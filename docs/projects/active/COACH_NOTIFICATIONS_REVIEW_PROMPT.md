# Review prompt — the coach Notifications screen, on a phone and on a desktop

**Owner ask, 2026-09-03:** *"review the notification screen on the phone and desktop… I am also
wondering if we can improve it where it doesn't force you out of the coaches portal."* Then:
*"make sure the prompt does its own review of what other improvements we can make and provides me
with mockups after its own assessment."*

You are reviewing **`/{orgSlug}/coaches/notifications`** — the "See all" feed a coach reaches from
the bell.

**This is a three-phase job, in order. Do not skip to phase 3.**

| Phase | What you produce | Gate |
|---|---|---|
| **1 · Look** | Your own findings, phone and desktop | Nothing is designed yet |
| **2 · Assess** | A ranked assessment + your recommendations, including improvements nobody asked for | The owner reads this **before** seeing any picture |
| **3 · Draw** | Mockups as a **Claude Artifact**, of what phase 2 recommended | ⚠ **Nothing is BUILT until the owner approves these** |

---

# Phase 1 — Look at it yourself

## ⚠ The findings below are a FLOOR, not a ceiling, and not a checklist

A previous session measured these while investigating something else. They are handed to you so you
do not waste a pass re-deriving them — **not** so you can confirm them and stop. **Your job is to
find what nobody has looked for yet.** A review that returns only this list has failed.

**Challenge them too.** If any is wrong, say so with evidence — plans and hand-offs in this repo
have been wrong before, including this one's earlier draft. Argue from what the code and the
rendered page actually do.

### Given: the screen is the ADMIN screen wearing the coach shell

`app/[orgSlug]/coaches/notifications/page.tsx` is 15 lines. It renders
`components/notifications/NotificationsPageContent`, *"the same shared component as the admin
route; the coaches layout supplies the shell + org context."* Most of what follows is downstream of
that one fact.

### Given: it has no responsive rules at all

`components/notifications/notifications-page.module.css` contains **zero `@media` queries**.
`npm run check:layout -- --only=coach-notifications` reports at **361px**:

- `[page-overflow]` — the page scrolls sideways by **82px** (53px at 390)
- `[control-offscreen]` — **"Mark all read" sits 82px past the right edge with no scroller to
  reveal it.** A control a coach cannot reach at all on a phone.
- `[tap-floor]` — "Mark all read" is **28px** tall against the 44px floor
- four `[content-overflow]` findings on the page's own containers

Cause: `.header` is a `flex … space-between` whose `.headerActions { flex-shrink: 0 }` holds **two**
controls beside the title. At 361px that row wants 443px and nothing may shrink or wrap.

### Given: the timestamps are painted in a BORDER colour

`.itemTime` ("4d ago", "Aug 23") is `color: var(--white-30)` — *30% white on a dark ground*, correct
in the admin theme this stylesheet was written for. **In the warm coach portal `--white-30` remaps
to `--home-line-strong`** (`app/globals.css`) = `rgba(70, 55, 30, 0.2)`, a hairline. Measured
**1.43:1 against a 4.5:1 floor.** Effectively invisible.

`--white-50` (the subtitle) lands on the muted ink and is fine. `--white-20` also lands on a
hairline. `.markAllBtn`'s border is `--blueprint-blue` — the **platform-admin accent** — in a portal
whose accent is olive.

### Given: the "forces you out" is a route-group jump

The feed's **"Notification settings"** control links to
**`/account/notifications?focus=coach-{orgSlug}`**, which lives under **`app/(consumer)/`** — a
different route group with **its own shell**. A coach pressing it lands in the consumer/fan app:
different navigation, different chrome, no route back except the browser's back button.

## Now go further than that list

Nobody has yet reviewed this screen as a screen. Look for what a coach actually experiences and
what the feed is *for*. Some directions worth a look — **not a checklist, and not exhaustive**:

- **Is the feed useful?** What does a coach do with it that the bell dropdown doesn't already do?
  If the honest answer is "very little", that is a finding worth stating plainly.
- **Density, grouping and volume.** What does this look like for a coach on three teams mid-season
  with 200 notifications? The fixture almost certainly does not show you that state — the repo has
  a standing trap where a gate passes because the data could not fail. Say what you could not see.
- **What a notification does when tapped.** Does every row go somewhere useful? Are any dead ends?
- **Read/unread, and whether "Mark all read" is even the right control** once it is reachable.
- **Empty and error states**, and the first-run state for a brand-new coach.
- **Filters, bundling, and the toolbar** — do they earn their space on a phone?
- **The bell, the feed and settings as one journey**, not three screens. Where does a coach get
  stuck or double back?
