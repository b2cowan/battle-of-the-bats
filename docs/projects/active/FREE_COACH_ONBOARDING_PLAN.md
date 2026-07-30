# Free Coach Portal — Onboarding Honesty (implementation plan)

**Status:** in build (2026-07-29)
**Owner approval:** approach approved 2026-07-29; audience decision approved 2026-07-29 (below).
**Build prompt:** `FREE_COACH_ONBOARDING_PROMPT.md` (this plan supersedes it as the working spec).
**PM brief:** `FREE_COACH_ONBOARDING_PM_BRIEF.md`
**Governing ruling:** two-family — free = consumer **companion**, premium = operator **HQ**
(`memory/project_free_coach_portal_experience.md` + design decisions log).

---

## 1. Verified defect (checked against live code 2026-07-29, not taken on trust)

`app/coaches/team/[basicTeamId]/page.tsx` renders an `isFirstRun` welcome card
(`CoachEmptyState`, eyebrow "Get started") with a static three-item `<ol>`:

1. "Add your players to build the roster"
2. "Add practices and games to the schedule"
3. "Send your first announcement to parents"

`components/coaches/CoachPortalShell.tsx` builds the nav as `TIER1` + `TIER2.filter(s =>
currentTeam.activatedFeatures.includes(s.key))` + Explore. `TIER2` = roster / schedule / fees /
announcements. `activated_features` (mig 131) starts **empty**, so on a new free team:

- Steps 2 and 3 name tabs that do not exist, and the `<ol>` carries **no actions at all**.
- The card's only button — `primaryAction` "Add your first player" → `/roster` — lands the coach on
  a live page that is **absent from both the tab row and the rail**. Leaving it is a one-way door.

Confirmed worse than the prompt described: the roster route works when deep-linked, so the coach
gets a functioning page they can never navigate back to.

The activation path already exists and is the only one: `CoachExploreCatalog.turnOn()` →
`POST /api/coaches/teams/{id}/features` → `setBasicCoachTeamFeature` → `router.refresh()` +
`router.push(section)`. The shell re-fetches team context on every pathname change, so a new tab
appears immediately. **This plan calls that path; it does not add a second one.**

## 2. Owner decision — audience / persistence (approved 2026-07-29)

The old gate (`isFirstRun`) required players + events + fees + announcements + history all empty, so
the card vanished the instant anything was entered — a "✓ completed step" was **unreachable**.

**Approved: scratch teams only, until all three steps are done.**

```
isSettingUp = history.length === 0
           && !(players.length > 0 && events.length > 0 && announcements.length > 0)
```

- Server-derived. No time window, no localStorage gate on visibility.
- Teams that arrived via a tournament registration (`history.length > 0`) see **no change** — they
  keep the "beyond this tournament" divider + `CoachOverviewInvite`, exactly as today.
