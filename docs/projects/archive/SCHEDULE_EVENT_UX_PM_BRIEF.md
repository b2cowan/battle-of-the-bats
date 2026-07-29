# Schedule & Event Experience — PM Brief (Tier 1)

**What this is:** A focused rework of how a Premium coach **creates and views events** on the team
Schedule. Today every event type — a 3-day tournament, a league game, a Tuesday practice, a team party —
flows through the *same* generic form and the *same* tall, stacked detail panel. This makes the coach
hunt for the right fields, type information twice, and scroll past a wall of labels to reach attendance or
the lineup. The rework tailors the experience to each event type and trims the clutter.

**What the coach sees that's new:**
- **A form that fits the event.** Creating a game shows opponent + home/away and a smart, pre-filled name;
  creating a practice shows the recurring schedule; creating a tournament asks for a **date range**, not a
  single time. Fields are grouped under plain headings (**When / Where / Who / Notes**) instead of one long
  list of inputs.
- **No more typing the name twice.** For games, the name fills itself in from the matchup
  ("League Game vs Lady Jays") and can be edited — it's no longer a required box that just repeats the
  opponent.
- **Home/Away that's hard to miss.** It's now a clear choice with a sensible default, because it quietly
  controls how the dugout printout reads ("@" vs "vs") and which side your win/loss is recorded on.
- **A tidier event panel.** Opening an event shows a compact header (date · time · place · opponent) and
  gets you to **Attendance / Lineup / Result** without scrolling — a real difference on a phone at the field.
- **Tournaments that behave like tournaments.** A multi-day tournament spans its days on the calendar, and
  its individual games clearly attach to it (instead of floating loose).

**Why it matters:** The Schedule is the coach's day-to-day home base. Friction here — redundant typing,
the wrong fields, a cluttered panel, a tournament that only shows on one day — is friction they hit every
single week. Tightening it makes the paid portal feel built *for* coaching, not like a generic calendar.

**Coming right after (needs a small data change):** the three most-requested game-day fields — **arrival /
call time**, **field / diamond #**, and **uniform / jersey** — drop into the new grouped form. These answer
the questions parents text the coach most on game day.

**Also planned — attach links to an event (decided 2026-06-28):** a coach can add labelled **links** to any
event — a YouTube drill, a Google Doc practice plan, a tournament's rules page, a field map — shown as
clickable rows on the event. Starts with links (fast); **file uploads** (e.g. a rules PDF) follow on,
reusing the existing Documents storage. Today this is the coach's own at-hand reference (the portal is
coach-facing); it's built ready to share with parents/players the moment a parent view exists.

**Now decided:** the **season W-L-T record** defaults to League + Tournament (scrimmages excluded) with
small live on/off toggles per category that remember the coach's choice.

**Priority:** High — surfaced during the Premium portal walkthrough; the Schedule is the most-used coach
surface and the owner flagged it as needing the most work.

**Sequencing:** Phase 1 per-type grouped form → Phase 2 slimmer detail panel → Phase 3 tournament date-range
+ calendar spanning (none need a data change) → then the new game-day fields (one small data change). Each
ships and is verified on its own.

**Success criteria:** A coach builds any event type with only the fields that matter, never types redundant
information, sees a multi-day tournament correctly on the calendar, and reaches attendance/lineup in one
screen — on desktop and phone.
