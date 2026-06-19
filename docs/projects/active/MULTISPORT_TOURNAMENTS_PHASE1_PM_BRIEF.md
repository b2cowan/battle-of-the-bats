# PM Brief — Multi-Sport Tournaments, Phase 1: "Choose your sport"

**Status:** BUILT (dev only, 2026-06-19) — reveal-timing decided: picker held to Phase 2
**Priority:** High
**Tier:** All tiers (multi-sport is core, not plan-gated)
**Part of:** Multi-Sport Tournaments (see MULTISPORT_TOURNAMENTS_PLAN.md + _PM_BRIEF.md). Phase 0 — the invisible foundation — is built and reviewed. This is Phase 1.

---

## What we're shipping

The moment where a tournament gets a **sport**. Today every tournament silently assumes softball. Phase 1 adds a single **"Sport"** choice when a tournament is created, records it on the tournament, lets the organizer change it later, and carries it across when they clone or pre-fill from a past event.

Phase 1 is the **anchor**. It does not yet change any on-screen wording or any standings rules — that's the next two phases. On its own, Phase 1 is deliberately quiet: it captures the answer to "what sport is this?" so the later phases have something to read.

---

## What the organizer sees and does differently

### Creating a tournament
- A new **"Sport"** choice appears in the create flow.
- It's **pre-filled intelligently**: if the organization already runs a league or has past tournaments in a known sport, that sport is pre-selected; otherwise it defaults to **Softball**. Most organizers just confirm and move on.
- The list offers the sports we **fully support today — Softball and Basketball — plus "Other."** We intentionally don't list sports we can't do well yet; the list grows as we add them.

### In Event Settings (after creation)
- A **"Sport"** field appears in the tournament's overview/settings so an organizer can correct it if they picked wrong.
- **Guardrail (activates with the rules phase):** once a tournament has played games, changing the sport in a way that would change how standings are calculated will prompt a clear heads-up before it takes effect. In Phase 1 the field simply records the value; the warning becomes meaningful when standings start reading the sport.

### Cloning or pre-filling a past event
- The **sport carries over** automatically, consistent with the settings carry-over we just repaired — "set this year up like last year" now includes the sport.

---

## What does NOT change in Phase 1

- **Softball tournaments are identical to today.** Softball is the default and the pre-fill; no wording, columns, or rules change for anyone.
- **Picking "Basketball" records the choice but does not yet change the screens.** The wording still reads softball until the wording phase, and standings still use softball rules until the rules phase. This is the key reason for the sequencing decision below.

---

## When it actually goes live (a sequencing decision for you)

Because Phase 1 alone records the sport without changing how anything reads, there's a choice about **when organizers should first see the Sport picker**:

- **Recommended — reveal the picker when the wording is ready.** Build and verify Phase 1 now as the foundation, but only surface "choose your sport" to organizers once the sport-aware wording (Phase 2) ships — so the very first basketball tournament reads correctly end-to-end ("Points," "Tip-off," a court, no run-cap) instead of a half-translated screen. Until then, every tournament is quietly recorded as softball. This protects the "we never show a sport we can't do well" promise.
- **Alternative — show it now.** Make the picker visible in Phase 1. Upside: new tournaments start capturing their true sport immediately. Downside: for a short window, an organizer could pick Basketball and still see softball wording — an over-promise we deliberately avoided elsewhere.

My recommendation is the first: treat Phases 1–3 as one organizer-facing "Basketball support" release, with Phase 1 as the foundation slice we build and verify first.

---

## Who benefits

- **Non-softball organizers (basketball first)** — the tournament finally knows what it is, which unlocks correct wording and rules in the next phases.
- **Coaches** — the sport they already chose at signup can start flowing through to the tournaments they enter.
- **Softball organizers** — no disruption; their events stay exactly as they are.

---

## Edge cases & guardrails

- **Existing tournaments** are all recorded as softball — no action required, nothing changes for them.
- **Mis-picks are recoverable** — sport is editable in settings (with the standings-safety heads-up once that matters).
- **"Other"** is always available for an organization whose sport we haven't tailored yet; it runs a neutral, generic experience rather than mislabeling.

---

## Success criteria

- Creating a tournament shows a Sport choice that is correctly pre-filled (from the org's known sport, else softball) and saved with the tournament.
- The sport is visible and editable in Event Settings, and carries over on clone / pre-fill.
- A softball tournament created in Phase 1 is **indistinguishable from today**.
- The recorded sport is in place and ready for the wording (Phase 2) and rules (Phase 3) phases to read — with no rework needed.

---

## Decision (settled 2026-06-19)

**Reveal timing — hold the Sport picker until the wording phase (Phase 2).** Phase 1 ships as the silent foundation: every tournament is recorded as softball, with no organizer-facing change. The picker (and the Event Settings sport field) appear in Phase 2 alongside the sport-aware wording, so the first basketball tournament reads correctly end-to-end.

## Build status

**Phase 1 built (dev only, not browser-checked, not committed).** Every tournament now carries a sport (defaulting to softball), and it travels through cloning and pre-fill. There is **no visible change** for anyone — exactly as intended for a foundation slice. The database change is live on dev and **pending on production** until the multi-sport phases ship together. Next: Phase 2 reveals the picker and translates the wording.
