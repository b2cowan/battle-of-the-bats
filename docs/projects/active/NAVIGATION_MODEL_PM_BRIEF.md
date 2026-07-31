# Navigation Model — PM Brief

**Date:** 2026-07-31 · **Status:** Proposed, awaiting owner ruling · **No code written**
**Full detail:** `NAVIGATION_MODEL_FINDINGS.md` (evidence) · `NAVIGATION_MODEL_PLAN.md` (model + stages)
**Mockups:** https://claude.ai/code/artifact/5f96acb1-af87-4d6d-9e92-d42fb19417c2

---

## What we asked

Can a person move between the screens their roles give them simply and efficiently, without that
machinery leaking into the experience of a member of the public who has no account?

## What we found

**The navigation isn't missing a control. It's missing a few doors.**

We mapped every way a person can change what they're looking at, against the actual product — nine
distinct navigation surfaces, thirteen ways to change place, six flavours of the operator/public
toggle, and five automatic redirects. Then we designed five competing models to fix it and attacked
each one from three directions: the public experience, the phone, and the multi-hat case.

**None of the five survived.** Every one broke somewhere real — including the two-axis model we
started from. That sounds like a dead end, but it's the most useful thing the work produced: it means
**the evidence does not support building a new navigation system right now**, and it tells us exactly
what to do instead.

The reason is that "which place am I in?" turned out to be two different questions wearing one coat:

- **Which of my places?** — jumping between unrelated things, like a club you run and a team you coach
  somewhere else. **This is already solved.** The Home screen lists every place a person holds,
  completely, on phone and desktop. The problem is that two screens have no way back to it.
- **Which one inside here?** — picking a tournament, a season, a team within one place. Five separate
  mechanisms do this one job, and only one of them produces a link you could bookmark or send to
  someone.

Separating those two makes the multi-hat case tractable. It also explains why the paid coach portal's
team menu only shows teams in one club: that's not a bug, it's a mechanism correctly refusing to do
the other job.

## The specific things that are broken

- **The paid coach portal has no way out except signing out.** No route to the fan app, to another
  team at another club, or to the club's own public page. It is the worst-off surface in the product.
- **An event's public page has no link to the club that runs it** — not in the rail, not in the
  header, not in either of the two logos on screen. Nowhere in the entire product does an event page
  link up to its organization.
- **A club's public page has no way into the app.** No Scores, no Chat, no Discover, no bottom bar.
  It's also invisible to search engines. Both problems land hardest on League and Club customers —
  the tiers that actually pay for that page.
- **The "see all your workspaces" shortcut never appears for the person it was built for.** It only
  counts organizations you administer, so someone who runs one club and coaches at another is counted
  as having one place, and never sees it.
- **The FieldLogicHQ logo in the admin sidebar isn't a link.** Clicking it does nothing.
- **When someone's role is removed mid-session, the screen keeps showing it** as though nothing
  happened, until a page fails with a generic error. Suspension explains itself; removal doesn't.

## What we recommend

**Finish the navigation that exists rather than building a new one.** One rule governs it: *one
canonical list, many doors, never a duplicate.* Home stays the single place that knows every hat a
person wears; every screen gets exactly one plain door back to it; nothing anywhere keeps a second
copy of that list.

**The first step is invisible to users.** Build one shared answer to "which places does this person
hold," replacing three separate counts that already disagree with each other. It fixes the miscount
above on its own, and it turns every later step into a one-line change instead of a fresh invention.
It needs no design review and no decision from you.

Then, in order: make the admin logo work; add the event→club link; correct the shortcut's counting;
give the club's public page a way into the app, a way back to admin, and a search-engine entry.

## What this means for each kind of customer

- **A parent with no account:** nothing changes, anywhere, with one deliberate exception — a single
  plain link from a club's page into the app, closing the one place a fan can currently get stranded.
  The acceptance test for this whole project is a before-and-after comparison proving an anonymous
  visitor's page is otherwise byte-for-byte identical.
- **A tournament organizer (our most common paying customer):** one dead click starts working.
  Nothing else changes on either device.
- **A free-tier coach:** no change at all. That portal is already the shape we're moving the others
  toward.
- **A paid coach:** gains a way out of the portal that isn't signing out.
- **Someone wearing several hats:** the shortcut they were always meant to have finally appears.

## Two decisions we need from you

1. **The paid coach portal's exit.** That portal deliberately has no FieldLogicHQ logo anywhere — an
   earlier call, made on purpose. Does a plain text "Home" link, with no logo, honour that decision?
   One yes or no; not a study.
2. **The free coach portal's role chooser.** Paid coaches who hold several roles at one event get a
   small chooser; free coaches don't. Closing that gap puts an operator idea into a portal we
   deliberately made feel like the fan app. This needs one design sign-off.

## What we're deliberately not doing yet

**A visible "jump to any of my places from anywhere" control, a desktop rail, or a role badge.** All
of it is held behind a single cheap number: how many signed-in sessions actually hold more than one
role at once. If that's below roughly one in ten, this work is **cancelled rather than postponed** —
the doors are the permanent answer. That number is one line of logging on a check that already runs,
and it never touches anyone who isn't signed in.

**Making the tournament selection live in the address bar** is held on severity rather than
popularity. Today that choice lives only in memory, and the accounting screen tracks its own
separately — so the tournament shown and the ledger being edited can silently disagree. One confirmed
instance of that affecting money funds the fix immediately, ahead of any navigation polish, because
it's an accuracy problem wearing a navigation costume.

**Stale screens after a role is removed** is real, affects the whole platform, and is not part of this
work. It's named explicitly so it doesn't get quietly counted as solved.

## One thing found along the way that needs attention regardless

The platform-admin login page accepts a "send me here afterwards" address without checking it, while
every customer-facing login page does check. That's a way to bounce a staff member to an outside site
straight after login. It has nothing to do with navigation design and should be fixed on its own.

## How to look at this

The mockups show all four kinds of customer on both a laptop and a phone, plus the full journey you
asked about — run a league, run a tournament inside it, view that tournament as the public sees it,
view the club's own public page, coach a team. Every element is labelled: unchanged, new, already
shipped, or waiting on a decision. Two steps in that journey are impossible in the product today.
