# PM Brief — Coach Roster + Player Record

**One line:** the roster stops spending its best column on a word that reads the same on every row, and
the player record stops being a filing cabinet.

**Plan:** `COACH_ROSTER_AND_PLAYER_RECORD_PLAN.md` ·
**Mockups:** https://claude.ai/code/artifact/fe469a92-5808-4974-8e3a-00b0e1a7c452

---

## What a coach sees differently

**On the roster list.** The Status column and the twelve grey "Deactivate" buttons down the right edge
are gone. In their place: the guardian's **name** instead of a 40-character email address, and small
markers on the name itself — a star for an A-squad player, a rank for a pitcher, a flag for a child with
medical notes on file. Where something is missing, the row says so quietly in the cell where the value
would be — *Add a position* — instead of a summary line at the top telling the coach that three players
somewhere below need one.

Players who have been taken off the team no longer sit in the middle of the batting order looking almost
identical to everyone else. They fold into one collapsed line at the bottom: *Off the roster (2)*, with
**Add back** beside each.

**On a player's page.** It opens with the player, not with a form: jersey, positions, age, the
flags that matter, and four figures a coach actually wants — what they owe, whether they turn up,
who to call, and what they have won this season. Underneath, three tabs instead of nine drawers:
**This season** (development, playing time, awards), **Details** (the April form), and
**Family & paperwork** (contacts, safety, documents).

**Removing a player is now a named action.** It leaves the top of the page — where the first control
under a child's name was a delete button — and moves to the foot of Details, reading **Take off the
roster**, with a confirmation that says what happens: they stop appearing in lineups, attendance, dues
and team emails; everything recorded is kept; you can put them back.

## Why it matters

The roster is the page almost everything else in the portal reads from, and it was the page giving a
coach the least back. Two of its six columns said the same thing on every row. Meanwhile the action that
removes a child from every lineup, attendance sheet and dues run was a small grey button repeated on
every row — the most consequential thing on the page dressed as the least.

## What was deliberately left out

- **Dues.** It was in the mockup and the owner ruled it out. Money stays on the money screens; this is a
  page a coach opens standing beside a parent.
- **Attendance.** It has one front door in Reports, and a second door here was removed once before
  because it kept sending coaches "back" to a page they had never visited.
- **Filter chips and counts.** A roster is twelve to eighteen rows on one screen. Filtering it is slower
  than reading it.
- **The "on the family app" badge.** The per-player version of that data sits behind the guardian tier,
  which is shipped switched off pending privacy counsel review. The column is built so the badge drops
  in later rather than needing a rebuild.

## Access

Unchanged. Assistant coaches without guardian-contact access see the Family column redacted exactly as
they saw the Guardian column redacted. Only a head coach (or an assistant granted roster-write) sees
**Take off the roster** or **Add back** — the server already refuses the rest.

## Success criteria

- A coach can tell, without opening anyone, who has no position and who has no contact on file.
- A player who has been taken off the team cannot be mistaken for one who hasn't.
- Removing a player takes a deliberate act with a stated consequence, and cannot happen by mis-tapping a
  list.
- A player's page answers "how is this kid doing" before it asks "what is their jersey size".

## Not included / follow-ups

- Per-team **required documents** — no such list exists anywhere in the product, so nothing can honestly
  say a document is "missing". Documents are counted on the Family & paperwork tab; building a required
  list is its own decision.
- Reordering the roster is **desktop-only** as of this session (owner's call). If that turns out to bite,
  the put-back is one line.
