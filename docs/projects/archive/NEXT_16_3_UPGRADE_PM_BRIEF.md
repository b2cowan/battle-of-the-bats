# Framework Upgrade (Next.js 16.2.4 → 16.3.0) — PM Brief

**Status:** In execution 2026-08-12 — Gates 1 and 2 are done (the Aug 11 safety nets are committed;
the finished feature work went to production 2026-08-12). Now at step 3: the upgrade itself, with
before/after measurements.
**Full plan:** [NEXT_16_3_UPGRADE_PLAN.md](NEXT_16_3_UPGRADE_PLAN.md)

## What this is

The platform runs on a web framework that gets regular releases. We are four months behind, and the
investigation you commissioned found two independent reasons to catch up — one expected, one not.

## Why now — the reason changed during planning

**The expected reason:** the local development server (the private copy used to build and test the
product — customers never touch it) has a memory defect. Roughly twenty pages of ordinary clicking
kills it, and work stops until it restarts. The new release rebuilt the machinery responsible for
most of that memory use, with headline numbers up to 90% less in long sessions. Safety nets installed
on Aug 11 (an automatic restart, memory guards on our page-sweep checks) contain the pain today.

**The unexpected reason, found while verifying this plan: the version we run has 21 published
security advisories against it, 11 rated High.** Several describe ways to slip requests past the
exact gatekeeper this product relies on — the layer that blocks writes to the public demo clubs and
guards the admin areas. There is no sign anyone has exploited us, but the fixes have been public
since May–July, which means the recipes are public too. **Production is exposed today.** This is now
a security upgrade with a developer-comfort bonus, not the reverse.

## An honest expectation about the memory fix

The verification pass dug into what the new release actually fixes, and it is *most* of our problem
but possibly not *all* of it. Our measurements found two separate behaviors: each newly-visited page
costs a large chunk of memory that is never returned (the big one — this is what the release fixes),
and each repeat visit to an already-loaded page quietly wastes a small slice (a different defect,
reported to the framework team by others, root-caused publicly just this week, and **not** claimed
fixed by this release). So: expect dev-server life to get dramatically better, but possibly not
perfect. We will measure both behaviors before and after on this machine with the same instruments,
and the after-numbers — not the release notes — decide whether the Aug 11 safety nets can be retired.
If the small leak survives, the auto-restart net simply stays, and we hand our measurements to the
framework team's open investigation.

## What you and customers will notice

- **You / anyone testing:** the dev server should stop dying mid-session. The page-sweep checks
  should stop being a memory event. Nothing about how you run things changes.
- **Customers:** nothing visible. Pages render the same. The framework's own tests show the server
  handles up to ~22% more traffic under load, and the security holes close. No feature, screen, or
  flow changes in this work — by design, nothing else rides along.

## What could go wrong, and how it's contained

- The new release is only nine days old, and other teams have reported a handful of defects in it.
  Each was checked against how *this* product is built: most land on tooling or platforms we don't
  use. The one that lands nearest to us involves the same gatekeeper layer — our code uses a
  different pattern that analysis says is unaffected, and the plan includes a purpose-built check
  that proves it on our own pages rather than trusting that analysis.
- The upgrade ships to production **alone**, as its own release, after the pending feature work goes
  out first — so if production ever misbehaves afterward, there is exactly one suspect and one thing
  to undo.
- If it does go wrong in production: the fastest rollback is redeploying the previous build from the
  hosting console (minutes). If we ever had to abandon the new release entirely, there is a
  fully-security-patched fallback version on our current line — so no scenario forces us to choose
  between "broken" and "insecure."

## Cost

About a day of engineering for the upgrade and verification, then two to three days of normal
dev-branch use as a soak before promoting to production. No customer downtime. No data changes of
any kind.

## The sequence, with your approval gates

1. **Gate 1:** commit the Aug 11 safety nets (currently existing only as unsaved files) and this plan.
2. **Gate 2:** release the ~20 finished, QA-passed feature commits waiting on dev — so the upgrade
   doesn't share a release with anything.
3. Upgrade on dev; run the full verification battery including the before/after memory measurements.
4. **Gate 3:** you see the measurement verdict; decide whether the safety nets retire or stay.
5. Two-to-three-day soak while we watch it under real use.
6. **Gate 4:** promote to production as its own release; verify live.

## Success criteria

- All standing checks green on the new version; the demo sandboxes verified intact.
- Before/after memory numbers on record from this machine — the dev server survives a full sweep and
  a long clicking session comfortably.
- The gatekeeper check proves org pages, admin gating, and the demo write-block behave identically.
- Production promoted with the security advisories closed, and a one-step rollback available.
