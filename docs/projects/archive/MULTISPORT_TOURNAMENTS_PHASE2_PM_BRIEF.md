# PM Brief — Multi-Sport Tournaments, Phase 2: "Basketball lights up"

**Status:** UX + sub-decisions signed off (2026-06-24) — ready to build
**Priority:** High
**Tier:** All tiers (multi-sport is core, not plan-gated)
**Part of:** Multi-Sport Tournaments (see MULTISPORT_TOURNAMENTS_PLAN.md). Phase 0 (foundation) + Phase 1 (silent sport anchor) are built and live in production with no visible change. **Phase 2 is the first phase organizers and fans actually see.**

---

## What we're shipping

The moment multi-sport becomes **real and visible**. Phase 2 reveals the "choose your sport" picker, sets a sensible default from the organization's primary sport, and **translates every tournament screen into the chosen sport's language**. After this phase, a basketball organizer can create a basketball tournament that reads correctly end-to-end — and a softball organizer sees no difference.

This brief also bakes in the model you approved: **sport is chosen per tournament, with the organization's primary sport as the default — a smart pre-fill, never a lock.**

---

## The organization's "primary sport" (the new default)

Each organization gets a **primary sport** — the one it mostly runs. It does two jobs:

- **It pre-fills every new tournament's sport**, so a single-sport organization effectively never has to answer "what sport?" again — they just confirm.
- **It's a default, not a limit.** A multi-sport club can still pick a different sport on any individual tournament. Nothing is locked.

**How it gets set (recommended):**
- **Existing organizations:** inferred from what they already run (if everything is softball, primary sport = softball) — so nothing changes for anyone today.
- **New organizations:** picked once during setup (the league/rep flows already ask for a sport, so this is familiar), and editable later in organization settings.
- Wherever we can't tell, it falls back to **softball**.

> This also quietly unifies something messy: today each module (leagues, rep teams) carries its own sport with its own default. **Decision (2026-06-24): the org primary sport becomes the single default that seeds them all** — new tournaments, leagues, AND rep teams pre-fill from it. One consistent default everywhere.

---

## What the organizer sees and does differently

### Creating a tournament
- A **Sport** choice now appears, **pre-filled with the org's primary sport**. One tap to confirm; change it only if this event differs.
- The list shows the sports we fully support — **Softball and Basketball — plus "Other."**

### In organization settings
- A **"Primary sport"** control (one place) that sets the default used across new tournaments. Set it once; forget it.

### In a tournament's settings
- A **Sport** field to correct an individual tournament if needed — with a clear **heads-up if the tournament already has played games and the change would alter how standings are calculated** (e.g., switching to a sport ranked differently). Pure wording changes need no warning.

### Across the whole tournament (the translation)
Once a tournament's sport is set, every screen speaks it. For **basketball**:
- Standings read **Points For / Points Against / Point Differential (PF / PA / PD)**, ranked by **win %**, not "Runs."
- The softball-only **"mercy / run-difference cap" simply disappears** (it's meaningless for basketball).
- The pre-event countdown reads **"Tip-off in…"** (vs "First pitch"), the default venue is a **Court**, and tie-breaker wording matches the sport.
- Sample rules templates stop talking about innings and mercy runs.

A **softball** tournament is unchanged in every one of these.

### What fans see
Public standings, team pages, and result screens show the **right words for the sport** — a basketball parent never sees "Runs Against."

---

## What does NOT change

- **Softball tournaments are identical to today** — softball remains the default and reads exactly as it always has.
- Existing tournaments (all softball) are untouched.
- Multi-sport is still **free on every tier** — we're not gating the sport choice.

---

## Edge cases & guardrails

- **Multi-sport org:** the org primary sport is just the default; they override it per tournament in one tap.
- **Mis-pick:** sport stays editable, with the standings-safety heads-up once results exist.
- **"Other":** always available; runs a neutral, generic experience rather than mislabeling a sport we haven't tailored.
- **Standings correctness:** the win-vs-points logic becomes sport-aware so basketball ranks by win % and (looking ahead) other sports compute correctly — no more one-size-fits-all.

---

## Success criteria

- A brand-new **basketball** tournament — created by an org whose primary sport is basketball — comes pre-filled as basketball and reads Points/PF/PA/PD, win-% standings, a Court default, a "Tip-off" countdown, and **no** run-difference cap, with **zero** softball wording on any organizer or fan screen.
- A **softball** organizer's experience is **indistinguishable from today**.
- Setting the org's **primary sport** changes the default for new tournaments; existing tournaments are unaffected.
- Per-tournament sport is overridable, with a safety warning when results already exist.

---

## Decisions (settled 2026-06-24)

1. **How the org primary sport is set** — ✅ **inferred for existing orgs + an explicit "Primary sport" control in org settings** (set once for new orgs, editable anytime). Falls back to softball where nothing can be inferred.
2. **Scope of the org default** — ✅ **unify all module defaults**: the org primary sport pre-fills new **tournaments, leagues, and rep teams**.

---

## Note

Phase 2 changes user-facing flows and terminology, so the in-app help guides will need a pass (the `/docs` step) as part of this phase.
