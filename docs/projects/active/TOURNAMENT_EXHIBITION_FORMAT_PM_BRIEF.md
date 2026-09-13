# PM Brief — Exhibition: a third tournament style, no playoffs

> Plan: `TOURNAMENT_EXHIBITION_FORMAT_PLAN.md` · Hub (mockup · brief · plan · decisions):
> https://claude.ai/code/artifact/1ec04652-246a-4c18-a6a4-bfd308a7dfd9 · Proposed 2026-09-13; the owner
> ruled the name (Exhibition) and that no standings-less format is needed the same day, accepted
> the two remaining recommendations, and it was **built on dev the same day** (no migration) —
> `/simplify` + `/review` (one real defect found and fixed) + `/docs` done the same day — QA walk
> on the hub's QA Walk tab, ledger §184.

**What it does:** When an organizer creates a tournament, the "Tournament style" step offers a
third card beside *Round robin + playoffs* and *Bracket only*: **Exhibition** — games and
standings, no playoff bracket. Picking it means the product stops promising a bracket everywhere
it currently does: the schedule shows one list of games instead of a Round Robin / Playoffs
switch, the dashboard never nudges "set up a playoff bracket", and the public page never shows a
Playoffs toggle that reads "No playoff games yet". The moment the last score is in, the dashboard
says **Ready to finalize** instead of waiting for the next day.

**Why it matters:** The product already sells this. The coaches marketing page promises "your
round-robin, exhibition weekend, or local event"; the coach portal's own set-up card says "A quick
round robin or exhibition weekend, set up from here"; the owner's delegation ruling describes the
head coach's job as "run the exhibition weekend". The style picker is the only surface that
contradicts all three, because both of its cards end in a bracket. Nothing blocks a coach from
running a scrimmage day today, but four surfaces nag them about a bracket they will never build,
and parents see a Playoffs stage that never comes.

**Who benefits:** Every organizer, on every plan — the style is a property of the tournament, so
a club running a jamboree gets it too. It matters most to the **standalone Premium coach**, whose
plan carries free-tier tournament tooling: no round-robin generator and no bracket generator.
They type each scrimmage in by hand and were never going to touch a bracket, so every bracket
nudge is noise aimed at exactly them. No role or plan gating changes.

**What changes for the organizer:**
- **Creating a tournament** — three style cards instead of two, in the setup wizard and in the
  org sign-up wizard. The new card reads *Exhibition — Games and standings, no playoff bracket —
  for a scrimmage day or an exhibition weekend.* On a phone the cards stack.
- **Event settings → Schedule Rules** — the Tournament Format control gains an *Exhibition*
  segment, with its own one-line description and the card summary reading *Exhibition · 60m
  games*. Still locked once the event leaves Draft; switching still clears the schedule when games
  exist (recommended ruling D3).
- **The admin Schedule page** — no Round Robin / Playoffs stage switch; View offers List and
  Timeline; *Add Game* stays the main button; the empty state says "Add your games by hand" and
  mentions the Round-Robin Generator only as the Plus upgrade; no Build Bracket button, no Bracket
  PDF.
- **The dashboard** — before the event the shortcut "Set up a playoff bracket" reads "Add your
  games"; on game day "View the playoff bracket" reads "Print today's schedule"; when the last
  score lands the status pill flips to **Ready to finalize** and the card says *Every score is
  final. Mark the tournament complete to lock in your results and standings.* — no mention of
  champions, because there are none.
- **The public schedule** — one list of games, no Pool Play / Playoffs toggle. Standings stay on
  the public page as today, and the organizer hides them with the existing Hide Standings switch
  if a scrimmage day should have no table (ruling D2). The public overview already knows how to
  finish a tournament with no bracket, so nothing changes there.
- **Help** gains a sentence per touch-point for the third style. **The demos do not change**
  (recommended ruling D4).

**Expected impact:** A coach can set up a one-day scrimmage in the same number of taps as today
and never see the word "bracket"; families see a schedule that promises exactly what will happen;
the organizer gets the close-out prompt the same afternoon rather than the next morning; one fewer
"do I have to build a bracket?" support question.

**Trade-offs made:**
- Switching a Draft's format with games already typed still deletes them all, even though
  Exhibition and Round robin + playoffs share identical round-robin games. Kept for this pass
  because the format is only changeable in Draft and a draft rarely has games; a smarter rule is a
  small follow-up if anyone asks (D3).
- Exhibition still runs standings. A pure scrimmage day with no table is the existing Hide
  Standings switch, not a fourth format (D2).
- The Round-Robin Generator stays a Tournament Plus feature; Exhibition does not unlock it for the
  standalone coach.

**Priority:** Medium — small build (about a day and a half including tests, help and review), no
migration, no plan or gate change; it closes a gap between the marketing copy and the picker on
the surface a new standalone coach reaches first. Sequence after the roster/player-page and
development-lifecycle commits in flight so the review runs on a clean diff.

**Success criteria:** An organizer who picks Exhibition sees no Stage switch, no Build Bracket
button and no bracket wording anywhere on the admin schedule; the public schedule for that event
has no Pool Play / Playoffs toggle; the dashboard reads *Ready to finalize* the moment the last
game is scored, and a round robin + playoffs event whose bracket is not built yet still does NOT
(the original safeguard survives, pinned by a unit test); the word "Exhibition" is the only name
the third style has anywhere a customer reads it.
