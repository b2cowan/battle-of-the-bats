# PM Brief — Tryouts "Run Your Tryout" Flow UX

> **Created:** 2026-07-02 · **Status:** Building · **Plan:** COACHES_PORTAL_TRYOUTS_FLOW_UX_PLAN.md

**What it does:** Turns the Tryouts page from a stack of six separate tools into a guided, four-stage
flow. A progress header at the top shows the coach where they are (**Set up → Tryout day → Decide →
Build your team**) and always names the single next thing to do. The tools below are grouped under those
stages with plain-language step labels, a re-openable "How tryouts work" overview refreshes the whole
process in seconds, and a "Build your team" summary connects accepted players to the Roster.

**Why it matters:** Tryouts is a once-a-year, multi-step process, so *every* coach — new or veteran —
arrives without a clear mental model. Today the page answers none of "what do I do first / where am I /
what's next / how do results become my team." That's friction at the exact moment a coach is busy and
time-pressed. This makes the flow legible without them reading a manual.

**Who benefits:** Every coach running tryouts (standalone Premium head coaches now; club-admin context is
a later extension). No change for anyone else.

**What we deliberately avoided:** a rigid wizard that forces order or hides tools — real tryouts are
messy and coaches revisit steps, so the design *guides* without *caging*. And we didn't touch any of the
tryout tools themselves — this is an orientation wrapper, so it's low-risk.

**Expected impact:** Faster, more confident self-serve tryout runs; fewer "how does this work" support
questions; and the tryout → roster → lineup connection finally visible on screen.

**Success criteria:**
- A first-time coach can start and progress a tryout without external help.
- The page always shows one clear next action, derived from real progress.
- Accepted players' path to the Roster is obvious.
- Nothing about the underlying tryout tools or data changes.
