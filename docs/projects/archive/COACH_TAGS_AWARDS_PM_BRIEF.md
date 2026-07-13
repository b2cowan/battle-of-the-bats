# PM Brief — Coach Tags & Player Awards (Premium Coaches Portal)

**Date:** 2026-07-09, updated 2026-07-12 · **Status:** Game tags + the "vs tag" report are **shipped** (committed, owner-tested 2026-07-10). Player Awards design is **signed off (2026-07-12, clickable mockup) and now in build.** · **Priority:** Medium-high (feeds the Insights hub story; differentiating coach-retention feature)

## Phase 2 — Player Awards (in build)

**What the coach gets:** a "give an award" moment right on the game screen after a game wraps — pick a player, pick an award (MVP, Best Hitter, Hustle Award to start; the list is fully editable, same curation model as tags), done in a few taps. From there it pays off in three places: a small trophy mark shows up on that game in the schedule list, the player's own profile picks up a line like *"2× MVP this season,"* and Insights gets a new destination — a **team awards leaderboard** — so the season's recognition doesn't just live in a group chat and get forgotten by August. A coach can also hand out an award that isn't tied to one game (a whole tournament, or catching up on one they forgot) from the leaderboard page itself.

**Why it matters:** this is the emotional, game-day-ritual half of the tags-and-awards idea — tags answer "how are we doing," awards answer "who showed up big." Coaches already do this informally after every game; giving it a ten-second home turns a forgettable text thread into something the team can look back on.

**What's locked already:** per-team award list, editable/curatable like tags (edit the name *and* icon together, retire — deleting an award type keeps history rather than erasing past awards), same capability model as the rest of the portal (roster/schedule access, no special head-coach-only lock), and **internal-only** — no public or parent-facing display in this phase, since that would put kids' names in front of an audience and that needs its own consent conversation first.

**What the mockup review changed (2026-07-12):** the leaderboard gets its **own new spot on the Insights hub** (a 5th destination, "Who's earning it?") rather than being tucked inside an existing page — awards are a genuinely new kind of report (who's earning recognition), not a new number bolted onto an existing one. And picking an award's icon is a **tap-to-choose gallery** of about 28 trophy/medal/sport icons (with a "type your own" option), not a blank box a coach has to know how to type an emoji into — the first mockup pass had that as free typing, and it was a clear miss for anyone not on a phone.

**Success criteria:** a coach hands out an award in the same visit where they enter a final score — no separate trip, no typing a name from memory — and by mid-season the leaderboard is something they'd screenshot and send to the team group chat.

## What the coach gets

**Tags** — a coach's own vocabulary stuck onto their data so reports can answer their questions later. Tag a game "Top in the province" or "Rivalry" in two taps while editing it; at season's end, Season Review shows *"vs Top in the province: 3–5, 21 runs for / 34 against"* with a tap-through to those games. Later, the same idea on expenses ("winter dome") adds slice-and-dice to the money reports — though the existing category system already covers most of that.

**Awards** — teams love handing out MVP / Best Hitter / Hustle Award after games and tournaments, and today that lives in a text thread and is forgotten by August. A "give an award" moment on the game screen records it in ten seconds; the player's profile shows "2× MVP this season" and Season Review gets an awards leaderboard. Internal to the coaching staff for V1 — celebrating publicly involves kids' names, so that waits for a proper consent decision.

## Decisions already made (owner, 2026-07-09)
- Libraries are **per-team** (each coach curates their own), with a future path for an org to promote a tag/award org-wide.
- Creating/managing follows the **existing capability model** (schedule access for game tags, money access for expense tags) — no special locks.
- **Awards stay internal** in V1.
- **Ship game tags + the "vs tag" report first** — it proves the whole loop on the most exciting surface.

## Why it matters
This is coach-defined intelligence no template can offer — "how do we do against the best teams?" is the question every rep coach asks and no product answers. It deepens the Premium portal's moat, gives the planned Insights hub its first differentiated dataset, and awards add an emotional, sticky ritual to game day.

## Deliberate guardrails
- No generic "custom fields everywhere" editor — tags appear only as small contextual affordances and pay off in reports, keeping us clear of the stacked-panels disease.
- Rename **and merge** tools ship with V1 so tag libraries can't rot into near-duplicates.
- Sport-neutral by construction (all names are coach-typed).

## Success criteria
A coach can tag five games and immediately see their record against that tag without reading help; a season later, the awards leaderboard and "vs tag" splits are content they screenshot and share with the team.
