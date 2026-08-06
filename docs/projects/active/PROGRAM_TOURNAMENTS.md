# Program — Tournaments

> **The single working document for tournament and organizer work.** Created 2026-08-06.
> Replaces `PROGRAM_TOURNAMENT_ENGINE.md`, `PROGRAM_ORGANIZER_EXPERIENCE.md`,
> `STANDINGS_REMODEL_PLAN.md` + brief, `USER_MANAGEMENT_TOURNAMENT_UX_PLAN.md`,
> `TOURNAMENT_ADMIN_SANDBOX_PLAN.md` + brief, `TOURNAMENT_CREATION_LIVE_PREVIEW_PLAN.md` + brief,
> and the two sandbox mockup files — all archived 2026-08-06.
>
> **Every claim below was verified against the code on 2026-08-06**, not carried forward from a
> plan header. Where this document says something is built, a specific behaviour was found in the
> source. Where it says open, a search for that behaviour found nothing.

---

## 0. Why this document exists

On 2026-08-06 a planning session proposed a body of tournament work built from the two program
docs. Checking the proposals against the code found **16 of 19 outstanding items were already
built.** The roadmap was describing a product that no longer existed.

This had already happened once — the 2026-08-01 consolidation found four plans claiming
"planned/not built" that were all code-verified as built. Those four were corrected; the pattern
was not.

The cost is not the wasted planning hour. It is that **the tournament backlog looked full of
unbuilt work while being mostly shipped, so every "what's next?" conversation picked the Coaches
Portal by default** — not because it was more valuable, but because it was the only place the
paperwork showed a gap.

**Rule going forward: this document is only edited after checking the code.** A status here that
cannot be traced to a verified behaviour is a defect in the document.

---

## 1. Where the product actually stands

### 1.1 The strategic position

Tournaments are the only self-serve purchasable product FieldLogicHQ has. League is parked, Club
and Club · Association are early-access and have never been sold, and the managed early-access
cohort was withdrawn 2026-07-28. Tournament and Tournament Plus are what a stranger can buy today.

Tournaments are also the only product with a **distribution multiplier**. One director signs up and
20–40 teams plus several hundred families touch the public pages over a single weekend. Every coach
there is a Coaches Portal prospect and every club is a Club prospect — the pricing model's coach
bridge already assumes exactly this path.

**The platform has zero customers.** That is the number this program exists to move.

### 1.2 The funnel, end to end — verified 2026-08-06

| Step | State |
|---|---|
| **Discover the product** | Public directory, opt-out discoverability, "Built on FieldLogicHQ" credit on paid pages — **shipped** |
| **Try it without signing up** | Tournament Admin Sandbox — one org, three tournaments, a 6-step tour — **built, owner QA owed** (ledger §5.2, §5.3) |
| **Create the tournament** | Creation wizard with a live phone-frame preview — **live on production** (ledger §5.1) |
| **Invite the staff** | Empty state with guidance and a CTA, plan-aware upgrade links, seat banner naming the plan, role guide explaining who consumes a seat — **all shipped** |
| **Build the schedule** | Per-type event form, game-day fields, smart location, recurrence, series edit — **live** |
| **Build the bracket** | Reopens saved work, tracks unsaved changes, per-tier seed pickers, order-violation detection that blocks a bad save, free-tier health panel, honest paid upsell, venue optional — **all shipped** |
| **Run the weekend** | Live scoring, dashboard status sections, completion guidance — **live** |
| **What families see** | Live playoff bracket that promotes above the pool tables once knockout play starts, playoff cutoff line, follow dock highlighting your team through the bracket, and a **Playoff Picture page** with a written per-division storyline and key-stat callouts — **all shipped** |
| **Convert the audience** | Account-free follows, push alerts, discovery directory — **shipped** |

**The funnel is complete.** No step in it is missing. This is the finding that should drive
everything below: the remaining work is not "build the wedge," it is **"the wedge is built, go use
it."**

### 1.3 What shipped better than it was planned

