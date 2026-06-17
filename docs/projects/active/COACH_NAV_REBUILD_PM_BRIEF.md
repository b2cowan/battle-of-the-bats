# PM Brief — Coach Portal Nav Rebuild (Team-Scoped Shell)

**What it does:** Reworks the free Coaches Portal so it's built around **one team at a time** — the coach's team sits at the top of the navigation (with a simple dropdown to switch when a coach has more than one), and the menu underneath becomes the things they do *for that team* (its tournaments, roster, schedule, fees, announcements). Today the portal shows generic "Home / Tournaments / My Teams" links plus a separate team list — so "My Teams" appears twice and the whole thing reads like a directory of teams, even though almost every coach only has one.

**Why it matters:** A coach arrives at this portal because they registered **a team** for a tournament. They should land in *that team's* home and immediately see what they can do — exactly like a tournament organizer lands in *their one tournament* and never sees a wasted "My Tournaments" list. The current design spends prime navigation space advertising "you can have more teams" to people who have exactly one, which is noise that makes the portal feel unfocused and confusing (the duplicate "My Teams" was flagged during the coach walkthrough).

**Who benefits:** Every free-tier tournament coach (the org-less Coaches Portal). No plan restriction — this is the **free** coach experience. The premium org-scoped coaches portal (`/{orgSlug}/coaches`) is a separate surface and is **not** affected.

**Expected impact:** A coach opens the portal and sees "**toronto blue jays5**" at the top with its current status, and a clean menu of that team's sections — not a list of teams or a redundant nav link. Multi-team coaches get a tidy dropdown to switch. The portal finally reads as "my team's home base," matching how organizers experience their tournament.

**Priority:** Medium-High. It's the structural follow-through on the coach-experience walkthrough (the pending-page rethink fixed the *page*; this fixes the *shell* around every coach page). Not blocking, but it's the difference between "a few good pages" and "a portal that feels designed."

**Success criteria:**
- A one-team coach sees their team name + status at the rail top, with the nav links being that team's sections — no "My Teams" link, no team-list section, no "Back to Coaches Portal" breadcrumb.
- A multi-team coach gets a working dropdown that switches the whole portal context.
- A brand-new coach (zero teams) sees a clean "register/start a team" prompt, not an empty switcher.
- Works on mobile (top bar + bottom nav) without crushing the section list.
- The brand carries a one-line subtitle answering "what is this portal."
- No regression on any existing coach page (verified via `/review` — the shell touches them all).
