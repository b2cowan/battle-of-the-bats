# Free Coach Portal Experience — PM Brief

**Date:** 2026-07-25 · **Status:** A1 (fixes) built pending owner QA; A2+ ratified direction, not started
**Companion plan:** `FREE_COACH_PORTAL_EXPERIENCE_PLAN.md`

## Ratified direction (2026-07-25): two families, one app

The owner ratified a platform-wide ruling (logged in the Business Decisions + design logs): the free portal joins the **consumer app family** and the premium portal stays in the **operator family**.

- **Free portal = "tournament companion."** It stops being a third mini-app: coaches get the same bottom bar as everyone else (Home · Scores · Chat · Account), their team and tournament identity in a persistent header with the flip-to-public button top-right (same spot as admin and the live site), and the portal's sections as a scrolling tab line under the header — the exact pattern the public tournament pages use. Live scores and chat are one tap away all weekend; team chat appears in the app-wide Chat tab (it's already the same conversation under the hood) plus a doorway on the team page. The clunky "More" sheet disappears.
- **Premium portal = "team operations HQ."** It keeps — deliberately — the workspace shape that org admins use: a sidebar of grouped season tools (roster, lineups, attendance, money, insights). No rebuild now; when we next touch it, the sidebar gets grouped into clear domains and its patterns converge with admin's. The step-up from companion to HQ becomes the upsell story, and upgrading shows a one-screen "your team now has a workspace" welcome.
- **One promise held constant:** the tournament experience is identical on both tiers — premium buys season tools, never a better game weekend.

## What this is

A two-tranche upgrade of the free Coaches Portal experience for the platform's most important new-customer moment: a coach signing up for their first tournament. Tranche A fixes what's broken or confusing; Tranche B makes the tournament weekend feel great and quietly opens the door to the Premium portal (free during Founding Season until Jan 1, 2027).

The good news the audit confirmed: the signup itself is already excellent — one submit click and the coach is signed in and looking at their tournament's status page, no email-verification detour, no picker screens. We're protecting that and fixing everything around it.

## Tranche A — Fix (do first)

**What coaches see differently:**
- **No more dead ends.** Today, any free coach who resets a forgotten password gets dumped on a system error page afterward — and these coaches are the most likely to reset, because their password was created mid-registration without a deliberate "set up your login" moment. After the fix, a reset always lands them back on their team.
- **Navigation behaves like the rest of the app.** The flip-to-public button stays pinned top-right on phones (today it falls to the left under the title), the tournament page gets a "← Tournaments" back link (the paid portal already has one), and the Tournaments tab — not Overview — highlights when you're looking at a tournament. The sign-in screens also get Coaches Portal framing and lose an off-brand tagline.
- **The tournament page becomes a dashboard, not a pile.** Today it's up to 13 stacked blocks that repeat the fee, the contact email, and the schedule three times each. It becomes four clearly-labeled zones — Status & Payment, Schedule, Your Team, From the Organizer — with quick-jump pills on mobile, styled with the same header pattern the public tournament pages use.
- **Small flow polish:** the confirmation email links straight to their tournament record (not a list), the Register button mentions the free portal that comes with it, and two rare-but-confusing error paths get honest copy.

**Why it matters:** this is the first impression for every new coach account on the platform. Right now the happy path is great and everything one step off it is shaky.

## Tranche B — Delight & convert

**What coaches see differently:**
- **Instant utility:** one tap adds every game to their phone calendar; every field name is a directions link; a "We're in!" share button drops a branded card into the parent group chat; the organizer's real logo appears on their page; "38 teams are in — 9 in your division" makes the event feel real on day one.
- **Game-weekend companion:** live pool standings and bracket position inside the portal (today coaches must leave for the public site — the most compulsive weekend habit, unserved); and a "Schedule updated" banner when the organizer moves a game — today *nothing* tells a coach their 2:00 moved to 3:15. Real push/email alerts for the coach's own team follow as a designed second step (today a random fan who follows the team gets more notifications than the coach who runs it).
- **Premium discovered at honest moments, not via banners:** after the tournament ends, their real record ("finished 3–1") with a line about Premium keeping season history; a nudge when they register a second tournament; a lineup-builder mention only on multi-game days; a "coaching solo?" line in Chat (free has no assistant-coach concept at all). All copy carries the Founding Season "free until Jan 1, 2027" framing. Today the most common coach — one team, one tournament — literally never sees any premium messaging.

**Why it matters:** the wow items are almost all reuse of things already built for fans, so the cost is low relative to how much they change the "this is a real ops tool" impression — and the premium bridges convert at moments of felt need instead of ad fatigue.

## Priority & sequencing (resequenced 2026-07-25)

1. A1 (auth dead-end + nav fixes) — ✅ built, pending owner QA + commit.
2. A2 (consumer shell integration) — the ratified re-chrome above; needs a short design pass first.
3. A3 (tournament-page regroup) — the four-zone cleanup, now landing inside the new chrome.
4. A4 (flow polish) + B1 (quick wins) — can ride along in the same passes.
5. B2 (notifications) — needs a short design pass; biggest single capability gap.
6. B3 (premium bridges) — fastest to ship once B1's surfaces exist; time-sensitive while Founding Season runs. The premium portal itself: light-touch roadmap only (grouped sidebar, admin-pattern convergence, upgrade-moment welcome) — no rebuild.

## Success looks like

A coach can go from a tournament link to managing their team without ever being lost, stuck, or on an error page; their tournament page answers status/schedule/fees/roster/contact at a glance; the weekend runs through the portal (calendar, directions, standings, updates); and every coach encounters at least two natural, non-pushy reasons to try Premium before their tournament ends.