Two things are worth recording because the plans they came from read as failures:

**The "Race to Playoffs" view became the Playoff Picture page.** The plan called for a segmented
Standard/Race toggle with podium cards on the standings page. What shipped instead is a standalone
page carrying a hero, an auto-written narrative per division, key-stat callout cards, and a seed
list with a visible playoff cut — linked twice from the tournament home page and from the champions
page. That is more ambitious than the plan, and it is already most of the way to the "This Morning's
Storylines" idea still sitting in the backlog as a new concept.

**The bracket editor outgrew its own roadmap.** It was recorded as five unbuilt problems. It
reopens saved brackets, tracks changes against what was loaded, scopes each tier's seed picker so a
seed cannot leak across tiers, detects games scheduled before the game that feeds them, refuses to
save until those are fixed, shows a live health read-out to free-tier organizers, and offers the
paid auto-generator honestly rather than teasing it.

---

## 2. The stages

Each stage below is independently decidable. **Nothing proceeds without an explicit yes.** The
"Needs" column states what must exist before any build begins.

| # | Stage | Needs | Effort | Decision |
|---|---|---|---|---|
| 0 | Close the books | — | done | ✅ complete |
| 1 | The owner-only permission gap | Plan | S | ☐ open |
| 2 | The cross-org invite ruling | **Owner ruling**, then plan | S–M | ☐ open |
| 3 | Prove it works | — (QA) | M | ☐ open |
| 4 | The first real tournament | Plan | M | ☐ open |
| 5 | Storm Mode | Plan + mockups | L | ☐ open |
| 6 | The Big Board | Plan + mockups | L | ☐ open |

---

### Stage 0 — Close the books ✅ COMPLETE (2026-08-06)

Reconciled both program docs against the code, corrected 16 false "not built" claims, consolidated
everything into this file, archived the eleven superseded source documents.

---

### Stage 1 — The owner-only permission gap ☐

**What's wrong.** The member management screen lets an owner override individual permissions for a
member. That override list includes **organization settings** and **billing** — two permissions
policy deliberately reserves for the owner alone. They are not merely displayed: the permission
check honours an override for any non-owner, so granting one actually works.

**What a customer experiences.** An owner who wants to give an admin a little more room can hand
over billing or organization settings without any warning that they have just given away
owner-level control. There is no confirmation, no distinct styling, and no policy enforcement
behind it.

**Why it matters here.** This is the screen a new organization touches in its first hour, and it is
the one place in the product where a well-meaning click quietly transfers control of the account.

**Needs a plan:** yes — small, but it turns on a policy question (block the grant, or keep it and
make it a deliberate, warned action). **Needs mockups:** no.

---

### Stage 2 — The cross-org invite ruling ☐

**What's wrong.** A person who already belongs to one real organization cannot be invited into a
second. The invite is refused with *"This user already belongs to another organization. They must
be removed from their current organization before being invited here."*

That enforces the original 2026-06-19 single-org rule. But the **2026-07-24 Verified Network
decision amended it** — joining and coaching across organizations was ruled "unlimited and free,"
with only *ownership* of a second subscription gated behind verification. That decision is recorded
in the Business Decisions Log as **decided, not yet built.**

**What a customer experiences.** A coach or admin already attached to one club hits a wall when a
second organization tries to bring them in — and the message tells them to leave the first
organization, which is not something the product should ever ask.

**Why it matters here.** Tournaments are exactly where this surfaces. A tournament pulls in staff,
scorekeepers, and coaches who already belong to their own clubs. This will appear on day one of the
first real event.

**⚠ This needs an owner ruling before any plan.** Two honest options:

- **(a) Build the ruling.** Open the membership axis as decided — a person may join any number of
  organizations; only owning a second subscription is gated. Closes the gap between the log and the
  product.
- **(b) Reverse the ruling.** Keep single-org membership and update the Business Decisions Log to
  say so. Legitimate — but then the message needs rewriting, because telling someone to leave their
  club is not an acceptable dead end either way.

