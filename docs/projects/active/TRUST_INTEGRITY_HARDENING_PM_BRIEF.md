# PM Brief — Trust & Integrity Hardening

> **Created:** 2026-06-13 · **Companion plan:** [TRUST_INTEGRITY_HARDENING_PLAN.md](TRUST_INTEGRITY_HARDENING_PLAN.md) · **Source:** User Journey Audit Phase 5 (FP-1)

**What it does:** Fixes the cross-platform security and data-integrity problems the 10-persona journey audit found — the handful of issues that leak personal data, corrupt records, or let the wrong person see/change the wrong org's information. These are not polish; they are the "must fix before we put this in front of real customers" set.

**Why it matters:** The audit surfaced a small number of high-blast-radius roots. Anonymous visitors can currently harvest coach emails, payment status, and private admin notes from any tournament's public pages; an unauthenticated visitor can type a guardian's email and get a child's name, age division, and status — even on private leagues; a documented "Add Ledger" button corrupts a club's books; a permissions bug resolves the wrong organization for multi-org users, so reads and writes can land in the wrong org's records; 17 admin/coach pages are dead on the current framework; and removing a member can delete a person's entire multi-org account. Each is trust-catastrophic and several gate whether a module can be promoted to customers at all.

**Who benefits:** Every customer-facing role and all four plan tiers — but especially anyone whose data is currently exposed (coaches, guardians, children) and multi-org operators (club presidents, coaches with their own free workspace) who hit the wrong-org bug by definition.

**Expected impact:** The platform becomes safe to promote. Specifically: anonymous endpoints serve only non-sensitive data; the child-disclosure lookup requires proof of possession; org context fails closed so multi-org users can never touch the wrong org; the ledger button stops corrupting books; the dead pages render; and member removal stops destroying multi-org accounts.

**Priority:** Highest — this is the audit's headline recommendation and the prerequisite for the six experience projects (FP-2…FP-7). The fix-now tranche ships first.

**Success criteria:**
1. Every Blocker and fix-now finding in the plan verified fixed against its original repro.
2. A multi-org user can no longer read or write the wrong organization's data.
3. Anonymous public endpoints serve only sanitized payloads.
4. No new regressions; schema changes reflected in the data dictionary + snapshots.

**Scope note:** Correctness and security only. The bracket-math correctness items (a tied playoff advancing the wrong team; a coin toss that doesn't re-seed) stay with the Tournament Organizer Experience project (FP-5) per owner decision. UX, IA, and design fixes live in the other fix projects.
