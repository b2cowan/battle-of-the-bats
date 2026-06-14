# Platform-Admin API Hardening (F1) — PM Brief

> **Companion plan:** [PLATFORM_ADMIN_API_HARDENING_PLAN.md](PLATFORM_ADMIN_API_HARDENING_PLAN.md) · **Priority: P0 (security), fast-track** · Created 2026-06-13.

## One line

Close a set of internal-console permission holes where staff API endpoints check only "are you logged in," not "is this your job" — letting any employee role do things only specific roles should.

## Why it matters

FieldLogicHQ's internal admin console has role-based access (support / billing / product / growth / read-only) so each employee sees only what their job needs. That model is correctly enforced on the **screens** — but the audit found several **behind-the-scenes endpoints** that skip the role check. In practice that means a teammate with a narrow role (say a growth contractor, or a read-only auditor) could, by calling the right URL: overwrite the company's live customer-email wording, fire off a real mass email, or download the entire sales-lead / customer-feedback / error database including private notes. These are live in production. None is exploitable by an outside customer — they require a logged-in employee — but they defeat the whole point of having internal roles.

## What changes

Every flagged endpoint gets the same permission check its on-screen page already uses, via one shared helper so the gap can't reopen. Two items need an owner call: whether permanently deleting a customer account should require a senior role, and how tightly to lock the developer tools.

## Customer impact

None visible — this is internal safety. The benefit is reduced risk of an accidental or unauthorized mass email, data export, or destructive action as the team grows.

## Priority & success

- **Priority:** P0, ahead of the cosmetic/UX audit fixes — it's verified, small, and security-relevant.
- **Success =** no platform-admin endpoint grants more than the employee's role allows; a single shared guard helper enforces it from the same source of truth as the menus and pages.

## Size

Small and surgical — roughly a day: one helper + ~7 route edits + a grep-sweep for stragglers. Verified findings, so little discovery risk.
