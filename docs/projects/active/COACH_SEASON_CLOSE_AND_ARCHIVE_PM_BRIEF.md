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

---

## Built 2026-08-18 — what changed from this brief

Everything above shipped. Three things are worth a product owner knowing, because they differ from
what the brief promised or go slightly beyond it.

**1. "Start next season" already warned — it just warned last, and half of it was wrong.**
The brief said that dialog never told a coach the old season stops being editable. It did, in an
amber box at the very bottom, under the options — which is why nobody read it. It has moved to the
top, and the half that promised "the Insights archive keeps every result and money record" is
corrected, because this release is what removes that archive.

**2. A closed season's other screens don't open at all — that is what made the clean-up possible.**
The brief said a finished season becomes one page. In practice that only works if the old screens
stop being reachable: leaving them open and just removing their read-only styling would show a coach
buttons that quietly fail. So a team with no live season now has exactly one destination, and any
old link or bookmark into that team lands there. Nothing is lost — there is nothing behind those
doors until a season is running again, and starting one is on the page itself.

**3. The closed-season page is now titled with the season's name** ("2025 Season"), not "Season's
End". It is the only thing on screen that says which year is being read, and the roster shelf in
particular looks identical from one year to the next.

**One bug fixed on the way past:** the "See last season's Season Wrapped" button shown right after
starting a new season was opening the NEW season and reporting it as still under way. It now opens
the season the coach just finished.

**Not built, on purpose, exactly as the brief said:** undoing an accidental rollover. A coach who
closes by mistake *and* starts the next season still needs help. The rule for building it later is
written down in the plan.

---

## The long shelves (2026-08-18)

The closed-season page's Results and practices lists now **answer before they list**.

**Why:** the test team has four games and two practices, so the flat lists looked fine. A real season
is twenty-six games and forty-four practices — and practice rows are two lines each, so between them
they were the longest thing on a page sold as one quiet page.

**What a coach sees.** Opening Results now shows the record split by competition — league,
tournament, scrimmage — then home and away, then scoring. Opening the practices shelf shows what the
season was actually spent on: "Hitting 19 · Defence 14 · Baserunning 8". Underneath each, the season
is listed **by month**, four to six rows, each carrying that month's record or what it was about, and
each opening to its own nights.

Nothing is hidden — months organise the list, they never shorten it. A short season skips the month
layer entirely, because two rows that each need a click to reveal four nights is worse than a list of
nine.

**One correction worth flagging.** The practices shelf's number used to read as *the season held 44
practices*. It doesn't: that shelf holds nights a coach **wrote something about**, and a night nobody
wrote up never appears. A coach who ran sixty and planned forty-four was being told they ran
forty-four. It now says "44 nights written up".

**The tradeoff, stated:** this adds a level — page, shelf, month, night. The summary strip is what
pays for it, because a coach who came to find out how the season went now stops a level earlier than
they used to. If it turns out coaches open months routinely, the summary isn't doing its job and the
design was wrong.