- `fees` is deliberately **not** a completion signal: fees is not one of the three approved steps.
- Rejected: every free team (would put a setup card on top of tournament-only coaches' Overview);
  brand-new-only (leaves the completed-step state dead).

Consequence: `CoachOverviewInvite` re-gates from `!isFirstRun` to `!isSettingUp`, so the two never
stack. While the setup card shows it already owns the roster invitation (step 1).

## 3. Copy deviation from the mockup (deliberate, flagged to owner)

The mockup labels step 3 **"Turn on Notes"**, but the tab it creates is **Announcements**. Shipping
"Notes" would recreate this exact defect in miniature (a button naming a door whose label differs).
Button reads **"Turn on Announcements"**; the step's plain-language line stays "Send a note to
parents". Everything else follows the mockup.

Exit copy also adjusted: the mockup's "Just here for your tournament record?" cannot be true under
the approved gate (`history.length === 0` — these coaches have no tournament record). Replaced with
a line that is true for a scratch team.

## 4. Build

### 4.1 New shared pieces (extractions, not inventions)

| File | Why |
| --- | --- |
| `lib/coach-feature-activation.ts` | `activateCoachTeamFeature()` — the POST + error normalisation lifted out of `CoachExploreCatalog.turnOn`. Both callers use it. One way to turn a feature on. |
| `components/coaches/useCoachNudgeDismiss.ts` | The `useSyncExternalStore` localStorage dismiss idiom lifted verbatim out of `CoachOverviewInvite` (server snapshot `false`, cross-tab `storage` listener, synthetic event for same-tab writes). |
| `components/coaches/CoachExploreFaintLine.tsx` (+ module CSS) | The degraded "Team tools available — explore →" line, lifted out of `CoachOverviewInvite` so the setup card's dismissed state reuses it instead of copying it. `.faintLine` rules move out of `CoachOverviewInvite.module.css`. |

### 4.2 The panel — `components/coaches/CoachTeamSetupPanel.tsx` (+ module CSS)

`'use client'`. Wraps the existing `CoachEmptyState` (which takes `children`) — no new card
primitive. Props: `basicTeamId`, plus per-step done flags and `activatedFeatures` from the server.

Per-step state machine (the honesty rule):

| Step state | Row renders | Button |
| --- | --- | --- |
| done (real data exists) | ✓ check medallion, light payoff line | none — stops asking |
| tool off | numbered medallion + "Not on yet — this switches it on and opens it." | "Turn on X →" → activate, then `router.refresh()` + push into it |
| tool on, not done | numbered medallion + light line | "Open X →" (plain navigate) |

- Step 1 = Roster (done ⇔ `players.length > 0`), 2 = Schedule (`events.length > 0`),
  3 = Announcements (`announcements.length > 0`).
- `primaryAction` on the card is **dropped** — the dishonest "Add your first player" button is the
  defect. Every action now lives on the step that owns it.
- Busy state disables the other buttons (Explore catalog's pattern); failure shows an inline
  `role="alert"` and re-enables.
- Dismiss: one click on the footer "Skip this" row → `useCoachNudgeDismiss` → the card is replaced
  by `CoachExploreFaintLine`. Reversible: the line is a live link to Explore, and Explore remains a
  permanent tab.

### 4.3 Edits

- `app/coaches/team/[basicTeamId]/page.tsx` — replace `isFirstRun` with `isSettingUp`; render
  `CoachTeamSetupPanel`; re-gate `CoachOverviewInvite` on `!isSettingUp`; drop the now-unused
  `Users`/`CalendarDays`/`Megaphone`/`Rocket` imports it no longer needs.
- `app/coaches/team/[basicTeamId]/team.module.css` — delete `.firstRunSteps`, `.firstRunStep`,
  `.firstRunStepIcon` (moved into the panel's own module).
- `components/coaches/CoachExploreCatalog.tsx` — `turnOn` calls the shared helper.
- `components/coaches/CoachOverviewInvite.tsx` — uses the shared hook + shared faint line.
- `lib/help-content/coaches.tsx` — two sections drift and must be reconciled:
  - `recipe-first-login`: "opens with a short three-step starter" → describe that each step turns
    its own tool on and opens it, and that the card can be skipped.
  - `explore`: keeps "the four tools start switched off" (still true) + Explore as the browsable
    home, and adds that a brand-new team can also switch a tool on straight from its welcome steps.
    Search keywords extended so "skip setup" / "hide welcome" resolve.

### 4.4 Constraints honoured

- **Voice:** no `description`/`payoff`/`blocker` teaching contract — that is operator voice. Free
  copy is one short warm line per step. Free section empty states are **not touched**.
- **Styling:** custom CSS module, tokens only, no raw hex / brand `rgba()` literals.
- **Sport-neutral:** no score/period vocabulary in any string ("practices and games" is generic).
- **Out of scope, untouched:** `ScopeShelf`, `CoachOverviewInvite` copy, the premium portal, the
  tournament-variant Overview, which four tools are free, the Tier-2/Explore model.

## 5. Verification

- `npm run typecheck` (shared modules touched), `npm run lint:focused -- <files>`,
  `npm run verify:changed`, `npm test`, token + date baselines at zero.
- Owner does all browser QA. **Note:** the TODO line's "QA must include one assistant with Schedule
  off and one with Roster hidden" is premium-portal language that does not apply here — a free team
  is a single sign-in with no assistant-coach concept at all.
- Restart-required: new files added → stop server, clear `.next`, restart before handoff.

## 6. Definition of done

1. ✅ No step names a section it cannot reach from that step.
2. ✅ Turning a tool on from a step activates **and** lands the coach inside it.
3. ✅ Completed steps render complete and stop prompting.
4. ✅ One-interaction dismiss, reversible via the faint Explore line + the permanent Explore tab.
5. ✅ Companion voice — measurably shorter than the premium empty states (one line per step).
6. ✅ Explore unchanged as browsable home + rail entry point.
7. ✅ Help content reconciled.
8. ✅ Gate green.

## 6b. `/simplify` + `/review` record (2026-07-29/30)

**`/simplify` (4 lenses) — 7 fixed, 1 rejected, 2 skipped.**
- Reuse lens caught a real visual defect: the panel's "Turn on" button was modelled on the Explore
  catalog's but missed its warm-theme override, so under the warm portal the lime fill olive-ifies
  and leaves near-black `--on-lime` ink on dark olive (dark-on-dark). Ported (TH-5 twin).
- **Altitude + simplification both flagged the same depth issue:** the four Tier-2 tools were
  described in three places (shell `TIER2`, Explore `FEATURES`, panel `STEPS`). Extracted
  `lib/coach-team-tools.ts` (`COACH_TEAM_TOOLS` = key + nav label + icon, plus `coachTeamToolSub` /
  `coachTeamToolPath`), consumed by all three. Section paths are now DERIVED (`/${key}`), never
  hand-written. Per-surface copy deliberately stays local (Explore's blurb, the panel's action line
  and note) — only the facts that must agree are shared. Verified byte-identical nav output.
- `activateCoachTeamFeature` now takes `previousFeatures` and always returns `string[]`; the
  `string[] | null` "merge, don't replace" hazard is gone from the caller contract.
- One derived `state` per step row replaced three independent `done`/`on` checks; the
  `useSyncExternalStore` `subscribe` fn moved to module scope (it was re-subscribing every render);
  a `useCallback` that no consumer needed was dropped; duplicate React import merged.
- **Rejected:** "drop `router.refresh()` before `router.push()` as wasted work." It is load-bearing
  — the Next 16 refresh reducer invalidates the segment-cache entry SYNCHRONOUSLY, which is what
  stops a return to the Overview replaying a payload that still offers "Turn on". The comment that
  caused the misread (it claimed the refresh was for the rail) is corrected. Independently
  re-confirmed from router source by the concurrency lens.
- **Skipped:** unifying the twin button CSS via `composes` (non-transitive under Turbopack per
  repo memory, needs compiled-output verification) — kept as a local copy with a ⚠ twin pointer;
  relocating `useCoachNudgeDismiss` to a shell-neutral home (2 coach-only consumers today — the
  `useDismissable` precedent sets that bar at a third, structurally different consumer).

**`/review` — tier high-risk (two new `lib/` modules + the portal nav shell), 4 lenses,
3 CONFIRMED and fixed, 2 refuted, 3 real-but-out-of-scope follow-ups.**

1. **[Medium → fixed] A step could show "done" with no way back.** The tool sub-routes are NOT
   gated on `activated_features` (`resolveCoachTeamPage` checks auth/ownership/premium only —
   verified), so a coach reaching `/schedule` by bookmark or typed URL can add an event while the
   tool stays off. Ranking "done" above "on" then rendered a checkmark with **no button**, while
   the nav still hid the tab — rebuilding the exact one-way door this panel exists to close.
   Fixed: **being switched on outranks having data.** An off tool always offers to turn itself on,
   however much data sits behind it.
2. **[Medium → fixed] An in-flight activation could yank the coach off a page they chose.** The
   router outlives the component, so if the coach left (an "Open" link, the rail, Back) while a
   write was in flight, the resolved write still fired `push()` into the other tool. Fixed with an
   alive ref — their latest intent wins. Same guard applied to the Explore catalog (same pattern).
3. **[Medium → fixed] A stalled navigation left the panel dead.** `busy` was held through
   navigation, so if the destination fetch stalled (bad signal at a field) every button stayed
   disabled behind a spinner only a reload could clear. Fixed: `busy` clears before navigating, and
   a new `justActivated` set keeps the row honest ("Open X →", not a re-offer of "Turn on") while
   the server prop is still stale.

**Refuted (dropped):** the roster invite being unreachable for scratch teams (that IS the intended
mutual exclusion — the panel's step 1 delivers the same invitation, and tournament-registration
teams keep the invite unchanged); and a suspected stale-closure regression in the Explore catalog
(the pre-diff code used the identical pattern — premise didn't hold).

**Verified-correct postures worth keeping on record:** ownership is enforced server-side and adding
a second UI entry point cannot bypass it (`basicTeamId` comes from the URL, never the body); the
shared catalog's cross-module import is genuinely `import type`, so the service-role Supabase client
cannot reach the client bundle; feature activation was never plan-gated and still isn't (the
`checkoutOpen` gate governs only the upsell CTA); no new route, so no service-worker denylist change;
the API's error responses are a fixed set of safe strings; double-submit is prevented by React's
discrete-event flush; the dismiss localStorage key is byte-identical to before, so no coach's
existing dismissal is lost.

### Follow-ups — owner-decided 2026-07-30 (2 built, 1 accepted as-is)

**1. Lost-update race on activation → ✅ FIXED (owner: "fix it now"). Ships migration 211.**
`setBasicCoachTeamFeature` was a read-modify-write in app code: two activations for one team inside
each other's read window (one coach, phone + laptop, or two tabs) both started from the pre-write
set, so the second overwrote the first and a tool the coach had just switched on vanished from
their nav. Now the merge happens inside ONE `UPDATE` in `set_basic_coach_team_feature`
(mig 211) — `UPDATE ... SET x = f(x)` re-reads under the row lock, so callers serialise. No CAS, no
retry loop. Result is sorted + de-duplicated; non-array/JSON-null legacy values normalise to `[]`
(the column is `NOT NULL`, so SQL NULL is unreachable — the CASE is belt-and-braces).

Verified **against the live dev DB**, not just typecheck:
- anon → `permission denied for function` (an open RPC would let anyone flip features on ANY team)
- unknown team id → raises, does not silently no-op
- add / re-add / remove → correct, idempotent
- **two concurrent activations of different features → BOTH survive** (the actual bug, reproduced
  green)

> ⚠ **RELEASE GATE: mig 211 is DEV-ONLY. Apply to prod BEFORE promoting this code to master.**
> ⚠ **`npm run check:migrations` reports "in sync" — that is a FALSE GREEN here.** The snapshots
> track tables/columns/indexes/constraints/RLS, **not functions**, so the drift checker is blind to
> a missing function. (Same class as the FK-action-drift gotcha: the check is not a parity gate.)
> Failure mode if promoted without it: the RPC errors → the route 500s → the coach sees "Could not
> update your team tools" and the tool never turns on. Fail-closed and visible, but broken.

**2. Setup card flashed on every Overview visit → ✅ FIXED (owner: use the existing pre-paint
mechanism).** Worse than first reported: a coach who skips never completes the steps, so they stay
in the setting-up state indefinitely — the card painted and collapsed to the faint line on **every**
Overview load, forever, for exactly the people who opted out. The skip lives on the device, so the
server always renders the card.
Fix rides the root layout's existing `NO_FLASH_SCRIPT` (the one that already stops theme/density
flashing): it now reads the team id out of the path and, if that team's skip flag is set, stamps
`data-coach-setup-skipped` on `<html>` before first paint; a CSS gate hides the card. No cookie, no
DB, no migration. **`CoachPortalShell` strips the attribute on hydration and on every pathname
change** — the script runs once per hard load, so a stale flag would otherwise hide the card on the
NEXT team the coach opened. The removal lives in the shell, not the panel, because the panel does
not mount on every page.

**3. Tool pages open by direct link without the tool being on → ACCEPTED AS-IS (owner call).**
The panel is honest about it now (an off tool always offers to turn itself on, however much data
sits behind it) and Explore is always one tab away. Auto-activating on visit would grow the nav
without the coach choosing, contradicting the deliberate opt-in model Explore exists to protect;
a read-only mode for four editors is disproportionate to a rare path with a working recovery.
**Do not re-open without a new owner decision.**

## 7. Owner QA script

1. Create a free team from scratch ("Start free team home"). Overview shows "Let's set up your
   team" with steps 1–3, each carrying a **Turn on** button.
2. Press **Turn on Schedule** → you land on Schedule, and Schedule is now a tab.
3. Return to Overview → step 2 reads **Open Schedule**, step 1 and 3 still offer Turn on.
4. Add a player → step 1 shows a checkmark and no button.
5. Add a game and send an announcement → the whole card is gone.
6. On a fresh team, press **Skip this** → card collapses to one faint "Team tools available" line;
   reload → still collapsed; the line still opens Explore.
7. On a team that came from a tournament registration → Overview is unchanged from today (divider +
   roster nudge, no setup card).
8. **Review-fix checks.** (a) Warm theme: the "Turn on" buttons must be dark ink on bright lime,
   never dark-on-dark. (b) Open a tool by URL without turning it on, add something, return to the
   Overview → that step must still offer "Turn on", never a checkmark with no button. (c) Press
   "Turn on Schedule" then immediately tap another step's "Open" link → you must stay where you
   chose to go, not get pulled into Schedule.
9. **Skip must not flash.** Skip the card, then hard-reload the Overview (F5, not a client nav).
   The card must never appear at all — you should land straight on the one-line faint link. Then
   navigate to a DIFFERENT team's Overview without reloading: that team's card must appear normally
   (this is the stale-flag case the shell clears).
10. **Activation still works end to end** (mig 211 changed how it writes): turn a tool on, confirm
    it opens and appears in the tab row, and that a second tool turned on afterwards does not knock
    the first one back out.
