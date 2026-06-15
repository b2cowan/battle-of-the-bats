# Theme 1 — Phase-Adaptive Hero · Browser Test Plan

> **Status:** BUILD COMPLETE 2026-06-14 (commit `54a25a2`) — dev-only, awaiting owner
> browser verification against this plan. Theme 4 (`ef19c95`/`4b0d4bb`) + the
> CoachEmptyState slice (`9c16b52`) also complete + awaiting verification.
> **Scope:** the phase-adaptive tournament hero (commit `54a25a2`) + the Theme 4 identity
> band (`ef19c95`/`4b0d4bb`) it layers on. Coach account: **`b2cowan@outlook.com`**.
> **What's verified by tooling already:** typecheck (0-err) + focused lint. This plan covers
> the **visual/behavioural** checks that only a browser can confirm.
> **Owner does browser testing** (per AGENCY_RULES). This is the script.

---

## 0. Why the hero changes shape — the levers

The coach phase is a pure function (`lib/coach-tournament-phase.ts`) of four inputs on the
coach's **registration row** (`teams`) + its division + tournament:

| Phase | `teams.status` | `division.schedule_visibility` | `tournaments.status` | Event dates (vs today) |
|---|---|---|---|---|
| **pending** | `pending` / `waitlist` (anything ≠ accepted/rejected) | any | any | any |
| **rejected** | `rejected` | any | any | any |
| **accepted_prep** | `accepted` | not published (`hidden`/null) | not completed | before start |
| **schedule_live** | `accepted` | `published_teams`/`published_generic` | active | before start |
| **game_day** | `accepted` | any | active | today ∈ [start, end] |
| **result** | `accepted` | any | `completed`/`archived` **or** today > end | event over |

So to drive a phase you flip those columns on one registration. Section 5 gives copy-paste
SQL/script snippets to move a single team through every phase.

---

## 1. Setup (once)

1. **Dev server up** with network access: `npm run dev` → wait for `✓ Ready`, confirm
   `http://localhost:3000/platform-admin/login?next=%2Fplatform-admin` returns **200** (no
   Supabase `EACCES` in the log). *(New shared component shipped in 5h/5i/5m earlier; this
   slice only edited existing files, so no `.next` clear is needed.)*
2. **Sign in** as `b2cowan@outlook.com`. The coach landing is `/coaches`.
3. **Confirm a claimed registration exists.** Go to **Tournament Records** (`/coaches/tournaments`).
   You should see at least one tournament card for this coach. Open one → you land on the
   tournament detail page `/coaches/tournaments/[registrationId]` — **this is the page under test**
   (the hero is at the top).
   - If no claimed registration exists, claim one first via the hub's "Claim team" flow, or use
     the `live-demo` / `dev-tournament-2026` tournaments in `dev-test-org` that this account is
     already linked to (per the Phase-5 build notes).
4. **Note the `registrationId`** in the URL — you'll reuse it to drive phases in Section 5.

---

## 2. Theme 4 identity (regression check — should already be live)

On the **standalone team home** (`/coaches/team/[basicTeamId]`, reached from `/coaches` →
"Your Teams"):

- [ ] **T4-1** — Header is now a **colour band** (not a plain H1): a team-coloured wash, a
  52px rounded-square monogram (team initials), the team name in the condensed display font,
  and a faint oversized watermark of the initials bleeding off the right edge.
- [ ] **T4-2** — The grey **stat strip sits below** the band and has **no** colour wash (stays
  on the dark surface). The band's colour must **not** bleed into the strip.
- [ ] **T4-3** — **Mobile** (≤640px, narrow the window): band stays readable, monogram shrinks
  to 44px, watermark to 5rem, name to ~1.4rem. Left-aligned, no overflow/clipping.
- [ ] **T4-4** — The monogram is a **rounded square**, never a circle.

---

## 3. The five hero phases (the core of Theme 1)

Open the tournament detail page and drive each phase via Section 5. For each, confirm the
hero is **unmistakable at a glance** vs the others.

### 3a. Pending / waitlist *(blue)*
- [ ] **P-1** — Left border is **blue**; status chip reads the pending label; headline
  "Registration submitted".
- [ ] **P-2** — If the tournament/division has a fee schedule: an **Entry fee preview** box
  shows "**$N · due if accepted**" (blue-tinted). If no fee schedule → the box is **absent**
  (not an empty box).
- [ ] **P-3** — Checklist shows "Registered ✓" + "Decision · Awaiting organizer" (clock icon).
- [ ] **P-4 (honesty)** — **No** fee glance strip, **no** countdown, **no** public links.
- [ ] **P-5 (data-gated)** — There is **no** waitlist-position row (deferred — no data source).
  Confirm its absence doesn't leave a gap/placeholder.

