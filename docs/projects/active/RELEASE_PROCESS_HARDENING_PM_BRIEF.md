# Release process hardening — PM Brief

Plan: `RELEASE_PROCESS_HARDENING_PLAN.md`. Written 2026-11-15.

## What this is

A release should be boring: the same checks every time, done in minutes, with a clear answer. Today the checks
are good but depend on the agent running the release remembering each one, and they all run on one PC that is
busy with other work. The clearest symptom is the layout sweep, which has not completed for the last three
releases.

## What changes for the owner

- **The layout sweep finishes.** It checks its own setup in the first minute, gives up on a broken screen in
  seconds, keeps its progress if it is interrupted, and waits out a busy PC before it quits. Built and tested on
  2026-11-15. One run now covers both themes (dark is read on the same page visit), and the 390 phone width runs only
  on request, because it never found anything the 361 phone missed. Expected: about 20 minutes unattended for the
  whole product, once the coach Overview fix below ships.
- **A product bug the sweep found:** the coach Overview re-requests two pages about three times a second while it is
  open. That costs coaches' phone data and battery and our server's time, and it was over half of the sweep's
  running time. A fix session is written and ready to run.
- **One release check, one answer.** Both ways of releasing run the same list and show one table: what passed,
  what failed, and anything that was waived, with the reason. Nothing is skipped quietly.
- **Two holes closed.** Today the usual route to production has no type check, and releases have gone out with
  failing tests. Both become stops.
- **Two new checks, seconds each.** Known-vulnerable software packages, and passwords or keys saved into the
  code by accident.
- **Later: the heavy checks move to a cloud machine.** They run by themselves after every staging build, so on
  release day the answer is already waiting and the PC is left alone.
- **Later: a safety net.** A way back for the database, and a look at the live site after each release.

## Why it matters

- Customers' phones are where a layout defect shows first. Three releases have shipped without that check.
- The "type push" step is the owner's control over production. Today it is a request to the agent, not a lock.
- Access tests exist for who can see whose information, and no release runs them.
- A release that cannot be reversed cleanly is a risk that grows with every paying customer.

## Stages

| Stage | Outcome |
|---|---|
| 1A | The sweep finishes, and the sweep owed since 2026-10-30 is run |
| 1B | One release check for both routes; the type check, tests and scans are stops |
| 2 | The checks run on a cloud machine after every staging build |
| 3 | A way back for the database; the live site is checked after a release |

## Decisions needed

Five, listed as A1–A5 in the plan. The two that shape the work: whether a push to production must always stop
and ask (A1, recommended yes), and whether test sign-ins may be stored with GitHub for the cloud machine (A2,
recommended yes).

## Priority

High. Stage 1A first: it is the check that has been missing, and every later stage uses the same tool.

## Success looks like

- Every release records a completed whole-product sweep and how long it took.
- No release reaches production without a type check and passing tests.
- A waived check is visible in the release summary with its reason.
- After Stage 2, release-day checking takes minutes.
