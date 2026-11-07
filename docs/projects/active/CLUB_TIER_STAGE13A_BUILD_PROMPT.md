# Club Tier Stage 13a · Doors by person (build prompt, two sessions)

> Written 2026-11-06, after the fix-now work committed (`2a33cc98a`) and the owner ruled all 25 hub asks as recommended.
> Plan of record: [CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §10 (status log).
> Hub (walk, ladder, findings, captures): https://claude.ai/artifact/1G7m1CwSX7d3V8Cv2k1AQY — tab 15 "Not yours" is the drawing for
> Asks 6 and 7; tab 11 the ladder; the Asks tab holds the four rulings below. Hub source: `.probe/nav-journeys/hub/content.cjs` +
> `build.cjs`; never edit the html. Evidence: `.probe/nav-journeys/VERIFY.md`, the walk files in `.probe/nav-journeys/walks/`
> (NAV, R1, L1, T1, A5, O1, R2), captures in `.probe/nav-journeys/shots/`.
> Marks: **[V]** = opened this session by the planner (file:line); **[H]** = handed over by a helper, **re-open before editing**.
> Line numbers drift. Branch `dev`, explicit pathspecs. Recommended model: Opus (auth guards, nav shared by every club role).

## What 13a is

**One rule: one list of doors per person, used by every surface.** A person is shown the doors they hold, a page that isn't theirs
says so in one voice, and the two people whose whole job is house league see house league first. Nothing here changes how the
sidebar is shaped (that is 13i — Ask 25, its own drawing session; do NOT touch chevrons, groupings, lone rows or the rail's length).

## Owner rulings this build carries (all 2026-11-06, as recommended)

- **Ask 6 = A.** A page that isn't yours is always ONE in-frame screen: what the page is, who opens it (by name), and a door back
  to your own home. Not a silent return, not a one-line notice.
- **Ask 7 = A.** The Organization hub shows only doors the person holds; a person with one door goes straight to it. Locked rows
  stay for admins, name the owner ("Ask Morgan Ellis"), and stay only where the section holds nothing else.
- **Ask 8 = A (exception to N10).** For the league admin and the registrar, House league is a lead row and takes the phone bar's
  third slot even before a season exists. N10 itself is unchanged for everyone else (the owner, admin and treasurer).
- **Ask 9 = A.** The header pill reads "View site"; the foot door goes wherever the pill exists; the live site's way back gets a label.
- **R1 (the "also" row tagged 13a):** a registrar sees who runs the board, **names only** — it answers "who creates the season?".
- **Decisions already standing, do not reopen:** J10-016 (locked rows for admins), D1 (never draw a view into a coach's books),
  N10 for everyone not named above, the 2026-10-20 phone-site-button ruling.

## Before any code: the plain-language summary (required, blocking)

Present a product-manager summary in the conversation first: per item, what each of the five people sees differently (owner /
admin / league admin / registrar / treasurer) and what does not change. Then build.

## Split: two sessions

- **Session A — "Not yours": one screen, honest hubs (Asks 6, 7).** Items A1–A6. Server guards + the Organization hub + the Overview's
  Organization section + empty states. Drawn already (hub tab 15).
- **Session B — "Yours": the leads, the count, the site label (Asks 8, 9).** Items B1–B5. Nav + phone bar + Overview cards + a count.
  **Uses shipped components only** (see "Not drawn" below).
- A before B (B's registrar Overview card links into doors A decides). Each session ends with its own `/simplify` → `/review` → `/docs` offer,
  and ONE walk for the whole stage after B (§ in the Owner QA Ledger, one purpose: "each person sees only their doors").

---

## Session A

### A1 · One "not yours" screen (Ask 6; F-NAV-12 Med, F-A5-9 Low)
**Today [H, spot-checked]:** about eight wordings, no shared helper.
- Silent server `redirect()` to the Overview: Families (`families/layout.tsx` ~27-29), Accounting (`accounting/layout.tsx` ~33-35), Rep
  teams (`rep-teams/layout.tsx` ~28-33). Rep-team sub-pages add their own "Access restricted" card (`rep-teams/past/page.tsx` ~55-62,
  `rename-slugs`, `teams/[teamId]/history`, `history/[yearId]`).
- "Access restricted … Ask the owner." Public site (`public-site/page.tsx` ~441-451; words in `lib/public-site-words.ts` ~125-126).
- "You don’t have access to this page." House league (`house-league/page.tsx` ~77-83; season, money, registrations, teams, email pages;
  words in `lib/house-league-money-words.ts`, `lib/house-league-teams-screen-words.ts`, the registrations and email word sets).
- A page with no heading: PDF settings (`org/settings/pdf/page.tsx` ~150-160 returns only a callout).
- Owner-only refusals with their own voice: Settings (`SettingsKit.tsx` ~163-173), Plan & billing (`BillingBody.tsx` ~544, words
  `lib/plan-billing-words.ts` ~80-81), Audit log (`AuditLogKit.tsx` ~96-102), Members (`MembersKit.tsx` ~150-158); and a bare 404 for
  an admin who types the Audit log address (F-A5-9). "Nothing to show" on Schedules and Calendar (F-NAV-12).
- Three duplicated `.accessDenied` CSS blocks (house-league, public-site, rep-teams modules).
**Fix:** ONE component (the kit's, beside `EmptyCard`) rendered **inside the admin frame** with: a heading naming the page ("Families"),
one sentence saying who opens it, a button back to the person's own home (the landing the role resolves to — reuse the resolver the
sign-in uses; do not hard-code Overview, the league admin's home is House league). Words in ONE words file; one spelling of every
word (`npm run check:spelling`).
**"By name":** the sentence names the owner ("Morgan Ellis opens this") and the role in plain words ("or an admin"); it does not list
admins' names (there can be many). Find or add the owner's display name on a payload every role already reads (the club brief is the
natural place) — **names only, never an email**. If a club has no named owner, say "the club's owner".
**Replace, don't add:** the three silent redirects become the screen; the callout-only and bare-404 pages become the screen; the
duplicated CSS blocks go. A server layout that today redirects must now render the screen in its place (same decision, server side —
the page's data routes must still refuse, and they already do: 403 per VERIFY.md).
**Not in this item:** a page that does not exist (a real 404 stays a 404); the plan-gate "not on your plan" cards (they say something
different — `W.noSiteOnPlan` and the "In League Plus and Club" teaser stay as they are).
**Guard:** a unit test that every guard site renders the shared component (source assertions listing each layout/page), and that the
old wordings ("Access restricted", "You don’t have access to this page") no longer appear in `app/` or `components/` outside the one
words file; a test for the sentence builder (named owner / no owner).
**Watch:** a layout that rendered children only after the redirect check — make sure the screen replaces the **children**, not the
shell, so the nav still shows; a team-limited coach's Families refusal (`lib/families-access.ts`) must keep refusing the same people.

### A2 · The Organization hub shows only doors the person holds (Ask 7; F-NAV-7 High, F-NAV-8 Med, F-T1-6 Med, F-R1-5 Med)
**Today [V 2026-11-06, `app/[orgSlug]/admin/org/page.tsx` 31-81]:** the **Members** and **Tournaments** tiles are built with no role
check, so a registrar, league admin or treasurer who reaches the hub is offered Members (refused: "Members isn’t turned on for you")
and Tournaments (opens a tournament admin shell whose Dashboard says "Couldn’t load the dashboard", Teams/Schedule/Settings empty).
PDF settings and Plan & billing/Settings are already gated (owner/admin; owner). [H] The Organization rail row only shows when the
person has an org door (`kitOrgLinks`), so the hub is reached mostly by typing the address or by the phone's More sheet — check which
roles' navs link to it [V needed] and say so.
**Fix:** build the tile list from the same capability checks the rail already uses (`kitOrgLinks`, `canSeeMembers`, `canOpenModule(…
'module_tournaments')`), not a second list. The hub's tiles are the SAME doors the rail's Organization group lists: **one list of
doors per person**. A person left with ONE tile goes straight to it (a server redirect that carries no loop); a person with none sees
the A1 screen. Locked rows are NOT added here (the hub never had them for non-owners).
**F-O1-15 (Low):** the owner's hub gains the **Audit log** tile it omits; the Tournaments tile stays where it is for the roles that
hold tournaments (13i decides whether it belongs under Programs — do not move it here).
**Guard:** extend `tests/unit/club-stage1-screens-guard.test.ts` (hub doors only where they open; its locked-row regex stays) and
`tests/unit/admin-kit-nav.test.ts`: a table of role × tile for owner, admin, league admin, registrar, treasurer built from the shared
door list; assert the hub file reads that list rather than listing tiles by hand.

### A3 · The Overview's Organization section, and the locked rows (Ask 7; F-NAV-10 Low, F-NAV-4 Low)
**Today [V `components/admin/kit/club/ClubHubKit.tsx` 418-445]:** the section shows for any non-owner who sees Members or is on a
club plan; locked rows read "Plan & billing" / "Settings" with a chip "Owner only". A registrar or treasurer with no door sees a
section holding only two locks.
**Fix:** (1) the section appears only when it holds something other than locks, **or** the person is an admin (J10-016: admins keep
their locked rows); (2) locked rows say who: the chip reads **"Ask Morgan Ellis"** (A1's owner name); aria-label follows ("Plan & billing,
the owner's"); (3) a registrar, league admin or treasurer with a Members door sees only that row.
**Guard:** the Overview guard (above): role × row table; the chip wording from the words file; "Owner only" no longer appears as a chip.

### A4 · The registrar sees who runs the board, names only (ALSO row R1; F-R1-2 High, CONFIRMED)
**Today:** a brand-new club's House league › Seasons says "No seasons yet … Create one to get started." with no control, to a registrar
who cannot create one, and the board list (Members) is closed to them.
**Fix:** that empty state, for a person who cannot run a season (`houseLeagueAccess(...).run` false — the registrar; the league admin
CAN run [V per plan §1; `lib/house-league-access.ts` runners = owner/admin/league_admin — re-open to confirm]), reads: who creates the
season (the owner/admin/league admin **by name**, roles in words) and that registrations arrive once it exists. Names and roles only,
read through ONE small server read that returns display name + role for the people who can create a season, available to every role
with house league access. **No emails, no phone numbers**, no other board members.
**Guard:** unit test the read's shape (no email field); source assertion that the Seasons empty state branches on `run`.
**Note for the hand-off:** this shows staff names to a staff role inside the same club (no new data collected, nothing sent); say so,
and offer `/legal` only if the owner wants it checked — it is not a new collection.

### A5 · "Start a season" is offered only to people who can start one (F-R1-4 Med, half of F-L1-5)
**Today [V `ClubHubKit.tsx` 373-385]:** the quiet row "House league: not running · Start a season" is built from the plan's "also on
your plan" list, filtered only by "can open". The registrar is told to start a season; the link lands on the empty Seasons page.
**Fix:** the link shows only when the person can run a season; otherwise the row names who can (A4's sentence, shorter). Same for
"Tournaments: none yet · Run a tournament" — check who can run a tournament and apply the same rule.
**Guard:** the Overview guard: the Start-a-season link is gated on `run`.

### A6 · Treasurer's Accounting empty states (F-T1-5 Low)
**Today:** Accounting › Teams ("A team appears here once the club adds it in Rep teams.") and Allocations send the treasurer to Rep
teams, a page they cannot open.
**Fix:** for a person who cannot open Rep teams, the sentence says "Ask the owner or an admin to add it." (A1's phrasing; no link).
**Guard:** source assertion that the link is gated by the same Rep-teams door check.

---

## Session B

### B1 · House league leads for the league admin and registrar from day one (Ask 8; F-L1-2 Med, F-R1-3 Med)
**Today [H]:** `lib/nav-tiles.ts` (N10, `clubPhoneNav` ~43-73): House league fills a tab/tile only once the club **runs** it
(`shape.runsHouseLeague`; the server's `orgRunsHouseLeague` in `lib/board-roles.ts` ~56-70 is true on a League plan or once a season
exists; `app/api/admin/club-brief/route.ts` ~98-108). Before then it sits in `alsoOnPlan`: the desktop rail shows it under "Also on your
plan" (`AdminKitRail` ~283-290), the phone bar is Overview · Calendar · More, and the registrar's home has no program section.
**Fix (the exception, written as one rule):** for a person whose **only** module is house league (league admin, registrar — decided by
their capabilities, NOT their role label), house league counts as run for the purpose of the nav shape. Implement it where the nav reads
`runsHouseLeague` (one place — the hook all surfaces share, `components/admin/kit/useAdminKitNav.ts`, plus the club brief's
client fallback `ClubBriefProvider` ~96-99), not in each surface. Everyone else's N10 is unchanged: assert the owner's and admin's bar on
a club with no season is still unchanged.
**Also:** that person's Overview gets the House league **program card** — the same "Your programs" row component the owner's
Overview already uses (`ClubHubKit`), with the sub-line from the brief (waiting count — B2; "no season yet · {owner name} creates it" —
A4's sentence). No new component shape.
**Doc:** `docs/agents/design/NAV_STANDARD.md` N10 gets the exception, with the date and the reason, in this session.
**Guard:** `tests/unit/nav-standard-guard.test.ts` (the N10 cases ~207-250): a role × plan × season-state table; league admin and
registrar with no season → House league is a tile/lead; owner and treasurer with no season → unchanged.

### B2 · The registrar's waiting count, shown where the registrar looks (F-NAV-9 Med, F-R2-1 Low) — **fix the count first**
**Today [V]:** `app/api/admin/attention-summary/route.ts` ~55-59 counts `league_registrations` with `status = 'pending'`, but the real
waiting state is `pending_review` (`lib/types.ts` 937-938: `'pending_review' | 'active' | 'waitlisted' | 'declined' | 'withdrawn'`).
**So the Overview's "League registrations · waiting for review" line cannot ever show.** The same slip was found and fixed for tryouts
on 2026-09-25 (lines ~95-97 of the same file). It also counts only seasons in `registration_open`. [H] The House league rail row shows
NO count: `PROGRAM_COUNT` in `ClubBriefProvider` ~150-152 has only accounting; inside a season the Registrations row and each season row
show `pendingReviewCount` (`lib/db.ts` ~2974, counts `pending_review`).
**Fix:** (1) ONE server read — the number of `pending_review` registrations across the club's seasons that are open or running
(decide the set once; same one the season rows use) — used by the attention summary, the club brief's new house-league count, and
the Overview tile, so the tile, the rail pill and the season rows cannot disagree; (2) the House league rail row, the phone bar's
House league tab/tile and the program card show that count for anyone who can review registrations; (3) the amber badge stops hiding
the number: the club admin kit's count shows the real number up to 99 and "99+" after (rail row, Registrations tab, phone bar — one
shared formatter in the kit; the coaches portal, chat and notification badges are NOT touched).
**Why first:** without (1) the pill shows 0 for ever and B2 would pass its own tests while showing nothing.
**Guard:** a unit test on the read's status literal (source assertion: no `'pending'` for `league_registrations`); the formatter's table
(9, 10, 15, 99, 100); the brief's key; a source assertion that the three surfaces read the one count.
**Watch:** `/api/admin/club-brief` is hot (every club screen) — one cheap head count, not a page-through. Say what it costs.

### B3 · "Public site", twice (Ask 9; F-NAV-5 Med)
**Today [H]:** for every non-owner the header pill (`AdminEventHeader.tsx` ~171 → `lib/use-admin-flip.ts` ~102-107, label from
`lib/flip-twins.ts` `siteLabel` ~176) and the sidebar foot door (`AdminKitRail` ~340-344; phone `AdminKitBottomNav` ~363-367) both say
"Public site" and go to the live site. For the owner the pill goes to the live site and the sidebar row to the editor, both named
"Public site". On the live site the way back is an icon-only door (`components/public/ClubBar.tsx` ~55, ~104; label words in
`flip-twins` ~502-509).
**Fix:** (1) on the club's own admin screens the pill reads **"View site"** (the pill's label only — tournament pages keep "Preview
site"/their current words; `siteLabel` is shared, so change it for the club-admin case and keep every other caller); (2) the foot door
is shown only where the pill is NOT (no second door to the same place; the owner's sidebar "Public site" editor row is unchanged
— rename it only if the Ask 9 drawing on the hub shows a different word; **re-read the hub's Ask 9 text before building, the planner
reads "foot door goes wherever the pill exists" as "no duplicate"; if the drawing shows otherwise, stop and say so**); (3) the live
site's way-back door shows a visible word ("Admin" / "Coaches Portal" / "Roles" — the existing labels) beside the icon wherever there is
room, and keeps its accessible name; on the narrowest phone width it stays icon-only.
**Guard:** the nav guard (foot door vs pill); a table test for the pill's label (club admin vs tournament vs preview); the live-site
bar's label source assertion.
**Watch:** help articles and the demo sandboxes quote "Public site" — grep `lib/help-content/*.tsx` and the demo tour files for the
pill's wording; `/docs` updates the guides, and the demo tour fails the build if a destination or anchor goes (that is the only demo
signal; do not add "re-read" notes to the demo files). Run `npm run check:layout --changed` on the live-site bar (desktop and phone).

### B4 · Not drawn, on purpose
Three visuals here are new **uses** of shipped pieces, not new shapes: the House league program card (the owner's own card), the
waiting count pill (the rail's own count pill), and the live-site bar's label (one word beside an icon that exists). They are not
redrawn. **Say so in the hand-off and ask the owner to look at these three first in the walk.** If the labelled door does not fit at
phone width, stop and report; do not widen the bar.

### B5 · What Session B must not do
No change to how the sidebar groups, folds, highlights or measures (13i). No new "Permits" row (13c). No registrar notice when a
league admin finishes the time (13d). No change to Calendar's "Nothing to show" beyond A1's screen.

---

## Done means (both sessions)

- Each item's guard written and green; `npm run verify:changed`; `npm run typecheck` (A1, A2 and B1 touch server guards and the shared
  nav). Run `npm run check:spelling`.
- After each session: `/simplify` (A1's component and B2's one count are new shared pieces), then `/review` (high-risk tier: auth guards).
  `/docs` after both: help guides that name the hub's tiles, the locked rows, the site pill, the registrar's first screen.
- **One QA walk** as a checkable Artifact, its own § in the Owner QA Ledger, ONE PURPOSE: "each person sees only their doors". One part
  per person (owner, admin, league admin, registrar, treasurer); each part: sign in on a **fresh copy** of Harbourtown (make it with
  `.probe/nav-journeys/seed-navj-base.mjs --slug=navj-club-13a`; remove it with a teardown like `.probe/nav-journeys/fx-teardown.mjs`
  after the owner says the walk is done — re-point its slug constant; never touch `navj-club`, `navj-fresh`). Steps: the hub, a link
  they cannot open, the first screen, the phone bar, the pill and the live site's way back, the registrar's waiting count (needs real
  `pending_review` registrations on the copy — seed 3, and one more to see the real number past 9). Nothing that emails a family is
  pressed. Fix any wording slip in the walk text from the walk results, not by guessing the fixture's names (the fix-now walk named a
  permit by its issuer, not its name; name things as the screen shows them).
- Plan §10 status line and the TODO line updated with the positive fact ("built <date>", "committed `<hash>`"). Commit only when the
  owner says so; explicit pathspecs; `git show --stat HEAD` after. Rebuild the hub's tab 11 ladder row 13a to read "Built"; republish
  to the same link in a fresh session (read the live copy first).
- Record in the hand-off: the B2 bug (the Overview's waiting line could never show) as a defect FOUND AND FIXED here, not a feature.

## Open questions to settle in the build, not before

- Does the owner's name come from the club brief or does a small read need adding? (A1) — pick the cheapest that every role already calls.
- Which set of seasons counts toward the waiting number? (B2) — one definition, written in the words file's comment and the plan.
- Do "Run a tournament" and the Calendar/Schedules empty states need the same A5 rule? (A5) — check who can run a tournament first.
