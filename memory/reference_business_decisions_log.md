---
name: reference_business_decisions_log
description: Where binding business decisions + canonical plan/pricing facts live, and how drift is prevented
metadata:
  type: reference
---

# Business decisions + plan/pricing source of truth

Two canonical files under `docs/agents/strategy/`, stewarded by the `/strategy` agent:

- **`BUSINESS_DECISIONS.md`** — binding log of durable decisions (pricing, packaging, positioning, GTM, monetization, commercial roadmap sequencing). Newest first; `Decided` entries bind across all chats unless superseded. `/strategy` decides the *what/why* and routes follow-through: copy → `/marketing`, gates → `/billing`, plans → `/plan`.
- **`PLAN_PRICING_FACTS.md`** — **canonical** live facts: plan names, prices, capacity bands, gating, inclusions. Kept matched to `lib/plan-config.ts` (the runtime truth). Has a status flag per row (Live / Decided-not-yet-built / Held / Target-anchor) and a drift-check checklist.

## Anti-drift rule (governance decision 2026-06-22)

The same pricing fact used to live in ~5 hand-maintained docs and drifted (League/League Plus was right in 2, wrong in 3). Now: **one canonical Facts doc; everything else points at it.** Brand strategy §5/§7, the pricing memory file, and (next pass) the pricing-copy appendix are pointers, not copies. Before asserting/changing any plan price/name/gate, reconcile against the Facts doc; a divergence is a bug to flag to `/strategy`, not a new number to write. `CLAUDE.md` carries the guardrail; `/strategy` runs the drift check on every pricing change + before billing releases. See [[project_pricing_strategy]].
