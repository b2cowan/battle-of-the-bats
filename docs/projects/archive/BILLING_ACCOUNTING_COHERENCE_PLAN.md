# Billing & Accounting Coherence — Implementation Plan

> **Status:** SCOPED 2026-06-13 — spun out of the User Journey Audit (Phase 5, FP-6). **Successor to the archived STRIPE_INTEGRATION** (its 2 J4-routed findings reopen here). Awaiting owner go-ahead.
> **Branch:** dev. **Companion:** [BILLING_ACCOUNTING_COHERENCE_PM_BRIEF.md](BILLING_ACCOUNTING_COHERENCE_PM_BRIEF.md)
> **Source of truth:** [journeys/JOURNEY_J4_CLUB_PRESIDENT.md](journeys/JOURNEY_J4_CLUB_PRESIDENT.md) + [USER_JOURNEY_AUDIT_SYNTHESIS.md](USER_JOURNEY_AUDIT_SYNTHESIS.md) §4 FP-6.

## Goal

The Club-tier money cockpit has excellent bones and three coherence failures on top of them: the **billing lifecycle is incoherent** (the charge a president confirms never fires, the real charge lands later, archived teams bill forever), the **board-facing numbers can lie** (overdue hard-zero, headroom summed from ≤50 entries, a "Budget vs. Actual" page with no actuals), and **money actions are irreversible** (one-click mark-paid, one-sided transfer voids). This project makes the Club tier's whole sales pitch — money trust — true. STRIPE_INTEGRATION is archived, so J4-032/033 have no owner; this is their successor.

## Scope

Club-tier billing + accounting. J4 is the source of truth. The ledger-corruption **Blocker J4-020** is the only item with a routing question: it currently sits in **FP-1** (data-integrity) — referenced here, owned there, to keep the fix-now sweep together. Everything else below is FP-6's.

### Billing lifecycle (Stripe successor)
- **J4-032** (fix-now) — bill-what-you-confirm: the E4 modal charge never fires; the real charge lands on the next unrelated sync; archived teams bill forever; consent modal skippable (client-side group-filtered). Make the billable event and the confirmation the same moment; sync on every count-changing transition incl. archive; compute the preview server-side.
- **J4-033** — comped/override orgs hard-blocked from creating a 4th rep team by a billing-preview 400. Distinguish "no subscription to bill" from transient failure.

### Board-facing numbers (accounting truth)
- J4-010 (overdue hard-zero — query omits `due_date`), J4-011 (rows don't reconcile — no ALLOCATED column), J4-024 (Budget-vs-Actual has no actuals; free-text categories never join the chart), J4-025 (Org Headroom summed from ≤50 entries), J4-026 (under-allocation becomes permanently unallocatable), J4-027 (allocate resolves current-year plan only), J4-028 (no whole-club Financial Summary; team-held funds mixed into Net Position), J4-022 (ledger badge only knows Org/Tournament), J4-017 (no "what do rep teams owe us" view).
- **Wow:** J4-028 whole-club Financial Summary, J4-017 team-balances rollup, J4-006 franchise health board (cross-ref; data behind admin GETs — FP-7/coaches adjacency).

### Reversible money actions
- J4-013 (mark-paid one unconfirmed irreversible click; nothing in the allocation lifecycle undoable), J4-023 (one-sided transfer void skews Net Position), J4-030 (mass-email reminder waves fire with no confirm), J4-014 (two rails with contradictory approval rules), J4-015 (automated reminders are manual/self-addressed/skip the late ones), J4-016 (allocation payments no team attribution), J4-031 (payees uncreatable/unmergeable), J4-018/019 (mobile table crops money / green $0 reads healthy).

### Cross-refs (NOT here)
J4-020 (Blocker ledger corruption) → FP-1. J5-026 / J2-035 (coach-side mark-paid) → FP-1 / phase5. J4-035 (coach offboarding cliff) → FP-7/coaches. J4-001 (dead pages) → FP-1.

## Phases

- **Phase A — billing lifecycle (fix-now):** J4-032, J4-033.
- **Phase B — board numbers that don't lie:** J4-010/011/025/024/026/027/022.
- **Phase C — reversible money + the rollup:** J4-013/023/030/014/015/016, then J4-028/017 (the Financial Summary wow).

## Key decisions

- **STRIPE_INTEGRATION stays archived** and is cited; this project is its named successor for the audit's billing findings. If broader Stripe Phase-G work resumes, reconcile scope then.
- **J4-020 ledger-corruption Blocker stays in FP-1** (fix-now sweep) — referenced here, not owned here.
- **Schema/accounting changes** update DATA_DICTIONARY + snapshots per the schema-dictionary rule.

## Success criteria

1. The charge a president confirms is the charge that fires; archived teams stop billing.
2. The overdue count, headroom, and allocation rows on the board-facing pages are all true and reconcile.
3. Every money action is confirmable and reversible (mark-paid, transfer void).
4. A whole-club Financial Summary exists (program-segmented P&L + one receivables panel).
