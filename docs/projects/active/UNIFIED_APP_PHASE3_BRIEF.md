# UX Brief — Phase 3: One-home connective tissue (REVISED, rev 2)

**Status:** SIGNED OFF (rev 2, owner 2026-07-14) — build approved in the same session. Q1 ratified: §8 "return to directory" stays deferred, revisited as the immediate next design round after Phase 3. Q2 ratified: compact Following rows on the switcher home. Follows Phase 2 (fan accounts, Following feed, account-gated alerts), fully committed to dev 2026-07-14 (`7d626328`).
**Revision trail:** rev 1 = an always-visible "you coach here / you run this event" strip on every page of a tournament's space. **Rev 2 (owner direction 2026-07-14): no persistent real estate on tournament pages** — replaced by a small account chip in the tournament chrome (signed-in visitors only) opening a bottom sheet that lists exactly the hats this account owns on this event (Coach view / Open admin / Scorekeeper) plus Following and Your FieldLogicHQ. Pull, not push. The former "officials" open question is absorbed (one more sheet row).
**Scope guardrail:** IA/navigation only. No new tables, no migration, no changes to how coach or admin worlds work inside — this phase only *connects* surfaces that already exist.
**Visual reference:** mockups artifact (same design language as the original journey mockups) — link kept stable across revisions; see the conversation for the URL.
**Binding context:** G1–G5 (2026-07-11) and account-only alerts (2026-07-14) are decided; Phase 3 has no open decision gates. Phase 4 (verified family) is NOT in scope — gated on the PIPEDA/CASL review.

## The idea in one line
> Everyone — fan, parent, coach, organizer — has **one stable home**, and every hat you wear is one tap away from wherever you're standing.

## What changes, per person

### A fan or parent (one hat)
- **Nothing changes in daily use.** Following, live scores, alerts, the Discover/Scores/Following/Account tabs — all exactly as shipped in Phase 2.
- A fan-only account still lands straight on the Following feed after sign-in — they never see a "workspace picker" they don't need.

### A multi-hat person (e.g. coach who also follows a kid's team, or an organizer who's also a fan)
- **"Your FieldLogicHQ" (the switcher home) becomes a real home, not just a picker.** Today it's a plain list of workspace cards titled "Home." After this phase it shows your workspace cards *and* a live **Following** section — your followed teams with what's happening right now (live score, next game, last result), same intelligence as the Following tab, in compact form. One glance covers both your duties and your fandom.
- The one-workspace auto-skip is preserved: if you only have one place to be, you're still sent straight there.

### A coach (Basic/free or Premium)
- **Inside a tournament's public pages, one small account chip in the chrome** (initials, next to the notification bell — signed-in visitors only) opens a sheet that knows you coach here: *"You coach Rockets U13"* with a **Coach view** button that lands directly on your portal team page — the free portal for a free team, your Premium workspace if the team was upgraded. No banner, no popup, no content pushed down; the door is always in the same place when you want it.
- **From the portal, "Fan view" takes you back** to that tournament's public space — the round trip is one tap in each direction.
- **The consumer shell learns you're a coach.** The Account tab gains a "Coaches Portal" row, and the desktop header gains a matching link — the cross-event coaches hub (which already aggregates all your teams) is now one tap from anywhere in the fan-facing app.

### An organizer / org admin
- The same sheet shows *"You run this event"* with an **Open admin** button that lands on that specific tournament's admin dashboard (the right tournament already selected). Checking your public pages and jumping back into ops becomes one motion.
- Tournament-scoped staff see the row only on tournaments they're assigned to.
- Officials get the equivalent **Scorekeeper** row on tournaments where they officiate (absorbed from the former open question — included unless the owner objects).

### An anonymous visitor
- **Zero change.** No chip, no sheet, no sign-in nags from this phase. Everything here is signed-in-only connective tissue.
- A signed-in **pure fan** sees the chip too, but their sheet holds only Following and Your FieldLogicHQ — no coach/admin rows they don't own.

## What deliberately does NOT change
- Coach and admin backends, permissions, and page internals — untouched.
- The mobile bottom nav stays four tabs (Discover / Scores / Following / Account) for everyone — the coach affordance lives in Account + the desktop header, so the nav never shifts under people's thumbs.
- No migration, no new tables, no pricing/gating change.
- The alerts model from Slice 3, the follow mechanisms, the fail-closed sign-in routing — all as shipped.

## Honest limits (plain language)
- **The coach row appears once a coach has claimed their team.** The platform connects you to a tournament through your claimed team's registration; a coach who registered but never claimed won't see the row until they claim (the existing claim flow is unchanged). This covers free teams and teams upgraded to Premium.
- A Premium rep team that never registered into a tournament has nothing to connect to — no row, correctly.
- The chip is discovery-light by design (that's the trade for zero real estate): a coach who doesn't tap it won't learn about Coach view from this page. The Account tab row and the switcher home carry the same doors, so there are three ways in.

## Open questions (answers wanted at sign-off)

**Settled in rev 2 (owner direction):** no persistent strip/popup on tournament pages — the account chip + sheet is the shape. Officials' Scorekeeper row is absorbed into the sheet (included unless the owner objects).

**Q1 — The deferred "return to directory" navigation (plan §8): fold into Phase 3, or keep deferred?**
**Recommendation: keep deferred — and schedule it as the immediate next design round after Phase 3 ships.** Reasons: (a) that problem is about *every* visitor — overwhelmingly anonymous fans — while Phase 3's connective tissue is signed-in-only; bolting an anonymous-nav decision onto this phase couples it to the wrong work. (b) You explicitly flagged it needs real design thought (it changes what the top-bar wordmark *means* on every public page). (c) The rev-2 sheet makes the deferral cheaper to honor: when that decision is taken up, a "Browse tournaments" row in this same sheet is the obvious candidate for signed-in users — no new chrome invented (the anonymous answer still needs its own design round).

**Q2 — How rich should the home's Following section be?**
**Recommendation: compact rows** (team, event, one status chip: live score / next game / last result) with an "All following →" link — not a full embed of the Following feed. The switcher home should answer "anything happening?" in one glance and hand off to the real feed for depth.

## How you'll test it (on dev, after build + restart)
1. **Multi-hat account** (coach + admin): open Your FieldLogicHQ — workspace cards plus the Following section; a live followed team shows its live score chip.
2. **Fan-only account**: sign in — you land straight on Following, never the switcher (auto-skip intact).
3. **Coach round trip**: signed in, open a tournament your claimed team plays in — the account chip appears in the chrome; the sheet shows the coach row; Coach view lands on your team's portal page; Fan view returns to the public space. Repeat with an upgraded (Premium) team — Coach view lands in the Premium workspace.
4. **Admin**: open a tournament your org runs — the sheet shows "You run this event"; Open admin lands on that tournament's dashboard with the right tournament selected.
5. **Anonymous**: same tournament in a private window — no chip, no sheet, nothing new. Then as a signed-in pure fan: chip present, sheet holds only Following + Your FieldLogicHQ.
6. **Account tab**: coach accounts see the Coaches Portal row; a pure fan account doesn't.

## Not in this phase
Phase 4 (verified family — gated on PIPEDA/CASL). The §8 return-to-directory navigation (per Q1 recommendation). Org/league directory listings (Phase 5). Any backend/permission change.
