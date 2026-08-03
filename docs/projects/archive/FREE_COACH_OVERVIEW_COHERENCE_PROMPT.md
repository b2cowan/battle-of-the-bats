# Handoff prompt — does the FREE coach overview need its own "one thing" pass?

> ## ✅ WORKED 2026-07-30 — DO NOT RE-RUN THIS PROMPT
> **Answer: (b).** Premium's defect is genuinely absent (verified by walking all seven conditional
> blocks — §3's hypothesis was right); the free page has a different, specific problem and does
> **not** need an ordered resolver. Findings, measurements, mockups and the seven decisions awaiting
> ratification are in **`FREE_COACH_OVERVIEW_COHERENCE_PLAN.md`** + `_PM_BRIEF.md`.
> Mockups: `claude.ai/code/artifact/8efbb388-a58c-40b9-8377-62b36f140bde`.
> This file is kept only as the record of the question that was asked.

**Start a fresh chat with this file.** Written 2026-07-30 immediately after Coach Portal Chunk I
shipped to `dev` (`c167a74`), by the session that built it.

---

## Paste this into the new chat

> Read `docs/projects/active/FREE_COACH_OVERVIEW_COHERENCE_PROMPT.md` and work the question in it.
> Run `/design` and `/ux` on the free coach overview. Do NOT assume the answer is "port Chunk I" —
> §3 below explains why that framing is probably wrong. Produce mockups and a recommendation before
> writing any code, and bring the owner a decision, not a build.

---

## 1. Why this is open

Chunk I rebuilt the **premium** team Overview around one rule: the page shows exactly one prose card,
chosen by an ordered resolver, and the team's own numbers sit directly under it. The full reasoning,
the sixteen ratified decisions and the two review passes are in
`COACH_PORTAL_CHUNK_I_ONE_THING_PLAN.md`. Binding mockups:
`claude.ai/code/artifact/5ae1c9e4-c31e-4f83-a098-3fbaa0ae15cd` (rev 3).

The **free** portal's overview was deliberately left out of that scope. The two tiers now look further
apart than they did. That divergence is consistent with the standing two-family ruling — free is the
consumer-shell **companion**, premium is the operator **HQ** — but "consistent with a ruling" is not
the same as "right", and nobody has actually looked.

## 2. The question to answer

**Not** "should the free overview look like premium's". The real question:

> Does the free coach overview have its own version of the coherence problem — more than one thing
> talking at once, or the coach's own information ranked below explanatory chrome — and if so, what is
> the free-tier-appropriate fix?

Bring back one of three answers, with evidence: **(a)** it is already coherent, leave it and record
why; **(b)** it has a smaller, specific problem — name it and fix that; **(c)** it needs its own
one-thing pass, with mockups.

## 3. What I already checked — do not redo it, but do verify it

I looked at the free overview before writing this, and **it does not appear to have the premium page's
defect**. That page is a different shape doing a different job: it is organised around tournament
registrations (a registrations list, per-registration cards, a "beyond this tournament" divider into
the team's own tools, an org-invite card, and a first-run setup panel), with the setup panel and the
invite already mutually exclusive rather than stacking.

So the honest starting hypothesis is **(a) or (b), not (c)**. Please confirm or refute that by reading
the page rather than trusting this paragraph — I checked its structure, not its lived behaviour across
states, and I did not view it in a browser.

**What I would look at first**, in order:

1. **Can two prompts co-render?** The premium bug was two bands whose predicates overlapped. Walk the
   free page's conditional blocks and check whether any pair can both be true — especially the setup
   panel, the org-invite card, the tournament-awareness banner and the registration empty state.
2. **Is the coach's own information below the fold?** On premium the answer was yes and it was the
   headline complaint. Check on a 390px phone with a real free team.
3. **The states a free coach actually lands in:** no tournaments yet · registered, event upcoming ·
   event live · event finished · team tools turned on vs. not. The last one matters — free Tier-2
   tools (Roster, Schedule, Announcements) are OFF until switched on from Explore, so an overview that
   assumes they exist would repeat a defect already fixed once in the free-onboarding work.

## 4. What is already shared, and must stay shared

Chunk I gave `CoachLiveEventCard` a `layout` prop (`'card'` for free, `'row'` for premium's tail) so
the tournament lifecycle states, their three chip labels and the ⇄ Fan view door live in ONE place. It
also fixed a real bug that had been hitting **both** tiers: a finished event rendered with no chip at
all, so a tournament that ended two weeks ago sat in the slot a live one occupies. **Do not fork that
component.** If free needs a third presentation, it takes a third `layout` value.

Likewise `lib/coach-overview.ts` is capability-shaped and premium-shaped. If the free tier ends up
wanting an ordered resolver, decide deliberately whether to generalise that module or write a separate
one — the free tier has no assistant-coach capability model, so most of what that module reasons about
does not exist there. **A shared module that only one caller's inputs make sense for is worse than two
honest ones.**

## 5. Constraints inherited from Chunk I (binding — do not re-litigate)

- **D14 — state proposes, capability disposes.** Never offer an action the coach cannot complete;
  never a disabled control. On free this mostly reduces to "don't point at a tool that is switched
  off".
- **Absence of a chip is never how a surface says a thing is over.**
- **A muted tile, never a dashed one** — the portal has exactly one dashed frame (the Money sample).
- **One prose card per surface** if a resolver is introduced at all.
- Two-family voice: free is the **companion**. Do NOT port premium's operator tone, and leave the free
  sections' existing empty-state copy alone — it is already correct.

## 6. Deliverables

1. A short design review of the free overview (what works, what does not, with states named).
2. Mockups **only if** the answer is (b) or (c) — at 390px first, the premium precedent.
3. A recommendation with a plainly-stated cost, and any decisions the owner must ratify.
4. If the answer is (a), say so plainly and log it as a decision so this question is closed rather
   than re-opened every time the tiers are compared.

**Do not build before the owner has picked.** Chunk I's value came from the mockup-and-ratify loop,
not from speed.
