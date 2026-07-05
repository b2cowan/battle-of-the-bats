# Coaches Portal IA/UX Review — PM Brief

> **For:** a stakeholder who hasn't read the full plan.
> **Companion plan:** [COACH_PORTAL_IA_UX_REVIEW_PLAN.md](COACH_PORTAL_IA_UX_REVIEW_PLAN.md)
> **Status:** Planning complete; awaiting owner decisions. Planning-only — no code, no migrations, no user-visible change yet.

## What this is

A journey-first reorganization of the **Premium Coaches Portal** — the paid, year-round workspace a rep head coach uses. Over months the portal has grown feature-by-feature into a set of long, single-column pages and a navigation menu that reflects the *order things were built*, not *how a coach thinks at the field*. Nothing is exactly "broken," but a volunteer coach — non-technical, time-poor, checking their phone on a sideline, arriving each season having forgotten last season's layout — has to scroll and hunt for the things they need most. This review restructures the portal around the coach's actual season journey and surfaces the data they care about, almost entirely by **reusing features that already exist**.

## The core problem, in one sentence

The portal holds a genuinely impressive amount of intelligence — auto-filled fair lineups with arm-care limits, a depth chart, a season record, dues tracking — but it's organized so that a coach can't easily *find* it, can't see *what matters right now*, and can't answer the one question they ask first: **"where do we stand?"**

## What a coach experiences differently after this ships

- **A home screen that changes with the season.** Instead of one long scroll that's half setup-checklist and half dashboard, the top of the Overview becomes a "here's what matters right now" panel: pre-season it says "finish your roster"; between games it shows the next game, who's coming, and whether the lineup is set; on game day it shows the live score; after the game it shows the result and a share card. Their **season record** — the most emotional number — moves from the very bottom of the page up to where they'll actually see it.
- **They can finally find the lineup builder.** Today the portal's smartest feature is buried inside a specific game's detail panel with no menu item — a coach who's never opened it can't discover it. It gets its own front door.
- **They learn where they stand.** The portal has never been able to show a coach their standing in their pool or division. This adds it — the single highest-value addition and the one thing on this list that isn't already built (though it reuses the existing standings engine).
- **Money stops hiding.** "3 players haven't paid, $420 outstanding" appears on the home screen instead of four taps deep.
- **The menu matches their brain.** Navigation regroups into plain-language sections — *my squad · our season · money · talk to my team · the back office* — instead of an "Admin" junk drawer. Sections a coach doesn't use (tryouts, external tournaments) hide until relevant.

## Why it matters

Three goals held together, not traded off: **dead simple** for a non-tech seasonal coach, **rich with metrics** they genuinely appreciate, and a real **"wow"** they feel in a five-minute self-serve trial on their own phone. That five-minute moment is the commercial engine: a prospective head coach deciding between paying for Premium and going back to a group chat needs the tool to *do their job for them* immediately. Set a roster, build a compliant lineup, see where they stand, share a result — the things a group chat and a spreadsheet can never do together.

## Customer impact & priority

- **Who:** rep head coaches on Premium (the power user and the paying customer); assistant coaches see a safely-limited version of the same portal.
- **Priority:** high — this is the portal's conversion surface and the owner has flagged its accreted navigation as a liability.
- **Cost profile:** unusually low risk. **No database migrations** are required for any phase. Most of the work is relocating and phase-ordering features that already exist; the few genuinely new pieces (standings, attendance trends, placement cards) are new screens over existing data.

## How it's sequenced

1. **Stop the portal lying** — fix a checklist that marks lineups "done" when none exist, and purge stale prices. (No visible change; restores trust.)
2. **Clarity** — the phase-aware home screen; record moved up; money surfaced.
3. **Standings** — answer "where do we stand?" for the first time.
4. **Navigation rebuild** — the regrouped menu and the lineup front door.
5. **Depth** — last-season preview, season-over-season comparison, attendance reliability, "who hasn't paid," tournament placement cards.
6. **Safety pass** — confirm assistants only ever see what the head coach granted (privacy-critical).

Each phase is shippable on its own and leaves the coach better off.

## Decisions needed from the owner

The plan lists eleven, but the ones that shape the product most: (1) is the house-league coach fix part of this or a separate stream? (2) how aggressively do we surface standings, and to whom? (3) does the lineup builder get its own menu item? (4) do we adopt the full phase-aware home screen or just reorder the current one? Full list with recommendations and tradeoffs is in the plan (§7).

## Success criteria

- A first-time head coach, on their phone, with no tour, can **set a roster, build a lineup, and see where they stand within five minutes** — and wants to share the result.
- The season record and "what to do next" are visible **without scrolling**.
- No coach reports "I didn't know that feature existed" for lineups or standings.
- Zero regressions against the free portal (Premium ≥ Free) and zero privacy leaks to assistants.
- Ships with **no database migrations**.
