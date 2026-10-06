# Sheet Frame — PM brief

**Ruled 2026-10-05** (all six recommendations accepted). Hub: https://claude.ai/artifact/GDVi8DXFYsxrbq1rLarstc

**Step 1 built on dev 2026-10-05** — the shared frame exists, and every "⋯ / Tools" sheet and both Ledgers' Filter
sheets come from it. A coach sees no change (proved by before-and-after captures of every sheet). One club fix rode
along, approved by the owner: on the club's Ledger and Allocations, the Tools and Filter sheets hung half-way down the
page with nothing dimmed behind them; they now rise from the bottom bar and dim the page, like the coach's. Owner QA
§264 passed.

**Step 2 built 2026-10-05** — the small menus say what they are; the Schedule's + and view menus rise from the bar.
Owner QA §266 passed.

**Step 3 built 2026-10-06, committed `5d036eeb` — game day.** On a phone or tablet, Note and End game come down over the bottom bar,
so a stray tap cannot leave the game with a note half written or a corrected final score dropped; Scouting does the
same only while an observation is being typed (owner rulings 2026-10-06: End game and Scouting were the two the plan
left to sort). Who's here, Score and Scouting-while-reading stay on the bar with the warm dim; Who's here shows about
two more players. **Found and fixed on the way:** a tap on the game-day dim used to press whatever it covered — over
the game's Back arrow it left the game. On a computer nothing changed. **Found, not fixed (owner: a separate small fix
next):** a run tapped on the score is saved ten seconds later, so leaving the game within those ten seconds loses it;
End game's final score still corrects it. Owner QA §268.

**Follow-up built 2026-10-06, committed `62f76580` + `b06d8483` — the game-day button row docks on the bar.** Found by the owner in the §268 walk: on a
phone or tablet the row of Who's here · Note · Scouting · End game stopped short of the screen's edges and, at the
end of the page, lifted off the bottom bar. Drawn true size and ruled as drawn the same day: it now runs edge to edge
and sits on the bar wherever you are on the page; the buttons did not move; a computer is unchanged. Owner QA §269 passed 6/6.
Asked about in the same walk and fixed the same day: in Warm the bottom bar turned grey at the end of every page (and
on the club admin), because the page behind its frosted glass was near-black there; it now stays cream everywhere.
Owner QA §270 passed 4/4.

## What changes for a coach

Very little on screen, on purpose:
- Writing a game-day note or ending a game, the sheet covers the bottom bar, so a stray tap cannot lose the work
  (built, step 3).
- The Schedule's Add event and view menus rise from the bottom like every other menu.
- Print, the team switcher and Call up get the same kind of title as their neighbours.
- On the warm theme, the game-day sheets dim the screen the same way every other sheet does.
- For a keyboard or a screen reader, every sheet behaves the same way: a sheet that covers the bar keeps you inside
  it; one that doesn't never claims to.

## Why it matters

A coach can open 16 sheets on a phone, built four ways. Two rulings about how sheets behave reached some of them and
not others, so the same gesture does different things on different screens. One frame makes the rulings hold
everywhere and stops new sheets drifting.

## Customer impact

Every coach on a phone. Most visible on game day, the screen used under the most pressure.

## Priority

Medium. Five small steps, each built and walked on its own; the lineup builder last because it is being worked on in
parallel.

## Success criteria

- Every sheet that holds unsaved work covers the bar; every other sheet leaves it live.
- Three title styles, one dim per theme, one height rule across every sheet.
- Escape returns focus to what opened the sheet, everywhere.
- A new sheet is built from the frame, with nothing to copy.
