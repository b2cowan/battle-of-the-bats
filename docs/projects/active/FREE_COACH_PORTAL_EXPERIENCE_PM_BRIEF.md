# Free Coach Portal Experience — PM Brief

**Date:** 2026-07-25 (B3 section added 2026-07-27) · **Status:** Tranche A + B1 built and committed on dev, none on production yet; **B3 (premium bridges) built 2026-07-27, awaiting owner QA**; B2 (coach alerts) is the last piece and needs a design decision first
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

## B3 — Premium bridges: what we decided to offer, and where (built 2026-07-27)

B3 is the phase that decides *when a free coach is asked to pay*. The short version: **four moments, none of them during the tournament.**

**The rule we chose to keep.** This product has a standing promise — the pressure ladder — that the portal stays pitch-free before and during an event, and that the one earned ask comes after it. The plan's own B3 section proposed breaking that with a lineup pitch on multi-game days. We dropped it. The moment it targeted is the hour a coach is least able to act on anything, and the weekend being clean is a large part of why the free portal feels like a tool rather than a funnel. If we ever want that moment, it should be a deliberate change to the promise, not a quiet exception.

**What a coach now encounters:**

1. **After the tournament ends.** Their result is already on screen. Beneath it, the portal now says what happens to that weekend next — *"That's the first line of Riverside U13's season history"* — and that the record, who played, and who earned an award all leave with the event unless they keep them. The upgrade panel below was retitled from a generic "ready for the full toolkit?" to **"Keep the season, not just the weekend"**, because at that exact moment the coach isn't shopping for a toolkit, they're watching something disappear. Founding Season framing ("free until Jan 1, 2027, then $29/month") unchanged.
2. **When they enter a second tournament.** Their Tournaments list — which has never said anything at all — grows the same quiet footer their Roster, Schedule, Fees and Announcements pages already carry: two lines about carrying a roster, staff and results forward instead of retyping them each time. It appears only from the second entry onward, because before that the argument is a guess about the coach rather than an observation about them.
3. **When they browse Explore.** The list of what Premium adds gains one true item it was missing: **assistant coaches with their own sign-in**. A free team is one person's login, and there was nowhere in the product a coach could learn otherwise. (The plan wanted this in Chat. Chat is now shared with fans and paying coaches, so it moved.)
4. **When they're chasing team dues.** One line above the shelf that's already there: *"9 players still owe — that's 9 reminders to send by hand."* It counts people, not invoices, and appears only at five or more — a coach with two stragglers is never told they have a problem.

**Who does NOT see any of it:** paying coaches. The tournament record is one screen serving both tiers by standing rule, and everything B3 adds to it is suppressed on the paid side. The other three moments live on free-portal-only pages.

**Expected customer impact.** The honest count, and a correction to how we were measuring: a coach who registers, plays, and never opens the team tools meets Premium **once** — at the afterglow — with Explore permanently one tap away if they go looking. We had written a success target of "two or more moments per tournament"; that target and the pitch-free promise can't both be true, so the target changed. What we're actually optimising for is that the one ask lands at the moment of felt need, in language about what the coach just did rather than what we sell.

**Tradeoff taken.** Fewer impressions than the plan originally imagined, in exchange for a game weekend that never sells to anyone. Founding Season runs to Jan 1, 2027, so the cost of a quieter funnel this season is a season of feedback rather than a season of revenue — which is the strategy we already chose.

**Success criteria for B3:** the afterglow reads as being about the coach's team rather than about our product; no paying coach ever sees an upsell on the tournament record; no upsell appears on any pre-event or game-day surface; every price and date on every new surface comes from the live Founding Season configuration, so nothing can drift.

## B2.3 — "your game moved" finally reaches a phone (built 2026-07-28)

**The gap, stated plainly.** Until now, when an organizer moved or cancelled a single game, the product told **nobody**. Not the coach. Not the parent who deliberately followed the team and turned alerts on. Score updates buzzed; the thing that changes where you drive on Saturday morning did not. This was never a coach-tier gap — it was the platform's largest unclosed notification hole, and it's now closed for coaches and families in the same send.

**What a coach or parent experiences.** Their game moves, and their phone says so: *"Your 2:00 p.m. vs Northside Thunder moved — Now 3:15 p.m. at Diamond 4."* A cancellation gets its own blunter wording. If several of their games change in one sitting they get **one** message with a count, never one buzz per game. Tapping opens that game. Nobody has to turn anything on — a coach's own team is already followed automatically, and the switch that controls this ("Event news") has been on by default and describing itself as "rain delays & day-of updates" all along.

**What an organizer experiences.** Editing a game on a **published** schedule now tells them, before they save, that teams will be told and names which ones. On a free event it tells them the opposite just as plainly: teams see the change in the app, phones don't buzz. That is the only place in this feature where a plan is mentioned at all — because the organizer is the person who could actually buy it.

