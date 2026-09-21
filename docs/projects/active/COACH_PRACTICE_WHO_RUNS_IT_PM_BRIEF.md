# PM brief — A station knows who runs it

**Status:** drawn 2026-09-17 · ruled the same day (A–K as recommended) · **built on dev the same day**, after
the Stage 5 and P10 commits · owner QA walk §203 owed on the hub's QA tab · commit on the owner's word ·
migration 303 to prod before the promote. Plan: `COACH_PRACTICE_WHO_RUNS_IT_PLAN.md` (§10 is the build record).

## What a coach can do that they couldn't before

- **Tag a station with a person, not just a word.** The Staff picker on a block or station now opens
  with the team's own people first — head coach, assistants, helpers, manager, treasurer, each with
  their word — and picking one links the tag to their account. The tag still reads as the coach's own
  label ("Craig"); outside instructors stay a plain word, exactly as today.
- **Fix the old names once.** In the staff tag manager, "Jen" can be linked to Jen with one control;
  every practice already written that says "Jen" then knows who that is.
- **Send the plan to the right people.** A **Send to staff** button on a finished plan offers three
  audiences — *Named in this plan* · *Coaches and helpers* · *Everyone on staff* — each showing who it
  reaches by name, with a preview of the message. Managers and treasurers stop receiving practice
  plans unless the coach chooses "Everyone". The toolbar then says when and to whom it went; sending
  again is always allowed.
- **Email them too, when it matters.** A tick on the same sheet sends the coach's own email — the
  message, the outline with their rows marked, a button to the plan — to everyone in the audience,
  whatever their notification settings say and even if they have paused notifications. It is the
  coach's explicit act, on the same footing as a dues reminder; the email names the coach and says
  why it arrived. Off by default, remembered.

## What an assistant sees that they didn't before

- A phone notification the moment the coach sends it — *"Tuesday's practice plan is ready — you're on
  Footwork ladder and Close control. Arrive by 5:45 p.m. for 6:00 p.m."* — that opens the plan.
- On the plan, a quiet **"You're on …"** line under the title listing their blocks and stations in
  order, each a jump; those rows wear a small **you** mark. Nobody else's plan page changes.
- On the field, "that's you" / "You're running" fires **reliably** on every station and block that is
  theirs. Today it works only when the tag's spelling exactly equals a member-list field that is often
  blank — it fails silently for most teams and nobody knows.

## Why it matters

The practice plan is the one document a whole staff shares in the hour before a practice. Today the
only way an assistant learns a plan exists is to go looking, and the only way they learn which
station is theirs is to read for their own name. The notification closes the first gap; the identity
link closes the second — and makes the notification worth sending, because it can name their stations.

## What was deliberately not proposed, and why

- **An automatic reminder before every practice.** A scheduled send is a second decision (a cron, a
  quiet-hours policy, what "before" means); the button is the one the coach controls. Revisit if asked.
- **Marking "you" on the printed sheet.** Paper is for everyone at the table.
- **Any change to what a helper or assistant can open.** A tag is a label, never a grant — the
  2026-07-31 ruling holds. Linking gives a person nothing they couldn't already read.
- **Keeping the old name-matching as a fallback.** It would keep working for some teams and hide
  from everyone that the link was missing. The honest path is the "a name only, not sent" line.

## Customer impact

Every team with more than one adult on staff, every practice. The coach's cost is one button and,
once, linking a few tags. The assistant's benefit is the difference between "there's a plan
somewhere" and "I'm on Footwork ladder at 6:10, here's the sheet".

## Priority

After the Stage 5 build commits (it rewrites the same screens); before the next practices-area work.
The link is the first half to build — the send's best audience depends on it.

## Success criteria

- A linked assistant opens a plan they are named on and sees the "You're on …" line without hunting;
  on the field every one of their stations says "that's you" — by identity, with a blank member name.
- "Named in this plan" reaches exactly the linked people on the plan and lists the unlinked words as
  not sent; a manager receives nothing unless "Everyone" was chosen.
- The push arrives on the owner's Android device (the open diagnosis re-tested before ship).

## Decisions for the owner

Eleven lettered questions on the hub's Decisions tab (helpers in "coaches"; the default audience; merge
carries the link; channels; no name fallback; build order; where the strip sits; "changed since" —
recommended deferred; where the sent stamp lives; the coach's email bypassing settings and the pause;
what the email carries). Each has a recommendation and a paste-back.

## Follow-up (2026-09-20) — one assistant first

- **Just these people.** Under the three audiences on *Send to staff* there is a fourth: tick names
  from everyone the plan could reach (each with their role word) and send to just them — the way a
  head coach hands a plan to one assistant to read over and tidy before the group gets it. The line
  under the toolbar then names them — *Sent to Jen Okafor · bell and push · 4:12 p.m.* — so whoever
  opens the plan tomorrow knows who has it and who doesn't.
- The sheet keeps remembering your last *group* choice; a hand-pick is never made the next default (so
  Monday's send to one assistant can't quietly make Tuesday's go to them alone), but the names you last
  ticked stay ticked inside *Just these people*.
- **Staff**, everywhere. The people line on a station is labelled *Staff*, as it is on a block and on
  the door that opens it — it read "Who runs it" before. Nothing else on a station changed: the five
  teaching fields already matched a drill's, field for field.
- One small migration (305) is applied to dev and owed to prod before the next promote.