**Needs a plan:** yes, after the ruling. **Needs mockups:** only if (a) introduces a verification
step a person sees.

**⚠ Shared with another program.** `PROGRAM_ACCOUNTS_AND_ACCESS.md` carries the other half of this
— "multi-org creation for existing users (the visible half of Verified Network)." **The ruling is
one ruling and must be made once**, then executed in whichever program owns the surface. Do not
plan this here without reading that program doc first, and record the ruling in
`BUSINESS_DECISIONS.md` so it cannot drift a third time.

---

### Stage 3 — Prove it works ☐

**What's wrong.** Nothing, as far as anyone knows — and that is the problem. Roughly a dozen engine
and organizer features have been live in production for four to seven weeks with "no reported
defect." At zero customers, **no reported defect means untested, not proven.** Nobody has run a
real event on any of it.

Carried from both retired program docs, all still owed:

- Manual brackets (free) · tiered auto-split (Plus) · inline tiered editing Phase 2
- Coin-toss tie-breaker · run-differential cap
- Public bracket venues · clickable cards · standings parity
- Unified My Team card · schedule and event rework
- Playoff bracket builder canvas
- Dashboard status sections · completion guidance · post-event summary · admin role parity

Plus the tournament work already queued in the QA ledger: **§5.1** creation live preview, **§5.2**
the sandbox, **§5.3** the moments dock.

**How to close it.** One owner pass over a single seeded tournament, walked end to end — not
fourteen separate verifications. The QA ledger is the home for the steps; this document should not
restate them.

**Needs a plan:** no. **Needs mockups:** no. This is a QA session, and it is the highest-value
unglamorous thing on the list.

---

### Stage 4 — The first real tournament ☐

**What this is.** Not a feature. The goal of getting **one real organization running one real
event** on the platform this fall, and letting that director's friction choose everything that
comes after.

**Why it belongs in this document.** Every item in Stages 5 and 6 is a guess about what a
tournament director needs. One real event replaces all of those guesses with evidence. It also
converts the zero in §1.1 into a one, which is the only number that changes the company's position.

**What it likely involves.** Choosing a target event, walking the setup personally, watching where
the director hesitates, and holding the roadmap open for whatever that surfaces. It may need small
fixes discovered live — that is the point of doing it.

**Needs a plan:** yes — a light one, naming the target event, what gets watched, and what happens
if it goes wrong mid-weekend. **Needs mockups:** no.

---

### Stage 5 — Storm Mode ☐

**What it is.** One button: *Declare a Delay.* Pick the kind and the affected games — pre-selected
from the live board — and every affected game is tagged as delayed everywhere it appears. The
schedule drops into a reflow view surfacing each new conflict with accept-or-adjust per game, a
plain-English message is pre-drafted for the organizer to approve, **every public page for the event
grows the same truth banner automatically**, and followers get a push.

Three taps instead of forty-five frantic minutes.

**Why it's the strongest unbuilt idea.** Rain is the defining crisis of running an outdoor
tournament, and it is the moment a director is judged. A product that turns the worst forty-five
minutes of the weekend into three taps is the thing a director tells other directors about. The
public auto-sync half is non-negotiable to the concept — a delay that does not reach the parents in
the parking lot has not been declared.

**Dependencies that already exist:** the schedule-health engine, the live game-day board, the
announcement composer, the follow and push system, and public page banners. This is largely an
orchestration layer over shipped parts.

**Needs a plan:** yes. **Needs mockups:** yes — the reflow view and the public banner are both new
surfaces, and the composer needs a signed-off voice for a message that goes out under pressure.

---

### Stage 6 — The Big Board ☐

**What it is.** One tap casts the tournament to any TV or tablet propped at the gate, the
concession stand, or the coaches' tent: a slow, auto-rotating, broadcast-style board of field-by-field
live scores, up-next call times, today's biggest moments, and any active delay notice. No login on
the display, readable from thirty feet, updating itself. A toggle flips the same screen into an
internal operations board — schedule health, games missing scores — for the staff room.

