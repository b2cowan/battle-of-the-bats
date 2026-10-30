# House League Stage 9d-3, House league's families: the first practice notice and calendars: draw it (prompt)

> **Written 2026-10-29**, the day the 9d-2b Rules door walk (§422, 17 of 18) closed the last owed 9d-2b walk. 9d-3 was logged by
> the owner on 2026-10-27 ("did you make note to follow up on family notifications and calendar access and when to address
> that?") and placed **after 9d-2b is built, before 9e**. **Paste this into a new chat on `dev`.** Other sessions share this
> working copy (TODO, the plan, the PM brief and the QA ledger carry their edits): stage explicit paths only, and commit only your own
> hunks, and only when the owner says.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.
>
> **How to draw (owner ruling 2026-10-26, binding):** the drawings are **one published HTML-page Artifact with tabs and a
> written explanation beside every frame**, published by `file_path`. **Never** use the design canvas / the `design` quickstart /
> a Design artifact type, and never open an empty artifact "to fill later". Load `artifact-design` first. Frames at **true
> size**, a desk and a phone for each, with a whole-screen before/after.

## What 9d-3 is, and what is already ruled

The Stage 9 plan's row (`docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` §4, the 9d-3 row, ~line 394) reads: *the first practice
notice to a team's families (deferred from 9d2·2: a practice **change** already emails them); a house-league team's calendar to
subscribe to, for its coach and its families (Stage 6d built the feed for rep teams only, so a house-league coach or family has
none); what a family's own calendar carries (the public team page stays games-only, ruled; a private family feed is the question 6d
parked on its family view, which waits for counsel).* Size M. Its Asks column is "—": **nothing is ruled.**

**Ruled, do not reopen** (record each as ruled and add nothing it did not rule):
- **9d2·2:** a practice **change** emails the team's families. **9d2·13:** families hear about a **published game once, from the league
  admin's send**, never from the club's. **9d2·16:** what the club taking house-league time back does. 11b's **coach** practice email
  stands as drawn. The words of the family practice-change email are in `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`
  ("The families' practice-change email"; it says "until 9d-3, a family may never have been told the practice time").
- **The public team page is games only**, never practices or team events (owner decision; memory `decision_public_team_page_games_only`).
- **6d's rulings** (`CLUB_TIER_PRODUCTION_READINESS_PLAN.md`, "Stage 6d — Calendar feeds", ~line 2347 to 2440, and its ratification
  block): a coach's link is personal, revocable, checked against their place on the team on every read; the feed carries the
  recipe's words F1 to F10 (cancelled marked and "Cancelled · " in the title, "vs" / "@", "Arrive by 5:30 p.m. (Eastern time)", the
  team leads the title); **a team's feed is the live season only**; a stopped link answers with an empty calendar; the last read is
  recorded at most once a day; a four-hour refresh hint; **the family view's door waits for counsel** and was left untouched.
- **9c·10 / 9c·12 and Q12c:** the service-mode sender; automatic notices never count toward a cap; an automatic notice appears as an
  **Automatic** row in the season's sent history (9d1·4).
- **A season stays live until closed; a closed season is one page** (CLAUDE.md). A closed season has no feed and no notice to draw.
- **9d-2b is built:** a house-league coach's team page lists the team's schedule (games as families last heard them, and practices,
  from today on); practices are handed out per team from the time the club gave house league; Changes to send and Send the changes
  tell families.

## The facts the drawing rests on (leads, not facts: **re-open every row against the code before drawing on it**)

