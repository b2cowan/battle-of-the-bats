# PM Brief — In-Org Coach-to-Coach Chat, Re-scoped (Project 2, v2)

> Companion to `IN_ORG_COACH_CHAT_RESCOPE_PLAN.md` (2026-07-29). Status: **Proposed — awaiting
> three owner rulings.** Nothing here is built; this brief exists so the decisions can be made in
> plain language.

## What this project is

Chat for a coaching staff *outside* of any tournament. Two possible pieces:

- **A team staff room** — a head coach and their assistants get a standing chat for their team,
  right where the roster, schedule, and announcements already live. Open all season, not tied to
  an event.
- **An org-wide coaches' room** — every coach in a club, plus the club's admins, in one standing
  channel (think: "all coaches" for the whole organization, year-round).

Both reuse the same chat experience coaches already have in tournaments — same look, same
notifications, same moderation tools. No new notification system, no new account types.

## Why it was re-scoped instead of built

The June plan was written to solve a problem that no longer exists. Its core argument was that
in-org chat was "the natural place to introduce assistant coaches." Assistant coaches shipped on
their own weeks ago — invites, permission toggles, the works — and they already appear in
tournament chat automatically. About a third of the old plan's work is simply done.

Two more things changed under it:

1. **The buyers moved.** The old plan aimed at "League and Club" orgs. In reality, paid coaching
   staffs only exist at the **Club** tier — and separately, the **Premium Coaches Portal** now
   exists (it didn't when the plan was written), full of real coaching staffs today. For those
   portal teams, "in-org chat" simply means **their team's staff room** — the old plan's optional
   extra turns out to be the only piece with a live audience.
2. **Club is parked.** Per the 2026-07-28 decision, League and Club can't be purchased until the
   full League evaluation happens (after Coach Portal work wraps). So the org-wide room — the old
   plan's main event — currently has **zero possible buyers**.

Good news from the technical dig: the chat engine was built with this project in mind from day
one, so the build is smaller than the program doc feared. The work is mostly "teach the existing
surfaces about a second kind of room," not "build a new kind of chat."

## What the re-scoped project looks like

- **Piece A — team staff room** (serves Premium Coaches Portal teams *now*, Club teams later).
  Head coach runs the room; assistants are in automatically; membership keeps itself in sync the
  same way tournament chat does. Roughly a week of work. Honest caveat: coaching staffs are
  small and often already text each other — the value is keeping team talk in the app where
  everything else lives, and adding weight to the premium portal before the January 2027 paid
  conversion. A retention feature, not a growth feature.
- **Piece B — org-wide coaches' room** (Club only). Club admins run it. Slightly bigger build
  (needs an admin management screen and a place to live in the coach portal). **No one can buy
  Club today**, so building it now means shelf inventory.

Building either piece pays about half the cost of the other — they share plumbing.

## The three decisions needed

1. **What ships (CH-2, revised)** — staff rooms only, org-wide only, both, or neither yet?
   *Recommendation: if building now, staff rooms only; hold the org-wide room for the Club
   evaluation. If not building now, park the whole project — this plan is the ready blueprint.*
2. **History for a replacement coach (CH-5)** — when a coach is swapped mid-season, do they see
   the room's earlier messages? *Recommendation: yes — the room belongs to the team, and season
   continuity is the point. (Parent-facing chat, where the answer differs, is a separate future
   project.)*
3. **Timing** — build now as a premium-portal value-add, or after the League/Club evaluation?
   *This is genuinely the owner's call: it competes with the Coach Portal launch batches for the
   same attention, but it's also the only chat piece that reaches the founding cohort before
   their January conversion.*

## Success criteria (if greenlit)

- A premium portal coach opens their team and finds the staff room without being told it exists.
- Assistants appear in the room with no extra setup; a removed coach loses the seat; a replaced
  coach's access follows the CH-5 ruling.
- Organizers/admins moderate with the exact tools they already know from tournament chat.
- Zero new notification settings for anyone to configure.

## What happens next

Nothing is built until the three rulings land. When greenlit, the standing rule applies: a PM
brief plus mockups of every changed screen, approved, before any code.