- **Consistency with the rest of the portal** — this screen was not designed alongside the money
  tabs, the roster or the practice plans. Does it look and behave like they do?
- **Anything else you find.** This is the point of the phase.

---

# Phase 2 — Assess, and recommend

## ⚠ The settled ruling, and why it does NOT block the "forces you out" question

A reviewer who misreads this will wrongly report the question closed:

> **D2 — Coach settings are a separate destination**, not a tab on their feed — satisfied by the
> universal page reached via the gear (feed and settings never share a screen).
> — `docs/projects/archive/NOTIFICATION_SETTINGS_PLAN.md:153`

**D2 governs whether settings share a SCREEN with the feed. It says nothing about which SHELL they
render in.** A settings destination hosted inside the coaches portal — its own page, reached from
the feed, never sharing a screen with it — satisfies D2 completely. The question is **open**.

**Do not propose putting settings on the feed as a tab, drawer or accordion.** That is what D2
forbids, and it has been ruled on.

## What phase 2 delivers

**A. The review**, phone and desktop, ranked by **what it costs a coach** — not by how easy it is
to fix. Separate plainly:
- *a coach cannot do this at all* (the offscreen "Mark all read" is one),
- *a coach can, but it is unpleasant or confusing*,
- *cosmetic*.
Include your own phase-1 findings, and mark which are yours versus given.

**B. An answer to the "forces you out" question — a recommendation, not a menu.** Weigh at least:
- a notification-settings page hosted **inside** the coaches portal (its own screen, portal shell,
  portal nav) — satisfies D2, ends the route-group jump, adds a surface to maintain;
- keeping the universal page but giving it a real way home that lands the coach back on the feed;
- something better you thought of.
State the trade-off in coach terms: what they see, what they can now do, what it costs us.

**C. The borrowed-component decision, stated not implied.** Is the honest fix to make the shared
component theme-aware, to give the coach portal its own feed, or to keep it shared and fix the
tokens? **Everything else depends on this**, so answer it explicitly and say what you would lose.

**D. Your improvements list** — the phase-1 discoveries, each with a recommendation and a rough
size. **Rank them, and be willing to say "leave this alone."** A short honest list beats a long one.

⚠ **Do not fix a token defect at a call site.** Hand-picking a colour for `.itemTime` would green
the gate and leave the same defect wherever else that component is borrowed. Fix tokens at the
token — and if you touch one, sweep the whole portal, not the screen.

---

# Phase 3 — Mockups, after the assessment

Once phase 2 is written, produce mockups **as a Claude Artifact** covering what you recommended.

- **The WHOLE SCREEN, before and after** — not a diagram of the change, and not a fragment.
- **True size**: a 390px phone frame at actual scale, and 1440 desktop.
- **Every destination you propose gets drawn.** If you recommend a settings page inside the portal,
  mock that page too — with the portal's real chrome around it.
- Show the states that matter, not just the happy one: a busy feed, an empty feed, and whatever
  phase 1 told you a coach really sees.
- Where you are proposing a choice, draw both options side by side and say which you recommend and
  why. The owner picks from pictures, not prose.

**Nothing is built until the owner has approved these.**

---

## How to verify, and the traps that have bitten this repo

- `npm run check:layout -- --only=coach-notifications` — ⚠ **the `=` is required**; `--only a,b` is
  silently ignored and sweeps the whole suite (~10 min) while looking like it worked.
- The rendered sweep is the authority for any composited colour or real layout. A static read of the
  CSS cannot tell you what `--white-30` becomes on a painted ground.
- ⚠ **A contrast finding names ONE ground; the token may fail on others nobody looked at.** Two
  grounds were added to `tests/unit/warm-palette-contrast.test.ts` on 2026-09-03 after exactly this
  mistake — a fix computed against the ground the finding named, which passed a scoped run and still
  failed portal-wide.
- ⚠ **A green check can mean the data could not fail.** This screen's whole defect class stayed
  invisible for the same reason. Before reporting a state as fine, ask whether the fixture actually
  contains it.
- The owner does browser testing. Give them something checkable, not a claim.

## Deliberately NOT in scope

The dev server shares a working copy with other sessions; `accounting/expenses/panel.tsx` may not
parse. That is someone else's in-flight work — do not fix it, and do not report it as a finding.
