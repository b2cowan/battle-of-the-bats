# Date Correctness — "What day is it?" in the org's timezone

**Status:** ✅ **COMPLETE 2026-07-26** — every unsafe site fixed; guardrail baseline is **ZERO**
(1,209 files scanned, 0 grandfathered). Typecheck clean, 391/391 unit tests pass.
**Source:** Codebase Cleanup Tranche 4, date/time group (B15/B16/B18/B19/B21), promoted to its
own project because it is user-facing correctness, not consolidation.
**Owner decisions (2026-07-26):** correctness sites + a regression guardrail; **not** the
cosmetic formatter dedup (B10/B12/B20). Dates always follow the **organisation's** timezone,
never the viewer's device.

---

## The fault

Calendar-day questions — *"is it game day?"*, *"is this overdue?"*, *"how many days until?"* —
are answered from the **runtime's** timezone rather than the org's:

```ts
const today = new Date().toISOString().split('T')[0];   // ← UTC, not Toronto
```

- **On the server:** Amplify runs UTC. Toronto is UTC−4 (−5 in winter), so from **~8 PM Toronto
  the server already believes it is tomorrow.**
- **In the browser:** `new Date()` uses the *viewer's device* zone, so an Alberta coach and an
  Ontario organiser disagree about what day it is for the same event.
- **Invisible in development.** A dev machine runs on Toronto time, where the code is correct.
  Only production is wrong — which is why this has survived.

### Worked example (the one that matters most)

`lib/coach-tournament-phase.ts` picks the phase from `today` vs the tournament's start/end date:

```ts
const ended = input.endDate ? today > input.endDate : …;
if (ended) return 'result';
if (input.startDate && today >= input.startDate) return 'game_day';
```

At 8 PM on the **final evening**, server-side `today` becomes *the day after* `endDate`, so the
tournament flips to `result` **while games are still being played** — the live game-day surface
is replaced by a results view. The night **before** a tournament, the same rollover flips it to
`game_day` a day early. 8 PM–midnight on an event day is peak usage for this platform.

### This already caused a production incident

`lib/timezone.ts`'s own header documents J6-056: the identical fault "made the live ticker vanish
mid-game, 'Today's Games' go empty, and the dock die on championship evening." It was fixed on the
**fan** surfaces and the fix was never propagated to coach, admin, money, or schedule surfaces.

---

## The fix

Use the existing, proven helpers in `lib/timezone.ts` — no new design required:

| Helper | Use for |
|---|---|
| `tournamentToday()` | "today" as `YYYY-MM-DD` in the org zone |
| `tournamentNow()` | "has this start time passed?" (`{ date, time }` wall-clock) |
| `calendarDaysBetween()` / `daysBetweenDateStrings()` | "days until X" that counts date boundaries, not rolling 24h spans |

They are pure `Intl` — **client-safe**, and already imported by client components
(`Navbar`, `MyTeamDock`, `MyTournamentCard`, `DesktopMyTeamRailCard`), so bundling is proven.

### Scope — 76 sites / 59 files

| Group | Files / sites | Impact |
|---|---|---|
| **1. Shared logic** | 11 / 13 | Tournament + coach phase, lifecycle, status model, registration attention, `lib/db.ts`. Widest blast radius — everything downstream inherits it. |
| **2. Money** | 8 / 13 | Dues, payables, allocations, budget-vs-actual. Midnight in the wrong zone ⇒ items flag **overdue up to 4–5h early** and "due today" lists are wrong each evening. |
| **3. Schedule / game day** | 7 / 11 | Which day's games count as "today"; playoff wizard; timeline. |
| **4. Coaches portal** | 12 / 15 | Team HQ, live event card, live schedule, tournaments list, fundraiser + installment writes. |
| **5. Other** | 21 / 24 | Admin dashboard "days until", onboarding, setup, official score entry, export filename stamps. |

Plus: **5 duplicate `isOverdue()` implementations** collapsed to one shared helper, and the
dashboard's local `computeDaysUntil()` moved onto `daysBetweenDateStrings()`.

### Deliberately NOT touched

**Instant comparisons are already correct** and will be left alone: invite expiry, offer expiry,
snooze-until, and similar `new Date(stored).getTime() < Date.now()` checks compare precise moments
in time, not calendar days. There is no timezone question in them, and "fixing" them would add
risk for no benefit. Same for `Date.now() + N days` used to derive an instant.

