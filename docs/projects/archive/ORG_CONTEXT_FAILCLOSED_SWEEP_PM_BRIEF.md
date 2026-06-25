# PM Brief — Org-Context Fail-Closed (J3-012 + J4-012)

> Part of **FP-1 Trust & Integrity Hardening**, Phase A. Branch `feat/free-tier-coaches`.
> Companion: [TRUST_INTEGRITY_HARDENING_PLAN.md](TRUST_INTEGRITY_HARDENING_PLAN.md) ·
> Edit spec: [ORG_CONTEXT_FAILCLOSED_SWEEP_SPEC.md](ORG_CONTEXT_FAILCLOSED_SWEEP_SPEC.md)

## What this is
The single highest-blast-radius fix in the user-journey audit. Admin and coach screens were
resolving "which organization am I working in?" from the user's *first* membership row instead
of the organization in the address bar.

## Why it matters
For anyone who belongs to **more than one organization** (a club president running two clubs, a
coach who also has a free workspace), the app could silently act on the wrong org:
- **Best case:** a bogus "Forbidden" wall on a module they actually own — they think their plan is broken.
- **Worst case:** reads *and writes* land in the wrong org — e.g. an accounting ledger entry posted
  to the wrong club's books. A trust-catastrophic, hard-to-detect data-integrity bug.

Single-org users never saw it, which is why it survived this long. Multi-org users — exactly the
club-president and coach personas League/Club is sold to — hit it immediately.

## Expected customer impact
- Multi-org users: every admin/coach screen now resolves to the org in the URL. No phantom
  "Forbidden," no cross-org data leakage.
- Everyone else: zero visible change. No new screens, no role changes — a class of failures
  simply stops happening.

## Priority
**Fix-now / High** — the last open piece of FP-1 Phase A. Nothing in FP-2…FP-7 should ship before
the FP-1 fix-now tranche lands, and this is the breadth item in it (~143 files).

## Success criteria
1. A multi-org user (owner@dev.local) can no longer read or write the wrong org on ANY module
   (house-league, accounting, rep-teams, members, org-settings, public-site, coaches).
2. `getAuthContext` fails closed: admin/coach routes pass `requireOrgSlug: true`; a missing org
   resolves to null, not the first membership.
3. A CI lint guard (`check:org-context`) fails the build if a future admin/coach route forgets to
   pass org context — the bug can't silently return.
4. No regression for orgless-by-design callers (billing, /api/auth/me) — they keep the
   user's-own-org fallback.
