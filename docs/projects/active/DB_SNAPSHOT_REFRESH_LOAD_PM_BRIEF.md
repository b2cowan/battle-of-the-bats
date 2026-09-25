# PM Brief — Our own tooling stops maxing out the database

**Status:** all three steps done 2026-09-25; D1 ruled "correct it once". The one remaining check
is tomorrow's slow-query count on both databases. · **Date:** 2026-09-25 ·
**Plan:** [DB_SNAPSHOT_REFRESH_LOAD_PLAN.md](DB_SNAPSHOT_REFRESH_LOAD_PLAN.md)

## What was wrong

The development database hit 99% CPU on Sep 21–22. Customers and product features did not cause it.
Our AI-assistant setup did: an automation meant to run only after a database change was running
after almost any command an assistant ran, up to 580 times a day. Each run made both databases
(development and **production**) do about 15 seconds of heavy work. Since April, this has been about
90% of all the work the production database has done. The public demos run on that database.

## What changes

1. **Done today:** the automation is switched off. Assistants and the owner run the refresh by hand
   after a database change. The migration tool already reminds them, and a build check fails if they
   forget.
2. **Planned:** bring the automation back in a form that checks for itself that a database change
   really happened and succeeded, and never runs two copies at once.
3. **Planned:** make the refresh itself cheap, about a second instead of 15–20 seconds. It also
   corrects 16 entries in our schema record that currently describe links between tables wrongly.

## Why it matters

- Production has headroom for customers and the demos instead of spending it on our tooling.
- Development no longer slows to a crawl when several assistant sessions work at once, which is the
  way this project is normally worked.
- The schema record every assistant reads becomes accurate for the team-scoped player tables.

## Customer impact

Nothing visible changes. The benefit is steadier response times on the live site and in the demos,
and no risk of a slowdown on a busy development day spilling into production.

## Decision needed

**D1:** correct the 16 mis-recorded table links once (recommended), or keep reproducing them exactly
as they are.

## Success looks like

- Slow database statements (over 10 seconds) fall from about 500 a day to about zero.
- A refresh takes seconds, not most of a minute.
- The next heavy development day shows no CPU pinning.
