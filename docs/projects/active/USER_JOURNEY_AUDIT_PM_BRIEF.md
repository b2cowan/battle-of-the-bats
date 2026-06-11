# PM Brief — Platform-Wide User Journey Audit

> **Created:** 2026-06-10 · **Companion plan:** [USER_JOURNEY_AUDIT_PLAN.md](USER_JOURNEY_AUDIT_PLAN.md)

**What it does:** Walks FieldLogicHQ end-to-end as 10 real personas — from landing on the marketing page, through signup and setup, to daily operation and season close — and scores every step against six experience questions: Do I know what this is for? Is the sequence logical? Is it visually appealing on mobile and desktop? What would make it easier? Is the page scannable at first glance? What would delight me? Output is one journey report per persona plus a deduplicated, severity-ranked master findings backlog.

**The 10 personas:** tournament organizer · rep team head coach (team ops) · house league admin · club president · rep coach whose team is in a tournament · tournament parent/fan · house-league parent (added) · scorekeeper + gate volunteer (added, combined) · house-league team coach (added) · invited org staff admin (added, light).

**Why it matters:** Every module has shipped and two visual redesigns have landed, but nobody has experienced the platform the way a customer does — *across* surfaces, in sequence, with a goal. Per-page QA catches broken pages; only a journey audit catches "I didn't know what to do next," "this took 9 clicks," and "the marketing page promised something signup never mentioned." Several journeys (house-league parent, club president's budget oversight) have never been walked at all.

**Who benefits:** Every customer-facing role; all four plan tiers get coverage (Free/Tournament + Plus → J1/J6, League → J3/J7/J9, Club → J4, Basic/Premium coaches → J2/J5).

**Expected impact:** A prioritized, evidence-backed backlog (code refs + screenshots) that spins out into scoped fix projects. Findings on in-flight surfaces (Free Tier Coaches Phase 5, Coaches Experience A–E) get folded into those open plans while the code is still warm — the cheapest possible moment to act on them.

**Priority:** High. Phase 5 slices 5i–5o are about to be built and the J5/J2 walks directly shape them; the platform is also approaching real-org onboarding, where journey friction = churn.

**Success criteria:**
1. 10 journey reports with scored legs, findings tables, and a ranked "top 5 moves" each
2. A cross-persona master backlog, deduped across shared surfaces (landing, /start, auth, /home, emails)
3. Routed findings appended to the Phase 5 and Coaches A–E plans before those phases build
4. The owner can pick the next 3 fix projects directly from the synthesis without re-reading the reports

**How it runs (owner decisions, locked 2026-06-10):** hybrid method (code-walk for breadth + live browser screenshots at mobile/desktop for signature screens); checkpoint after Journey 1 to calibrate format and depth before the remaining nine run; in-flight coaches surfaces walked now with findings routed, not deferred. Evaluation only — no product code changes in this project.