**The four judgement calls, and why.**
1. **One message, not twenty.** An organizer can touch a dozen games in ten minutes. Changes are held for a short quiet window and sent as one message per team once the editing stops. The much bigger lever turned out to be free: a schedule that hasn't been published yet tells nobody anything, because nobody has been shown those times — and that's where the twenty-edit case actually lives.
2. **Urgency changes delivery, not whether we send.** A game starting within a few hours skips the wait entirely; a game three weeks out is batched and calm. We alert on every future change with no cutoff, because a family that booked a hotel for a Saturday 8am game needs to know it moved to Sunday. Changes to games already played or already started send nothing.
3. **No new switch to learn.** We considered adding a third "Schedule changes" toggle. We reused the existing one instead — splitting a promise people have already read costs more than it buys, and it keeps the alerts panel (B2.2) honest and short.
4. **Rain delays stay one buzz.** The bulk rain-delay tool already ends with the organizer writing their own message. If they send it, our automatic notice stands down — their words win. If they skip it, ours goes out. Today, skipping means nobody is told.

**A stale email that quietly corrected itself.** The "your first game is tomorrow" reminder was scheduled when the schedule was published and never recalculated when a game was moved by hand, so it could announce a time that was no longer true. That now re-syncs on every single-game change.

**Nothing here sells anything.** No Premium mention in the push, the email, or the app. Where an organizer's plan means we can't reach a phone, we say so once, plainly, to the person who could change it — never to the coach, who can't.

**Tradeoff taken.** A short delay (up to about ten minutes) on non-urgent changes, in exchange for never buzzing somebody five times about the same afternoon. And the batching relies on a background job running on schedule — a missed run delays a message, it never loses one.

**Before this reaches customers:** the database change must be applied to production ahead of the code, and phone delivery re-tested on a real device rather than assumed.

## B2.2 — the last phase, and the hole it found (built 2026-07-28)

**What this was supposed to be:** a panel telling a coach what alerts they're set up to receive. **What it turned out to be:** a two-line copy change plus the fix for a real hole in the feature we'd shipped the day before.

**The hole.** A coach starts receiving alerts about their own team automatically — but that only kicked in *once their event went live*. Organizers do most of their rearranging in the days before: schedules get published, times get shuffled. So during exactly the stretch that matters most, the coach wasn't on the list. Families who'd followed the team deliberately *were* — meaning a parent could hear their kid's game had moved before the coach did. That's uncomfortably close to the complaint this whole program started from.

Nothing was wrong with the alerts themselves. The coach just wasn't a recipient yet.

**The fix.** A coach now becomes a recipient when their team is **accepted** into the event, rather than when the first ball is thrown. It's the same automatic follow, moved to a more honest moment, and it's still one tap to turn off.

**The trade, stated plainly.** Score alerts and schedule alerts ride the same follow, so an accepted coach now starts getting live-score notifications for their own team earlier too. For your own team that reads as reasonable — but it's a real change affecting people who didn't ask for it, which is why it was your call and not ours.

**The panel itself.** The door already existed: Notification settings has always been on the Account tab. Building a coach-only alerts screen inside the portal was considered and rejected — it would have meant two places claiming to control the same switches, and the first coach to turn something off in one and find it still on in the other would have been right to distrust the whole screen.

So the change is at the destination, where a coach previously read a card written for a fan — *"all the teams you follow"* — that never mentioned their own team or how it got there. It now names the team and the event, and says in one line that coaches are followed to their own team automatically, so there was nothing to switch on. Nothing else moved.

**What we deliberately didn't build:** an "alert me" button for a coach who isn't following. Once following starts at acceptance, the only people left in that state are those whose team hasn't been accepted yet — where there's no schedule to be alerted about — or who deliberately turned it off. Putting a button in front of someone who just opted out is nagging, not service.

**Two things the review caught, both ours.** A comment describing a capability that didn't actually exist (removed, along with the dead wiring behind it), and a sentence claiming a coach was followed "when your team was accepted" — which isn't something the screen can actually vouch for, since a coach who'd followed their own team by hand would have been told it was automatic. It now states the rule rather than a history.

## Priority & sequencing (resequenced 2026-07-25)

1. A1 (auth dead-end + nav fixes) — ✅ built, pending owner QA + commit.
2. A2 (consumer shell integration) — the ratified re-chrome above; needs a short design pass first.
3. A3 (tournament-page regroup) — the four-zone cleanup, now landing inside the new chrome.
4. A4 (flow polish) + B1 (quick wins) — can ride along in the same passes.
5. B2 (notifications) — needs a short design pass; biggest single capability gap.
6. B3 (premium bridges) — fastest to ship once B1's surfaces exist; time-sensitive while Founding Season runs. The premium portal itself: light-touch roadmap only (grouped sidebar, admin-pattern convergence, upgrade-moment welcome) — no rebuild.

## Success looks like

A coach can go from a tournament link to managing their team without ever being lost, stuck, or on an error page; their tournament page answers status/schedule/fees/roster/contact at a glance; the weekend runs through the portal (calendar, directions, standings, updates); and every coach encounters at least two natural, non-pushy reasons to try Premium before their tournament ends.
