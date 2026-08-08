# Demo organizations — production readiness

**Date:** 2026-08-07
**Purpose:** everything that must be true on production for the two no-login demos to work, in the
order it has to happen. Written for the release step.

**Status (updated 2026-08-07, after execution): DATA IS LIVE ON PRODUCTION. Both actions completed
and verified — see the execution log at the foot of this document.**

**⚠ ONE NEW BLOCKER FOUND WHILE VERIFYING, and it must be fixed before the doors open:
the demo doors do not work on the apex domain.** Details in "The apex-domain defect" below.

---

## What was verified today (against live production, not notes)

| Check | Result |
|---|---|
| Demo orgs exist on prod? | ❌ **No.** Zero `riverdale-*` organizations on the production database |
| Demo orgs exist on dev? | ✅ Both (`riverdale-minor-ball`, `riverdale-ridge`) |
| Tournament demo clock on prod | ✅ `demo-sandbox-tick`, every 2 min, **active** — ticking against an org that doesn't exist (a safe no-op by design) |
| Coach demo clock on prod | ❌ **Absent** |
| Coach demo clock on dev | ✅ **Added today** — migration 226 applied 2026-08-07, verified (`20 8 * * *`, active) |
| Search-engine exposure | ✅ `robots.ts` already disallows the door and both org slugs, in both path forms |
| Seed scripts prod-safe? | ✅ Both refuse the production project unless `--allow-prod` is passed |
| Marketing doors visible on prod? | ❌ No — hidden in production builds by default, and no page links to them |

---

## ⚠ The trap: `check:migrations` cannot see the thing that is missing

`npm run check:migrations` reports **"prod is in sync with dev — no unapplied migrations"**, and that
is true as far as it can see. **It compares tables and columns.** Migration 226 adds neither — it
schedules a cron job — so the gate is structurally blind to it and will stay green whether or not
prod has it.

The migration says so itself, as do 122, 183 and 224 before it. **A green migration gate is not
evidence that the coach demo's clock is running on production.** The only proof is querying
`cron.job` on prod, which is why that row is in the table above.

---

## Why the coach demo must NOT be seeded before its clock exists

The coach demo's promise is a calendar, not a ticker: the 11U's tryout is always **today**, the 12U's
next game is always **this Saturday**. Nothing moves while you watch — so the only thing that can go
wrong is the date, and the date goes wrong once a day.

Seed it onto production without migration 226 and it is correct for one day, then quietly becomes a
demo whose "tryout day" was last week and whose "game this Saturday" has been played — on a surface
we point strangers at as proof the product works. Migration 224's own note calls this failure
**worse than having no demo at all**, and it is exactly the drift the guards exist to catch.

**Order is therefore fixed: clock first, data second.** Both are no-op-safe in the other order, but
this order is never wrong.

---

## The two outstanding production actions

### Action 1 — apply migration 226 to production

Schedules `coach-sandbox-tick` nightly. Adds no tables and no columns. Idempotent (`cron.schedule`
upserts by name), and harmless before the data exists — the reconcile treats "not seeded here" as a
successful no-op.

**Verify after:** `cron.job` on prod lists **both** `demo-sandbox-tick` and `coach-sandbox-tick`, active.

### Action 2 — seed the two demo organizations on production

Requires `--allow-prod` on each script. Both are idempotent with stable ids, so re-running is the
re-anchor rather than a duplicate.

**What it creates — the tournament demo:**
- Auth user `demo-organizer@example.com` (IANA-reserved domain — can never receive mail; random
  password, deliberately never printed)
- Organization **Riverdale Minor Ball Association** (`riverdale-minor-ball`), plan **comped
  Tournament Plus**, `is_discoverable = false` (never listed in /discover)
- Three tournaments: **Summer Classic** (live now), **Season Opener** (finished yesterday),
  **Invitational** (three weeks out, mid-registration)
- 1 venue + 2 diamonds · 2 divisions · 8 teams · pool play scored · bracket seeded from the real
  standings engine

**What it creates — the coach demo:**
- Auth user `demo-coach@example.com` (same unreachable domain and discarded password)
- Organization **Riverdale Ridge Baseball** (`riverdale-ridge`); the demo coach is a member with
  role `coach`, **not owner**, so the shared session cannot reach an admin surface even before the
  write block applies
- Five teams frozen at five moments of a season, with rosters, tryouts, dues, budgets, lineups and
  practice plans
- Every guardian and coach address is `@example.com`

**Verify after:** `npm run check:demos` against production, and open both demos on the live site.

---

## ⚠ What seeding exposes, and what it does not

**It does not open the doors.** The marketing links stay hidden in production builds until that
separate decision is made (logged **Proposed**, `BUSINESS_DECISIONS.md` 2026-08-07). Nothing on the
site will link to either demo.

