# PM brief — Real email addresses on our own domain

**Priority:** medium-high — the "contact us" address we already show customers goes nowhere today.
**Status:** queued 2026-10-26, waiting for the owner to start. Plan: `BUSINESS_EMAIL_ADDRESSES_PLAN.md`.

## What changes for people

- **Customers** can write to `support@fieldlogichq.ca` (or `hello@`) and get a human reply that comes
  back from that same address. Today a reply to one of our emails disappears.
- **Us:** support mail arrives in one place we actually read, and we can answer as "support" rather than
  from a personal Gmail.
- **Nothing changes in how the product's own emails are sent** — those already go out as
  `noreply@fieldlogichq.ca` and keep working.

## Why it matters

A customer-facing address that nobody reads loses signups, payment questions and cancellations
silently, and looks unprofessional on a site that asks clubs to trust us with their money. It is also a
prerequisite for any future support process or the privacy/billing contact lines.

## What the Google list got right and wrong

It lists full mailbox products, but most of what we need is cheaper: **receive** support mail and
**reply** as the support address. We already pay for the sending half (Resend). The work is picking the
cheapest way to receive, and proving replies don't land in spam. One option on the list (Cloudflare
forwarding) probably doesn't fit because our domain's records live in AWS.

## Expected customer impact

Low visible change, high trust and recovery value: questions that were lost get answered.

## Success looks like

Write to support from an outside address → it arrives → our reply lands in their inbox (not spam),
showing `support@`. No page or email names a dead address. Monthly cost inside a ceiling the owner sets.

## Scope and timing (ruled 2026-10-26)

A team of one: every address (support, info, feedback, hello, noreply) forwards into the one inbox already
in use, and replies go out as the address the customer wrote to. Runs **right after Support Console Stage 5**,
which ships first with replies going to the existing Gmail inbox. The setup itself (no app code) can be
done any quiet moment earlier.

## Decisions made (2026-10-26)

- **Public addresses:** `support@` (help, everywhere a customer looks), `hello@` (general and marketing),
  `privacy@` (privacy policy and terms only). `noreply@` stays send-only. No `info@`, `feedback@`,
  `billing@`, `security@` or `sales@` yet.
- **Goal:** no customer ever sees the Gmail address; the product sounds professional.
- **Spend:** close to zero. No live clients, little mail expected.

## Decisions still waiting on the owner

None. The plan is ready to start when the owner is.
