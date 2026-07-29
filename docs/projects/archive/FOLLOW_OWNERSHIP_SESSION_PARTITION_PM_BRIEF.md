# PM Brief — Follow Ownership & Session Partition

## What this is
A fix to how "followed teams/events" behave on a device across signing in and out, so a device never shows follows that belong to someone else — or that only stuck around because someone logged in and back out.

## The problem, in plain terms
Fans can follow a team without an account; those follows are saved on the device. But the app doesn't remember *who* each follow belongs to, which causes two bad moments:

- **Follows survive a sign-out.** Sign into an account that follows teams, browse, sign out — and the teams are still sitting there for the next person (or for you, logged out). On a family or shared phone, that leaks one person's teams to another.
- **Follows blend together while signed in.** If you follow 10 teams on your phone and your mom borrows it to log into her account (which follows 1), she should see **her 1** — not 11. Today, on the tournament pages, your anonymous follows still show through and can even override which team she sees pinned.

## What changes for users
Every follow is treated as belonging to either **the device** (followed anonymously, no account) or **the account** (followed while signed in, or auto-synced from the account):

- **Signed out:** you see the teams you followed anonymously on this device. Unchanged, persists forever — the no-account feature still works.
- **Signed in:** you see **only your account's** teams, everywhere — Scores, Home, and the tournament pages. Anyone else's anonymous follows on that device are hidden for your whole session. If *you* have anonymous follows you want to keep, the existing one-tap "add these teams to your account" prompt makes them yours for good.
- **Sign out:** anything that showed up because of the session disappears; your own anonymous follows come back exactly as they were.

Nothing is ever lost: account follows are safely stored server-side and return when you sign back in; anonymous follows return when you sign out.

## Why it matters
- **Privacy on shared devices** — the #1 driver. A borrowed phone shouldn't reveal or mix up whose teams are whose.
- **Trust** — "I signed out and my mom still saw my teams" is exactly the kind of small leak that makes a product feel careless.
- **It keeps the anonymous-follow feature intact** — we get the privacy win without punishing fans who follow without an account.

## Customer impact
Fans (public/parent role). No admin, coach, or billing impact. No pricing or plan-gating change.

## Priority
Medium. One real leak is already partly fixed (account-seeded pins now clear on sign-out); the remaining work closes the rest of the leak and the "she sees 11" bleed on tournament pages.

## Success criteria
- Sign out → zero follows left behind that only existed because of the session.
- Signed in → only the account's follows appear, on every screen.
- Sign back out → your anonymous follows are exactly as you left them.
- Anonymous-only fans notice no change at all.

## Tradeoffs
- A solo user who signs out will briefly not see their teams *while signed out* if those teams live only in their account — this is intentional (signed-out isn't you), and they reappear on sign-in. The one-tap claim is the escape hatch for anyone who wants their follows to live on the device too.

## Rollout
No migration. Ships as part of the consumer/Unified Home work; verify on dev, then promote in a normal bundle.
