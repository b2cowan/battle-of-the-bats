# Top Nav Repair — PM Brief (2026-08-01)

**What this is:** the repair package for the top-nav audit. Ten decisions (R1–R10), each with a
recommendation and — where a real alternative exists — the alternative, shown as before/after
mockups drawn from live measurements of the current build. Nothing is built until you rule.

**Mockups:** https://claude.ai/code/artifact/6d825ef3-192a-4e12-8b4b-6f46e8e947b1
**Full plan:** `TOP_NAV_REPAIR_PLAN.md` · **Evidence:** `TOP_NAV_CONSISTENCY_FINDINGS.md`

## What changes for people, by phase

- **Phase 0 (no ruling needed):** invisible cleanup that removes the ways removed things creep back
  (stale notes, leftover old-height fallbacks, dead code, one label casing, two stacking-order
  fixes). One visible piece: the scorekeeper screen stops changing shade against its twin check-in
  screen for a volunteer working both.
- **Phase 1 — nobody lands on a dead page (R1, R2):** the org-name link on event pages stops
  rendering when the org's page isn't public (today it 404s), and the coach "not assigned" screen
  gains the normal frame plus real exits — Home, sign out — instead of a black screen with one
  possibly-dead link.
- **Phase 2 — the marketing seam (R3, R4, R5):** tablets stop showing two menus with a colliding
  logo; a signed-in customer visiting Pricing sees their Account and an "Open app" button instead
  of "Sign In / Get Started"; the marketing bar's height gets formally chosen and its content lines
  up with the pages under it.
- **Phase 3 — the paid surface sits on its own grid (R6, R7):** League page content aligns under
  the new section tabs, and the one corner of the product where door order differs (club pages)
  falls in line — or is formally ruled an exception.
- **Phase 4 — judgement calls (R8, R9, R10):** the admin phone's confusing second "Chat" door; the
  packaging question of whether Pricing belongs on a customer's phone pages at all; and the
  suspended-account page whose copy contradicts its working navigation.

## The three rulings that actually need your judgement

Most items have an obvious right answer (marked "defect fix — confirm only"). The real calls:

1. **R9 — Pricing on a customer's public pages.** Recommendation: leave it off (their page, not our
   billboard; acquisition already lives on free-tier event pages) and correct the recorded wording.
   The alternative — Pricing for anonymous phone visitors only — is defensible if acquisition from
   club traffic matters more than page ownership. This is a packaging decision → `/strategy` logs it.
2. **R5 — what height is marketing?** Recommendation: keep today's height but make it official and
   line its content up. Alternatives: fold marketing into the app-bar height (more unified, more
   churn) or the branded-row height (taller for no benefit).
3. **R7 — club-page door order.** Recommendation: match the rest of the product (one-line change).
   Alternative: ratify the exception in writing. Either resolves the rule-conflict the audit found.

## Success criteria

No door in the product can land on a 404; a stranded coach always has a way out; one nav set per
viewport on marketing; a signed-in customer is never shown "Sign In"; League content aligns under
its tabs (re-measured, not eyeballed); both standing navigation guards stay green throughout, with
new guard checks added for the 404-door and marketing fixes.