**Why it's worth building.** It is the highest-visibility physical surface the product could
occupy. Every person at the event walks past it. It is also the most natural possible pairing with
Stage 5 — a delay declared on the board everyone is already watching.

**Needs a plan:** yes. **Needs mockups:** yes — a thirty-foot-legible layout is a genuine design
problem and nothing in the product currently solves it.

---

## 3. Decided NOT to build

Recorded so nobody re-proposes them.

- **Standings segmented toggle + podium cards.** Superseded by the Playoff Picture page, which does
  the same job better. Close the original plan rather than build the toggle.
- **Admin IA and multi-module navigation.** Real, but it is a League and Club problem — a club owner
  signing in and finding a tournament-first product. Ruled 2026-07-28 (OE-6) to fold into the
  League/Club work rather than ship twice. Lives in `PROGRAM_LEAGUE_AND_CLUB.md`;
  `ADMIN_IA_MULTIMODULE_NAV_PLAN.md` stays active there, not here.
- **Multi-sport phases 2–4.** Paused by owner since June (softball first). The casing mismatch that
  worried the old program doc is defended in code — stored sport values are coerced case-insensitively
  from either the id or the display label. Data-level reconciliation is still owed eventually but is
  no longer a live integrity risk.
- **Schedule Tier-2 control-model choice.** A deferred decision on one surface, not a project.
  Re-read it at the next schedule touch rather than carrying it as open work.

---

## 4. Verified built — the reconciliation record (2026-08-06)

Kept so the next reader can see what was checked rather than re-deriving it.

| Item | Old status | Verified |
|---|---|---|
| Standings: live playoff bracket | not started | **built** |
| Standings: bracket promotes above pool tables | not started | **built** |
| Standings: playoff cutoff line | not started | **built** |
| Standings: Race to Playoffs view | not started | **built** — as its own page |
| Standings: follow-bar redesign | not started | **built** — as a follow dock |
| Bracket: reopen a saved bracket | not built | **built** |
| Bracket: flag scheduling-order violations | not built | **built** — badge + blocks save |
| Bracket: free-tier health panel | not built | **built** |
| Bracket: honest free-vs-paid labels | not built | **built** |
| Bracket: optional venue (structure-first) | not built | **built** — venue never required |
| Members: dead-end empty state | not started | **built** |
| Members: broken upgrade links | not started | **built** — resolves by plan |
| Members: seat banner plan context | not started | **built** |
| Members: role guide explains seats | not started | **built** |
| Invite 409 for existing users (J10-001) | open | **fixed** |
| Multi-sport sport-name casing | latent defect | **mitigated** — normalizer coerces both forms |
| Capability editor offers owner-only permissions | open | **confirmed open** → Stage 1 |
| Cross-org invite vs Verified Network ruling | not in either doc | **new finding** → Stage 2 |

---

## 5. Source documents archived 2026-08-06

`PROGRAM_TOURNAMENT_ENGINE.md` · `PROGRAM_ORGANIZER_EXPERIENCE.md` · `STANDINGS_REMODEL_PLAN.md` ·
`STANDINGS_REMODEL_PM_BRIEF.md` · `USER_MANAGEMENT_TOURNAMENT_UX_PLAN.md` ·
`TOURNAMENT_ADMIN_SANDBOX_PLAN.md` · `TOURNAMENT_ADMIN_SANDBOX_PM_BRIEF.md` ·
`TOURNAMENT_CREATION_LIVE_PREVIEW_PLAN.md` · `TOURNAMENT_CREATION_LIVE_PREVIEW_PM_BRIEF.md` ·
`TOURNAMENT_SANDBOX_MOCKUPS.html` · `TOURNAMENT_SANDBOX_PHASE2_MOCKUPS.html`

Owner QA for the sandbox and the creation preview continues to live in `OWNER_QA_LEDGER.md`
(§5.1–§5.3) — archiving their plans does not affect their QA status.
