# Club Website Enhancements — Stage 0 kick-off prompt (the walk and the end state)

> Paste this whole file into a FRESH session. Written 2026-11-24. Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md`
> (read it first, all of it). Status lives on the board (project `club-website`).

## What this session is for

One whole-site pass over a club's PUBLIC website, before any single idea is drawn or built. The owner's instruction
(2026-11-24): "I want to do this right the first time and not have to need to continue to add on later because we
rushed." Ten ideas are proposed (plan §5). Drawn one at a time they collide: three of them want the top of the club
home, three share the sponsor places (plan §4). This session decides the shared pages ONCE.

**Nothing is built here.** No code, no migration, no gate. The output is one published page and the owner's rulings.

**The owner said (2026-11-24): start with what is proposed, add Milton Bats' feedback later.** So Parts 1 and 2 run
now, and the asks are NOT put to him for ruling until the feedback slot below has been looked at (Part 3).

## Feedback from the Milton Bats meeting (the owner pastes it here; empty = not in yet)

Three questions the owner is asking in the room:
1. What does their current website do that they would miss?
2. What do families ask the board for that the site does not answer?
3. Who updates it today, and how often?

Their answers:

> (not in yet)

**How to use it:** one club is one data point. Use an answer to test the end state (does a page they rely on have a
home; is a thing families ask for answered in one look), never to redraw the product around one club. The roadmap's
standing rule holds: nothing public points at one club's asks. If the slot is still empty when Part 2 is done, publish
anyway with a visible line on the asks tab: "Milton's answers are not in yet; rule after they are."

## Read first (delegate the broad reading to helpers; open the lines a conclusion turns on yourself)

- `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md`: §2 findings (◦ marks what was NOT re-opened), §3 the rulings that bound every
  idea, §4 the seven shared foundations, §5 the ten ideas, §6 the proposed ladder, §7 the open calls, §8 the census
  questions.
- `docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md` and the club-site look rulings (2026-10-19, in-repo
  `memory/design_decisions.md`): light ground, the club's colours in four roles, "Open now" first.
- The owner's UI conventions (auto-memory index → "UI conventions — owner rulings") BEFORE drawing any control.
- `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §9–§10a for what the tournament pages already settled (band, pinned tabs,
  ticker, following and alerts only in the installed app, no app bar in a browser). Do not re-open those.
- `BOARD_READY_PLAN.md` Stages 5 and 7 (club events and camps on the club site): the end state must leave them room.
- `TEAM_STRUCTURE_PLAN.md` (owner 2026-11-24): how rep teams are grouped (level → age group → teams) belongs to that
  project. Draw the Teams page, the home's Teams section and Tryouts from its Stage 0 end state if it exists. If it
  does not exist yet, draw them as a placeholder frame marked "waits on Team structure", and do not invent a layout or
  read levels and ages out of team names.

## Part 1 — The walk and the census (no dependency on Milton)

1. **Capture today's club site, phone (390) and computer (1280), true size.** Every public club page: home, About,
   Teams, one rep team page, Tryouts, one tryout page, House league, one season page, its schedule and standings, the
   Tournaments list, a notice showing, the sponsor strip. Use a dressed club. Prefer Kestrel Bay on dev (its seed and
   capture scripts are named in the auto-memory file `project_club_on_sale_pages.md`; the extras seed must run in the
   daytime) or the public pages of the Milton demo club on staging, which need no sign-in. **Never rebuild the Milton
   world for this.** Follow AGENTS.md for the dev server; a handful of screens, not a sweep.
2. **Capture three states of the home:** a quiet day (nothing open, no games), a day with games on, a day with a
   notice up. If a state cannot be staged, say so on the page rather than faking it.
3. **Answer plan §8's census questions from the code,** with file and line, and re-check every ◦ item in plan §2 that
   a frame leans on. The two that shape everything: do rep and house league games point at a real field record; and
   how does a public page know a rep team's schedule is public without leaking a private one (the Stage 0 D1 lesson
   from the tournament review: a draft schedule reached families).
4. **Name each foundation's real starting point** (plan §4, F1–F7): what exists, what is missing, what a stage would
   have to add. Short. This is what lets the ladder be trusted.

Stop here and tell the owner what the walk found before drawing, in a few plain lines. A `/clear` between Part 1 and
Part 2 is fine; put Part 1's findings in the plan's Progress block first.

## Part 2 — The end state, every page once

Draw each club page as it stands when ALL ten ideas are in. Phone first, then the computer. Frames, not finished
drawings: real words, real page structure, true size, built from the shipped components and the layout standard.
Whole-screen before (the capture) beside after (the frame).

Pages and states owed:
- **Home:** quiet day · game day · a field closed · a news post up · registration open. This is the page three ideas
  fight over; decide the one moving region and what leads it in each state. "Open now" is locked first today: keeping
  or moving that is an ask, not an assumption.
- **A rep team page** with a team photo and its game-day state. A house league team page ONLY as an option on the
  ask for call C2.
- **House league season, schedule, standings** with field status on affected games.
- **News:** the list and one post. Say what `/{club}/news` does when a club has its own news AND a running tournament
  (printed links and QR codes rely on today's forward).
- **Sponsors:** every place a sponsor can show (home, game-day rows, score images, tournament pages by reference to
  that project). Same-size tiles as ruled; larger tiles only as an option on the ask for call C1.
- **Trophy case.**
- **The Big Board:** one landscape frame for a TV.
- **The share kit:** the poster and the social image, one frame each.
- **The admin's doors, one small frame each:** where someone closes a field, posts news, adds a photo, sees the
  sponsor report. A public page with no drawn way to feed it is how add-ons happen later.
- **Track P (a prospect's club made before a meeting):** one frame of the owner's side and the "claim it" moment,
  marked as waiting on call C3.

Hard limits while drawing (plan §3 has the sources):
- No child is named on a public page. Photos of children are drawn only with a consent state shown.
- "The site writes it" = fixed sentence patterns. No AI.
- No follow or alert control in a browser. No page for one game. No "share one link".
- Nothing of ours advertised on a club page beyond the quiet credit.
- Words a customer reads go to `/marketing` in ONE pass before hand-off; spelling per AGENCY_RULES ("8:00 a.m.").

## Part 3 — Fold in the feedback, then hand off

1. Re-read the feedback slot at the top of THIS file (another session or the owner may have edited it).
2. Test the end state against each answer; change a frame only where the answer exposes a real gap, and say which.
3. `/ux`, then `/design`, on the page BEFORE the owner sees it. `/legal` reads three things: children's photos and the
   consent question, counting sponsor views, the "tell me when registration opens" email.
4. **Publish ONE page** (a Claude Artifact, an HTML page, never the canvas; the house layout): tabs for the walk, the
   end state page by page, the foundations, the ladder (plan §6, corrected by what Part 1 found), and the asks with a
   paste-back line. Every highlighted thing on a frame is clickable to its ask.
5. **The asks:** the shape questions first (what leads the home in each state; one moving region or several), then the
   open calls C1–C4 from plan §7, then the ladder's order. A recommendation on each, option A first. Do not ask what to
   do first; recommend an order.
6. Records: plan Progress block and §7, the PM brief if scope moved, the board line (phase and next), and a line in
   in-repo `memory/design_decisions.md` only for what the owner RULES. No commit without his word.

## Done means

One published page the owner can rule from; every census question answered from code; every page with a before and an
after at true size; the ladder corrected by evidence; the asks waiting; nothing built.
