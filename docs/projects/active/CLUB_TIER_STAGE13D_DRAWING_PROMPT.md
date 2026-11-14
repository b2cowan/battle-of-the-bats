# Club Tier Stage 13d · Hand-offs between people (DRAWING session first, build prompt after)

> Written 2026-11-13 (by `/tasks`, on the owner's request), after the 13c walk (§502) passed 53/53 and its copy was removed. Paste into a
> **fresh chat on `dev`**: `execute @docs/projects/active/CLUB_TIER_STAGE13D_DRAWING_PROMPT.md`
>
> **This is a drawing-and-ruling session, not a build session.** It changes no product code. The output is one published drawing (a
> Claude Artifact), the owner's rulings on the few things that are still open, and then a **build prompt** for 13d. Recommended model: Opus.
> Run `/ux` and `/design` before the hand-off. It touches no code, so it can run beside any build.
>
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) (the ladder at the 2026-11-05/06 entries,
> §11.2 rows R-F-03, R-F-09, R-F-10, and the status log). Hub of the earlier drawings: https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY (source
> [CLUB_TIER_STAGE13_JOURNEYS_HUB.html](CLUB_TIER_STAGE13_JOURNEYS_HUB.html)): the tab "Drawn: hand-offs" (tab 14) and the Asks tab (Asks 14, 15, 16).
> Standing rules: `docs/agents/design/NAV_STANDARD.md`. Mark each fact **[V]** (you opened it this session, with file:line or the shot's name)
> or **[H]** (handed to you here, unverified). Everything below is [H] unless marked. Branch `dev`; explicit pathspecs; ask before committing; never push.
>
> The facts below were gathered by a helper on 2026-11-13 and spot-checked by the writer (the ruled wording of Asks 14–16, the ladder row,
> and the 13c test that pins "no Ask for time button (13d)" were opened and match). **Everything else is a lead, not evidence.**

## What 13d is

The ladder's line: **hand-offs between people.** Several things in the club only work when one person does something for another, and today the
second person is told nothing, or told something untrue, or has no way to ask. The ladder row (hub `content.cjs` lines 239–243) says, verbatim:

> House league's time given → the league admin's bell and a true line on their season, with a door. No time → "Ask for time", which lands on the owner's and admins' This morning. The treasurer sees the schedule's fair shares and its draft bill on the budget line. A club tournament's Payments card opens its book for people who hold Accounting. The treasurer reaches house league money from the figures that include it. A coach's "how I paid" arrives as said.

Size on the ladder: **Medium**. Dependency: 13c (done, walked §502: "the notices live in the time path").

## What is already ruled: do NOT re-ask these

The owner ruled all 25 hub asks "as recommended" on 2026-11-06 (reported in conversation; no per-ask quote exists beyond this). Record them as ruled, nothing added:

- **Ask 14 A.** The league admin is told when time is given; with none, "Ask for time" lands on the owner's and admins' This morning; **only an owner or an admin gives** (a deliberate rule: time and money). B (the league admin hands house league its own time from a permit) and C (words only) were not chosen.
- **Ask 15 A.** The schedule bills; its draft shows on the budget line as "being billed (draft)", and New allocation warns on a line a draft holds. "Warns, never blocks" (Stage 6a). B (Accounting bills) and C (both doors) were not chosen.
- **Ask 16 A (keeps ruling B4, 2026-10-30).** A "This event in the club's book" line on a club tournament's dashboard Payments card, for people who hold Accounting. **No Accounting row in the tournament nav.**
- **13c C6 = A (2026-11-08).** The league admin's "in Schedules" is gone for anyone who cannot open Schedules; **13d adds the "Ask for time" button, with no names listed.** Option B (name the people) was not chosen.
- Also ruled: the treasurer reaches house league money by **links from the figures that include it**, not a nav row (hub "also" answer T5).

## What 13d covers (the findings; severity and source from the helper, verify each)

| ID | Sev | What is wrong | Status |
|---|---|---|---|
| F-O3-7 | High | After the owner gives house league time, the league admin gets no bell or email. | The *words* were built in fix-now (`2a33cc98a`); the **notice is 13d** |
| F-L4-1 | High | League admin can't generate games until the club gives time; the screen names no one and has no door; the owner is told nothing. | Ask 14 A |
| F-T2-4 | High | Nothing stops a double bill: a draft schedule bill reserves nothing; New allocation can bill the same line again. | Ask 15 A |
| F-O5-5 | High | A tournament says "payments aren't tracked here" while the club book holds $1,440 for it. | Ask 16 A |
| F-O3-4 | Med | A mixed schedule's Send dialog lists only rep coaches; nothing says whether the league admin is told. Direction: a House league line in WHO IS TOLD. | no ask |
| F-T2-3 | Med | The treasurer is told a schedule hands out the permit but can reach neither the schedule nor Fair shares. | draft-on-the-budget-line is Ask 15 A; **the read-only view itself is not an ask** |
| F-T5-7 | Med | The treasurer can read house league money but has no door to it from the figures that include it. | links, not a row |
| F-T3-1 | Low | The Accounting Overview's budget table has no line for house league fees ($2,355) or tournament money ($1,440). | no ask |
| F-T4-7 | Med | The coach's "Payment method" (how they paid: Card) reaches the treasurer as "How they'd like it: Card". | no ask |
| F-T4-10 | Med | The coach is told "approved" but not how or when they'll be paid. | no ask; **not clearly in the ladder prose** |

**Findings with a split or missing home (settle these in the drawing, with a recommendation each):**
- **F-T5-1** (the $1,740 families still owe house league appears nowhere in Accounting) and **F-O6-8** (the financial summary omits house league owed): the plan (§11.2) and the 13b prompt give them to 13d; hub theme 4 lists F-T5-1 under 13e; neither is in either ladder row's id list. 13b already put an "Owed to the club" tile on the owner/admin club band (team dues + live-season house league owing). **What remains is the treasurer's Accounting Overview.** Recommend a home and say it.
- **F-O6-5** (two "Outstanding" totals for one team): the plan says "13d; 13e", the ladder says 13e, the hub corrected it to **labelling, not money**. It is 13e's. Do not draw it; say so. The guard `tests/unit/club-money-one-definition-guard.test.ts` ("do not add a third owed query") stays.
- **F-L5-6**: the new season's time hand-off to the owner has no link or notice ("same as F-L4-1"). It is in no stage. It is F-L4-1's twin: draw it with 13d or say why not.
- **A registrar notice** when a league admin finishes the time (13a prompt line 197 says "(13d)"; nothing else does), and **the owner is not told when a league admin or registrar joins** (walk O1, no finding ID). Say whether each is 13d, later, or nothing.
- The league admin's **"Club time {h} · not divided"** tile on their season (`lib/league-morning.ts:9`) is called "the 13d hand-off" in the 13b prompt. Find out what that means now.
- **F-O2-15** (a coach is not told a schedule or bill is coming): the walk's direction was "owner's call; keep". Not 13d. Don't draw it.

## What is already built: do NOT redraw

- **Fix-now `2a33cc98a`**: the league admin's season line is true in three states (no time / given but not divided / divided). The *line and door* are built; what remains is the **bell/email on give** and the **Ask for time** button.
- **13a** (`2cebde79c`, `87ddc358e`, walk §475): the "not yours" screen, the Organization hub, house league leading for the league admin and registrar.
- **13b** (A `ebb2ca47c`, B `7d88d591d`): the club band's "Owed to the club" tile for owner/admin; the league admin's and registrar's This morning on the season page, with club time deliberately left out.
- **13c** (A `27e958f1a`, B `13e5f6085`, C `40e86b8dd`, walk §502 passed 53/53 on 2026-11-13): the Permits place, the Outside-the-permit notice, the Bill tile that opens Fair shares and the bill in a window, the league admin's sentence without "in Schedules". The treasurer **cannot open Schedules**; 13c's drawings said "the bill reaches them in 13d".
- **13i** and the Admin header (Phases 1–4): the sidebar's shape and the pinned bar. Don't redraw.
- **Also built since the ladder was drawn (the earlier tab-14 specimens predate these): "Send the bill" on a finalized schedule (`64bb5544d`, mig 481 dev only) and the late-bill money audience (`507f4505b`, `39eb59955`).** What "a draft bill" means after "Send the bill" is **unconfirmed**: settle it from the code before drawing Ask 15's "being billed (draft)".

## Why a fresh drawing round (and where I'd push back on skipping it)

Asks 14–16 are ruled and tab 14 already drew five specimens (the league admin's bell, the season line, "Ask for time", the treasurer's budget line with a double-bill warning, the tournament Payments card). A reader could say 13d needs no drawing. **Don't take that on trust either way.** Reasons it still needs a short round: (1) the club frame changed (13a, 13b, 13c, 13i, the header bar) since tab 14 was drawn; (2) "Send the bill" and the late-bill work changed what a draft bill is; (3) the **treasurer's read-only view of Fair shares and the draft bill (F-T2-3) has no drawing at all**, and the treasurer cannot open Schedules, so it needs a place; (4) the notice has a channel question (bell, email, both) and a wording question nobody has ruled; (5) F-T5-1/F-O6-8/F-L5-6/F-T4-10 have no ask. If after reading the code you conclude only (3), (4), (5) remain, **say so and draw only those**: keep the page small.

## Disagree out loud (settle these in the drawing, with a recommendation each)

- **The channel.** When time is given, does the league admin get a bell, an email, or both? "Ask for time" lands on This morning: for how long, and how does it clear (when time is given, when dismissed)? A new email to a person is a **/legal and CASL matter**: say in the hand-off what the email would be (transactional, to a signed-in staff member) and that `/legal` must review the words before the build hands off. Prefer the bell if the email adds nothing; recommend one.
- **Where the treasurer reads the draft bill.** Not Schedules (they can't open it). Draw the budget line's "being billed (draft)" and the read-only Fair shares view in two placements (on Allocations itself; a window from the budget line) and recommend one. Show the New-allocation warning on a line a draft holds, and **confirm it warns and never blocks**.
- **Is Ask 15's double-bill guard enough?** It guards the schedule→allocation direction. Confirm in the code whether billing part of a line from either side, or a schedule bill with no line, is also covered, or name the gap (F-T2-4's own text lists all three).
- **Who sees each notice.** Draw the owner, an admin **with** Accounting, an admin **without** it (Sam Okafor on the 13c copy was one), the league admin, the registrar, the treasurer. The "Payments card opens its book" line (Ask 16) shows only for people who hold Accounting: draw what the others see (nothing, not a dead link).
- **Phone.** Draw every new thing at 390 with the bottom bar and the More sheet. If a notice or a read-only view can't be one thing on a phone, say so and propose the phone's own shape.
- **Do not widen by accident.** The tournament dashboard's Payments card is the **tournament admin** portal: it is shared code or it isn't. Find out first, and say which portal each change touches. Nothing here reaches the Coaches Portal except F-T4-7 / F-T4-10 (the coach's own request screen): say that plainly. Keep the 2026-11-06 rulings that the coach owns the roster and dues (D1/D3) and that a club's money view of a team is the team's standing with the club.
- **The treasurer and the 12e question.** Stage 12 (families pay online) is not a 13d dependency. Do not bridge the club's bill to family dues.

## Steps

1. **Read** the plan's ladder and status-log entries for 13d, §11.2's three rows, the hub's tab 14 and Asks tab, `NAV_STANDARD.md`, the 13c build prompt's "Not in 13c" list and the 13c walk's results (§502 in the Owner QA Ledger), and the several-permits plan's §0 (it must not build until 13d is built and committed, owner 2026-11-13: it re-prices the bill that 13d puts on the treasurer's line; **it also says not to build over the New schedule and Bill windows while the late-bill money-audience work is in the working tree**: those files show modified in `git status` today; say what lands first).
2. **Settle the facts from the code** before drawing: what writes the bell today and who receives it; how "This morning" is built for owner and admin (13b), and whether a standing "Ask for time" row fits it; what a draft schedule bill is after "Send the bill" and what `billBlockers` / `lineAllocatedCents` (`lib/club-schedule-send.ts`) read; what the Accounting Overview's budget table is made of and what it would take to carry a house league line without a third owed query; what the tournament Payments card reads and whether it is shared with any other portal; how the coach's payment method is stored and shown to the treasurer.
3. **Re-open the evidence** for the High findings (F-O3-7, F-L4-1, F-T2-4, F-O5-5) on a **local production build** (`node .probe/p5-prodbuild.cjs start`, port 3100); never the :3000 dev server. Use a fresh Harbourtown copy (`.probe/nav-journeys/seed.mjs`, a new `navj-club-13d` slug) if you need one, and put real counts in the drawing. Remove the copy at the end.
4. **Draw** (Claude Artifact, not the design canvas; house layout: sticky numbered tabs, minimal scroll, an *Everything / Show only what differs* toggle; whole-screen before/after at true size; controls drawn from their shipped components; NEW / RESTYLED / UNCHANGED tags; every highlight clickable):
   - Time given → the league admin's notice and their season line; no time → "Ask for time" and where it lands for the owner and an admin; when it clears.
   - The treasurer's budget line with "being billed (draft)", the read-only Fair shares view, and the New-allocation warning.
   - The Payments card's "This event in the club's book" line, and what a person without Accounting sees.
   - The treasurer's door from house league figures; the Accounting Overview's house league / tournament lines (only if you settle F-T5-1 / F-T3-1 / F-O6-8 here).
   - The coach's "how I paid" as the treasurer reads it, and what the coach sees once approved (F-T4-7, F-T4-10): only if you recommend them in.
   - The same at 390, for the owner and the smallest-access person.
5. **Asks** for the owner: only what is genuinely open (the channel, the treasurer's read-only view placement, F-T5-1/F-O6-8's home, F-L5-6, the registrar notice, F-T4-10 in or out). Each with a recommendation and the alternative, numbered so the paste-back is short. **Do not re-ask Asks 14–16 or C6.**
6. **Run `/ux`, then `/design`** and apply what they find before publishing. Say in the hand-off what each changed.
7. **Publish** the Artifact once. Do not edit product code.
8. **Hand off in product-owner voice**: what a person sees and does differently, how it feels on a phone, the asks, and where 13d sits (after 13c, before 13e; before the several-permits build). Record one status-log entry in the plan with the Artifact link, **bring the plan's stale tail up to date** (it still ends at the 2026-11-09 walk publish: add the §502 pass, "Send the bill", and the late-bill audience work as facts with their commits), and add a 13d line to the TODO Stage 13 entry (TODO has none today).

## After the owner rules

Write the **13d build prompt** (`CLUB_TIER_STAGE13D_BUILD_PROMPT.md`): the screens, the guards (including re-pinning `tests/unit/club-scheduler-screens-guard.test.ts` "no Ask for time button (13d)", and keeping `club-money-one-definition-guard.test.ts` green), the help articles and demo-tour anchors that name a moved row or a changed notice, the `/legal` review before hand-off if an email is in, one QA walk (its own Owner QA Ledger section) and the staging layout sweep. Size is **Medium**: say how many sessions and which screens each touches, and sequence against the late-bill build and the several-permits build (13d first).

## Do not

- Build or edit product code. Redraw 13a, 13b, 13c, 13i or the header bar. Draw F-O6-5's labelling (13e) or "cancel this day across programs" (its own plan).
- Add a nav row for the club's book in the tournament admin (reverses B4), a nav row for the treasurer's house league money, or let the league admin give time (Ask 14 B).
- Invent a number: counts and heights come from the captures or the database.
- Record the owner's answers as anything but what they said.
