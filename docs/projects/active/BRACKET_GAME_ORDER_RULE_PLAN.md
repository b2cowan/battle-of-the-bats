# Bracket game-order rule — a game cannot start before the games it depends on

**Status:** RULED 2026-10-29 (owner), not started. Parked until the weekly usage refreshes (weekend of 2026-11-01); nothing built, nothing investigated beyond the trigger below.

## The rule (owner, 2026-10-29)
> It must be **impossible** in real life to schedule a game before a game it depends on. The admin schedule editor **blocks the save**.

Blocks, not warns. This is a decision, not a draft to re-open.

## Where it came from
On the public Schedule (phone), the Championship (2:15 p.m.) sat between two Semifinals (11:25 a.m. and 3:12 p.m.). The public sort was correct — it orders by date then time. The cause was test data: the Stage 3 fixture seed moved one Semifinal to "now" and left the Final's time alone. The seed is fixed (it now keeps the Final three hours after the Semifinals and restores it on undo). That fixed the fixture only; **a real organizer can still make the same mistake in the admin tournament schedule editor**, and the public page would then show it.

## What to investigate first (not yet read)
1. **How a game "depends on" another.** The fixture uses bracket codes (`SF1`, `SF2`, `FIN`) and winner placeholders ("Semifinal 2 winner"). Find out whether the dependency is stored (a source-game link) or only implied by the code/label — the rule needs a reliable answer, per bracket shape (single elimination, pools → playoffs, anything with a third-place game or a loser feed).
2. **Every door that sets a game's time or date.** The schedule editor save, the bracket editor, drag-and-drop on a grid, bulk shift / reschedule, auto-generate / auto-schedule, import, and any API route behind them. The rule belongs **on the server** (the one route/library they all share), with the editor showing the reason — a UI-only block is not "impossible".
3. **Pool play → playoffs.** Playoff games depend on the pool results too. Decide whether the rule includes "no playoff game before the last pool game of its division" or stays at game-to-game dependencies. Needs the owner's call if it is not obvious from the code.

## Open design questions (owner call at build time)
- **Equal times:** the same start time for a game and its dependency — block (recommended: a winner cannot be known at the moment the game starts) or allow back-to-back with a minimum gap?
- **Minimum gap:** does the dependent game need the earlier game's length (or a buffer) to finish, or is "later start" enough?
- **Moving a Semifinal later:** block, or offer "also move the Final"? Owner said block; the second is a convenience to price separately, not assumed.
- **Existing bad data:** tournaments already saved out of order — show the problem on open, but do not lock the organizer out of fixing it.
- **Auto-scheduling and published schedules:** what happens when the generator itself would produce an out-of-order pair, and what happens to a schedule that is already published/live.

## What the organizer should see (to be confirmed in the UX summary before any code)
- Moving or saving a game before a game it depends on is refused with a plain sentence naming both games: "The Championship can't start before Semifinal 2 (3:12 p.m.)."
- The same sentence wherever the time can be changed — drag, edit window, bulk move, generator.
- No change for tournaments with no dependent games (round-robin only).

## Tests when built
- A save with a dependent game earlier than its source is refused by the **server**, from every door above.
- Equal-time and just-after cases behave per the ruling on the open questions.
- A round-robin-only tournament is unaffected.
- The Stage 3 fixture still passes its own ordering check.

## Process notes
- Per AGENCY_RULES: PM UX summary presented in the conversation before any code; PM brief at `BRACKET_GAME_ORDER_RULE_PM_BRIEF.md`.
- Offer `/review` after the build; `/docs` if the editor's behavior is user-visible in the help guides.
