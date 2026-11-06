# Club Tier Stage 13 · Fix now: eight defects that make a sentence or a button true (build prompt)

> Written 2026-11-06, after the Stage 13 hub was published and the sidebar review added 13i.
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10 (status log).
> Hub (walk, ladder, findings, captures): https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY — tab 10 "Not navigation" holds this list,
> tab 11 the ladder. Hub source is rebuilt from `.probe/nav-journeys/hub/content.cjs` + `build.cjs`; never edit the html.
> Walk evidence: `.probe/nav-journeys/VERIFY.md` (session 3 confirms each High), the per-journey walk files beside it, captures in
> `.probe/nav-journeys/shots/`.
> **No drawing session.** Nothing here changes a screen's shape; each item makes an existing screen tell the truth. Reshapes start at 13a.
> One session. Recommended model: Opus (item 2 is auth + data loss, item 3 is the schedule engine). Branch `dev`, explicit pathspecs.
> Mark each fact you rely on [V] (opened this session, file:line) or [H] (handed over). Everything below is [H 2026-11-06]: a helper
> read the code and the parent re-opened items 2, 3 and 8 first-hand. Line numbers drift; re-open before editing.

## Owner rulings this build carries

- **Ask 23 (2026-11-06, as recommended):** the fix-now list runs as one small session before 13a, each item with its guard.
- **Dome default (2026-11-06, as recommended):** a blank club schedule **keeps "1 practice per team, per day"** (it prevents
  back-to-back sessions), and the form **tells the truth** about what that leaves open, beside the setting. Not "derive it from the
  permit", not "ask for it".
- **Even split is not an owner choice.** "Evenly" already promises an even split; the engine breaks it (item 3). Fix the engine to
  keep the promise. Do not add a new fairness option.
- **13i is not this build.** Only the double highlight (item 8) is pulled forward. Do not touch the sidebar's shape, chevrons or the
  lone "Seasons"/"Site editor" rows — Ask 25 decides those, after a drawing session.

## Before any code: the plain-language summary (required, blocking)

Present a product-manager summary in the conversation first: per item, what the person sees differently, who (owner / admin /
league admin / registrar / treasurer), and what doesn't change. Then build.

## The eight

### 1 · The setup checklist never lets a club owner go (F-O1-10, High)
**Today:** a Club owner lands on the setup checklist at every sign-in. The landing resolver sends a Club owner to onboarding while
the org's onboarding-completed mark is empty (`lib/user-contexts.ts` ~492-499); only the legacy tournament wizard ever sets it
(`app/api/admin/org/complete-onboarding/route.ts`, called from `app/[orgSlug]/admin/onboarding/page.tsx`). The club checklist
(`components/admin/kit/club/ClubSetupKit.tsx`) never calls it, ignores the `allDone` its API returns, and its only exit is a plain
"Go to Overview" link whose hint promises "You can come back to this checklist from Overview at any time".
**Fix:** the checklist marks setup finished (a) when every step is done and (b) when the owner presses "Go to Overview" (the
resolver's own comment already treats leaving as "dismissed"). Make the link a button that marks, then navigates; ignore a failed
mark the way the legacy page does. The Overview's "Setup: n of 5 · Continue setup" row reads the checklist, not the mark, so the
"come back from Overview" promise stays true — confirm [V].
**Guard:** extend `tests/unit/club-stage1-screens-guard.test.ts` (checklist calls the completion route) and add a club-owner case
(mark empty vs set) beside the fixture in `tests/unit/plan-billing-stage3-routing.test.ts` (~72).
**Watch:** the mark is also read by the Founding Season first-run offer (`lib/founding-season.ts` ~98; offer closed 2026-10-26),
the onboarding-plan route (409 once complete), `AdminHubClient` and the legacy wizard guards. Expected low risk for a Club owner —
confirm each [V] and say so in the hand-off.

### 2 · Removing a member who is also a parent deletes their family sign-in (F-A5-10, High)
**Today:** the member DELETE (`app/api/admin/members/[memberId]/route.ts` ~163-235) keeps the account only if the person belongs
to another org or holds a free Coaches Portal team; otherwise it deletes the auth user. A parent's `family_links` rows survive
(`ON DELETE SET NULL`) but are orphaned: the parent can no longer sign in to see their child. [V 2026-11-06: the check at ~166-178.]
**Fix:** the keep-the-account check also counts the person's family links (status not declined/revoked; any club — a link anywhere
means the account has another use). Put the counting in ONE shared helper used by both the DELETE and the GET that feeds the
dialog's "the account is kept" wording (GET ~76-100; `ManageMemberDialog.tsx` ~542-549), so the wording and the behaviour cannot
drift. Add the reason to the audit payload. The "your access was removed" email stays correct (the account survives) — confirm [V].
**Guard:** `tests/unit/club-stage1-server-guard.test.ts` already reads this route as source; assert the keep-branch includes family
links and that GET and DELETE call the same helper. A unit test for the helper's decision table if it is pure.
**Watch:** auth and data loss. This only turns some deletions into membership-only removals (an existing, tested path). Coaches are
refused earlier. Check `docs/agents/db/DATA_DICTIONARY.md` needs no change (no schema change expected).

