# PM brief — Click-away / Escape sweep

**Owner-approved 2026-07-30 · in progress · plan:** `DISMISS_BEHAVIOUR_SWEEP_PLAN.md`

## What this is

Across the platform there are small panels that open when you tap something and close when you tap
away — the "More" menu in the mobile navigation bars, the notification bell, filter menus on the
schedule and registrations screens, the payee picker in accounting, and others.

Each of those was built separately, with its own private copy of "close me when the user clicks
elsewhere." There are seventeen such copies. This work replaces them with one shared behaviour.

## Why it matters — the part that isn't housekeeping

**Seven of those panels cannot be closed with the Escape key.** Click away and they close; press
Escape and nothing happens.

For a mouse user that is a shrug. For someone navigating by keyboard — including anyone using a
screen reader — it means opening one of these panels leaves them with no keyboard way out. The panels
affected are not obscure: they include the **More menu in both mobile navigation bars** and the
**notification bell**, which appear on essentially every screen.

Consolidating onto the shared behaviour fixes this as a side effect, because the shared version has
always handled Escape. That is the real reason to do this now rather than filing it as tidy-up.

## What a customer will notice

For most people, **nothing**. The panels look identical, open identically, and close on click-away
exactly as before.

For keyboard users, seven panels start responding to Escape. That is the entire visible change.

## Expected impact

- **Accessibility:** closes a keyboard-trap-adjacent gap on two navigation bars and the notification
  bell — the highest-traffic surfaces in the product.
- **Maintenance:** one fix reaches every panel instead of seventeen. These copies had already drifted
  apart, which is exactly how the Escape gap appeared in the first place — some copies got it, some
  never did.
- **Risk:** low but not zero. This touches many files lightly rather than a few files deeply, so the
  failure mode to watch for is a menu that stops closing, not data loss. There is no database change
  and no change to who can see or do anything.

## Priority

Medium. No customer has reported it, and nothing is broken for mouse users — but it is a genuine
accessibility gap on high-traffic surfaces, the fix is well-understood, and the shared behaviour it
depends on has just been proven by review across three other panels.

## What is deliberately NOT included

- **The chat reaction popovers.** They were built differently — no container to test against — so
  converting them means reshaping chat's markup. That is a different kind of change than the rest of
  this work and should be approved on its own.
- **The coach team switcher.** Another workstream has that file open right now. Deferred to avoid two
  sessions overwriting each other, not because it is hard.

Both are recorded so they are not quietly lost.

## Success criteria

1. Every converted panel still opens, still lets you pick things, and still closes when you click away.
2. The seven panels that ignored Escape now close on Escape.
3. No visual or wording change anywhere.
4. Nothing else regresses — particularly the mobile navigation bars, which are on every screen.
