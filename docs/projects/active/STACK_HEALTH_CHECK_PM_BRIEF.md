# PM Brief — A morning health check for the whole stack

**Priority:** High · **Date:** 2026-09-26 · **Plan:** [STACK_HEALTH_CHECK_PLAN.md](STACK_HEALTH_CHECK_PLAN.md)

## What it is

Every morning at 7:30 a.m., your PC runs a quick check of the whole stack, the way a small devops
team with a database specialist would:

- the databases (slow or heavy queries, capacity, stuck work, failed scheduled jobs, new warnings
  from Supabase's own advisors);
- the traffic and errors the product sees;
- the deployment builds;
- the agent tooling (hook errors, and any change to the automation or the database checks).

It writes a one-screen report and keeps a daily history. It shows only what is new or getting
worse, not a wall of standing warnings.

## How you'll hear about it

- **Something red** (a real problem): a notification on your PC that morning, which stays in the
  notification centre if you're away. It also sends an email, naming the problem and saying what to
  do, once you've created a mail key for it (one-time setup, see the plan).
- **Every Monday:** a short weekly digest, even when everything is fine. If a Monday email doesn't
  arrive, the check has stopped running.
- **Any time:** open the dashboard in your browser (one command, or open the file in the private
  health folder). It shows today's verdict and what to do, every past day at a click, and 30-day
  trend charts. It rebuilds itself after every morning run.

## Why it matters

The database problem found on Sep 25 ran for nearly two months before anyone noticed, and it was
spending about 90% of production's database work. This check would have flagged it the first
morning.

## Cost

About a minute per run, with under a second of actual database work. Nothing runs in between.

## Success looks like

- Replayed on the bad days of Sep 21 and Sep 25, it comes out red and names the cause; Sep 26
  comes out green.
- You receive a test alert and the first Monday digest.
- It keeps running after a reboot, and the report is ready by 7:35 a.m.
