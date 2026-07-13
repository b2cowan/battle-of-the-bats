# PM Brief — Scheduled Jobs Wiring (Weekly Digest + Automatic Dues Reminders)

**What it does:** The coach "Your week in review" notification now sends itself every Sunday evening, and dues reminders go out every morning without anyone pressing a button. Both run on a timer inside the platform's existing database — no new services to operate.

**Why it matters:** The digest was built but only fired when the operator triggered it by hand — "weekly" wasn't real until now. Dues reminders claimed to be automatic in spirit but actually depended on a human remembering; late reminders cost teams real money at the deadline.

**Who benefits:** Every coach on a Premium team (digest); every family with a dues installment coming due, and the coaches/treasurers who no longer chase them (reminders). The operator stops being a human cron job.

**Expected impact:** Sunday evenings, coaches' phones light up with their team's week — only when something stood out. Families get consistent, predictable nudges ahead of due dates. Zero new operating cost; the manual trigger stays available as a backup and for testing.

**Tradeoffs accepted:** The built-in timer has no automatic retry — a tick that lands mid-deploy is simply lost. Both jobs are deliberately safe to miss and safe to double-fire (nothing sends twice; a missed digest catches up on the next tick), so the worst case is a delay, never a duplicate. Send times drift by an hour when the clocks change (accepted for these jobs). If we ever need guaranteed delivery or exact local times, a purpose-built AWS scheduler drops in without changing anything in the app.

**Safety gate:** Because dues reminders will now reach parents with no human in the loop, their wording and timing get an explicit owner review before the daily schedule goes live.

**Priority:** High — it completes the digest feature (the "Sunday" promise in the help guide) and removes a silent manual dependency in money collection.

**Success criteria:** A digest arrives Sunday evening with no operator action; a test family receives a dues reminder on the right day relative to the due date; the operator dashboard/audit trail shows each run; double-fires and missed ticks demonstrably cause no duplicate sends.
