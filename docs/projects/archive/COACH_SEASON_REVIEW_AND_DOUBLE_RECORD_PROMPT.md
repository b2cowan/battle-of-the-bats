# Two open questions from Practice Plans Phase 4 — **recommend, don't build** — paste into a FRESH chat

> **Created 2026-08-03**, at the close of the Practice Plans Phase 4 (Helpers) session, which raised
> both of these and deliberately did **not** resolve either.
>
> ⚠ **THIS IS A RECOMMENDATION SESSION.** Neither item is a defect with an obvious fix; both are
> **product decisions wearing technical clothes**. The deliverable is a recommendation the owner can
> rule on — routed through `/strategy` — not a diff. **If you open this and start editing capability
> code, you have broken it.**

---

## 0 · ⚠ READ THIS BEFORE ANYTHING ELSE — the ground moved on 2026-08-03

Three things landed the same day, in this order, and **the last one partly dissolves question 1**.
Get the sequence right or you will recommend something already decided.

| # | What | Where |
|---|---|---|
| 1 | **Practice Plans Phase 4 (Helpers)** built — a helper is a preset, three additive grants, no migration | `COACH_PRACTICE_PLANS_PLAN.md` status header · uncommitted on `dev` |
| 2 | **The Helper privacy ruling** — a helper sees **full roster basics, exactly as any assistant** | `BUSINESS_DECISIONS.md`, 2026-08-03 helper entry |
| 3 | **⚠ "Player names are baseline" (Addendum A1)** — names/numbers/positions become baseline for **everyone with portal access, including helpers**; the **Roster: Hidden/View toggle is RETIRED**, and `planPlayerNames` retires with it | `BUSINESS_DECISIONS.md` top entry · `COACH_PRACTICE_PLANS_PLAN.md` Addendum A1 · `memory/decision_player_names_are_baseline.md` |

**⚠ THE BUSINESS DECISIONS LOG IS NEWER THAN THE PLAN DOCS AND NEWER THAN MEMORY.** A session earlier
today asserted a counsel gate was still open because the plan doc said so; the log had already
recorded it CLEARED. **Read the log first, and treat any plan doc or memory file that disagrees with
it as stale.** That mistake is recorded in `decision_player_names_are_baseline.md` precisely so it
isn't repeated.

**⚠ CONCURRENCY.** A1 is **decided, logged, and deliberately NOT started** — it is blocked on Phase 4
being committed, because both touch the same five files. Phase 4 is **uncommitted, awaiting owner QA**
(ledger §1.9b). Do not begin either A1 or anything here as code until the owner says Phase 4 has
landed. **This session's output is a recommendation; that is compatible with the block.**

---

## 1 · Question one — the season review, and who should receive one

### What was actually found (state it accurately; the first framing was too broad)

Phase 4's `/review` flagged that **Season Wrapped labels every player on the roster** and is gated on
no roster capability at all — reachable by any coach whose season has closed, and (before the fix)
by a **helper**, who would have been *redirected* into it the day the season ended.

**Two corrections to that framing, both of which you must carry:**

1. **Wrapped's labels are `First name #number` — deliberately, not accidentally.** The code says so:
   *"share-safe label: FIRST name + jersey number only — never a full name on a card built to leave
   the app"*, and a prior adversarial review already tightened it once when a reused lineup's label
   leaked full names into that payload. **This is a considered design, not an oversight.**
2. **⚠ A1 largely dissolves the capability half of the finding.** If names and numbers are baseline
   for everyone with portal access, then "Wrapped shows names without checking roster access" stops
   being a gap and becomes *consistent*. **Do not recommend adding a roster gate to Wrapped** — you
   would be re-adding the toggle A1 just retired.

### What genuinely remains open — and it is a better question than the one that was asked

