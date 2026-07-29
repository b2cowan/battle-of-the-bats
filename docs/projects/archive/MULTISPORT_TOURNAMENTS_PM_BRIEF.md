# PM Brief — Multi-Sport Tournaments

**Status:** Planned
**Priority:** High
**Tier:** All tiers (plan-gating still to be decided)
**First new sport:** Basketball

---

## What we're shipping

The ability to run a tournament for **any sport**, not just softball. Today every tournament silently assumes softball — the standings say "Runs," settings offer a softball-only "mercy run cap," and there's no way to even tell the system what sport you're playing. We're adding a **"What sport is this?" choice when a tournament is created**, and teaching every screen to speak that sport's language.

We start with **Basketball** as the first non-softball sport to prove the model, but the design makes adding the next sport (soccer, hockey, etc.) a small, repeatable job.

---

## Why it matters now

We're asking coaches to pick their sport when they sign up, and many of them come from tournaments. Right now, if a basketball coach registers into a tournament, **their sport is thrown away** and the tournament still calls their points "Runs." If we want tournaments to be the front door for non-softball organizations, the tournament itself has to know what sport it is.

The good news: the tournament engine is **already most of the way there**. Scores are stored as plain numbers, standings already handle wins/losses/ties, and venues already support courts, rinks, and gyms. The work is mostly **changing the words on the screen** and handling a few real rule differences — not rebuilding anything.

---

## What the organizer sees and does differently

### When creating a tournament
- A new **"Sport"** choice appears in the create flow. If we already know the org's sport (from their league or the coach who signed up), it's **pre-filled** — they just confirm. Softball stays the default, so existing softball organizers notice nothing.

### After the sport is chosen, the whole tournament adapts
- **Standings speak the sport.** A basketball tournament shows **Points For / Points Against / Point Differential (PF / PA / PD)** and ranks teams by **win percentage** — not "Runs" and not a softball-style points total. A softball tournament is unchanged.
- **Settings only show what's relevant.** The softball "mercy / run-difference cap" simply **disappears** for basketball (it's a baseball concept). Tie-breaker defaults are sensible for the chosen sport.
- **The little things match too.** The pre-event countdown reads **"Tip-off in…"** for basketball (vs "First pitch" for softball), the default venue type is **Court**, and sample rules templates stop talking about innings and mercy runs.
- **Sport is editable later** in Event Settings if they pick wrong — it only changes wording, so it's safe.

### What fans see
- Public standings, team pages, and result screens show the right words for the sport — a basketball parent never sees "Runs Against."

---

## Two things we're fixing along the way

1. **A real bug, today:** when an organizer **clones** or **pre-fills** a tournament from a previous one, all of its settings (tie-breakers, game timing, roster rules, email preferences) are **silently lost**. This already frustrates the "set up this year like last year" workflow and would be worse once sport-specific settings ride along — so we fix it as step one.
2. **One scattered inconsistency:** the "pick your sport" dropdown is currently copy-pasted across four different screens with mismatched lists and spelling. We consolidate it into one shared list so coach, admin, league, and tournament all agree.

---

## Who benefits

- **Non-softball organizers** (starting with basketball) — can finally run a tournament that reads correctly end-to-end.
- **Coaches** — the sport they chose at signup now carries through to the tournaments they enter.
- **Fans & parents** — standings and scores use the right words for their sport.
- **Us** — every future sport becomes a small, additive task instead of a code-wide hunt.

---

## Rollout approach

Built in safe, mostly-invisible stages: first the plumbing and the bug-fix (organizers see nothing change), then the sport choice at creation (softball still default and identical), then the sport-aware wording, then the sport-correct rules. A softball tournament looks **exactly the same as today** at every stage; basketball lights up at the end.

---

## Decisions (settled with the owner, 2026-06-18)

1. **Basketball standings** — ranked by **win % (a "PCT" column)**, not a points total. ✅
2. **Sport picker contents** — the tournament picker shows **only sports we genuinely support (Softball + Basketball today) plus "Other,"** and grows as we tailor more. We never list a sport we can't do well yet. ✅
3. **Pricing** — multi-sport is **core, free on every tier**. We monetize capabilities (automation, polish), not which sport you play. ✅
4. **Editing sport after games are played** — **allowed**, with a clear warning only when the change would alter how standings are calculated. ✅

## Build status

**Phase 0 is built (dev only, not yet browser-checked):** the shared sport foundation now exists, the four scattered sport dropdowns are consolidated onto one list, and the **clone / pre-fill "lost settings" bug is fixed**. Softball organizers see no change. Phases 1–4 (the sport choice at creation, sport-aware wording, and sport-correct rules) are not started.

---

## Success criteria

- A brand-new **basketball** tournament shows Points/PF/PA/PD, win-% standings, a Court default, a "Tip-off" countdown, and **no** run-difference cap — with **zero** softball wording anywhere an organizer or fan can see.
- An existing **softball** tournament looks and behaves **identically** to today.
- **Clone** and **pre-fill** carry over all settings (and the sport).
- Adding the **third** sport later is just filling in one new "sport pack" — no new code paths.
