# PM Brief — Editable Email Campaigns

**Created:** 2026-06-29 · Companion to `EDITABLE_EMAIL_CAMPAIGNS_PLAN.md`

## What this is
Today the operator console shows 10 founding-season marketing emails you can preview and send — but you can't change a single word, date, or audience without a developer editing code and shipping a release. This gives operators the ability to **edit the campaigns' content themselves**, reusing the email-editing tool the platform already has for its other (transactional) emails.

## Why it matters
Marketing copy changes often — a date, a price mention, a tightened subject line. Routing every tweak through an engineer + deploy is slow and expensive, and it's inconsistent: the console *looks* like it manages these campaigns but offers no edit. It's also a hidden data-quality risk — each campaign's wording currently lives in two code spots that must be kept in sync by hand (the same class of drift we're already hardening elsewhere).

## What changes for the operator
- **Edit a campaign's subject and body** from the console, preview it in the FieldLogicHQ brand look, and **reset to the default** — exactly like the platform's other editable emails today. No deploy.
- The dashboard becomes **honest about what's editable**: content you can change vs. timing/audience that the system controls (shown read-only, clearly labeled).
- One source of truth for each campaign's words, so preview always matches what's actually sent.

## What we deliberately keep locked (for now)
- **Audience targeting** stays system-controlled (it's backed by real rules and youth-sport privacy/consent obligations — free-text targeting would be a foot-gun). A future phase could offer a few safe, pre-built audience choices.
- **Trigger-based timing** ("at signup", "60 days after signup") stays system-defined; only true calendar-date sends become date-editable.

## Priority & phasing
- **P1 (highest value):** content editing for the campaigns, and collapse the duplicated content into one place.
- **P2 (built on dev 2026-07-09):** operators can now **edit the planned date** on the calendar-based campaigns, and the dashboard shows a **"needs sending" board** — **Past due** (send now) and **Upcoming** (next 30 days) — so nothing gets missed. Trigger-based timing and audience stay system-defined. Sends remain **manual** (the board tells you *when*; true auto-send was intentionally left out). Future option: active reminders (bell/email) when a campaign comes due.
- **P3 (small, ships with P1):** dashboard clarity — mark editable vs system-defined.

## Success criteria
- Operators edit campaign wording + preview + reset without a developer.
- Preview always matches the sent email (single source).
- The dashboard no longer implies editability it doesn't have.

## Customer impact
Indirect but real: faster, safer marketing iteration (right dates, right prices, on-brand), and one less way for an outdated or off-message email to reach a customer.
