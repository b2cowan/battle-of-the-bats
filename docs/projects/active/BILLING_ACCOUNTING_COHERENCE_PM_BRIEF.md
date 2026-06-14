# PM Brief — Billing & Accounting Coherence

> **Created:** 2026-06-13 · **Companion plan:** [BILLING_ACCOUNTING_COHERENCE_PLAN.md](BILLING_ACCOUNTING_COHERENCE_PLAN.md) · **Source:** User Journey Audit Phase 5 (FP-6), successor to the archived Stripe Integration plan

**What it does:** Makes the Club-tier money tools trustworthy — bill what you confirm, show numbers that are true, and let money actions be undone. The club president's journey found excellent accounting bones with three coherence failures sitting on top, and this project fixes all three.

**Why it matters:** Money trust is the Club tier's entire sales pitch, and today it's shaky. The charge a president approves in the confirmation modal never actually fires — the real charge lands later on an unrelated trigger; archiving a team keeps billing it forever; the "who is late" page can never show an overdue installment because the query omits the due date; the board-facing "Org Headroom" number is summed from at most 50 entries, so it's silently wrong at exactly this club's size; the page literally named "Budget vs. Actual" contains no actuals; and marking a $1,500 installment paid is one unconfirmed, irreversible click. Every one of these is a number a president repeats to his board. The Stripe integration plan that would have owned the billing half is archived.

**Who benefits:** Club presidents and treasurers on the top-priced tier — the customers paying the most and currently landing on the least-trustworthy money surface.

**Expected impact:** The charge you confirm is the charge that fires; the board-facing numbers are true and reconcile; money actions are confirmable and reversible; and a whole-club financial summary finally exists — the screenshot that sells the Club tier to a board.

**Priority:** High — contains a fix-now billing-lifecycle defect, and the accounting-truth cluster is the Club tier's core value proposition.

**Success criteria:**
1. The confirmed charge is the charge that fires; archived teams stop billing.
2. Overdue counts, headroom, and allocation rows are all true and reconcile.
3. Mark-paid and transfer-void are confirmable and reversible.
4. A whole-club financial summary exists.
