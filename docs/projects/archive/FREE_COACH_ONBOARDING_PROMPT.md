# Build prompt — the free portal's welcome stops promising doors that aren't there

> Paste this into a fresh chat, or point the new session at this file.
> Owner approved the approach 2026-07-29, including the open decision below (owner chose
> **"turn on from the steps"**).
> Related: the two-family ruling (free = consumer **companion**, premium = operator **HQ**) in
> `memory/project_free_coach_portal_experience.md` + the design decisions log. **Read it before
> writing a word of copy.**

---

## The defect

A brand-new free team shows a first-run panel on its Overview
(`app/coaches/team/[basicTeamId]/page.tsx`, the `isFirstRun` block) with three steps:

1. Add your players to build the roster
2. Add practices and games to the schedule
3. Send your first announcement to parents

But on the **free** portal, Roster / Schedule / Fees / Announcements are **off by default** — they're
Tier-2 sections that only appear in the nav once the coach turns them on from **Explore**
(`components/coaches/CoachPortalShell.tsx`, the `TIER2` filter on `activatedFeatures`).

So a brand-new coach is handed a three-step plan where:

- **Steps 2 and 3 name tabs that don't exist yet**, with no way to act on them at all.
- **Step 1's only button** lands them on a Roster page that isn't in their navigation — so the moment
  they leave it, they cannot find their way back.

This is the free-portal instance of the exact defect Coach Onboarding Quiet Mode Phase B spent its
time fixing on premium: instructions pointing at doors the person doesn't have. Verify all of the
above against the live code before building — don't take this description on trust.

---

## What to build

Make each step **honest about state and able to act.** Owner-approved shape:

```
┌─ Let's set up your team ──────────────────────────────────┐
│  🚀  Three quick steps and your team home is ready.       │
│                                                            │
│   ✓  Add your players                                     │
│      Built once, reused for every tournament you enter.    │
│                                                            │
│   2  Add practices and games       [ Turn on Schedule → ] │
│      Not on yet — this switches it on and opens it.        │
│                                                            │
│   3  Send a note to parents        [ Turn on Notes →    ] │
│      Not on yet — this switches it on and opens it.        │
│                                                            │
│  Just here for your tournament record? Skip all this.  ✕   │
└────────────────────────────────────────────────────────────┘
```

Three rules:

1. **Every button is honest about state.** Tool off → button reads "Turn on X", switches it on, and
   lands the coach inside it. Tool already on → button just navigates. **No step may name a section
   without offering a way to reach it.**
2. **A finished step shows finished and stops asking** (step 1 above). Completion is already derived
   from real data — reuse the existing signals that compute `isFirstRun`, don't invent new state.
3. **There is a real exit.** Many free coaches only ever want their tournament record. The premium
   side learned this the hard way: clearing guidance must take one interaction, not several.

---

## Owner decision — already made, don't re-litigate

Turning tools on directly from the welcome panel partly bypasses **Explore**, which exists to keep
the free portal uncluttered by making activation deliberate.

**Owner chose: turn on from the steps.** The rationale to preserve: the panel *already* promises
those steps, so progressive disclosure has effectively been bypassed in copy already — it's just
bypassed *dishonestly* today. Explore remains the browsable home for everything, and the permanent
entry point in the rail. Do not remove or de-emphasise it.

---

## Hard constraints

**Voice — the most important constraint.** The free portal is the consumer **companion**, not the
operator **HQ**. Do **NOT** port Phase B's three-sentence teaching contract
(`description` / `payoff` / `blocker` on `CoachEmptyState`) here. That is operator voice. Free copy
stays short, warm, and light. If your copy reads like the premium empty states, it's wrong.

**Leave the free section empty states alone.** They already carry a correctly-voiced light payoff —
the roster one reads "Add your players once and reuse this roster for every tournament you join."
That's the companion voice working. Apply only the **honesty** rule (nothing should tell a free coach
to use a tool they haven't turned on), not the full contract.

**Reuse, don't invent.** `components/coaches/CoachEmptyState.tsx` already hosts this panel and takes
`children`. The activation path already exists for Explore — find it and call it; do not write a
second way to turn a feature on.

**Styling.** Custom CSS modules only. **No raw hex or brand `rgba()`** — every CSS baseline is at a
zero ratchet and `verify:changed` will fail you.

**Sport-neutral.** Score/period vocabulary comes from the Sport Pack (`lib/sports.ts`), never
hard-coded. (Phase B shipped "at the diamond" into a shared component and `/review` caught it.)

**Premium pitches stay where they are.** `ScopeShelf` and `CoachOverviewInvite` are out of scope —
don't fold upgrade messaging into the welcome panel.

---

## Process expected in this repo

- **Present a plain-language PM summary before writing code** (blocking, per `AGENCY_RULES.md`).
- **Create a plan doc + PM brief pair** in `docs/projects/active/` and add one linking line to
  `TODO.md` (the repo's doc-structure rule; this prompt is not the plan).
- Work on **`dev`**. Never `master`. Stage explicit pathspecs only; `:(literal)` for
  `[basicTeamId]` paths, since brackets are glob syntax.
- **Never commit without explicit per-action approval from the owner.**
- ⚠ **Concurrent sessions share this working copy.** Re-check `git rev-parse --abbrev-ref HEAD`
  before committing and `git show --stat HEAD` after; check for foreign hunks in files you touch
  *before* staging. Two sessions swept each other's work into their commits during Quiet Mode.
- Verification: `npm run verify:changed`, `npm run lint:focused -- <files>`; `npm run typecheck` if
  you touch shared modules. The owner does all browser testing.
- **Offer `/docs`** — this changes a user-facing flow and the free-portal help section
  (`explore` / `recipe-first-login` in `lib/help-content/coaches.tsx`) describes the current
  three-step starter and the "four tools start switched off" model. It will drift.
- Offer `/simplify` then `/review` before treating it as done.

---

## Definition of done

1. No step in the free welcome panel names a section the coach cannot reach from that step.
2. Turning a tool on from a step switches it on **and** lands the coach inside it.
3. Completed steps render as complete and stop prompting.
4. The panel can be dismissed in one interaction, and dismissing is reversible.
5. Copy is companion-voiced — measurably shorter and warmer than the premium empty states.
6. Explore is unchanged as the browsable home and rail entry point.
7. Help content reconciled (or `/docs` run) so the guide doesn't still describe the old flow.
8. Gate green: `verify:changed`, focused lint, tests, all token baselines at zero.

---

## Out of scope

- The **premium** coach portal — Quiet Mode Phases A/B/C are complete and QA-passed. Don't touch.
- Changing which four tools are free, or the Tier-2/Explore model itself.
- Upgrade/pricing messaging.
- The tournament-variant Overview (game day stays pitch-free — locked decision).
