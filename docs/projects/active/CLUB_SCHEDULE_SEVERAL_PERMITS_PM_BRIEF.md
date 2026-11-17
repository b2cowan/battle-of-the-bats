# PM brief — a schedule on several permits

**Proposed functionality.** A club builds one schedule on the time it holds, however many permits that time came on. The
admin can:
- pick several permits when starting a schedule (each adds its time; none replaces another);
- **add a permit to a schedule that already exists**, even one already sent to coaches, and only the new time is
  scheduled;
- start from **"Any permit — find the time"**: every diamond or field the club holds, narrowed step by step (the next
  three months → Tuesdays and Thursdays → 6 to 8 p.m. → diamonds only) until what's left is the time they want;
- say which venues a **date off** applies to (all of them by default);
- choose how a bill to rep teams prices the time: **each permit's own price** (a team pays for the field it actually got)
  or **one rate for all** (every team pays the same hourly rate, whichever town's field it got). The club recovers the
  same total either way; only the share between teams changes.

**Why it matters.** Clubs rarely get their time on one permit. A town grants three months and the club adds a fourth on
a second permit; a house league plays in two towns, each with its own permit, price and invoice. Today a schedule holds
exactly one permit, picking a second one wipes the first one's time, and the link can't change after the schedule is
made. The only workarounds are splitting the season into two schedules, or recording two towns' parks on one permit,
which leaves the permit with one cost and one issuer and puts the club's books out.

**Customer impact.** Club owners and admins (the schedule and permit people): one schedule per season, permits recorded
as the towns issued them, and time found by asking "what do I have on Tuesday nights?" instead of opening each permit.
Treasurers: bills that match what each town charges, or one rate if the club prefers it. Coaches: nothing new to learn;
their practices and their team's bill arrive the way they do today. Families: unaffected.

**Who has it.** Permits and schedules ride with League Plus, Club and Club · Association; billing teams is Club and
Club · Association. None of these plans is on sale yet, so no paying club uses this today.

**Priority.** Medium-high for the Club release: the two-town and fourth-month cases are ordinary club seasons, not edge
cases. Draw it after the 13c walk; build it after Stage 13d (which also reads the schedule's bill) and before 13h (the
naming pass), so 13h names its new words.

**Success.**
- A club with two permits makes one schedule and generates drafts across both.
- Adding a fourth-month permit to a sent schedule schedules only that month and moves no practice already sent.
- The finder narrows "all my diamonds" to the time that fits in four choices or fewer.
- A date off for one town's park leaves the other town's practices in place.
- A bill per permit matches each permit's own price per hour; a one-rate bill gives every team the same hourly rate;
  both total the same.

**Where it stands (2026-11-14).** The first of five build sessions is done on dev. New schedule takes several permits:
each one ticked brings its own rows, which show their park and sit under that permit's card, and unticking one takes
away only its time. The schedule's top line names every permit behind it, and a permit's "used by" names every schedule
that hands out any of its time. A one-permit schedule works and prices exactly as before. Still to come, in order: dates
off by park, Find the time, the bill priced per permit, then Add time. Until the bill session, a schedule on several
permits bills at the first permit's hourly rate, so its bill is not ready to walk.

**Added 2026-11-16: each team's amount (ruled, not built).** In Bill the teams, a club can choose "An amount I choose
for each team" and type each team's figure, starting from what its time costs. "A part of it" becomes "A total I
choose". When the bill is more or less than the permits cost, an amber warning says by how much, and the club can still
add the bill. Coaches are told the figure was "set by the club". If a team's time changes after the bill is sent, the
change is billed at the permit's price on top of the amount, and the club can switch that off for a flat deal. Why it
matters: clubs often charge round figures or give one team a break, and today the product can only split by the hours.
Success: a club bills $3,000 / $2,000 / $3,000 in one window and every coach gets the right amount and payments.
Drawing: https://claude.ai/artifact/FwoSTHUojVjWUa97bZGVnJ.

**Added 2026-11-16: Add time becomes a second schedule, shown as one (ruled, not built).** A draft is simply edited, and
its Settings can now add or remove permits. Once a schedule is final and sent, Add time makes a new part of it with its own
permit (any, including one already on the schedule), its own dates (a week, a day or months), its own teams (one team
ticked gets all of it) and its own bill, chosen when the changes are sent. The original practices and bill never change.
The schedule page stays one schedule, with a Part filter and a line naming the added time. Coaches see a second charge,
"Fall practices · Time added Nov 16". Why it matters: in the walk the owner could not add one practice for one team, use
more of a permit already on the schedule, or pick the dates of the new time. Success: one extra practice for 14U AA on
one evening, billed $135.00 to 14U AA alone, with every earlier payment unchanged. Drawing:
https://claude.ai/artifact/6Bz3gQSuyrot2HsQnkYX5P.

Plan: `docs/projects/active/CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md`.
