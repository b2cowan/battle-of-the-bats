# Stack health check — a part-time devops team and DBA, every morning

**Status (2026-09-26):** owner said go 2026-09-26 ("yes go ahead, include the daily schedule").
**BUILT the same day, all three stages; the task is installed and was proven end to end** (§8).
Owed from the owner: a Resend key for the email channel (§4). The desktop notification is live
without it. PM brief: [STACK_HEALTH_CHECK_PM_BRIEF.md](STACK_HEALTH_CHECK_PM_BRIEF.md).
Origin: the DB-load incident, [DB_SNAPSHOT_REFRESH_LOAD_PLAN.md](DB_SNAPSHOT_REFRESH_LOAD_PLAN.md) §9.

## 1. The owner's brief (09-26, in his words)

"I think the best are safety nets that can run checks to make sure that our processes are as
efficient as possible. I don't want these checks to take up a lot of time or resources, but want
them to be able to check our stack (essentially like having a professional devops team including a
dba that is there to make sure we are running efficiently)." He also asked for the daily schedule,
where the history is logged for review, and how it alerts him when anomalies begin to show up.

Not wanted: approval prompts or approval ceremonies ("these approval messages don't mean anything
to me").

## 2. Shape

One script, `scripts/stack-health.mjs` (`npm run health`), that produces one report. Every check
returns green / amber / red / unknown, a value, one line of detail, and for anything not green a
plain "what to do". The report shows what is **new or worse**, never 1,000 standing lint lines.

| Area | Check | Source | Red | Amber |
|---|---|---|---|---|
| DBA | Slow statements yesterday (>10 s) | log service | >10 or >300 s | ≥3× the 7-day median |
| DBA | Heaviest queries yesterday: the delta of the pg_stat_statements snapshot vs the last run | one catalog read | – | a new query in the top 3 by time, or ≥3× its own median |
| DBA | Vitals: connections/limit, cache hit %, stuck and idle-in-tx sessions, dead-row bloat, replication-slot lag, failed cron runs, pg_net backlog, database size growth | one catalog read (~160 ms) | connections ≥80%, a stuck session, slot lag >1 GB, cron failures on PROD | connections ≥60%, cron failures on dev, size +20%/week |
| DBA | Supabase advisors (performance + security), NEW findings only vs a stored baseline | Management API | a new security WARN/ERROR | a new performance WARN |
| DBA | Dev-vs-prod schema: prod behind dev | the existing drift check | – | informational: migrations waiting for prod |
| DevOps | Requests per day by client (server / browser / other) | log service | ≥5× the 7-day median and ≥200k | ≥3× the median and ≥50k |
| DevOps | Errors: 5xx count and rate, auth 429 rate-limit hits, realtime subscription errors | log service | prod 5xx ≥1% with ≥20 errors | ≥3× the median; any 429 on prod |
| DevOps | Slowest endpoints (p95 origin time) | log service | – | overall p95 ≥2× the median |
| DevOps | Deployments: latest dev and master build status and duration | AWS CLI (Amplify) | the latest build FAILED | duration ≥1.5× the median of the last 10 |
| Agent tooling | Hook errors in agent sessions yesterday | local transcripts | ≥20 | ≥1 |
| Agent tooling | Commits that touched agent automation or the database checks | `check-agent-automation.mjs` | – | any (a review line) |

Anomaly rule: compare against the median of the last 7 recorded days. It needs 3 or more days of
history; before that, only the absolute limits apply. Every threshold is a named constant at the top
of the script.

**Honest gap:** the Supabase compute chart (CPU/memory) is not readable with our access token (the
dashboard endpoint needs a browser session). Slow statements, heaviest queries, connections and
traffic are the proxies, and each would have flagged the 09-21 spike.

## 3. History (where the owner reviews it)

`.health/` at the repo root, gitignored like `.probe/`: private, local, never git noise for agents.
- `latest.md` — the newest report (open it in VS Code).
- `reports/YYYY-MM-DD.md` — one report per day.
- `history.jsonl` — one line of metrics per day. It is what the medians and a trend dashboard are
  built from.
- `state.json` — the advisor baseline, the last pg_stat_statements snapshot, the last digest date.
- `last-run.log` — the scheduled task's output, for when something fails.

`dashboard.html` is the browser view of all of it (§9): `npm run health:open`.

## 4. Alerts

- **Red → a Windows desktop notification** at the moment of the run. It stays in the notification
  centre if the owner is away, and needs no setup: the built-in toast API through Windows PowerShell.
  Proven 09-26.
- **Red → an email that morning** to `PLATFORM_ADMIN_EMAILS` (or `HEALTH_ALERT_EMAILS`), through
  Resend from `RESEND_FROM` (default `FieldLogicHQ <hello@fieldlogichq.ca>`). The subject names the
  problems; the body is the report. **Needs `HEALTH_RESEND_API_KEY` in `.env.local`**: a key with
  sending access, created in Resend for this check only. `.env.local` has no mail key by design, so
  the dev app never emails real people, and the product's own key must never go there for the same
  reason. Until the key exists, the scheduled run logs "Email skipped".
- One alert per day per set of reds (`state.lastAlert`), so a re-run doesn't re-alert.
- **Monday digest** — always sent: the week's green/amber/red per area plus the ambers to review.
  It is also the **heartbeat**: no Monday email means the check is not running.
- Advisor findings are baselined, so a long-standing lint never alerts. Only new ones do.

## 5. Schedule

A Windows Task Scheduler task, "FieldLogicHQ stack health", runs daily at 7:30 a.m. local:
`node scripts/stack-health.mjs --scheduled`, with the working directory at the repo, StartWhenAvailable
(runs on wake if the PC was asleep at 7:30), and only while the owner is logged on (no stored
password). `--scheduled` records history and sends email; a plain `npm run health` does neither.
`/release` step 1c-1 runs `npm run health` and puts the verdict in the Release Summary, and warns
when `latest.md` is more than two days old.

## 6. Cost

Per run: about 0.2 s of database work per project; the rest reads Supabase's log and advisor
services, AWS and local files. Target under 60 s wall time, with dev and prod in parallel. Nothing
runs continuously.

## 7. Stages

1. **Database and traffic:** the DBA rows and the DevOps request/error/endpoint rows, the report
   format, and a replay against history (09-21 and 09-25 must be red, 09-26 green).
2. **Deployments and agent tooling:** the Amplify rows, hook errors, automation changes.
3. **History, anomalies, alerts, schedule:** `.health/`, the medians, Resend email (one real test
   send to the owner), the Task Scheduler task, and the `/release` step.

## 8. Built and proven (2026-09-26)

- **Files:** `scripts/stack-health.mjs` (`npm run health`); `scripts/lib/supabase-ops.mjs`
  (read-only API helper: SELECT/WITH only, at most 3 requests in flight, and a 429/503 retries with
  backoff, because the Management API throttles per account token and every agent shares it);
  `scripts/stack-health-task.cmd` (the launcher; output to `.health/last-run.log`);
  `scripts/stack-health-schedule.ps1` (installs/removes the task, headless through
  `conhost --headless`); `.gitignore` gains `.health/`.
- **Replay 09-17 → 09-25** (log-based checks): every day red for slow queries on both databases,
  naming the snapshot query (dev 305/536/12/192/1,177/921/160/573/857, prod 154/268/6/96/589/460/80/287/420).
  Dev traffic amber on 09-21, 22 and 25 (×4.6, ×4.3, ×4.3 the 7-day median); dev database errors
  amber (×4.8). The first replays hit "ThrottlerException: Too Many Requests", which is why the
  retry exists.
- **Live run (09-26 for 09-25):** 10–19 s. Beyond the known incident it found: dev connections at
  65% (amber), two failing dev cron jobs (`observability-metrics-fold`, `schedule-change-notices`),
  about 4,100 live-update filter errors a day, 114 dev 5xx, and 50 hook failures in agent sessions
  on 09-25. The advisor baselines: ~1,050 performance + 138 security findings per project, standing.
- **Fixed on the way:** the AWS CLI crashed on an emoji in a master commit message ("'charmap'
  codec"), so the check now asks only for the four job fields it needs, with the CLI set to UTF-8.
  The check's own catalog reads are tagged `/* stack-health */` and excluded from the heaviest-queries
  ranking.
- **Scheduled task:** installed ("Ready, next run 09/27/2026 07:30"). Started by hand, it exited 0
  in 17 s, rewrote `latest.md`, showed the red desktop notification and logged "Email skipped" (no
  key yet).
- **History seeded:** the 09-17 → 09-25 replays sit in `.health/history.jsonl` and `reports/`, so
  the medians work from day one and the incident is on record.

## 9. The local dashboard (owner ask 2026-09-26, built the same day)

"A simple local front end that is git ignored where I can open a browser and see a dashboard for
the issues, history, etc."

- **The page is `.health/dashboard.html`: gitignored, local only, never deployed.** It is one
  self-contained file (no server, no libraries, no network) that opens from file://. The two
  pieces that BUILD it are committed, so it survives a clean checkout and works on the second
  machine: `scripts/stack-health-dashboard.mjs` and the template
  `scripts/lib/stack-health-dashboard.html`. That split was said to the owner up front.
- **Rebuilt** after every recorded run, i.e. the 7:30 a.m. task. On demand: `npm run health:dashboard`,
  or `npm run health:open` (rebuild + open in the default browser). The red desktop notification
  points at `npm run health:open`.
- **What it shows.** Always on top: the verdict pill, when the report ran and the task's next run,
  and banners when the run is more than 48 h old, when the task is missing or failed, or when email
  is off. Then **three tabs** (owner ask, 09-26):
  - **Latest run:** summary tiles (problems, to review, fine, could not check, red days of the last
    7) and the issues as cards with "what to do".
  - **History:** a strip of up to 60 days. Click a day to see every check, with filter chips by
    status, search, and the full report text.
  - **Trends:** 9 metrics as small multiples, dev and prod each on its own axis (one axis per
    chart), 30 days, a dashed 7-day-median reference line, crosshair + tooltip, and a table view
    per chart.

  The tab lives in the address (`#latest` / `#history` / `#trends`), so a refresh or bookmark
  lands on it. Tabs follow the ARIA tablist pattern (arrow keys, Home/End); counts show in the tab
  labels, and are hidden under 520 px so the row fits a phone. Charts draw only while Trends is
  showing, because a hidden panel measures 0 px wide. The tab marker uses `location.replace`,
  because `history.replaceState` can throw on file:// pages. Light/dark follows the OS, with a toggle.
- **Data:** metrics from `history.jsonl`; checks parsed from `reports/<day>.md` (the report is the
  source of truth for the detail and "what to do" text); task state from Get-ScheduledTask; email
  configured as a yes/no only (the key never enters the page). The JSON is embedded with `<`
  escaped, so no string in the data can close the script tag.
- **Verified in a headless browser** (Playwright, `.probe/health-dash/`): no script errors in light,
  dark or phone; the hover tooltip reads "Sep 23 · dev · 119,341 requests · day: Problem"; a day
  click gives 16 rows for 09-21 and the red filter 2; no horizontal overflow at 1280 or 390 px.
  Round 1 found the axis text unreadable (the SVG scaled down) and the day table 22 px too wide on
  a phone. Charts now draw at their measured pixel width and redraw on resize; the day table
  scrolls in its own box and drops the Area column under 720 px.

## 10. Success criteria

- The 09-21 and 09-25 replays come out red, naming the snapshot query and the traffic spike; 09-26
  comes out green.
- A daily run takes under 60 s with less than 1 s of database work.
- The owner receives a test alert email and the first Monday digest.
- The task survives a reboot, and the report is in `.health/latest.md` by 7:35 a.m.
