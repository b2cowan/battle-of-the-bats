# PM Brief — Public Tournament Pages, Mobile Polish

**What:** Targeted fixes to the public tournament site (the pages coaches and parents use on game day) so they work on a phone, not just a desktop.

**Why it matters:** These pages are the product's most-seen consumer surface. The two screens people open under pressure — the home page and the standings table — were the weakest on mobile. This directly affects how trustworthy the platform feels to the families a tournament organizer invites.

**What changes for the user:**
- **Standings on a phone:** team name and points stay pinned on screen while the other stats scroll — no more blind swiping to find out who's winning.
- **Pre-event messages** ("schedule not published yet") are now clearly readable instead of faint grey.
- **Schedule** opens straight to today's games.
- **Home page** leads with games once the tournament is live (instead of a full screen of branding); keeps the big welcome hero before the event.
- **Branding safety:** a Tournament Plus org can't accidentally pick a colour that renders as unreadable text — the platform keeps it legible automatically.
- Plus two fixes: a mislabeled home stat, and a navigation gap on landscape phones/small tablets.

**Customer impact:** Higher confidence and fewer "I can't read this / where's my game" moments for coaches and parents on mobile — the core game-day audience.

**Priority:** High (consumer-facing, pre-marketing-push).

**Success criteria:** On a 390px phone — standings readable without hunting for points; empty states legible; schedule lands on today; home shows games first during the event. No regression to the default or Milton-branded themes.

**Status:** Built 2026-06-01; pending owner browser verification (dev-server restart required first).
