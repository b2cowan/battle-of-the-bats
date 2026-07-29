# PM Brief — Coach Premium: Automatic Retry for a Partial Data Carry-Over

**One-liner:** If bringing a coach's roster/schedule/fees into Premium ever hits a snag, the system quietly finishes the job on its own — instead of leaving the coach to notice and fix the gaps by hand.

**Plan:** [COACH_PREMIUM_MIGRATION_RETRY_PLAN.md](COACH_PREMIUM_MIGRATION_RETRY_PLAN.md) · **Parent:** [COACH_PREMIUM_UPGRADE_FLOW_PLAN.md](COACH_PREMIUM_UPGRADE_FLOW_PLAN.md)

## Why it matters

The upgrade copies a coach's data into Premium at the moment they pay. Today, if a transient hiccup means part of it doesn't make it, we're honest about it — the welcome banner says "some items hit a problem, double-check your roster/schedule/fees" — but the coach has to clean it up themselves. For a brand-new paying customer in their first five minutes, "your data half-arrived, go fix it" is a rough first impression. This makes the system **finish the job automatically** so most snags resolve before the coach even sees them.

## What the coach experiences differently

- **Before:** populated portal + a "couldn't bring everything over" warning they have to act on.
- **After:** the portal quietly completes the import in the background; the banner updates to "we finished bringing the rest over." If it genuinely can't (a stuck item), it stops trying after a few attempts and shows clear "add this manually / contact support" guidance — plus a **"Try again now"** button they can press themselves.

## The one thing that makes it safe

Retrying a data copy is risky — done naively, it **duplicates** everything that already arrived. The fix is to give each carried-over record a quiet "where it came from" tag, so a retry can fill only the missing pieces and never re-copy or overwrite what's already there (including anything the coach already edited). Lucky timing: since Premium upgrades aren't live in production yet, we can add this safely now and every future upgrade is covered with no clean-up of old data.

## Scope guardrails

- Only re-attempts the parts that **failed** — it never re-touches things we **intentionally** left behind ($0 fees, fees with no player, etc.), and never overwrites a coach's own edits.
- It's a one-time catch-up, not an ongoing sync — the free team becomes read-only history at upgrade.

## Cost & priority

Small–medium (~2–4 days) including review. Best done **before launch** so the safety tagging is in place from the first real upgrade. Not a launch blocker on its own, but cheap insurance for the new-customer first impression.

## Success criteria

- A partial carry-over caused by a transient error self-completes with no coach action and no duplicate data.
- A genuinely stuck item stops retrying after a few attempts and gives the coach a clear, honest next step.
- No duplicated players/events/fees and no clobbered coach edits, ever.

## Decisions needed

Trigger (auto + manual button — recommended), how many auto-attempts before giving up (recommend 3), and confirming we add the safety tagging now, pre-launch.
