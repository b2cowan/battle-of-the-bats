# Program — League & Club segments

> **Status: PARKED — owner decision 2026-07-28.** League is not production-ready as a whole. It will
> be picked up as a **full capability evaluation**, started by the owner once the Coach Portal work is
> finalised. Nothing here is scheduled and no launch decision is open.
>
> **Consolidated 2026-07-28.** Replaces 7 league/club plan-brief files (§4).
> **Purpose while parked:** hold the inventory — what exists, what's known-broken, what the future
> evaluation will need — so none of it has to be rediscovered.
>
> **Related current doc:** `FREE_TIER_STRATEGY_PLAN.md` owns free-floor *strategy* and stays separate.

---

## 0. Why it's parked

League is built but not trustworthy end-to-end. Individual pieces are finished — the creation wizard,
caps, public season pages, Club capacity bands — but the in-season experience a real league actually
lives in has never been hardened, and three of its supporting projects were never started. The
readiness checklist written on 2026-06-22 was never walked, so "is League ready?" has never had an
evidence-based answer.

The owner's call is to stop treating this as a launch waiting on a flag, and instead evaluate the
whole capability properly, after the Coach Portal work lands.

**The ~August 2026 early-access target and its go/no-go decision are withdrawn.** The ratified
decision always made the open date contingent on the checklist rather than the calendar, so parking
is consistent with it — not a reversal. Worth recording via `/strategy` so the business-decision log
reflects the pause.

---

## 1. Current exposure — the one thing to confirm while parked

League and Club are **not purchasable** (both held in early access), and the free league floor sits
behind a flag that is **off in production**. So the known defects below should not be reachable by
any customer today.

**Worth one check before walking away:** confirm no organization has house-league access granted by a
comp or operator override. If one does, the communications defect in §2 is live for them, and that
would need handling regardless of the park.

---

## 2. Known-broken — the inventory the evaluation will start from

Preserved because it's already-paid-for investigation, not because anything is scheduled.

**House-league in-season (never started).** The half of the league product that determines whether an
org stays after signing up:

- **Communications are the worst of it.** Waitlist and pending audiences **silently email nobody**
  while reporting a green "0 delivered" success. Provider failures are counted as sent. There's no
  guardian de-duplication, no reply path, and no rainout/postpone notification. A league admin cannot
  currently trust that a message reached parents — which alone makes the product unfit for a real season.
- **Vanishing-season blocker** — the highest-severity item on the original list.
- **Schedule honesty** — location, cancelled and postponed states aren't represented properly.
- **Parent payment loop** — incomplete.
- **No real schedule generator.**
- **An email-injection issue** flagged as fix-now.

**Supporting projects never started:** Billing & Accounting Coherence (whether board-facing numbers
can be trusted) and Admin IA & Multi-Module Navigation (the product presents a tournament-first shape
to league and club orgs, so modules are buried and the whole thing feels wrong on arrival).

**Never validated end-to-end:** no Club has ever been provisioned from scratch through to a full
coaching staff in populated portals. Every Club pricing and packaging decision remains untested
against a single real club.

---

## 3. Shipped — reference only

- **Free League floor (Phases 6.0–6.7)** — creation wizard with caps (1 active season / 1 division / 8 teams), public league season pages, abuse controls (per-account, per-IP and global rate limits), instrumentation, database change applied to production. Owner browser-QA'd 2026-06-13. **Behind a flag, off in production.**
- **Free-floor entitlement model** — a persistent field on the organization contributing module access, rather than a one-off flag.
- **Branding rename** — "League Starter"/"League" → "League"/"League Plus" across product copy.
- **Club Repackaging** — ✅ complete and live on production since 2026-06-24: capacity bands, whole-staff portals included at no per-team charge, the per-team meter fully retired, live prices wired for both Club bands.
- **League creation safeguards** — creation refuses anyone who already belongs to another organization (live since 2026-07-24), and as of 2026-07-28 also refuses anyone holding an unaccepted invitation, so nobody can strand themselves outside the org that invited them.

---

## 4. Source files consolidated (archive candidates)

`FREE_TIER_LEAGUE_STARTER_PLAN.md` · `FREE_TIER_LEAGUE_STARTER_PM_BRIEF.md` ·
`LEAGUE_CLUB_EARLY_ACCESS_READINESS_PLAN.md` · `LEAGUE_CLUB_EARLY_ACCESS_READINESS_PM_BRIEF.md` ·
`HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md` · `HOUSE_LEAGUE_INSEASON_TRUST_PM_BRIEF.md` ·
`FREE_TIER_STRATEGY_PM_BRIEF.md` (superseded — the current strategy doc is `FREE_TIER_STRATEGY_PLAN.md`)

> **Keep active:** `HOUSE_LEAGUE_INSEASON_TRUST_PLAN.md` — it carries the itemised defect list the
> future evaluation will want as its starting inventory.
