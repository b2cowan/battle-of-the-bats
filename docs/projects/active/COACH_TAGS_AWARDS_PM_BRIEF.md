# PM Brief — Coach Tags & Player Awards (Premium Coaches Portal)

**Date:** 2026-07-09 · **Status:** Planned, not started · **Priority:** Medium-high (feeds the Insights hub story; differentiating coach-retention feature)

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
