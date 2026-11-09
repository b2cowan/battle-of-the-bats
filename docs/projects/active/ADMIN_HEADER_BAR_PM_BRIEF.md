# PM Brief — Admin header: the bar names where you are

> Plan: [ADMIN_HEADER_BAR_PLAN.md](ADMIN_HEADER_BAR_PLAN.md) · Drawings: https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC
> Ruled 2026-11-07 (option 4), and every follow-up ask the same day, all as recommended (see the plan). Drawings
> cover every kind of admin screen. Phase 1 (the bar's shape) walked and passed 2026-11-07. Phase 2 (all six club places
> name themselves in the bar, tabs pinned) walked and passed 2026-11-07 (§492). Round 4 (the desktop strip) ruled
> 2026-11-08 from drawings https://claude.ai/artifact/A1W443obR8aJd8PjUZEgUx; Phase 2D built it 2026-11-08, committed `135f4652c` (93px
> pinned on a place with tabs, 48px in a tournament; the strip says "Admin", the Workspaces list keeps "Admin Area"),
> owner walk §495 https://claude.ai/artifact/8XSzVFVFnsbCDAiR5uszyo; then Phase 3 (Calendar, Schedules, record pages).

**Desktop, round 4 (2026-11-08):** on a computer the sidebar already says where you are, so the white bar's name row
was saying it a third time and kept about a fifth of a laptop screen pinned. On desktop the place's name moves up into
the top strip ("← Teams │ 14U AA"), View site moves beside the bell, the tabs are one pinned band under the strip,
and the club's name heads the sidebar in a cell lined up with the tab band, so the header reads as one block and the
sidebar's links start below it. Clicking the club's name opens Overview, whose strip now just says "Overview". The
strip's portal word becomes "Admin". A team's group ("Senior") is no longer repeated in the header. Pinned space on a
laptop drops from about 151px to 93px on a place with tabs. **Phones do not change.**

**Settled details:** on a phone, a season's or team's status rides a second line in the bar. Overview loses its
"Overview" heading, so the club's name heads it on a phone. On desktop the club's name sits in the sidebar's top cell.
Accounting keeps its sideways tab row, pinned. A record one level down (a child's page) puts its name and its
way back in the bar. A tournament-only organization's bar names the event inside an event, and the organization
on its organization-wide screens (the list, Members, Plan & billing).

**What it does:** The white bar pinned at the top of every admin screen now says where you are, not which club
you're in. On the Overview it shows the club's name. In Rep teams it says "Rep teams". In a season it shows the
season's name, its switcher and its status. Inside a tournament it shows the event, as it does today. The tabs of
that place sit inside the bar and stay on screen as you scroll. The bar no longer shrinks or jumps when you
scroll.

**Why it matters:** Today every screen has two titles of the same size, the club's in the bar and the page's
underneath, and only the one that never changes stays on screen. Scroll down a long list of registrations and
nothing tells you which season you're in, and switching tabs means scrolling all the way back up. On a phone the
bar is tall and snaps smaller as you scroll, which moves the content under your thumb.

**Who benefits:** Every club admin role (owner, club admin, league admin, registrar, treasurer). The gain is
largest on long screens: registrations, Families, ledgers, the draft. Tournament organizers get a quieter,
steadier bar. Nothing changes for coaches or families.

**Expected impact:**
- One title per screen instead of two.
- The place and its tabs stay visible while you work down a long list.
- A season's status stays on every tab.
- No more jump on scroll.
- The cost: a place with tabs keeps a little more of a phone screen pinned (about 23% with the bottom bar,
  against about 18% today).

**Priority:** Medium. It's a quality-of-life change surfaced during QA, not a blocker. It touches the chrome of
every admin screen, so it goes in phases with a walk after each.

**Success criteria:**
- On every admin screen, the bar names the screen you're on, and the page has no second title repeating it.
- In any place with tabs, you can switch tabs from the bottom of a long list without scrolling up.
- The bar doesn't change height when you scroll, on phone or desktop.
- On a phone, a place with tabs keeps no more than about a quarter of the screen pinned.
- On a 1440 × 760 laptop window, a place with tabs keeps no more than about 95px pinned (151px before round 4).
- The coaches portal looks exactly as it did.
- The owner walk passes on phone and desktop.