**But the pages become publicly reachable by URL.** Anyone who has the address sees a fictional club
on the production domain. Mitigations already in place: search engines are blocked by `robots.ts`,
the orgs are non-discoverable, the demo account cannot write (blocked above every route), and it
cannot contact anyone (three outbound chokepoints refuse it, and every address is unreachable).

**Recommended before the doors ever open:** walk both demos on production yourself. A demo is the
one surface where a defect is seen by a stranger before it is seen by us.

---

## Release-day order

1. Promote the code.
2. Apply migration 226 to production. Verify both cron jobs are listed and active.
3. Seed the tournament demo (`--allow-prod`). Verify.
4. Seed the coach demo (`--allow-prod`). Verify.
5. Run `check:demos` against production.
6. Walk both demos on the live site.
7. Doors stay shut until the separate decision is made.

**Steps 2–4 write to production and have not been done.** Nothing in this document has been applied
to production.

---

## ⚠ The apex-domain defect — found 2026-08-07 while verifying, PRE-EXISTING, NOT yet fixed

**A visitor who reaches a demo door on `fieldlogichq.ca` (no `www`) does not get a demo session.**

Proven by tracing the redirect chain on the live site:

```
https://fieldlogichq.ca/see-it-live/coaches
  → 307, Set-Cookie: 1     → https://www.fieldlogichq.ca/riverdale-ridge/coaches/teams/…
  → 307, Set-Cookie: 0     → /auth/login?next=/riverdale-ridge/coaches
  → 200  (the login page)
```

The door runs, mints the shared demo session and writes the cookie **for the host that was asked**
(`fieldlogichq.ca`) — then redirects to the **canonical `www.` origin**. A host-only cookie set on
the apex is not sent to `www.`, so the very next request is anonymous and the coach portal bounces
it to a login screen. Entering on `https://www.fieldlogichq.ca/see-it-live/coaches` works perfectly
(verified: lands on the 12U team page, chrome present).

**Why this is worse than it looks:**

- **The coach demo fails visibly** — every page of it needs the session, so an apex visitor gets a
  login form. That is the worst possible first impression for a no-login demo.
- **The tournament demo fails INVISIBLY.** Its fan pages are public, so an apex visitor sees the
  live event and believes the demo is working — but they hold no demo session, so they are not the
  demo organizer. The flip into the organizer's seat and every operator step of the guided tour
  will not work for them, and the tour's operator beats fall back to sending them through the door
  again. A silently half-working demo is exactly the "these buttons don't seem to do anything"
  verdict this sandbox has already been rebuilt once to escape.
- **The short address is the one people will use.** `fieldlogichq.ca/see-it-live` is what gets said
  aloud, printed on a card, or typed from memory — the exact scenario that motivated giving the
  demos their own addresses in the first place.

**Not caused by this release.** It is pre-existing behaviour of the door plus the canonical-host
redirect, and it was invisible until there were demo orgs on production to walk into.

**Deliberately not fixed in the same breath as a production data seed.** The redirect target comes
from the trusted-origin resolver, which exists to close an account-takeover vector (see
`reference_auth_email_origin_gotcha`) — it is not a file to adjust casually while also writing to the
production database. It needs its own change, its own review, and a test that walks BOTH hosts.

**Blocker status:** does not block this release (the doors are hidden in production builds, so no
visitor can reach them from the site). **It absolutely blocks opening the doors.**

---

## Execution log — 2026-08-07

All three steps run against production and verified.

1. **Migration 226 applied to prod.** Verified: `cron.job` now lists `coach-sandbox-tick`
   (`20 8 * * *`, active) alongside `demo-sandbox-tick` (`*/2 * * * *`, active). Applied to dev the
   same day and verified there first.
2. **Tournament demo seeded.** Riverdale Minor Ball Association (`tournament_plus` comped,
   `is_discoverable=false`); three tournaments confirmed on prod — Season Opener (completed),
   Summer Classic (active, playoff day = today, cycle phase semifinal-live), Invitational
   (registration open, first pitch 2026-08-28). 2 divisions · 8 teams · 15 games.
3. **Coach demo seeded.** Riverdale Ridge Baseball (plan `club`, role `coach`, not public, not
   discoverable); five teams across the five season moments, with rosters, 205 tryout scores,
   budgets, dues, lineups, awards and a closed 2025 season.
4. **`check:demos` against production: ✓ 2 presentable.**
5. **Live-site checks:** `/riverdale-minor-ball/summer-classic` renders the event and the demo
   chrome; `www` doors both land correctly; `robots.txt` disallows both slugs in both path forms.
6. **Apex-domain defect found** — see above.

---

## Note for the release notes

The demo-chrome work in this release (the mobile hat) renders **only** on demo organizations. Until
step 3–4 above happen, it ships as correct, tested, dormant code that nobody can see. The
customer-visible half of the release is the homepage and entry-point work.
