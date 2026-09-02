# PM Brief — Tournament Demo Becomes a Daily Snapshot

**What's changing:** The public "See it live" tournament demo currently simulates a scoreboard that
visibly moves — a semifinal score ticks up while you watch, a banner counts down to the next
"moment," a guided-tour step brags that nobody typed the score in. We're turning that off. The demo
instead re-anchors once a night to a realistic snapshot: as of "today," both semifinals are played
with real scores, the championship bracket slot shows the real winner's name already filled in, and
the final itself is sitting on the schedule later that day, not yet played. Nothing animates. The
coach demo (`riverdale-ridge`) already works exactly this way — this brings the tournament demo in
line with it.

**Why:** Two reasons, in order of how they came up but not of importance. First, a routine AWS cost
check turned up that the demo's "keep it live" job was pinging the production app every two minutes
around the clock, plus every visitor's browser was separately polling for score updates every ten
seconds — together a meaningful slice of a month's server traffic, though the dollar cost itself
turned out to be tiny (the whole AWS bill was about $11 for the month). The number is what started
the conversation, but the decision itself is a product call the owner made directly: **visitors
can't write anything in this demo — they can only look — so the point of it is letting someone
explore what the product does, not watching a number change.** Simulating live motion was expensive
to build and keep convincing (it went through several rounds of owner QA to make the timing feel
real) for a payoff that isn't the job anymore.

**Customer impact:** None for real customers — this only touches the public sales demo, not the
live product. A prospect clicking "See it live" gets a demo that looks complete and current every
time they visit, just without the "watch it move" moment. That moment was arguably attention-
grabbing but is gone; in exchange the demo is simpler to trust (nothing can look broken mid-cycle)
and slightly cheaper to run.

**Role-based access:** No change — same public/organizer split, same guided tour structure (four
steps), same moments dock. Two lines of tour narration are reworded because they described watching
something happen in real time; the underlying screens they point at are unchanged.

**Priority / sequencing:** Small-to-medium effort, self-contained to the tournament demo's own
simulation code, chrome, one API route, one migration, and its tests/scripts. No dependency on other
in-flight work. Should ship as one unit (code + copy together) per this repo's standing rule that
demo mechanics and demo narration must never drift apart.

**Success criteria:** The demo looks fully populated and current on any visit, at any time of day,
with nothing that reads as frozen or broken; the guided tour and moments dock make no claim the demo
can't back up; the production cron job runs once a day instead of every two minutes; `npm run
check:demos` and the sandbox health-check script both pass against the new design.
