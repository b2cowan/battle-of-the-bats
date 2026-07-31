# Navigation Unification — PM Brief

**Date:** 2026-07-31 · **Status:** Approved (mockups rev 2, owner 2026-07-31) — build under way.
Note: "Club" is a tier name only; generic references to a paying customer's public pages say "org".
**Mockups:** https://claude.ai/code/artifact/e346068e-8a70-440c-b4a8-b1a8fef50e07
**Plan:** `NAV_UNIFICATION_PLAN.md` (supersedes the two stopped nav plans and merges them with the
new items from the 2026-07-31 owner conversation).

## The problem, in one sentence

Moving between the consumer app, a branded public tournament page, and the admin shell feels like
jumping between three different products — the same navigation jobs live in different places with
different names on each screen, and some trips only work in one direction.

## What we're proposing

**Not** one shared nav bar — that was tested by an adversarial design panel and failed (it either
buries fans under operator chrome or wraps a paying club's branded page in platform bars). Instead:

1. **One navigation grammar, three rules, every screen.** Top-left always exits up/out (wordmark or
   club breadcrumb). The middle always belongs to the place you're in, wearing that place's brand.
   Top-right is always "who am I here" (chat · account · role pill — the ⇄ glyph always means "see
   the other side of this place," a plain pill always means "enter a workspace"). Learn it once,
   trust it everywhere; skins keep changing, the layout never does.
2. **Finish the missing doors, reusing controls that already exist.** The admin logo starts working;
   admin desktop gets the same Home/Chat/Account exits your phones already have; every event page
   gets a tappable club name (only when the club page is actually worth visiting); the club's public
   page gets a Discover link, sections, a breadcrumb, and a return flip for the club's own staff.

## What each audience sees differently

- **A logged-out fan:** nothing changes on any page they see today except new, quiet ways forward —
  a tappable organization name on event pages, and on org pages a Discover link plus a section row
  (League / Teams / Archives) so the org finally reads as one browsable place. Zero new tracking,
  zero new weight; pages render byte-identical otherwise. Org branding stays fully in charge of its
  pages.
- **A signed-in fan:** same as above; their chat/account doors sit in the same corner on every
  surface.
- **An organizer:** admin stops being a sealed room — the same thin top strip the app has appears
  across admin (in admin's dark skin): wordmark goes Home on the left; chat, account, and a
  Workspaces button sit in the top-right corner, exactly where they are everywhere else. Someone
  with roles in two orgs taps Workspaces and gets a small menu of all their places (today the
  button silently picks one and hides the rest); single-role users see no change. The sidebar
  becomes purely "this org, this event, its sections." The ⇄ pill stays with the event header.
  (Rev 2, owner-directed — replaces the earlier idea of doors at the bottom of the side nav.)
- **A League/Club-tier org (paying customer):** their branded pages gain connective tissue
  (breadcrumb, sections, one plain Discover link at the same weight as Pricing) — no second platform
  bar, no new badges. The subtle "Built on FieldLogicHQ" credit extends to their league/team/archive
  pages.
- **A coach:** later stages (gated on your call) give the premium portal the same thin strip in its
  warm skin — its first non-sign-out exit — and give free coaches the same Roles popover premium
  has. The strip carries the FieldLogicHQ wordmark, which reverses the portal's deliberate
  no-logo ruling; that reversal is decision 2 below.

## Why it matters

Every earlier finding pointed the same direction: the platform's navigation quality is currently
*inverted against the price ladder* — free-tier tournament fans keep app chrome everywhere, while
League/Club families lose it the moment they leave a club's home page. And operators live with
one-way doors (easy to get in, maze to get out). This plan closes both without touching the branding
promise.

## Priority and sequencing

Stages A–E are ungated bug-fix-grade work (dead links, one-way flips, a miscounting gate, missing
doors) and can ship in order. F–H each wait on exactly one gate: a design pass (section strip,
grammar tokens) or your yes/no (premium-coach Home link). Full detail in the plan.

## Your three decisions

1. **Org public pages — connectivity or full parity?** We mock connectivity (links + sections, no
   app bar). Parity closes the fan gap completely but adds platform chrome to paid branded pages.
2. **Premium coach portal** — take the strip (wordmark included), reversing the deliberate no-logo
   ruling? You signalled "there's room" at mockup review; one explicit yes ratifies it.
3. ✅ **Decided 2026-07-31:** org-level branding stays a League/Club benefit — the platform-preset
   org page on Tournament tiers is correct-by-design. Remaining follow-ups routed: empty-state copy
   to /marketing, org-page light/dark gap to /design.

## Success criteria

- You can round-trip consumer ↔ admin ↔ public on desktop without ever feeling stuck (two clicks max
  each way), and describe the three zone rules from memory after a day of use.
- Anonymous before/after page diffs come back clean (the agreed one-link exception aside).
- A house-league family can browse their org's League/Teams/Archives as one place and get back to
  the app from anywhere.
- No org complains about new platform chrome on their branded pages.
