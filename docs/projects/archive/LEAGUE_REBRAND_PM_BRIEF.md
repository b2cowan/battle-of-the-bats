# League Rebrand — PM Brief

**Status:** Approved, in execution (2026-06-13). Plan: [LEAGUE_REBRAND_PLAN.md](LEAGUE_REBRAND_PLAN.md).

## What we're doing

Renaming two customer-facing plan names so the League line mirrors the Tournament line:
- The free house-league tier "**League Starter**" becomes "**League**".
- The paid $89 tier "**League**" becomes "**League Plus**".

Nothing changes under the hood — same plans, same prices, same Stripe, same database. Only the **names customers see** change.

## Why it matters

- **"League Starter" was off-brand.** Our brand voice forbids "Starter"/"Pro" naming; the free tier needed a better name regardless.
- **It makes the upsell honest.** Free "League" lets a small organizer run one real season; "League Plus" is the clear "run a *bigger* league" upgrade (multiple divisions, seasons, full public site, exports) — exactly parallel to Tournament → Tournament Plus.
- **The timing is free.** Paid League is still early-access (no self-serve checkout, no paying customers yet), so renaming it now costs nothing and sets up a clean launch.

## What a customer sees differently

- The pricing page and in-app upgrade prompts now say **"League Plus"** for the $89 tier.
- Inside the free house-league beta, the product calls itself **"League"** (not "League Starter"), and cap walls say "upgrade to **League Plus**".
- No new free "League" tier is advertised publicly yet — that goes live with the Phase-9 launch.

## Role-based access

No change. This is names/copy only — no gating, permissions, or feature changes.

## Success criteria

- Every customer-facing surface uses the new names; no internal keys, routes, or the "House League" module name are touched.
- The brand-voice + pricing-strategy canon is updated so the new names are authoritative.
- typecheck/lint pass; owner spot-checks pricing + a cap-hit modal.

## Out of scope (Phase-9 launch)

A public free-"League" pricing card / "start free League" CTA — held until the beta flag flips.
