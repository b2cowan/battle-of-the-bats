@AGENTS.md
@AGENCY_RULES.md

# Post-edit review

After completing a **substantive** code change (new logic, API/DB/auth/shared-module edits, anything beyond copy/CSS/docs/config tweaks), proactively offer to run `/review` — the token-tiered adversarial funnel in `.claude/commands/review.md` — before treating the work as done. Offer once per logical chunk of work; don't nag on trivial diffs, and skip the offer if the user has already asked for a review or said to skip it. `/review` runs the deterministic gate first, so it's cheap on clean diffs.

# Help-docs sync

When a change alters a **user-facing flow** (admin/coaches UI behavior, a screen/step a customer follows, plan-gating of a visible feature, or new/renamed terminology), proactively offer to run `/docs` — the help-system agent in `.claude/commands/docs.md` — so the in-app guides don't drift. In-app help content is the single source of truth in `lib/help-content/*.tsx` (indexed by the hub arrays in the `help/page.tsx` shells); keeping it current is a code-time task, not a periodic manual sweep. Offer once per logical chunk; skip for purely internal changes (refactors, platform-admin-only ops, DB plumbing with no UI change) and skip if the user already updated docs or declined.
