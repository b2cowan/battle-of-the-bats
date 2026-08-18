# PM brief — Closing the season

**Approved 2026-08-18 · plan: `COACH_SEASON_CLOSE_AND_ARCHIVE_PLAN.md` · mockups: artifact
`57e9bfd3`**

## What changes for a coach

- **The season no longer ends itself.** Today, once a season is marked finished the entire portal
  turns into a read-only copy — every screen a past-tense version of itself, every tool explaining it
  will be back next year. That state disappears. A season stays completely live, with nothing taken
  away, for as long as the coach needs it.
- **The coach decides when it ends, through two doors.** *Start next season* — which closes this one
  and carries the roster and staff forward — or, quietly, *close the season*, for a group that has
  aged out or a coach not ready to plan next year. **Closing the season is genuinely new:** today the
  button that says "Close out the season" actually opens *Start next season*, so a team that has aged
  out has no way to finish.
- **A closed season becomes one page.** The season's story, then four closed shelves — the results,
  the roster, the practices they ran, and how the season added up — and a door to compare seasons.
  The same page whether it closed yesterday or three years ago, and **reachable whether or not the
  team has a new season**.
- **Mistakes are cheap.** Closed the season by accident? Reopen it, as long as no new season has been
  started. Both dialogs say plainly what is about to happen before it happens.
- **Nothing stops after the last game.** Money, awards, documents, family emails and next year's
  tryout all keep working exactly as they do now.

## Why it matters

The product had no answer to *"when does a season actually end?"* beyond "when somebody marks it
finished" — and then punished that state across 29 screens. Coaches were shown a whole application
pretending to be a filing cabinet, at exactly the moment they still had real work to do.

This replaces it with something a coach can hold in their head: **your season is live until you close
it; a closed season is one page you can always open.**

## The tradeoffs taken, with eyes open

- **A closed season shows much less than it does today — on purpose.** Every record is still stored in
  full, so the page can grow later if something turns out to be missed. Starting minimal costs
  nothing and keeps the page quiet, which was the binding constraint on every history surface.
- **Unsettled money warns rather than blocks.** A coach can close with families still owed. Blocking
  would make the product the judge of a debt it cannot fully see, and would strand a coach who had
  already settled up in cash — so it names what is outstanding, offers a way back, and lets them
  decide.
- **One kind of mistake is not yet undoable.** If a coach closes a season *and* starts the next one,
  they cannot get the old one back without help. Undoing that means deleting a season and everything
  carried into it, which is dangerous code for a mistake nobody has reported. Instead, the *start
  next season* dialog now says clearly that the old season stops being editable — preventing the
  mistake rather than cleaning up after it. The rule for building the undo later is written down.
- **Starting next season is now the first real step of the year, not a formality** — next year's
  tryout needs a season to live in.

## Priority

Medium, and the value is mostly in what it removes. The visible change is one page and two dialogs;
the real return is deleting 29 screens' worth of finished-season special cases and retiring the
question every new feature has had to answer since the archive was built.

## Success criteria

- A coach whose team has aged out can finish their season, and understands what that means before
  they do it.
- Nothing a coach could do the week after the last game becomes harder.
- A finished season is one page, reachable for ever, whether or not there is a new season.
- Closing by mistake is recoverable in one press.
- No screen in the portal renders a "this season has finished" version of itself any more.