### 3b. Accepted — prep, fee owed *(lime + amber strip)*
- [ ] **A-1** — Left border + chip are **lime**; headline "You're in!"; the band carries the
  **18% team-hue wash + watermark** (Theme 4 celebration treatment).
- [ ] **A-2** — When the team has an unpaid scheduled fee: an **amber fee strip** under the
  headline: "**Fee owed · $N · due <date>**" + a "Contact <organizer email>" sub-line.
- [ ] **A-3 (no dup)** — The strip does **not** carry the process note ("organizer records
  payment manually") — that lives only in the **detail status block** lower on the page. Confirm
  the glance strip (hero) and the detail block (below) read as a coherent pair, not a repeat.
- [ ] **A-4** — Countdown "First game in N days" renders when the start date is in the future.
- [ ] **A-5 (paid)** — Mark the fee paid (Section 5) → the amber strip **disappears**; the
  checklist Fee row reads "Paid".

### 3c. Accepted — fee PAST DUE *(red alert)*
- [ ] **PD-1** — Set the fee due date in the past (Section 5). The strip turns **red**:
  "**Fee past due · $N**" with an **X-circle** icon and a "Was due <date>" sub-line.
- [ ] **PD-2** — The checklist **Fee row** shows a red "**Past due**" badge + "Was due <date>"
  micro-note (instead of the plain "Owed").
- [ ] **PD-3 (a11y)** — The red strip is announced to screen readers (`role="alert"`). The
  amber "owed" strip is **not** an alert. *(Inspect element to confirm `role="alert"` on red only.)*

### 3d. Schedule published *(lime)*
- [ ] **SL-1** — After publishing the division schedule (Section 5) while still before the
  start date: lime accent, "You're in!", countdown still promoted. The **CoachLiveSchedule**
  section appears below the hero with opponent names.
- [ ] **SL-2** — The hero does **not** duplicate the schedule — it points down to it.

### 3e. Game Day *(green + Today card)*
- [ ] **GD-1** — When today falls within the event dates: the accent + wash flip to **green**,
  headline/chip read "**Game Day**".
- [ ] **GD-2** — A green **Today card** shows: "**N games today**" + "Next: <time> · <location>
  · vs <opponent> (Home/Away)". The opponent + time/location match the schedule below.
- [ ] **GD-3 (fallback)** — If the team has **no** game scheduled for today (but the event is
  underway), the card is replaced by the plain "**Event underway**" line — no empty Today card.
- [ ] **GD-4 (no double-poll)** — The hero Today card is **static** (server-derived). The live
  scorebug is in the **CoachLiveSchedule** section below; only that polls. Confirm scores update
  in the section below, not in the hero card.
- [ ] **GD-5** — Checklist now includes the **Check-in** row (game day onward only).

### 3f. Result / Complete *(lime trophy/record card)*
- [ ] **R-1** — When the event is over (Section 5): a **result card** replaces the prep
  checklist: a Trophy icon + "**Event complete · <date range>**".
- [ ] **R-2** — "**Final record W-L-T**" renders from completed games. If no completed scores →
  "No completed game scores recorded for your team." (no fake 0-0-0).
- [ ] **R-3** — "View final standings →" link appears **only** when the tournament is public
  (active/completed). For a non-public event it's absent.
- [ ] **R-4 (no open checklist)** — The result hero shows **no** open-problem prep checklist
  (the event is over) — only the result card.
- [ ] **R-5 (data-gated)** — No "Champions!" headline / 1st-place trophy row (placement source
  deferred). Confirm the clean "Event complete" variant renders for every team, winner or not.

---

## 4. Cross-cutting checks

- [ ] **X-1 (glance test)** — Flip pending → prep → game-day → result in quick succession.
  Each must be distinguishable **at a glance** by colour + content alone (the acceptance test
  for J5-032). Screenshot each; they should not look like the same screen.
- [ ] **X-2 (light mode)** — If the coach shell exposes light mode, confirm the celebration
  wash softens (18%→12%) and text stays legible on all phases.
- [ ] **X-3 (mobile)** — Narrow to ≤640px on each phase: the fee strip / today card / result
  card stack cleanly, the watermark shrinks (9rem→6rem), no horizontal scroll.
- [ ] **X-4 (interactive accent)** — Every button/link in the hero (contact mailto, standings
  link) uses **lime**, never the team colour — team colour is wash/watermark/monogram only.
- [ ] **X-5 (no regression)** — The **CoachLiveSchedule** section and the **5m afterglow**
  section below the hero still render and behave as before (Theme 1 only restyled the hero;
  the result card replacing `.afterglow` is *inside* TeamHQ — the page's separate afterglow
  "That's a wrap" share/express-interest section is unchanged).

---

## 5. Driving each phase — DB state snippets

All phases are functions of the registration row + division + tournament. Use the
service-role client (same pattern as the seed scripts). Replace `REG_ID` with your
`registrationId` from the URL. Run with `node --env-file=.env.local scripts/<name>.mjs`,
or adapt inline.

> ⚠ This mutates dev data. Use a throwaway/`dev-test-org` registration, not real prod data
> (this is `.env.local` → dev Supabase).

```js
// scripts/drive-coach-phase.mjs  (scratch helper — not committed)
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const REG = process.argv[3];            // registrationId
const phase = process.argv[2];          // pending|rejected|prep|owed|pastdue|live|gameday|result|paid
const today = new Date().toISOString().split('T')[0];
const plus = (n) => new Date(Date.now() + n*86400000).toISOString().split('T')[0];

const { data: t } = await db.from('teams').select('id, division_id, tournament_id').eq('id', REG).single();
const setTeam   = (p) => db.from('teams').update(p).eq('id', REG);
const setDiv    = (p) => t.division_id ? db.from('divisions').update(p).eq('id', t.division_id) : null;
const setTour   = (p) => db.from('tournaments').update(p).eq('id', t.tournament_id);

if (phase === 'pending')  { await setTeam({ status: 'pending' }); }
if (phase === 'rejected') { await setTeam({ status: 'rejected' }); }
if (phase === 'prep')     { await setTeam({ status: 'accepted', payment_status: 'pending' }); await setDiv?.({ schedule_visibility: 'hidden' }); await setTour({ status: 'active', start_date: plus(14), end_date: plus(16) }); }
if (phase === 'owed')     { await setTour({ status: 'active', start_date: plus(14), end_date: plus(16), total_fee_amount: 450, total_fee_due_date: plus(7) }); await setTeam({ status:'accepted', payment_status:'pending', total_paid: 0 }); }
if (phase === 'pastdue')  { await setTour({ status: 'active', start_date: plus(14), end_date: plus(16), total_fee_amount: 450, total_fee_due_date: plus(-3) }); await setTeam({ status:'accepted', payment_status:'pending', total_paid: 0 }); }
if (phase === 'paid')     { await setTeam({ status:'accepted', payment_status:'paid', total_paid: 450 }); }
if (phase === 'live')     { await setDiv?.({ schedule_visibility: 'published_teams' }); await setTour({ status:'active', start_date: plus(5), end_date: plus(7) }); await setTeam({ status:'accepted' }); }
if (phase === 'gameday')  { await setDiv?.({ schedule_visibility: 'published_teams' }); await setTour({ status:'active', start_date: today, end_date: plus(2) }); await setTeam({ status:'accepted' }); }
if (phase === 'result')   { await setTour({ status:'completed', start_date: plus(-3), end_date: plus(-1) }); await setTeam({ status:'accepted' }); }

console.log(`set ${REG} → ${phase}`);
process.exit(0);
```

- **Pending fee preview (P-2):** before `pending`, also set `total_fee_amount` on the division
  or tournament so the preview has an amount.
- **Game-day Today card (GD-2):** needs a game row with `game_date = today` for this team in the
  published division. The `seed-live-tournament.mjs` script already shifts a full schedule so
  day 1 = today — seed `live-demo` and claim that registration for the richest game-day test.
- **After each change:** reload the detail page (server component — no hot data; a refresh
  re-derives the phase).

---

## 6. Known deferrals (do NOT file as bugs)

- **Waitlist position** (pending) — no data column yet; row intentionally omitted.
- **Champion / placement** (result) — no source yet; the "Champions!" + 1st-place trophy variant
  is gated off, every team gets the clean "Event complete" record card. Wiring `placement` is a
  follow-up (Phase-5 / 5m data note).
- **Theme 3 density reflow / Theme 2 hub & chips / coaches-a-e shell** — later slices, not in this hero.

---

## 7. Sign-off

- [ ] All Section 3 phase checks pass on desktop
- [ ] X-1 glance test: five phases visibly distinct
- [ ] X-3 mobile pass
- [ ] No regression in CoachLiveSchedule / afterglow (X-5)
- [ ] Deferrals in Section 6 confirmed as intentional (not bugs)

On sign-off, mark the Theme 1 sub-bullet `[x]` under the Combined coach-surface design/UX pass in `TODO.md`.