| Fact | Where to look | Consequence for the drawing |
|---|---|---|
| Stage 6d built a **coach** feed and a signed link, and a **public team page** Subscribe for the page's own address. Which of it reads `rep_team_events` only, and what a house-league coach or family gets today, is what the drawing has to establish. | `app/api/calendar/coach/[token]/route.ts`; `lib/team-calendar.ts`, `lib/calendar-subscribe.ts`, `lib/coach-calendar-link.ts`, `lib/calendar-feed-response.ts`, `lib/calendar-subscribe-words.ts`, `lib/export/ics.ts` | "Today" frames must be drawn from the real screens. The first frame answers: does a house-league coach already have any Subscribe, and what does it carry? |
| A house-league coach is a user with an account (Q7 coach accounts, built in 9c) and sees the team's schedule on the coach team page. | `lib/house-league-coach.ts`; `app/[orgSlug]/league/[seasonSlug]/team/[teamId]/` (`CoachSchedule.tsx`, `page.tsx`) | Where would a coach's Subscribe sit on that page, beside what, behind which control (the house rule: one Export, rare tools behind Tools)? |
| The families' practice-change email and the coach's practice email exist; the **first** practice message to a family does not. | `lib/club-schedule-league-words.ts` (the family email, `familyClose`), `lib/club-schedule-send.ts`, `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` | The first notice must read as the first one, and the change email must still stand on its own for a family who skipped it. |
| House league's practices are handed out per team from the club's time (Practice time), and **can change before anyone is told**. | `lib/league-practice-time.ts`, `lib/league-time.ts`, plan 11b notes | "First practice time" is not one moment: it is when the coach hands them out, when the league admin publishes, or when the first practice is a week away. Say which. |
| A family is a household with children on one or more teams; the Families engine batches per household. | `lib/families-email.ts`, `lib/house-league-email.ts`, `deliverFamilyEmail` | A household with two children on two teams: one notice or two? What does their calendar carry? |
| A "guardian switch" exists and 6d parked the family view behind it and counsel. | Readiness plan ~2395 to 2440; grep `guardian` | Find out what it is, and whether anything in 9d-3 needs it, before drawing a family door. |
| Whether a private per-household feed would need **new storage** (a token per household or child), and how it is revoked, is open. | 6d's Ask 1 and 8 (link storage, counter for Reset) | Cost: a family feed multiplies the readers of a team's feed by the size of the team. Reuse 6d's ratified answer to the server-cost question rather than reopening it. |

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper; a helper's summary is a lead, so open the cited lines
yourself; **disagree out loud**). Stage 9 plan §0, §3, §4 (9d-2, 9d-3, 9e rows), §5; `HOUSE_LEAGUE_STAGE9D2B_BUILD_PROMPT.md` (what
is built now); `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md`; the 6d section above; `docs/agents/design/TABLE_AND_LIST_STANDARD.md` and
`COACH_SURFACE_DESIGN_ADDENDUM.md`. The drawings you follow in shape and frame rules: `HOUSE_LEAGUE_STAGE9D2_DRAWINGS.html` and
`HOUSE_LEAGUE_STAGE9D1_DRAWINGS.html` (published links are in the Stage 9 plan's status log). House rulings that touch these screens
(check each against the code before drawing on it): a change that tells families is **held until ✓**; a window's foot has the
sentence left and the buttons right; one toolbar with rare tools behind Tools; a phone's secondary action is its symbol alone; absent
beats disabled; every highlight is clickable; one spelling, "8:00 a.m."; sport-neutral words; a coach's Subscribe sits behind the one
Export.

## Push back (out loud, on the drawings page, before the work)

1. **Does a family need a "first practice" email at all, once a calendar exists?** The honest options, with what each costs a
   volunteer convenor and a parent: (a) **no first notice**: the coach tells the team, the calendar carries the practices, and a
   change email still stands on its own; (b) **a first notice when practices are handed out** (one email per household, held until ✓,
   an Automatic row in the season's history); (c) **a first notice when the first practice is a set number of days away**, so a
   family hears once, late and right, and never about a time that then changed; (d) **the coach sends it** (their own email, not the
   league's). Recommend with reasons. Name what a family receives if a practice changes **before** the first notice has gone, and
   whether "first" is per team, per household, or per child.
2. **A family's calendar and the games-only public page pull against each other.** The public team page is ruled games-only, so a
   Subscribe there can never carry practices. A family who wants practices on their phone needs a private door. Draw the real
   choices and recommend one: (a) **games only, via the public page** (nothing new to store; practices stay out); (b) **a private
   per-household link** carried in the first notice (new storage, a Reset, and a reason to ask counsel: it names children and
   venues); (c) **a calendar file attached to the notice**, with no subscription, which goes stale, the exact problem 6d existed to
   end; (d) **coaches only for now**, with the family half parked behind counsel exactly as 6d parked the family view. Say plainly
   whether (d) is the right call, and what is lost by it.
3. **Is this one stage, or two?** The coach's Subscribe and a first notice use machinery that exists (6d's coach feed; 9d-1/9d-2b's
   sender). The family calendar waits on counsel and may need a migration. Argue whether 9d-3 should split (e.g. **9d-3a** the coach
   feed and the first notice, **9d-3b** the family calendar), and what the split costs in rework. Do not assume it is one build
   because the ladder row is one line.
4. **Who is told, and can they say no?** A family who unsubscribed from club news: does the first practice notice reach them? 9c·10
   and 9c·12 say a schedule *change* notice does, and never counts. Decide whether a **first** notice is the same kind of message
   (it tells them where to be) or a marketing-adjacent one. Name the precedent you rely on and what it was ruled for.

## What to produce

1. **One published Artifact**, an HTML page with **tabs** and a written explanation beside each frame (source
   `docs/projects/active/HOUSE_LEAGUE_STAGE9D3_DRAWINGS.html`; load `artifact-design` first). Before = today's real screens; after =
   true size; NEW / RESTYLED / UNCHANGED tags; clickable flags; one checkbox per option for each ask; a paste-back summary at the end.
2. **Frames:**
   - (a) **Today:** a house-league coach's team page and what it offers; a rep coach's Subscribe for comparison; the public team page's
     Subscribe; the family practice-change email as built; a family's inbox before any practice notice exists.
   - (b) **The coach's Subscribe** on the house-league team page (desk and phone), the Subscribe window, what the feed carries for a
     house-league team (practices and games, cancelled marked, the live season only), and Reset.
   - (c) **The first practice notice**, per push-back 1: when it is composed, the held-until-✓ preview the convenor sees (count of
     households it reaches, who is left out and why), the family's email (words provisional), and the season history's Automatic row.
   - (d) **The family's calendar**, per push-back 2: each option you recommend against or for, drawn as the family would meet it.
   - (e) **Edges:** a household with two children on two teams; a practice that changed before the first notice; a team with no
     practices handed out yet; a family with no email; a family who unsubscribed; a finished season (one page, nothing to draw: say so);
     a coach removed from the team (their link empties, 6d's rule).
   - (f) **The gate:** who may send the first notice and who sees a Subscribe: owner, admin, league admin, registrar, treasurer, coach,
     family. Point at `docs/agents/strategy/PLAN_PRICING_FACTS.md` for plan gating, never restate it.
3. **Words:** provisional, marked provisional. Final words go through `/marketing` **after the owner rules**, before any code.
4. **Flow + design:** run `/ux` on the journeys (a convenor handing out practices and telling families; a coach subscribing; a parent
   learning the practice time and, later, a change; a parent with two teams). Run `/design` on the whole page **before the hand-off**,
   apply its fixes, republish, and report what it changed.
5. **Asks:** numbered, each with a recommendation. Ask 1 = whether and when a first notice goes (push-back 1). Ask 2 = what a family's
   calendar carries and by what door (push-back 2). Ask 3 = the split into builds (push-back 3). Ask 4 = who is told and the opt-out
   rule (push-back 4). Ask 5 = the coach's Subscribe: placement, what it carries. Then any the frames raise.
6. **Build notes, not asks** (on the page, so a build prompt carries them): any migration for link storage (dictionary + snapshots in
   the same unit of work); the feed is the live season only; automatic notices write the season's history as Automatic and never count;
   the build must be reachable by a Codex session from the page alone.
7. **Records, same unit of work:** the Stage 9 plan's §4 9d-3 row and status log ("drawn, asks open", the link), the PM brief, the
   auto-memory file `project_club_stage9_house_league.md`, and the Club Tier project index if it still carries an `s9` entry (read it first,
   pin `if_version`; say `ruled` only after the owner rules). Record rulings as ruled.

## Do not

- Build, migrate, seed, or touch AWS or DNS.
- Use the design canvas, or publish an empty artifact.
- Reopen 9d2·2, 9d2·13, 9d2·16, the games-only public team page, 6d's rulings, 9c·10 / 9c·12, or Q12c. Push back only where a frame
  exposes a real conflict, and name the conflict.
- Draw game day, scores, standings or the rainout (9e), season end or Start next season (9f), or the family app.
- Decide anything counsel should: a family file or a private feed naming children is a question for counsel, so draw it, mark it
  "waits for counsel", and do not rule it.
- Add `module_families` to any role's defaults. Restate a plan name, price or gate. Promise timing anywhere.

## Definition of done

The drawings page is published and linked from the plan. `/ux` and `/design` have run and their changes are reported. Every frame in
item 2 is drawn in its empty, working and edge states. Asks 1 to 5 are answered with a recommendation, and the page says whether 9d-3
is one build or two and in what order. The records say "drawn, asks open". A 9d-3 build prompt can be written from the owner's answers
without re-deciding anything or redrawing a screen.