- **(1a) Should a non-coach adult receive a whole season's review at all?** This is an **altitude and
  archive** question, not a names question. The portal's own rule is *records in, instruments out*,
  and the binding archive ruling is that **the coaches-portal archive is OPT-IN** (`CLAUDE.md`).
  Phase 4 answered this narrowly — a helper is no longer redirected to Season's End and gets "This
  season has finished" instead — but that was **a build-time judgement, not a ruling**, and it is
  worth ratifying or overturning deliberately. A helper is the first non-coach on a staff list; there
  will be others.
- **(1b) Wrapped is built to leave the app — where does it actually go?** ⚠ **VERIFY THIS FIRST AND
  DO NOT ASSUME EITHER WAY.** The payload is documented as share-safe and money is deliberately
  excluded from it *because* it is shareable. Establish, from the code: is there a live share, export,
  image, or public link path for Wrapped today, or is "share-safe" currently a **property of the
  payload with no exit door built**? The two cases have completely different answers. If minors' first
  names and numbers can leave the app to people with no account, that is a genuine question for the
  owner and it is **not** the question Phase 4 raised. If there is no exit, say so plainly and close it.
- **(1c) Who else lands there?** Phase 4 fixed the helper's route. Check every other path into
  Season's End and Wrapped — the closed-team redirect, the nav, Insights, a typed URL, and the
  season-aware `?year=` rail — and say which personas can arrive by each. **Check what the server
  SENDS, not what the client renders**; that bug class has bitten this portal repeatedly.

### The shape of a good answer

A recommendation on **(1a)** that the owner can accept or reject in one line, grounded in the
records-vs-instrument rule; a **factual finding** on (1b) with the code cited; and a **door list**
for (1c). If (1b) turns out to have a real exit path, that is its own `/strategy` entry and probably
its own project — flag it, don't fold it in.

---

## 2 · Question two — one adult, up to three records

### The situation

A parent can now relate to a team in three unconnected ways, and the platform models each separately:

| Relationship | What it is | State |
|---|---|---|
| **Family follower** | Team-level, no child link — schedule, results, game pages, calendar | **BUILT** (Chunk D) |
| **Guardian** | Player-linked, max 2 per player, the accountable adult | **BUILT but SWITCHED OFF** behind a server flag, pending PIPEDA/CASL counsel |
| **Helper** | A non-coach adult who runs a station — staff-side, not family-side | **BUILT** (Phase 4), uncommitted |

**The same human being** — one parent, one email address — can hold the follower record *and* the
helper record today, and a third when the guardian tier is switched on. **Nothing joins them.** The
coach meets them in two different lists, on two different screens, with nothing indicating it is one
person. Phase 4 verified and recorded this as an **accepted limitation**, not a defect: a helper
grant does not widen the family layer and the family layer does not widen staff access, which was the
"two doors" safety check the gate demanded. **The safety property holds. The coherence does not.**

### The questions to answer

1. **Is this actually a problem worth solving, or is separation the correct design?** Make the honest
   case for leaving it alone: the two relationships are genuinely different (one is staff, one is
   family), they carry different consent, and **merging identities is exactly the kind of change that
   quietly widens access**. A recommendation of *"do nothing, and here is why"* is a completely
   acceptable outcome of this session — say so if that is where you land.
2. **If it is worth solving, what is the smallest thing that helps?** Consider, and rank: showing the
   coach a quiet "also a family follower" note on a staff card (a *label*, no data joined) · a
   combined "people connected to this team" view · nothing until the guardian tier turns on.
   ⚠ **A shared identity record joining staff and family relationships is almost certainly the wrong
   answer** — say why, at length, if you agree.
3. **⚠ What does the guardian switch-on inherit?** This is the real deadline. The counsel packet is
   written and ready to send (`COACH_PORTAL_CHUNK_D_COUNSEL_PACKET.md`); when it clears, a third
   record type appears. **Whoever scopes that switch-on must not discover this seam for the first
   time then.** Your output should be usable as an input to that scoping.
4. **Does anything break today?** Specifically: can removing one relationship mislead a coach into
   thinking they removed the other? Revoking a helper does not revoke a family follow, and vice
   versa. **Is that legible on screen, or is it a trap?** Verify it; don't reason about it.