**Cosmetic formatter dedup is out of scope** (owner call): ~28 local `fmtDate` and ~5 local
`formatTime` copies stay as they are. They are consistency debt, not wrong output.

---

## Regression guardrail

Mirrors the colour-token guardrail shipped 2026-07-25. A check that **fails the build** when the
unsafe pattern reappears:

- flags `new Date().toISOString().split('T')[0]` / `.slice(0,10)` and
  `new Date(); …setHours(0,0,0,0)` in `lib/`, `app/`, `components/`
- per-file baseline ratchet + `token-exempt`-style inline escape hatch with a **reason**, so
  deliberate UTC use (audit stamps, machine timestamps) is explained in place
- wired into `verify:changed` and the Amplify build, like the colour scopes

Without this, the same drift returns — the fan-side fix already proved that fixing one surface
does not stop the pattern spreading to the next.

---

## Verification

- `npm run typecheck` (shared modules + many call sites).
- Existing unit suite (`tests/unit/`) — `dues-status` and schedule/bracket specs cover affected logic.
- **Targeted proof:** run the phase/lifecycle helpers with a fixed clock at 8:30 PM Toronto on a
  tournament's final day and assert the phase is still `game_day`, not `result`. This is the
  regression the whole project exists to prevent, so it gets a test rather than an eyeball.
- Guardrail: confirm it blocks a freshly-added unsafe pattern and honours a reasoned exemption.

---

## Outcome (2026-07-26)

**76 sites across 59 files fixed; guardrail baseline 0.**

- **Shared logic (13):** tournament + coach phase, lifecycle, status model, registration
  attention, `basic-coach-teams`, `platform-metrics`, `lib/db.ts` (accounting entry date, dues
  status, overdue installments, and the two reminder windows), export stamps.
- **Money (13):** both `upcoming-payables` routes — `daysUntil()` now counts calendar days in
  the org zone, and the reminder window anchors on `tournamentToday()` + `addCalendarDays()`.
- **Schedule / game day, coaches, admin (50):** applied by codemod, each verified to have the
  import merged correctly.
- **Client-side rewrites:** roster birthdays and the coach dues-overdue count now compare
  `YYYY-MM-DD` strings against the org's today instead of building a device-local midnight; the
  admin dashboard's `computeDaysUntil()` delegates to `daysBetweenDateStrings()`.
- **Four duplicate `isOverdue()` copies** collapsed into `isInstallmentOverdue()` in
  `lib/dues-status.ts` (the fifth "copy" was a local boolean, not a duplicate).

**New helper:** `addCalendarDays(date, n)` in `lib/timezone.ts` — the counterpart to
`daysBetweenDateStrings`, so a reminder window steps from the org's today rather than
`Date.now() + n * 86_400_000`, which derives both ends from the runtime zone.

**Test-suite capability unlocked.** The unit suite could previously only cover **leaf** modules:
the app writes extensionless relative imports (bundler-resolved) which Node's ESM loader cannot
follow, so anything with a relative import was untestable — which excluded exactly the shared
logic most worth testing. `tests/ts-resolver.mjs` adds a resolve hook that retries `.ts`/`.tsx`
**only after** normal resolution fails, so it can never shadow a real file. A `npm test` script
now exists (there was none). 391/391 pass.

**Regression test** (`tests/unit/date-correctness.test.ts`) pins the actual symptom: at 8:30 PM
Toronto on a tournament's closing night the phase must be `game_day`. It asserts **both** the old
broken result and the fixed one, so a regression fails loudly rather than silently. Covers the
winter offset (EST) and a DST boundary too.

**Guardrail self-test found a hole in the guardrail.** The first version matched only
single-quoted `split('T')`, so a double-quoted variant of the identical bug would have passed.
Now covers `'T'`/`"T"`/`` `T` ``, `slice`, `substring`, `substr`, and runtime midnight.

## Rollout

Group-by-group commits (shared logic → money → schedule → coaches → other → guardrail) so any
single group can be reverted independently. Shared logic first: the downstream surfaces inherit
its correctness, which shrinks the visible diff of later groups.
