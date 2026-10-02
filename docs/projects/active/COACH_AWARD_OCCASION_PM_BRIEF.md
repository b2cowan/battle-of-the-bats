# Which game an award is for — PM brief

**Hub:** https://claude.ai/artifact/BaSM8ojh6AjMup6VJArCUv · **Plan:** `COACH_AWARD_OCCASION_PLAN.md` ·
**Status:** drawn 2026-10-01; ruled 2026-10-02, all four as recommended; built on dev, reviewed and committed (`55c237ee`) 2026-10-02; owner QA §257 ✅ passed 2026-10-02 (both walks). Production with the next promote.

**The problem.** On production, Alex Tennant showed two MVPs for one game. The coach gave the award from
the Awards page, which can only take typed words, so it was tied to no game and dated the next day; then
gave it again from the game once its score was in. The product kept both, and every count doubled.

**The proposal.**
- The Awards page's Give an award asks **which game** with a dropdown of the season's events, newest
  first, and opens on the newest. "Something else" keeps the typed occasion and adds the date it
  happened; "The season" covers season recognitions.
- A game still waiting for its score is listed, greyed, saying "enter its score first".
- A quiet line before Save says when the player already has the same award from a day or two before. It
  never blocks.

**Who sees it.** Coaches who can give awards: head coaches, and assistants given a record duty. Families
and the club see only the results: awards tied to the right game and counted once.

**Why it matters.** Awards are what families screenshot and Season Wrapped celebrates; a doubled MVP is
the error a parent notices first, and today the product leads coaches into it.

**Success.** An award for last night's game, given from the Awards page, is tied to that game and dated
its day in two taps; a coach about to give the same award twice is told before saving; no new pairs like
Alex's on production after release.

**Priority and size.** Small: one window, no database change, no new screen.
