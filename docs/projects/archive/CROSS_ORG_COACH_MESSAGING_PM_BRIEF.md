# Cross-Org Coach Messaging — PM Brief

**Status:** Planned, not started. Extension of the Coach Chat Platform.
**One-liner:** Let coaches message coaches in *other* organizations — so a club coach can reach a standalone coach to set up a scrimmage — without breaking the privacy walls between organizations.

## What it is

Every chat we've planned so far lives inside a single organization's walls (a tournament's coaches, a club's coaches, a coach and their parents). This adds the one conversation that deliberately crosses those walls: **coach-to-coach across different organizations**, aimed at real-world coordination like arranging scrimmages, exhibition games, and shared practices.

## What the customer sees and does

**Version 1 (invite-by-link):** A coach opens their portal, generates a private invite link, and shares it with another coach however they already communicate (text, email, in person). The other coach taps the link, signs in, and a private one-to-one thread opens between them — with the same chat experience used everywhere else in the product (live messages, unread badges, push notifications). No public directory, no exposure of anyone's contact details.

**Version 2 (later — opt-in directory):** Once enough standalone coaches are on the platform, coaches who *choose* to be discoverable can appear in a searchable directory (name, organization, sport/age group — never contact details). Another coach sends a connection request; only if it's accepted does a thread open. Coaches can block and report. This version is gated behind a privacy/anti-spam legal review.

## Who can use it

- **Paid coaches on both sides.** Cross-org messaging is for coaches who hold a paid coaching plan (the standalone Coaches Portal, or a Premium coach seat in a league/club).
- **Free coaches are not included here.** A free coach's chat access stays limited to the tournament chat run by a tournament admin. This keeps the feature simple and avoids unpaid coaches being cold-contacted.

## Why it matters

- It's the first feature that turns FieldLogicHQ from a set of **isolated tenants** into the beginnings of a **coach network** — a genuine differentiator and a reason for standalone coaches to value the platform beyond managing their own team.
- Scrimmage/exhibition coordination is a real, recurring pain for coaches that currently happens over scattered texts and emails. Bringing it in-platform increases stickiness and gives the paid Coaches Portal a clear "why pay" story.

## Customer impact & priority

- **Priority: medium, and sequenced.** It is **not** the first thing to build. It depends on two things first: (1) the shared chat engine and in-org chat (the core ask), and (2) **the standalone Coaches Portal actually being open for paid sign-up** — today it isn't, so there's no population of standalone coaches to message yet.
- Recommended sequence: launch the Coaches Portal → build core chat → add cross-org invite-by-link → (later) add the opt-in directory.

## Key trade-offs made

- **Start narrow (invite-by-link), not broad (directory).** The link model delivers the scrimmage use-case quickly, exposes no personal data across organizations, and avoids a legal review for the first release. The bigger "find any coach" directory is deferred until there's a real user base and demand is proven.
- **No reliance on the bigger identity change.** We considered whether collapsing to a strict "one account = one organization" model would unlock this; it wouldn't remove the core work, so this feature does **not** wait on that decision (which is being weighed separately on its own merits).

## Success criteria

- A paid coach can start a private cross-org thread with another paid coach in under a minute, and both reliably receive messages and notifications.
- Zero cross-organization data leakage (no coach can see another org's data through this feature).
- Coaches report using it to arrange real scrimmages/exhibitions (qualitative), and it becomes a cited reason standalone coaches value the paid portal.

## Open questions for the owner

1. Exactly which paid plans qualify a coach to use this (paid Coaches Portal only, or also Premium coaches in a league/club, and does a Tournament Plus admin who also coaches count)?
2. Should cross-org threads persist indefinitely or auto-archive after a period of inactivity?
3. For the later directory: how much does a coach reveal (name only / + org / + sport & age group)?
