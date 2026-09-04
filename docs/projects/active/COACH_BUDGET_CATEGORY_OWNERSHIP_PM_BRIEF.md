# Budget Category Ownership — PM Brief

**Status: plan drafted 2026-09-04, not yet approved or built.** Companion to
`COACH_BUDGET_CATEGORY_OWNERSHIP_PLAN.md`. Follows on from the Budget Tab Revamp (already shipped
and passed QA) — this is new, separate work, not a fix to that project.

## What a coach and a club admin see and do differently

**Today:** every budget category — "Uniforms," "Tournament Fees," whatever heading a budget line
sits under — is really one shared list for the whole club, even though a coach can add a new one
from their own team's budget screen. There's no such thing as "my team's own category" versus "the
club's category" — they all land in the same pool, visible to every team, with no way to tell who
made which one. That's also why there's no way to rename a category today: renaming one could
silently relabel it on every other team's screen too, with nobody the wiser.

**After this change**, there will be two clearly different kinds of category:

- **Shared categories** — set up by the club (an Owner or Treasurer), and every team sees and uses
  them. Only an Owner or Treasurer can create or rename one of these — not a coach, and not the
  broader "Admin" role either, to keep one consistent rule for who edits the club's shared setup.
- **Local categories** — a coach's own word for something specific to their team, exactly like a
  coach can already invent their own budget *items* today. Only that team sees it in their own
  budget screen day to day, but the club can still see it when pulling statements or reports across
  the whole club — nothing disappears from the club's view, it just isn't offered to other teams.

A coach will be able to rename a category they made for their own team, the same way they can
already rename a budget item they created. A club Owner or Treasurer will be able to rename a
shared, club-wide category from the club's budget settings — something nobody could do before.

## Why it matters

The current setup has a real, live risk: a category a coach thinks of as "theirs" is actually
everyone's, so a well-meaning rename or cleanup could quietly change what every other team's budget
screen calls something, with no warning to that team. Splitting shared from local closes that gap
permanently, and it does so by reusing a pattern this product already ships and has already been
proven safe — budget *items* went through this exact split in August, and coaches have been safely
managing their own team's items (including renaming them) ever since.

## What does NOT change

- Nothing about a category already in use today changes or gets locked out — every existing
  category keeps working exactly as it does now.
- No coach gets a way to "share" or "publish" their own category to other teams or the club — that
  stays a club-admin-only action, matching the owner's explicit "keep it simple" instruction.
- Deleting a category is still not possible for anyone — this only adds renaming.

## Priority and open decisions

This is not urgent — nothing is broken for a customer today, since renaming isn't possible at all
yet, so there's no regression risk in taking time to get the design right. Five open questions are
listed in the plan (how cross-team reports should visually treat a local category, what happens to
categories coaches already created, exactly who on a team can rename their own local category,
and where the rename button lives on each of the two screens) — recommendations are given for all
five, but they need an explicit go-ahead before this moves to implementation, per this project's
standing rule that a schema/permission change gets a plan and a PM brief before any code.

## Success criteria

- A club Owner or Treasurer can fix a typo'd shared category name from the club's budget settings,
  and it updates everywhere that category appears — every team's budget screen and the club's own.
- A coach can rename a category they created for their own team, without needing to ask the club.
- No coach can see, use, or rename another team's local category, and no coach can create a new
  shared (club-wide) category going forward.
- The club can still see every team's local categories when it pulls a cross-team report or
  statement — visibility for reporting is never lost, only the ability to select/edit across teams.
