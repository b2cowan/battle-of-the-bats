# Coach Portal — Chunk C: Schedule Intelligence — PM Brief

> **Plan:** `COACH_PORTAL_CHUNK_C_SCHEDULE_INTELLIGENCE_PLAN.md`
> **Status:** planned 2026-07-30. Nothing built. Waiting on mockup approval + nine decisions.
> **Priority:** high — this is the last big "the product costs me time instead of saving it" area
> in the premium Coaches Portal, and it contains a live defect.

---

## The one-line problem

A coach can build a whole season's schedule in the product — but doing it takes longer than typing
it into a group chat, there is no way to bring in a season that already exists, and **the times the
product shows are not the times the coach entered.**

---

## What we found that we did not expect

**Event times are wrong by hours, on a surface that is already in customers' hands.**

A coach types a 6:00 PM game. The portal saves it, and then shows it at **2:00 PM**. If they open
that event and save it again without changing anything, it moves again. This affects every event
created in the coach schedule since it shipped — and it also affects the tournament games we mirror
in from the organizer, which means a coach's calendar can disagree with the tournament they are
actually playing in.

This is not a theory. The correct handling already exists elsewhere in the platform (House League
does it right); the coach schedule simply never adopted it. Both versions are sitting in the
database side by side, which is how we caught it.

**Why it matters commercially:** the schedule is the surface a coach shows to parents. Being
wrong about *when the game starts* is the single most damaging thing a team-management product can
be wrong about, and it is the kind of error a coach discovers in front of fifteen families.

**Why it gates the rest of this work:** the headline feature of this chunk is bulk schedule import.
Importing a season on top of this would take one wrong time and make it thirty wrong times, in one
tap, with the coach's own spreadsheet as proof that we got it wrong.

**Recommendation: fix it first, in this chunk, and correct the existing events** — carefully,
announced rather than silent, with a reviewed dry run before anything changes.

---

## What the coach gets

### 1. Repeat weekly finally works for a real league

**Today:** "Repeat weekly" asks for a day, a time, a date range — and **one opponent**, which it
then stamps onto every game it creates. For a 12-game round robin the coach must go back and
correct eleven of them. It is genuinely *more* work than not using the feature, which is what two
reviewers independently reported.

**After:** the coach sets the pattern once, and instead of a summary sentence they see **the actual
list of games** — one row per date — and type the opponent beside each one. They can delete the bye
week before anything is created. Nothing is written until they say so.

Measured in taps for a real 12-game season: **about 120 today, about 23 after.**

Practices are unchanged in feel — same flow, and the coach now simply sees the dates before
committing.

### 2. Bring in a season that already exists

Most league schedules arrive as a spreadsheet or an email. Today there is no door for them.

**After:** paste it or upload it, and the coach sees every row with a plain-language verdict —
*this one gets added*, *this one updates the game you already have* (naming what changes), *this one
can't be imported* (saying why, in their words). They fix problems in place and commit. It works
with our own schedule export too, so a coach can export, edit in Excel, and bring it back.

**Two things we deliberately will not do:**

- **We never guess a date.** `03/04/2026` could be April 3rd or March 4th. We refuse it and ask,
  rather than picking one. A schedule that is quietly a month wrong is worse than one that asked a
  question.
- **We never overwrite a tournament's own games.** Games mirrored from a tournament belong to the
  organizer. If an imported row looks like one of them we show it side by side and let the coach
  decide — we never merge silently, and "keep both" is a real answer we remember.

### 3. The lineup builder stops fighting thumbs

The reorder arrows in the lineup builder are **18 pixels**. The per-inning position cells are about
**42 pixels tall**. The standard everywhere else in the portal is **44**. Two separate reviewers
found this independently — it is the worst spot in the product for a coach standing on a field.

We also found the underlying cause: **the same screen family currently has two different standards**
(attendance controls were bumped to 36px and labelled "the floor"). We are fixing the disagreement,
not just the symptom, so this does not come back.

### 4. Game morning tells the coach more, without another screen

The game-day card the Overview already shows gains the two facts a coach re-checks on a game
morning — **call time and uniform** — plus an **arm-care warning**.

**On arm care, the important constraint:** we will warn about what we can actually prove — that
today's saved lineup puts a pitcher over the cap *the coach themselves set*, and how many days it
has been since that player last pitched. We will **not** invent a season innings ceiling. Making up
a threshold in a place where the cost is a child's arm is the same mistake as printing an invented
dollar figure in a budget, and it is worse.

It warns. It never blocks, and it never changes a lineup.

---

## Who sees what

| | Head coach | Assistant with schedule + lineup access | Assistant without |
|---|---|---|---|
| Repeat weekly with per-date opponents | ✅ | ✅ (needs schedule write) | ❌ not shown |
| Import a schedule | ✅ | ✅ (needs schedule write) | ❌ not shown |
| Bigger lineup controls | ✅ | ✅ | n/a |
| Call time / uniform on game day | ✅ | ✅ | ✅ — facts everyone on staff needs |
| Arm-care warning | ✅ | ✅ (needs lineup access) | ❌ |

A read-only assistant sees the schedule and never sees a write door — verified by probe, because
this is the leak class that produced five findings in an earlier chunk.

---

## What we are deliberately NOT doing

- **No "notify families of the new schedule" email.** It will come up. If we want it, it follows
  the rule we just set for tryout decisions: **opt-in, off by default**, riding the individual
  action. Not defaulted on, and not in this chunk.
- **No new sport assumptions in the lineup builder.** That surface has known baseball/softball
  vocabulary debt. This is a *sizing* pass; we are not deepening the debt while we are in there.
- **No third arm-care number we made up.** See above.

---

## Success criteria

1. A coach can enter a real 12-game league schedule in **under 25 interactions** without touching a
   spreadsheet.
2. A coach who has a league spreadsheet can get it in **without retyping any of it**, and every row
   they could not import told them why in their own words.
3. **A time entered is the time displayed** — verified end to end, including after re-saving.
4. Nothing an organizer owns is ever changed by a bulk path — asserted at the data level, not just
   in the UI.
5. Every control in the lineup builder clears the portal's touch standard on a phone, measured.
6. A coach on a game morning learns the call time, the uniform and any arm-care concern without
   leaving the Overview.

---

## Decisions needed before build

Nine, listed with a recommendation for each in the plan (D-C1…D-C9). The four that actually change
what gets built:

1. **Do we fix the time defect and correct existing events in this chunk?** *(Recommend: yes to
   both, first.)*
2. **Recurrence shape — per-date opponent list, or narrow recurrence to practices and push games to
   import?** *(Recommend: the per-date list. Narrowing removes a feature to avoid fixing it, and
   forces a spreadsheet on coaches who don't have one.)*
3. **Arm-care warning — what may it claim?** *(Recommend: only what the coach's own settings and
   saved lineups prove. No invented ceiling.)*
4. **Does the schedule get a "tell the families" send?** *(Recommend: not now; opt-in if ever.)*

---

## Risk worth naming to the owner

**Fixing the times will visibly move existing events.** A coach who has unconsciously learned to
read their schedule as "four hours early" will see everything shift on the day we ship. That is the
correct outcome, and it still needs to be announced in-product rather than done silently overnight.
The correction runs as a reviewed dry run first, with counts, and is reversible.
