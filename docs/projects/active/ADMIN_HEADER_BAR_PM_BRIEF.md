# PM Brief — Admin header: the bar names where you are

> Plan: [ADMIN_HEADER_BAR_PLAN.md](ADMIN_HEADER_BAR_PLAN.md) · Drawings: https://claude.ai/artifact/DXmtj9E1SxcuyfyrcUnsuC
> Ruled 2026-11-07 (option 4), and every follow-up ask the same day, all as recommended (see the plan). Drawings
> cover every kind of admin screen; building starts with Phase 1.

**Settled details:** on a phone, a season's or team's status rides a second line in the bar. Overview loses its
"Overview" heading, so the club's name heads it. On desktop the club's name sits under every place's name.
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
- The coaches portal looks exactly as it did.
- The owner walk passes on phone and desktop.
