# PM Brief — "Pause notifications" master switch

**One line:** A single switch at the top of Notification Settings that quiets everything the platform sends you — except the alerts you can't afford to miss.

## What the user does differently
Today, someone who feels buried has to hunt through every workspace card and flip individual switches off. After this: one **"Pause notifications"** switch at the top of their notification settings mutes it all at once, on every device they're signed in on. Flip it back and everything they had returns exactly as it was — it never erases their choices.

## What still gets through (deliberately)
Two things pierce the pause so a quiet setting can't cause a costly miss:
- **Failed-payment alerts** — missing one can quietly suspend an org's billing.
- **@mentions in Chat** — the app already promises these "always reach you."

The switch shows this honestly: a sub-line and two small "still on" chips under it.

## What it covers
Everything else: organization/staff alerts, coach notifications, chat activity, the weekly coach digest, and the live-score / event-news pushes for teams you follow.

**Not covered in v1 (called out so it isn't assumed):** a coach's *organizer-sent* dues and game-day reminder emails. Those are a separate mass-email system tied to an email address, not your account, and already have their own organizer-side off switch. Reaching them from a personal pause needs plumbing that doesn't exist yet — a possible later addition.

## Why it matters
It's the single most-requested "give me quiet" control, and doing it *safely* (protected floor, non-destructive, honest copy) is the differentiator — a naive "turn everything off" would silence billing failures and read as a support liability. This version can't.

## Customer impact & priority
- **Impact:** high for overwhelmed multi-workspace users (owners/coaches on several orgs) and for fans following many teams during a busy weekend. Low risk to everyone else (off by default; nothing changes unless they flip it).
- **Priority:** medium — a satisfying, self-contained addition riding the same release as the rest of the warm consumer app.

## Success criteria
- Toggling on visibly stops non-protected notifications on every signed-in device; a failed-payment alert and an @mention still arrive.
- Toggling off restores the user's exact prior per-notification settings (nothing lost).
- Copy makes it obvious what still comes through; no support tickets from "I paused everything and missed a billing failure."

## Rollout
Ships with the pending Unified Home production bundle (needs a small database change applied to production first). Owner browser/device test before promotion.
