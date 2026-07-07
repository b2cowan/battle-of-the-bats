# Rain Delay / Day-of Operations — PM Brief

> **Created:** 2026-07-04 · **Status:** Planning · **Full plan:** `RAIN_DELAY_DAYOF_OPS_PLAN.md`

## PM Brief — Feature A: Day-of alerts that actually notify people

**What it does:** Lets fans opt into tournament notifications on the app (not just alerts for one team they follow), and makes an organizer's posted day-of message — like a rain delay — send a push notification to those fans and to the affected coaches, instead of just showing up silently on the schedule.

**Why it matters:** Right now an organizer *can* post "Rain delay — games pushed 1 hour," and it appears as a banner on the public app. But nobody is told. Fans only get buzzed when a score is posted for a team they personally followed; coaches get nothing at all on a schedule change. On a wet Saturday morning that means families drive to the field not knowing games moved. This closes the single most obvious gap in day-of communication.

**Who benefits:** Fans and families following a tournament (broadened opt-in), coaches of participating teams (now notified of changes), and organizers (their message finally reaches people). Fan messaging is anonymous and app-based — no login required.

**Expected impact:** A posted day-of alert reaches everyone who opted in within seconds. Fewer confused arrivals, fewer "did games move?" texts to the organizer, a more trustworthy public app.

**Priority:** High — it's the direct answer to a real organizer need (rain delays), reuses notification plumbing we already ship, and is low-risk.

**Success criteria:** An organizer posts a rain-delay message and opted-in fans + coaches receive a push that deep-links to the message; fans can opt into tournament-wide messages without following a specific team; category preferences let them choose score alerts vs. schedule/message alerts; posting without the notify option still works as a silent banner.

---

> **Status: Built on dev 2026-07-07 (B1–B3).** Not yet browser-tested by the owner, not yet through /review or /docs. Ships after: owner test → /review → /docs → apply migrations 177 + 178 to production → promote.

## PM Brief — Feature B: One-tap "shift the day" schedule tool

**What it does:** Lets an organizer select today's remaining games and move them all by a chosen amount (e.g. +1 hour for rain), or cancel some and push the rest — in a single action with a clear before/after preview — then optionally announce and notify in the same step.

**Why it matters:** Today, adjusting a rained-out day means editing games one at a time. A 20-game Saturday is 20 manual edits under pressure, with real risk of mistakes (moving a playoff final before its semifinal, forgetting a game). Organizers need to re-time the day in seconds, safely.

**Who benefits:** Tournament organizers and their admins (capability-gated), and indirectly every coach, player, and fan who gets an accurate, promptly-updated schedule.

**Expected impact:** "Rain delay, everything moves an hour" becomes one confirm instead of twenty edits. The tool guards against bracket-order mistakes automatically and refuses a half-applied change. Paired with Feature A, the same confirm updates the schedule, posts the banner, and pushes everyone.

**Priority:** Medium-High — high operational value on game day; slightly more build risk than Feature A (bracket integrity, timezone math), so it follows A.

**Success criteria:** An organizer shifts all remaining games by a chosen offset (or cancels some and shifts the rest) in one action; already-played games are never touched; a shift that would corrupt a playoff bracket is caught before it applies; public schedule updates within the normal live-refresh window; the optional "announce + notify" hand-off posts the message and pushes fans + coaches together.

---

## How they fit together

Feature A can ship first and stands on its own (announcements finally notify). Feature B can ship without A (silent shift). The payoff is the two together: **rain hits → organizer opens "shift the day" → moves remaining games +1h → one confirm also posts the banner and pushes fans and coaches.** That end-to-end flow is the north star; the phasing lets us de-risk by shipping the notification half first.

## Owner decisions needed before build

1. Can fans follow the **whole tournament** for messages, or must they follow a team? (Recommend: allow tournament-wide.)
2. One "all alerts" toggle, or **separate categories** (scores / schedule changes / messages)? (Recommend: a few categories, all on by default.)
3. Is fan **tournament-message push** a Tournament Plus feature or included in base Tournament? (Route to `/billing` + `/strategy`.)
4. On a bulk shift, **always notify / prompt / silent**? (Recommend: prompt with a prefilled message.)
5. Cancelling a **playoff** game in the bulk tool — **block or warn**? (Recommend: allow with a clear warning.)
6. Anti-spam posture for pushing messages to anonymous fans (push, not email — keep opt-in, revocable, rate-limited).