### 3 · The dome schedule's even split isn't even (F-O2-5, High)
**Today:** the walk's dome permit (25 Sundays × 18 slots = 450, 7 teams, Evenly) drafted 47 slots, the first teams in the list
taking almost all. Two causes [V 2026-11-06]:
- `apportionDeficits` (`lib/club-schedule-engine.ts` ~621-637) hands each week's slots out **in team-list order**, whole parts first,
  capped only by deficit — it hands the first teams quota they cannot place.
- A blank schedule starts at 1 practice per team per day (`lib/club-schedule-form.ts` ~51). On a one-day-a-week permit a team can
  place at most 1 a week, so the first teams' quota is mostly unplaceable and the rest get nothing, week after week.
- The form's step-1 footer still says "450 slots for 7 teams. Nothing left open." (`closingNote`, `lib/club-schedule-view.ts`
  ~270-278) — false at 1 a day: the ceiling is 7 × 25 = 175.
**Fix (engine):** (1) replace the list-order whole-part pass with a water-fill — one slot at a time to whoever is most behind, ties
by list order, each capped; (2) cap each team's weekly quota at what it can actually place that week (per-day cap × the days it can
use, or its eligible seats), passed into the caps where `needsFor` (~736-775) builds them, so seats a team can't use go to teams that
can. Expected on the walk's dome: every team ~25, the gap between teams ≤ 1, total at the 175 ceiling. The "A set number a week"
method is untouched.
**Fix (words, ruled):** the footer stops saying "Nothing left open" when the per-day setting caps it, and says the truth beside the
setting, e.g. "At 1 a day, 7 teams can use 175 of the 450 slots." Raising the setting updates it. One spelling of every word
(`npm run check:spelling`); build the sentence in `lib/club-schedule-words.ts` with the other schedule words.
**Not this build (13c):** the drafts' "7 teams short: …" warning saying *why* and linking to the setting; Permits as a door.
**Guard:** extend `tests/unit/club-schedule-engine.test.ts` (it has `domeInput()`, the one-a-day test ~283, Evenly cases): a
dome-shaped fixture (one day a week, 18 slots, 7 teams, Evenly, 1 a day) → max−min ≤ 1 and total = 175; at 3 a day → all 450.
Unit-test the footer sentence. Run the whole engine suite: exact-count tests may shift — explain any that do, never re-pin blindly.
**Watch:** the shared engine for rep-club and dome schedules (house league's time is cut elsewhere). Weighted ("percentage") shares
and sharing pools also pass through `apportionDeficits`; add one weighted case so the water-fill keeps the weights.

### 4 · "The club hasn't given this season any time yet" after it has (F-O3-7, High)
**Today:** the season route (`app/api/admin/house-league/seasons/[seasonId]/route.ts` ~75-83, ~149-152) counts time as given only
once the league admin has divided it into a division's games or practices. Time the club gives to house league is stored elsewhere
(the schedule slot's program, `lib/league-time.ts` header), so between "given" and "divided" the line is false. Its second sentence
sends a league admin to Schedules, a page they can't open (`lib/house-league-start-from.ts` ~330-336).
**Fix (words and condition only):** "given" is true when house league holds any upcoming final time in the season — reuse the set
the time window uses (`houseLeagueSlotRows`, `lib/league-time-server.ts` ~45) as a **head count**, not a page-through (this runs on
every season read). Three states: no time ("Ask an owner or an admin to give house league time." — no link to Schedules for roles
that can't open it); given but not divided (a sentence with a door to House league's time, for the roles that can divide it); divided
(no line). **The notice to the league admin is 13d**, not this build.
**Guard:** `tests/unit/house-league-start-from.test.ts` (~222 pins the words) + a source assertion in
`tests/unit/house-league-season-page.test.ts` that the route reads the program's time.

### 5 · Browser tab titles carry a tournament's name on club pages (F-R2-2 / F-A2-9 / F-O5-8, Low)
**Today:** `app/[orgSlug]/admin/AdminTitleManager.tsx` ~64-72 always adds the last-chosen tournament's name, so every house league
page reads "House league - Harbourtown Invitational 2026".
**Fix:** add the tournament name only on tournament routes. Extract the title-building into a pure function so it can be tested.
**Guard:** unit test: house league and Organization paths with a tournament chosen → no tournament name; a tournament path → name.

### 6 · Stray spaces in the Overview's Organization row (F-NAV-1, Low)
**Today:** "Organization : members , plan & billing (8 of 15 teams) , settings" — each piece is its own flex item with a gap
(`components/admin/kit/club/ClubHubKit.tsx` ~387-394, `.quietItem` in `ClubKit.module.css` ~62).
**Fix:** wrap the text after the icon in one inline run, as the other quiet rows are. Check desktop and phone (`check:layout
--changed` on the Overview only).

### 7 · A rep team's page looks stale after "Start next season" (F-O4-3, Med) — reproduce first
**Today:** the code already reloads the team after Start next season (`app/[orgSlug]/admin/rep-teams/teams/[teamId]/page.tsx`
~372-383, no cache found). Likeliest cause: the window closes and the banner shows **before** the reload lands, and the walk's
capture fell in that gap. VERIFY.md does not confirm this one.
**Do:** reproduce on a copy fixture (wait 2–3 seconds). Either way, keep the window busy until the new season is on screen (reload
before closing and before the banner); the same order applies to Close and the first-season window. If it still shows stale after
that, look at the deferred-load generation (`RepKit.tsx` ~321) and report before widening.

### 8 · Two sidebar rows highlighted inside a house league season (new, found 2026-11-06)
**Today:** inside a season both "Seasons" and the season page row are lit. The Seasons row carries an `also` path for every season
page (`lib/admin-kit-nav.ts` ~150) [V 2026-11-06]; there is no page at `/house-league/seasons` itself, so the `also` exists only to
light the row inside a season. Rep teams do not double (their Teams row has no `also`).
**Fix:** remove the `also`; the full rail and the collapsed strip's menu both read the same link. Nothing else about the sidebar.
**Guard:** in `tests/unit/admin-kit-nav.test.ts`, beside the rep-team case (~208-216): the Seasons row is not active on a season
page and is active on `/house-league`.

## Done means

- Each item's guard written and green; `npm run verify:changed`; `npm run typecheck` (items 1, 2 touch auth/routing and shared modules).
- `/simplify` if a new shared helper landed (item 2's, item 5's), then `/review`.
- `/docs`: items 1 (the checklist now lets go), 2 (the removal dialog's wording) and 3 (the footer sentence) change what a customer
  reads — offer it.
- A QA walk as a checkable Artifact, its own § in the Owner QA Ledger, ONE PURPOSE: "the eight fix-now defects are gone", one block
  per item, on the walk's fixture copies where a step changes data. Nothing that emails a family is pressed.
- Plan §10 status line and the TODO line updated with the positive fact ("built <date>", "committed `<hash>`"). Commit only when the
  owner says so; explicit pathspecs; `git show --stat HEAD` after.
- Rebuild the hub's tab 10 so the eight rows read "Built" with the walk's §, and republish to the same link.
