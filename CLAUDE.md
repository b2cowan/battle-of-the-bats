@AGENTS.md
@AGENCY_RULES.md

# Post-edit review

After completing a **substantive** code change (new logic, API/DB/auth/shared-module edits, anything beyond copy/CSS/docs/config tweaks), proactively offer to run `/review` — the token-tiered adversarial funnel in `.claude/commands/review.md` — before treating the work as done. Offer once per logical chunk of work; don't nag on trivial diffs, and skip the offer if the user has already asked for a review or said to skip it. `/review` runs the deterministic gate first, so it's cheap on clean diffs.

# Help-docs sync

When a change alters a **user-facing flow** (admin/coaches UI behavior, a screen/step a customer follows, plan-gating of a visible feature, or new/renamed terminology), proactively offer to run `/docs` — the help-system agent in `.claude/commands/docs.md` — so the in-app guides don't drift. In-app help content is the single source of truth in `lib/help-content/*.tsx` (indexed by the hub arrays in the `help/page.tsx` shells); keeping it current is a code-time task, not a periodic manual sweep. Offer once per logical chunk; skip for purely internal changes (refactors, platform-admin-only ops, DB plumbing with no UI change) and skip if the user already updated docs or declined.

# Business-decision logging

When a **durable business decision** is reached or changed — pricing, packaging/plan structure, what's gated, positioning, segment/GTM focus, monetization model, or commercially-driven roadmap sequencing — proactively offer to run `/strategy` (the steward agent in `.claude/commands/strategy.md`) to record it in the binding Business Decisions Log at `docs/agents/strategy/BUSINESS_DECISIONS.md`. `/strategy` decides the *what* and routes the follow-through (copy → `/marketing`, gates → `/billing`, plan → `/plan`); it never writes customer copy itself, so logging a decision there keeps it consistent and discoverable across all chats. Offer once per decision; log only what the user has actually accepted (record exploratory direction as **Proposed**, not Decided), and skip the offer for pure execution detail, for decisions already logged, or if the user declined.

# Plan & pricing — single source of truth

`docs/agents/strategy/PLAN_PRICING_FACTS.md` is the **canonical** record of plan names, prices, capacity bands, gating, and inclusions (kept matched to `lib/plan-config.ts`). **Never restate a plan price/name/gate as a fresh copy in another doc** — brand strategy, the pricing-copy appendix, and the pricing memory file **point at** the Facts doc. Before changing or asserting any pricing/packaging fact (in copy, gates, plans, or docs), **reconcile against the Facts doc; if they disagree, that's drift — flag it to `/strategy` rather than silently writing a new number.** Any pricing/packaging change updates the Facts doc + `lib/plan-config.ts` in the same unit of work, and `/strategy` runs a drift check (the checklist at the bottom of the Facts doc) on every such change and before any billing release.
