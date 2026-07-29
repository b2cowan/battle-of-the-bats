# PM Brief — House-League In-Season Trust

> **Created:** 2026-06-13 · **Companion plan:** [HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md](HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md) · **Source:** User Journey Audit Phase 5 (FP-4), new project

**What it does:** Fixes the house-league experience *after* a family registers — the public schedule and standings, the emails that go to parents and coaches, the payment hand-off, and the schedule the generator produces. The admin product underneath is genuinely strong; this project repairs the broken shell around it so a volunteer admin can trust the league to her families.

**Why it matters:** The audit walked the league from the admin's, the parent's, and the coach's seats and found the same pattern: the product registers a kid beautifully and then loses the family. The in-progress season disappears from the public site the moment next year's registration opens — so the schedule and standings a family uses all season become unreachable. The comms tool reports "Email sent — 0 delivered" in a green success banner and counts provider failures as delivered. Parents are never told how to pay the fee, which team their kid is on, or where games are played; the public schedule silently drops cancelled games and shows postponed ones at their old time, so families drive to dark diamonds. The generator produces simultaneous pairings, not a schedule. And the league email templates are an unauthenticated phishing vector. On rainout night, the product loses to the Facebook group it was meant to replace.

**Who benefits:** House-league admins (volunteers running ~200 kids), the parents who rely on the public site and emails, and the coaches who currently have no surface at all.

**Expected impact:** The league becomes safe to promote and share: the active season stays navigable, the comms spine tells the truth and reaches the right people, parents can pay and find their team and their diamond, and the generator produces a real schedule.

**Priority:** High — this is the league module's "ship before promotion" gate, parallel to the tournament integrity work. It coordinates with the Free Tier Strategy plan, which owns league *acquisition* (this project owns in-season *operation*).

**Success criteria:**
1. The active season stays reachable when next season's registration opens.
2. The composer never reports "0 delivered" as success; replies reach the league.
3. Parents can see how to pay, their kid's team, and where games are.
4. The generator produces a real schedule (diamonds + time slots).
5. The public league site is branded and honest about cancelled/postponed games.
