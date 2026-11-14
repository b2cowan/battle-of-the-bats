# PM brief — Real email addresses on our own domain

**Priority:** high. The contact address we already show customers goes nowhere today: mail to it bounces.
It is also a prerequisite for publishing the Terms (GST/HST step 6.7).
**Status:** started 2026-11-12; research done; one owner decision open. Plan: `BUSINESS_EMAIL_ADDRESSES_PLAN.md`.

## What changes for people

- **Customers** can write to `support@fieldlogichq.ca`, `hello@` or `privacy@` and it reaches us. Today the
  sender gets a bounce. Our reply comes back from `support@`, never from a personal Gmail.
- **The owner** keeps reading everything in the Gmail inbox he uses today, sorted by a label per address.
- **Nothing changes in how the product's own emails are sent.** They go out as `noreply@` and keep working.

## Why it matters

Every product email invites a reply to `hello@`, and about fifteen screens and emails print it. Those replies
bounce, so signups, payment questions and cancellations are lost silently. A site asking clubs to trust it with
money cannot have a dead contact address. The Terms and privacy policy also need a working contact line before
they publish, and anti-spam law (CASL) needs one on commercial email.

## What we found (2026-11-12)

- **Receiving is free and quick.** A free forwarder fits our domain setup with no change to product email.
  About twenty minutes in the AWS console.
- **Replying "as support@" from Gmail is going away.** Google ends that feature in January 2027 and may refuse
  new setups now. The free plan from October would have worked for about two months.
- **The product half is mostly ready.** One shared contact address already exists. A few billing "Contact us"
  links and email fallbacks still show the Gmail address and get fixed in this project.

## Ruled 2026-11-12

- **Free receiving now.** Mail to support@, hello@ and privacy@ lands in Gmail.
- **Own domain mailboxes later**, after a handful of paying clients.
- Until then, replies go out from the Gmail address. That is accepted at today's near-zero volume, but the mailbox
  should exist before we answer a paying client.

## The options as they were laid out (kept for when the mailbox decision comes back)

**How should replies leave?**
- **A (recommended):** a real mailbox, about C$15 a year (Zoho Mail Lite). Mail still lands in Gmail, and replies go
  out from the phone's Gmail app or the provider's site as `support@`.
- **B:** free, but two apps. Reply from a separate mail program. One reply from the wrong app shows a customer the
  Gmail address.
- **C:** answer from our own admin. Free to run, but a real build.

A needs the October "close to zero" spend ruling revisited, because the free path it assumed is being removed.

Separately: **turn on free receiving now** so the bounce stops while the reply decision is made (recommended).

## Success looks like

Write to support from an outside address. It arrives, and our reply lands in their inbox (not spam) showing
`support@`, and it still works after January 2027. No page or email names the Gmail address or a dead one.
