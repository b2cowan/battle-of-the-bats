# PM brief — Coach portal touch-target debt

**One line:** on a phone, hundreds of things a coach taps in the portal are smaller than a
fingertip, and we had stopped counting them.

## What is going on

The portal has an automated check that renders every coach screen at four widths and measures every
button and link. One of its rules is that a control must be at least 44px tall — the standard
finger-sized target.

That rule had been failing so widely that its failures were being recorded as "accepted" rather than
fixed: **1,928 of them, three quarters with no explanation attached.** It had become a check that
reported a number nobody read.

On 2026-08-19 the owner split that pile in two.

**Desktop is closed, and nothing changes on screen.** 44px measures a fingertip, and most of those
failures were the desktop sidebar being judged by a phone rule. Raising every sidebar row to 44px
would have added roughly 250px to it and undone the chrome slimdown that shipped days earlier. So
the rule now stops applying above tablet width, argued once, in writing, where the rule is defined.
No customer sees any difference.

**Phone and tablet is real, and this is the file for it.** 753 measurements survive — 345 distinct
controls a coach taps with a thumb, and they are genuinely too small. The smallest is 13px. The
"remove" buttons on a practice plan are 14px. Player names on the depth chart are 16px.

## Why it matters

This is not a compliance checkbox. It is the difference between a coach on the sideline tapping the
right player and tapping the one next to them — on the screens they use *while standing on a field*:
the roster, the depth chart, the practice plan. It is also the kind of defect that never gets
reported; it gets absorbed as "the app is fiddly on my phone".

## Customer impact

- **Who:** every coach using the portal on a phone or tablet — which, on a game day, is all of them.
- **What they'd notice:** fewer mis-taps and less pinch-zooming on the roster, depth chart, practice
  plan and money screens. Nothing about the layout changes on a laptop.
- **What they'd notice if we don't:** nothing they'd articulate. That is the problem.

## Priority

**Medium, and not urgent** — no customer has reported it and nothing is blocked. But it is now
*named*, with a number attached, which is the point: it was previously invisible.

Three screens hold a third of the work (depth chart, roster, practice plan). The single cheapest
slice is the ~125 controls already sitting at 36–43px — a few pixels of padding on shared components
clears the whole band. The depth chart deserves its own mockup session before anyone touches it; its
density is deliberate, and "make everything bigger" is the wrong answer there.

## Success criteria

- The count of unexplained accepted failures goes **down** every time this project is touched, never
  up, and never by writing explanations onto them.
- No screen regresses on a laptop.
- The depth chart's density survives whatever is done to it, or is deliberately traded with the
  owner's sign-off.
