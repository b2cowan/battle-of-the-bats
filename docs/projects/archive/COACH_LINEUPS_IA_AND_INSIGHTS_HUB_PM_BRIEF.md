# PM Brief — Coach Lineups Page Redesign + One "Insights" Home for Team Analytics

> Status: **Direction locked 2026-07-08 — ready to build.** Nothing is built yet.
> Companion technical plan: COACH_LINEUPS_IA_AND_INSIGHTS_HUB_PLAN.md

**What it does:** Two connected fixes to the Premium Coaches Portal. First, the Lineups page stops being three tools stacked on one scroll and becomes a fast game-day front door: open it, see your next games, tap into a lineup. Second, all the "how is my season going?" numbers — playing-time fairness, attendance reliability, win-loss trends, past seasons — move into one **Insights** destination in the Season menu, instead of hiding in four different corners.

**Why it matters:** A volunteer coach opens Lineups for one reason on a Saturday morning: today's game. Today they land on a page whose brightest button is "New template" (a pre-season chore), and whose season trends sit below a template manager they touch twice a year. Meanwhile the portal's best analytical answers are scattered: lineup trends live on Lineups, attendance reliability lives behind a button on the Roster page **and appears in no menu at all**, money reports live in Money, and season history lives at the bottom of "Team admin." A coach who asks "who's been carrying the bench?" or "are we better than last year?" has to already know where each answer hides. That scatter also means the features we're proud of go undiscovered — and upcoming ones (player stats, opponent scouting) would have nowhere to live.

**Who benefits:** Premium Coaches Portal head coaches and their assistants. No plan or pricing change — this rides existing Premium access. Assistant permissions are respected everywhere: money never shows without money access, lineup analytics only with lineup access, attendance summaries never expose guardian contact details, and any section a coach isn't granted simply doesn't appear.

**What changes for the coach:**
- **Lineups page (decided — tabs):** two tabs, **Games** and **Templates**, with Games open by default. Games lists your upcoming and recent games, each flagged "lineup set / not set", with the one bright **Build lineup** action on the next game that needs one — and a **filter row**: tap "Not set", "League", "Tournament" or "Scrimmage" (each with a live count) to cut straight to what you're after. Filtering to "Not set" also surfaces past games you never saved a lineup for — filling those in makes your Insights trends richer. Templates is the full manager (create, rename, apply, delete). The page gets dramatically shorter, especially on a phone.
- **Insights (in the Season menu):** one destination that answers "how are we doing?" — results and season-over-season trends, playing-time fairness and pitching load, attendance reliability (finally in a menu), and a money-reports shortcut for coaches with money access. Every card is honest: sections only show numbers when real saved data backs them, and teach you how to earn them otherwise.
- **Nothing gets buried:** the Overview keeps its at-a-glance record and tiles; the Roster page keeps its attendance shortcut; per-player pages keep their summaries. Glances stay where you work; depth gets one address.

**Trade-offs made:** Money reports deliberately **stay inside Money** (reading the dues report and chasing payments are one workflow; moving or copying it would split that and complicate assistant permissions). Template management moves one tap deeper to buy game-day speed on the landing page. And this renames "Season Review" again (a week after "History" became "Season Review") — worth it for the right long-term name, and search aliases will keep every old term findable in help.

**Priority:** Medium-High. No data is at risk and nothing is broken — but the Lineups stack was flagged by you within a day of shipping, the portal's demo story ("it knows my season") depends on these answers being findable, and every future analytics feature gets cheaper once there's one home for them.

**Success criteria:**
- From opening Lineups, a coach reaches their next game's lineup in one tap, with the page's single bright action pointing there.
- "How is my season going?" is answerable from **one** menu item, and the attendance report is reachable from the menu for the first time.
- No number appears anywhere without real recorded data behind it; assistants see exactly what they've been granted, nothing more.
- You sign off after a browser walkthrough of both pages on desktop and phone.

**Decisions (details + recommendations in the plan):**
1. Lineups page: ✅ **Decided 2026-07-08 — tabs (Games | Templates)**, plus a filter row on Games (all / not set / league / tournament / scrimmage, live counts). With the season read-outs living in Insights, the page needs only two tabs; a quiet "Season insights" link sits on the Games tab. The mockup shows the final layout with working filters.
2. Analytics: ✅ **Decided 2026-07-08 — one Insights destination in the Season menu**; money reports stay in Money with a shortcut.
3. Name: ✅ **Decided 2026-07-08 — "Insights."**