---

## 3 · Ground truth to verify FIRST (⚠ do not trust this document)

- `docs/agents/strategy/BUSINESS_DECISIONS.md` — **the top three entries** (A1 player-names-baseline ·
  the 2026-08-03 Helper ruling · the 2026-08-01 family-layer two-tier entry). **This file outranks
  every plan doc and every memory file.**
- `docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md` — the Phase 4 status header (what was built,
  the three grants, the `/review` finding and its fix) and **Addendum A1**.
- `docs/projects/active/COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` + the **counsel packet** —
  the family layer's own model, and what the guardian switch-on is waiting for.
- `lib/rep-season-wrapped.ts` — what Wrapped actually contains and the share-safe comments.
- The Wrapped/Season's End route + page, and every nav or redirect that reaches them.
- `lib/family-guardian.ts` — the tier switch and what it refuses while off.
- `lib/coach-capabilities.ts` — the current grants **including the three Phase 4 added**, two of which
  A1 will remove. ⚠ Recommendations must be written against **where the code is going**, not only
  where it is.
- `CLAUDE.md` — the binding archive ruling (opt-in, fails closed, build-enforced allow-lists).

---

## 4 · ⚠ Traps this session is specifically exposed to

- **⚠ RE-ADDING WHAT A1 JUST RETIRED.** The instinctive fix for question 1 is "gate Wrapped on roster
  access". That is the toggle A1 killed, and it was killed because **it was fiction** — four surfaces
  honoured it and four ignored it, so it made a safety claim the product could not keep. Do not
  resurrect it under a new name.
- **⚠ CONFUSING THE NAMES QUESTION WITH THE ARCHIVE QUESTION.** "Should a helper see names?" is
  **decided** (yes, baseline). "Should a helper receive a season review?" is **open**. They feel
  similar and are not.
- **⚠ TREATING THE ACCEPTED LIMITATION AS A BUG.** The double record was examined, understood and
  accepted at the gate. Reopening it is legitimate; pretending it was missed is not, and will produce
  a recommendation that argues against a decision nobody made.
- **⚠ SOLVING THIS WITH AN IDENTITY MERGE.** Joining a staff relationship to a family relationship is
  the single change most likely to widen access by accident. The bar for recommending it is very high.
- **⚠ THE WORKING COPY IS SHARED WITH OTHER CHATS.** Phase 4 is uncommitted and at least four of its
  files also carry another session's in-flight work (help content, the coach team page, the coaches
  stylesheet, the Practice Plans plan doc). **Do not commit anything, do not stage anything, and do
  not "tidy" a file you did not write.** If you must edit, edit only documents.
- **⚠ Do not assume a memory file is current.** Two were stale by hours today. Verify against the log
  and the code.

---

## 5 · Process

**Read the log and the code → verify the four factual questions (1b, 1c, 2.4, and whether A1 changes
anything else) → write ONE recommendation document → put the decisions to the owner → log whatever
they rule via `/strategy`.**

- Deliverable: a single doc at `docs/projects/active/` covering both questions, each with a
  **recommendation, the alternative it beat, and the cost of doing nothing**. Add a summary line to
  `TODO.md` per the doc-structure rule; do not put the detail there.
- **Put the decisions to the owner as decisions**, in plain language — what changes for a coach, a
  parent, a helper. Not a capability table.
- **No code this session** unless the owner explicitly rules and explicitly asks, and even then not
  until Phase 4 is committed.
- If either question turns out to be genuinely settled already — say so and close it. **"Nothing to
  do here, and here is the evidence" is a successful outcome**, and cheaper than a project.

## 6 · Definition of done

Both questions answered with evidence from the code, not from this prompt · a recommendation the
owner can rule on in one sitting · anything they rule **logged in `BUSINESS_DECISIONS.md`** via
`/strategy` · the guardian switch-on scoping given whatever question 2 produces · `TODO.md` +
`ACTIVE_PROJECTS_INDEX.md` updated · **nothing committed, nothing staged**.
