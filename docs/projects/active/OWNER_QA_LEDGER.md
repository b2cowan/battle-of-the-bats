# Owner QA Ledger — unverified LIVE behaviour, ordered by what it costs if it's wrong

> ## ⚠ Read this first — what this document is now (re-grouped 2026-08-06)
>
> **This is two lists wearing one cover, and you need to know which half you are standing in.**
>
> - **The shipped half.** A release went out on 2026-08-03. Everything labelled **LIVE ON
>   PRODUCTION** is in front of paying customers right now. Checking it is **damage-finding**, and
>   a failure is an incident to fix today, not a backlog item.
> - **The staged half.** Since that release, **18 commits of feature work have landed on `dev` and
>   none of it has shipped.** Everything labelled **ON DEV** is real, finished, funnel-passed code
>   that customers have never seen. For these, **your QA is the last gate before the next release.**
>
> **Corrected 2026-08-06 — the old framing said the opposite and it mattered.** This document used
> to claim "only §1.9c and four slices of §5.2 still gate anything; everything else has shipped."
> That was true on 2026-08-03 and is badly wrong now. Two facts, both re-checked against git rather
> than against these headings:
>
> 1. **Nothing is uncommitted any more.** The working tree is clean. Every section that said "BUILT,
>    dev, UNCOMMITTED" is committed — the last catch-all commit (`d8316e87`) swept up §1.9c, §1.18,
>    §1.19 and §6 together. The **UNCOMMITTED** label is retired; the label to read now is **ON DEV**.
> 2. **One migration is still waiting.** The old text said "nothing below is waiting on a database
>    change" — true of 211–224 (prod, 2026-08-03) and, as of **2026-08-06**, true of **225**
>    (opponent book), **227** (club shared book) and **228** (game-day moments) too: all three were
>    applied to production and the snapshots refreshed (`a2b91654`). **Verified against the live
>    databases, not the commit message.** **226 cleared on 2026-08-08 with the demo production launch**: the
>    coach-sandbox nightly re-anchor is scheduled and active on BOTH databases (verified in
>    `cron.job`, dev and prod) and both demo worlds are seeded on production — older 226 notes
>    below predate that night. The migration queue's remaining member is **229** (house-league
>    venues, dev-only; see the release-gate table at the end).
>
> ### The ordering: exposure first, then whatever you can test in one sitting
>
> Three tiers by **what happens if this is wrong**, because a finished feature nobody can reach
> matters less than a half-checked one handling a child's medical form.
>
> | Tier | What it means |
> |---|---|
> | **Tier 1** | Can harm someone — child data, money, messaging families, granting access |
> | **Tier 2** | Daily coach actions — friction and lost trust, not harm |
> | **Tier 3** | Polish — visible, annoying, nothing anyone can't get back |
>
> Inside each tier the sections are now **grouped by what shares a setup** — one account, one seeded
> team, one device, one sitting. Three of those groups exist because the old order actively cost you
> time: the four opponent-book phases were split across the tier, the three game-day phases sit on
> **one screen** and the ledger asks twice for them to be done together (they were separated by an
> unrelated section), and §6 was stranded behind two enormous sandbox walkthroughs.
>
> Section numbers are **unchanged** so older notes and links still resolve; they no longer run in
> numeric order and are not meant to. Every step's wording is untouched.
>
> ### Reading a status line
>
> | Label | Meaning |
> |---|---|
> | **LIVE ON PRODUCTION** | On `origin/master`. Customers have it now. Damage-finding, not gatekeeping. |
> | **ON DEV** | Committed to `dev`, never released. **Your QA is the gate.** Some carry a dev-only migration. |
> | **⛔ CANNOT BE QA'd** | Shipped but switched off, or otherwise unreachable. Leave it. |
>
> ### Device batching survives the re-group
>
> Each heading carries 🖥 (desktop), 📱 (phone) or both. **The phone sitting is now much bigger than
> it was** — game day is a phone-first feature and three of its sections are new:
> §1.15 · §1.17 · §1.18 (one sitting, one game) · §1.6b · §1.9b · §1.11 · §1.12 · §1.13 · §1.14 ·
> §1.16 · §2.3 · §2.1 · §2.2 · §2.5 · §2.6 · §2.4 · §3.1 · §5.4.
> **A real iPhone, not Chromium, is required for §2.6a and §4** — both have a recorded defect that
> existed only on iOS.

> **Added 2026-08-01 (later):** §2.5 — **running a practice at the field (Practice Plans 1b)**.
> ⚠ It is the one item in this ledger that genuinely cannot be judged at a desk; do it outdoors,
> one-handed. Practice Plans **1a** already passed your QA and is committed — 1b is the second half.

> **Added 2026-08-01 (later still):** the whole **Chunk D family experience**, now committed
> (`71b42636`) — §1.6b families following a team · §1.6c the guardian tier (⛔ switched OFF, not
> QA-able yet) · §1.7 the coach byproducts · phone passes in §2.6. Two steps carry more weight
> than the rest: in §1.6b, **flipping visibility to Staff only must remove the DATA** from a
> calendar a family already subscribed — not just hide a link; and in §1.7, the **sparse player**
> check — a recap must go *quiet* where you recorded nothing, never apologetic.
> Also corrected the stale "Chunk D not built" line at the foot of this doc.

> **Added 2026-08-01 (last):** §1.8 + two lines in §2.6 — **the drill library (Practice Plans
> Phase 2)**: write a drill once and adding it to a practice becomes four taps. Its sharpest QA step
> is the **detach** check — a drill's own words are read-only once you use it, and editing them
> deliberately *breaks the link* so "in 8 plans" keeps meaning eight of the same thing. Judge whether
> that bargain feels fair in your hand or like a wall. The §2.6 lines matter as much: the four-taps
> claim is only true if it's true **on a phone**.

> **Added 2026-08-02:** §5.1 — **the tournament creation live preview**, the first item in this
> ledger that is NOT a coaches-portal surface. It needs a **wide desktop window** and about ten
> minutes. Its sharpest step is the one that proves nothing broke: narrow the window and confirm the
> setup wizard is exactly what it was. Second sharpest: the preview must never promise a look the
> published page won't deliver — check the colours against a real public tournament page.

> **✅ PASSED 2026-08-03 — the coach portal DESKTOP SHELL chunk, QA'd live with the working agent
> rather than through this ledger, so it has no step list here.** Covers: the pinned team masthead
> **A2 status line** (record + Game day / Next / Complete, reshaped mid-QA to **Option B** —
> identity left, today's status right, no eyebrow where it would only echo the sidebar) and the
> **Option C rails** (Overview rail **cut** as duplicative; lineup + Dues rails kept and trimmed;
> the Dues chase card reduced to one line with per-family Remind moved into the player's panel, and
> it no longer raises an alarm before anything is actually due). Still uncommitted pending the
> owner's per-action OK.
>
> ⚠ **Test data was deliberately RETAINED on `toronto blue jays5` for future runs** (owner,
> 2026-08-03) — do not clean it up without asking. Everything seeded is marked **`[qa]`** in its
> name: eight events on the live 2026 season (a game TODAY with attendance set — 10 in, 1 out
> named, 1 no reply — plus a full week ahead and a scored-then-cancelled game), and an entire
> **finished 2025 season** (`[qa] toronto blue jays5 2025`, final record **8–3–1**, containing a
> scrimmage win and a scored-then-cancelled win that must never count). That team is now the
> standing fixture for game-day, archive, and cancelled-game-record checks.

> **Added 2026-08-03:** §5.2 — **the "See it live" sandbox**, all eight slices of its Phase 1. It is
> the longest section in this ledger and the only one where the *absence* of things is most of the
> point: no form at the door, no saved change, no email ever sent, no banner or nav change on a real
> customer's screen. Two prerequisites are genuinely load-bearing and easy to skip — **start the
> tick in watch mode** (without it the demo freezes and half the section can't happen) and **use a
> fresh private window** (signed in as yourself you get a deliberately shorter experience).
> Its sharpest steps: **B** — the banner must never be covered, which is exactly the defect the
> first QA pass found; **E** — a dragged game must stay on screen while the health score reacts, and
> **J** — proof that none of this touched a real customer.
> It also carries the one **open decision** on the project: what the door should do for a visitor
> who is already signed in.

> **How to use this:** work **Tier 1 top-to-bottom first**, tick `[x]` as you go, jot defects inline
> under the step that failed. A Tier 1 defect on a **LIVE** section is an incident to fix today; on
> an **ON DEV** section it simply holds the release. When a section is fully ticked, tell the working
> agent "QA passed: <section>" — it graduates the project (mark the TODO line, then archive the
> plan). Source plans are archived (paths noted per section); **this ledger is the QA surface of
> record.** Steps were extracted from each plan's own QA/acceptance sections; two projects had none
> written — their sections say so and carry a sketch instead.
>
> **Steps marked 🤖 were machine-verified on 2026-08-03** by the Tier 1 pilot in `tests/uat/` and are
> ticked. A machine can settle "can the wrong person reach this" better than a person can; it cannot
> settle whether copy is honest, whether a bargain feels fair, or how anything behaves under a real
> thumb. Everything still unticked needs your eyes for a reason.

## The running order at a glance

Ten groups, in the order to work them. **§ numbers are historical and do not sort** — this table is
the sequence.

| # | Group | Sections, in order | Device | State |
|---|---|---|---|---|
| **1A** | Access and entitlement — is this org still a customer? | §1.19 | 🖥📱 | ✅ **PASSED 2026-08-12** — 17/19; steps 9+9b owed (order defeated them) |
| **1B** | Who can see a child | §1.5 · §1.6b · §1.6c · §1.7 · §1.9b · §1.9c · §1.11 · §2.6a | 🖥📱 | LIVE, except §1.9c ON DEV · §1.6c ⛔ |
| **1C** | Money | §1.2 · §1.3 · §2.3 · §11 · §12 · §13 · §13b · §14 · §15 · §16 · §17 · §18 · §19 · §20 · §21 · §22 · §23 · §24 · §27 · §29 · §30 | 🖥📱 | LIVE · **§30 ON DEV** (the sponsorship follow-ups — two Overview doors, money tags on money coming IN, a sponsor in the demo world; ⚠ Part A's last step is the filter following a coach to another tab, and Part C is the shop window) · **§29 ON DEV** (the budget speaks in category + item — ⚠⚠ Part C checks the totals still reconcile, and Part D is the one-team-cannot-see-another rule) · **§27 ON DEV** (correcting a money record — edit/delete with ledger reversal; one Add door — ⚠ Parts D and E move real money) · **§24 ON DEV** (sponsors beside fundraisers; the budget splits — ⚠ Part D checks an arithmetic sign that would over-bill families) · **§23 ON DEV** (a fundraiser opens inside Money; a past season's drive shows that season's roster — ⚠ Part B closes a wrong-season defect) · **§22 ON DEV** (Team settings regroups; the two dues settings move into it) · **§13b ON DEV** (ledger columns + re-run guard + a live "Invalid Date" defect fixed) · §11 ✅ **PASSED 2026-08-12** — 5 post-review checks owed (see §11 note) · **§12–§21 ALL LIVE ON PRODUCTION 2026-08-14 (job 256)**, migrations **231–235 ✅ applied to prod** · §18 (help sub-topics) ✅ **PASSED 2026-08-14** · ⚠ **§12–§17 and §19–§21 shipped to production BEFORE owner QA** — the walk-throughs below are now run against the live site, not staging |
| **1D** | The opponent book, and the club that shares it | §1.12 · §1.13 · §1.14 · §1.16 | 🖥📱 | ON DEV |
| **1E** | Game day on the bench — ⚠ one sitting, one phone | §1.15 · §1.17 · §1.18 | 📱 | ON DEV |
| **2A** | At a desk — the week's work | §1.1 · §1.10 · §1.4 · §1.8 · §1.9 | 🖥 | LIVE |
| **2B** | On a phone — and one of them outdoors | §2.1 · §2.2 · §2.5 · §2.6 | 📱 | LIVE |
| **2C** | The free portal | §3.1 | 📱 | LIVE |
| **2D** | House league schedule — fields + double-booking | §8 | 🖥 | ON DEV · mig **229** ✅ on prod |
| **2E** | Tournament schedule — a field is picked, not typed | §9 · §9b | 🖥 | ON DEV · no migration |
| **3A** | The coach portal — words, findability, close behaviour | §6 · §1.6 · §2.4 · §4 · §10 | 🖥📱 | §6 ON DEV · §10 ✅ **PASSED 2026-08-12** · rest LIVE |
| **3B** | The shop window — what a prospect walks into | §5.1 · §5.2 · §5.3 · §5.4 · §5.5 | 🖥📱 | Mixed · §5.5 ON DEV |
| **3C** | The day-of volunteer bars — scorekeeper + gate get a bottom | §7 | 📱🖥 | ✅ **PASSED 2026-08-07** — 6 defects fixed in the run |

**Where the release gate actually sits:** groups **1A, 1D, 1E**, §1.9c, §6, and most of **3B** are
the unshipped half. If you only have one sitting, those are the ones where finding something still
changes what customers get.

**The three longest sections**, so you can budget: §5.2 (~30 min, the sandbox) · §5.4 (~25 min, the
coach sandbox) · §1.16 (needs two teams in one Club-plan org set up first).

## Before any session — prep (10 minutes, once)

- [ ] Dev server clean restart (stop → clear cache → start) — several of these landed shared files.
      Confirm the app loads and sign-in works.
- [ ] Accounts on hand: **premium head coach, club-owned team** (`j2-rep-coach@dev.local` /
      `devpass123`) · **standalone team** (`coach@dev.local` / `devpass123`) · at least one
      **assistant coach** you can re-toggle between runs (money read / money off / schedule off /
      lineups off / attendance off / roster hidden) · a **free-tier coach** account · a real
      **iPhone** for Session 4.
- [ ] Data states you'll need (ask me to seed any that are missing): a team with a game TODAY, one
      with a game this week, one quiet 3+ weeks, one pre-season (Chunk I); a team with a
      **closed/rolled-forward past season** (Chunk F); a team with **zero budget lines** (Chunk G);
      a team with dated budget lines/expenses/payables across months + a prior season (Chunk H);
      an org rep team with an **admin-linked tournament registration** (Batch 1); free-tier teams
      in the coherence states (Session 3).
- [x] **Setup the newer groups need, and nothing else does** — ✅ **SEEDED 2026-08-06.** One
      command rebuilds all of it, and re-running it is also how you reset after a run:
      `node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs` (`--cancel-lab` / `--game-day`
      / `--book` to do one at a time). It prints the URLs and sign-ins. What it makes:
      · **Group 1A** — a throwaway Club-plan org `qa-cancel-lab` with an owner, a coach, a
        scorekeeper, a rep team with a lineup, and three live tournaments. Re-running RESETS the
        subscription to active, which is the undo for §1.19 step 8.
      · **Group 3C** (added 2026-08-07) — two more volunteers in that same org, `Dana Scorer`
        (score only) and `Pat Gate` (gate only). They exist because no ROLE produces a single-duty
        volunteer — everyone who can score can also check teams in — so the case the new tab bar
        is weakest on had to be built with explicit capability overrides.
      · **Group 1E** — a live-window game on `toronto blue jays5` with a lineup whose bench
        streaks are deliberately **4 / 3 / 2 innings** so "longest sitting first" is a real claim,
        and three pitchers of two innings each. Pitching caps left UNSET on purpose — that is
        §1.18's "before".
      · **Group 1D** — book lines and observations on Northgate Knights, a **second spelling**
        ("Knights 12U") to merge, Durham Diamonds left deliberately EMPTY, lineups across three
        wins and two losses with a different starting pitcher in each, and the two-team club pair
        on `dev-club-org` with all three sharing switches **off** (turning them on is the test).
      ⚠ Still missing, and honestly so: **§1.14's "Their tournament so far"** needs a real platform
      tournament with the team registered in a published division. Those checkboxes will read
      "absent" for setup reasons — not a defect.
      ⚠ **Fixed 2026-08-07 — if you seeded before this date, re-seed.** The script stamped "today"
      in UTC, so any run after ~8pm Eastern put the day's games on TOMORROW and the scorekeeper
      board correctly reported **"No games today"** — a broken fixture that looks exactly like a
      broken screen. It now uses the local calendar day, the one a screen means by "today".
- [ ] Still yours to arrange: a team with **at least one prior season of tryout data** (§1.11), and
      a real **iPhone** for §2.6a and §4.
- ⚠ **Dev and prod are schema-identical again as of 2026-08-06** — 225, 227 and 228 were applied to
  production and the snapshots refreshed. **226 followed on 2026-08-08** (the demo production launch):
  the coach sandbox's nightly re-anchor is scheduled on **both** databases, so its dates move
  overnight everywhere. **229 followed on 2026-08-10** (house-league venues) — verified against live `information_schema` on
  both databases: all six columns present and nullable, all four foreign keys `SET NULL`, zero
  structural drift. **No database change blocks anything in this ledger now**, and the schema-parity
  baseline has been lowered to 0 accordingly.

---

# TIER 1 — can harm someone

Guardian and child information, money, messaging families, and anything that grants a person
access. Wrong here is not friction — it is a child's medical form in the wrong hands, a family
billed wrongly, or an adult holding access nobody meant to give them.

**This tier is now split roughly down the middle.** Groups **1B** and **1C** are shipped — customers
have them, and a defect there is an incident. Groups **1A**, **1D** and **1E** (plus §1.9c inside 1B)
are staged on `dev` and have never been released, so a defect there is caught in time. Both halves
are worth the same care; only the consequence of failing differs.

---

## Group 1A · Access and entitlement — is this org still a customer?

A cancelled subscription is the only thing in this ledger that can switch a whole organisation off. It
needs a throwaway org and a platform-admin sign-in, so it batches with nothing else — do it first and
alone, while you still have the patience for a before/after.

### 1.19 ✅ A cancelled subscription actually stops — **PASSED 2026-08-12** (17 of 19 steps) · LIVE ON PRODUCTION

> ## ✅ Owner QA PASSED 2026-08-12 — 17 of 19 steps
>
> The rail holds. Cancelling shuts down the coach portal, the scorekeeper and gate check-in; the
> comeback path loads; reactivating restores everything untouched; the family portal, tryout
> registration and the redirect-trap fixes all behave.
>
> **One finding, moderate — the way back is unlabelled.** Once an org is cancelled the **Cancel
> Subscription** section disappears (correct — you cannot cancel twice), but nothing replaces it.
> There is no Reactivate control and no pointer to the one that exists. Reinstating access means
> knowing to go to **Active Overrides → + Add Override → Subscription Status → active**, which the
> owner did not find unaided. The escape hatch itself is intentional and works; what is missing is
> any signpost from the cancelled state to it. **Suggested fix:** where the Cancel section used to
> sit, show a line saying access is off and naming the override. Not built — owner's call.
>
> ### ⚠ Steps 9 and 9b did NOT get a fair test — the step ORDER defeated them
>
> **This is a flaw in this checklist, not in the product.** Cancelling an org *already archives every
> non-archived tournament* (that is the cancellation working as designed). Reactivating does **not**
> un-archive them. So by the time step 9 dropped the org to a one-tournament plan there was nothing
> left over the cap: the downgrade had nothing to archive, printed nothing, and the check the fixture
> was purpose-built for never ran.
>
> Confirmed from the billing record afterwards: **one cancellation intent, no downgrade intent.**
>
> **To test it properly, step 9 must come BEFORE step 4** — or on a freshly re-seeded org. Re-seed,
> then downgrade to a one-tournament plan *without cancelling first*: the survivor must be
> **QA Lab Summer Showdown** (running today) and April Open + Fall Invitational must be the two
> archived. The order below is corrected for the next run.

*A platform admin cancels an org. Until now the coach portal and the scorekeeper app kept working —
forever — even though the confirm dialog promised both would shut down. They stop now.*

> ⚠ **This is now damage-finding, not a gate.** All three waves reached production on 2026-08-08.
> A failure below is an **incident to fix today**, not a release blocker to schedule. Verified
> against production rather than these headings, 2026-08-08.
>
> **Three rounds of work sit under this section.** The first shipped the rail itself. A follow-up
> review pass (2026-08-06 — typecheck ✓, 1,439 unit tests ✓) hardened three things the checklist
> below now covers:
> 1. **The downgrade no longer archives a tournament that is happening right now.** It used to keep
>    "the most recent seasons" — which inside one year is pure alphabet, so an event that finished
>    in the spring outranked one running today. Archiving a live tournament takes its whole public
>    site down mid-event, for every family watching. Step 9 is rewritten to catch that.
> 2. **A failed archive no longer reads as success.** The plan screen now names the tournaments it
>    archived, and says so loudly when it could not — previously the plan change reported plain
>    success while the org sat over its cap with a live tournament still running.
> 3. **Check-in joins the shut-down list** (it was already closed in the committed half; the new
>    work made the ordering a shared rule so the next volunteer surface inherits it). There is now
>    a checkbox for it — there wasn't before.
>
> ⚠ **A THIRD wave (2026-08-07) landed while setting this section up, and it is not about
> cancellation at all.** Doing step 2 signed in as the *wrong* account walked straight into a dead
> end that has been there all along, on every workspace in the product. Steps 15–17 below are its
> checks. Also live.

⚠ **This section is different from every other one in the ledger, and you need to know why before
you start.** Entitlement changes are close to impossible to QA by clicking: **a cancelled org that
still works looks exactly like a working org.** There is no red banner to spot, no error to notice.
If you just "click around and it seems fine", you have learned nothing — that is precisely the state
that shipped and went unnoticed for a year. So this section is built as a **before/after on one
throwaway org**, where the only meaningful evidence is that something you *could* do a minute ago
you *cannot* do now.

**Do not run this on a real customer org.** ✅ **A throwaway org is seeded for exactly this:**
`qa-cancel-lab` — Club plan, one rep team with a roster and a saved lineup, and **three tournaments
shaped so step 9 has a real answer** (see there). Rebuild or reset it any time with
`node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs --cancel-lab`.

| Sign in as | Email | Password | Used in |
|---|---|---|---|
| Coach | `qa-lab-coach@dev.local` | `devpass123` | steps 2 + 5 |
| Scorekeeper | `qa-lab-scorer@dev.local` | `devpass123` | steps 3 + 6 |
| Org owner | `qa-lab-owner@dev.local` | `devpass123` | step 7, the comeback path |
| Platform admin | `fieldlogichq@gmail.com` at `/platform-admin/login` | — | steps 4 + 9–12 |

⚠ **The seeded games and the live window are anchored to the day you last ran the seeder.** If you
come back tomorrow, re-run it — otherwise the scorekeeper's "before" shows no games today and the
step proves nothing.

#### Setup (5 min)
- [x] **1.** ✅ Already true: `qa-cancel-lab` is on the **Club** plan with a rep team, a coach, and three
   tournaments — **QA Lab Summer Showdown** (running today, carrying two games), **QA Lab April
   Open** (finished, earlier this year) and **QA Lab Fall Invitational** (last year). Step 9 turns
   on which of those survives, so glance at the three now.
- [x] **2.** Sign in as the **coach** and open the Coaches Portal at `/qa-cancel-lab/coaches`. **Do the
   things.** Open the roster, open attendance, open lineups — all three have real data in them.
   *This is the "before" half — without it the "after" proves nothing.*
   → While you are here, **create a family link** on the Roster page and open it in a private
   window. That is the "before" for step 12, and it can only be made from this screen.
- [x] **3.** In a second browser (or private window) sign in as the **scorekeeper** and open
   `/qa-cancel-lab/scorekeeper`. Confirm you can see the day's games — there are two.

#### ⚠ Do the downgrade FIRST — steps 9 and 9b, before anything is cancelled
*Corrected 2026-08-12 after the first run. Cancelling archives every tournament as a side effect, so
running the downgrade afterwards leaves it nothing to do and the check silently passes on an empty
board. **Do 9 and 9b here, then re-seed, then carry on to step 4.***

#### The act
- [x] **4.** As platform admin → the org → **Billing & Access** → **Cancel Subscription**. Read the
   **"Will shut down:"** list in the dialog before you confirm — that list is the promise this whole
   change exists to make true. Give any reason, confirm.

#### After (the part that matters)
- [x] **5.** **Coach browser — refresh.** Expected: the portal shell still frames the page, but instead of
   the team you get *"{Org} 's subscription has ended"* with a short explanation and a way home.
   ❌ If you still see rosters/attendance/lineups, the fix has failed — say so.
- [x] **6.** **Scorekeeper browser — refresh.** Expected: the same "subscription has ended" message.
   ❌ If you can still enter a score, the fix has failed. *(This one is the sharpest test: the
   scorekeeper is an installed phone app that lives outside the admin screens, which is exactly why
   it kept working before.)*
- [x] **6b.** **Check-in, the third volunteer door.** Still cancelled, open `/qa-cancel-lab/check-in`.
   Expected: the same "subscription has ended" wall — **not** "Access Denied". The distinction
   matters: Access Denied sends a volunteer to their org admin over something that is not their
   fault and cannot be fixed at that end. *(Same class of surface as the scorekeeper — outside the
   admin shell, so the original client-side redirect never reached it either.)*
- [x] **7.** **The comeback path — the thing most likely to be broken by this change.** As the org owner,
   go to `/{orgSlug}/admin`. Expected: you land on the **Billing** page (everything else redirects
   there) and **that page loads properly** — plan cards, prices, a way to resubscribe.
   ❌ If the billing page errors, 500s, or bounces in a loop, **stop and tell me** — that would mean
   a cancelled customer cannot pay us again, which is worse than the bug we set out to fix.
- [x] **8.** **Undo it.** Platform admin → set the org's plan back / re-activate. Expected: the coach portal
   and scorekeeper both come back **exactly as they were** — nothing was deleted.
   *(Belt and braces: re-running `scripts/seed-qa-day-fixtures.mjs --cancel-lab` also resets the
   org to active/Club and un-archives all three tournaments. Use it if step 8 goes wrong — but do
   step 8 by hand first, because whether the operator path can undo its own cancellation is
   exactly what is being tested.)*

#### Also changed, quick checks (4 min)

- [ ] **9.** **⚠ The downgrade must not archive the tournament that is happening today.** This is the sharpest
   of the "also changed" checks and the fixture is built around it.

   With the lab back on **Club**, use platform admin to drop it to a **one-tournament plan**.
   - Expected: the confirmation names what it archived — **QA Lab April Open** and **QA Lab Fall
     Invitational** — and the survivor is **QA Lab Summer Showdown**, the one running today.
   - ❌ **If Summer Showdown was archived and April Open survived, stop and tell me.** That is the
     old behaviour: it kept the alphabetically-first event of the most recent year, which meant a
     tournament finished in the spring outranked one being played right now. Archiving a live event
     takes its whole public site down mid-tournament, for every family watching it.
   - Then open the **public page of Summer Showdown** and confirm it still loads. The archived two
     should be gone from the org's tournament list but nothing should 404 that families are using.
   - Before this work the plan change reported the over-cap count and **left every one of them
     running**, indefinitely.

   ⚠ Re-run the seeder afterwards to put all three back before any other step.

- [ ] **9b.** **A failed tidy-up must not read as success.** Nothing to force — just read the confirmation
   after step 9. It should either name the archived tournaments or carry a **bold warning** that
   archiving did not happen. ❌ A plain "Plan and access updated" with no mention either way is the
   defect: the plan change lands regardless, so a silent screen would leave the org over its cap
   with a live tournament still running and nobody the wiser.
- [x] **10.** **Plans & Pricing → Feature Matrix.** Expected: a banner stating plainly that publishing the
    matrix records the decision but does **not** change customer access, plus either a list of
    "published but not live" rows or a ✅ saying published and live agree. *(Publishing used to
    imply a packaging change had taken effect when nothing had.)*
- [x] **11.** **Bulk Operations → Comp Period.** Expected: the same warning the single-org screen has always
    carried — comp period is a billing tag and grants no access. It used to just say "Grant a comp
    period", which reads like it gives something.

#### Added by the review — three more doors that were still open (2 min)
The review found the *same* defect on three surfaces the first pass missed. All three are worth a
look because none of them are reachable from the coach or admin screens you just tested.

- [x] **12.** **The family portal.** Use the family link you made in setup step 2 — the parent-facing team
    page. Confirm it works. Then cancel and reload: expected **404 / not found**, not a working
    schedule. *(A cancelled club's families kept the team page, schedule and calendar feed
    indefinitely — the family portal never consulted billing at all.)*
- [x] **13.** **Tryout registration.** With the org cancelled, open its public rep-team tryout registration
    page and try to submit. Expected: the org reads as not found. ❌ If it accepts a registration,
    a cancelled club is still collecting players' dates of birth and guardian contact details.
- [x] **14.** **Dues reminder emails.** Nothing to click — just know that the nightly reminder sweep now skips
    cancelled orgs. Previously a cancelled club kept emailing its families about money.

#### Found while setting this section up — the door that trapped you (3 min)
*Nothing here is about cancellation. It was found doing step 2 with the wrong account signed in, and
it applies to **every** workspace in the product, not just the lab. Built 2026-08-07, uncommitted.*

**What was wrong:** signed in as one account and following a link into a club you don't belong to,
the club bounced you to the sign-in screen and the sign-in screen bounced you straight back —
forever. No form ever appeared, no button, no message. The only escape was clearing cookies. Both
halves were individually behaving sensibly; together they trapped you.

- [x] **15.** **The trap itself.** Signed in as the **platform admin** (or any account that is *not*
    `qa-lab-coach@dev.local`), open `/qa-cancel-lab/coaches`.
    - Expected: a page headed **"No access to this organization"**, saying you're signed in but this
      account isn't a coach here — with the portal's usual top strip above it (wordmark, Account,
      Workspaces) and three buttons: **Go to Home**, **Back to Coaches Portal home**, **Sign out**.
    - ❌ **If the screen flickers between two URLs and you can't click anything, stop and tell me** —
      that is the original defect and it means the fix has failed.
    - The **Workspaces** control top-right is the useful one: it should let you hop straight to a
      club you *do* belong to, without signing out and back in.
    - ⚠ On a **phone** the top strip is deliberately absent (it is desktop-only everywhere in the
      portal); the three buttons carry the whole job there. That is intended, not a gap.

- [x] **16.** **The same trap, elsewhere.** The bounce-protection is global, so spot-check one other door:
    signed in as the coach, open `/qa-cancel-lab/admin` (they are not an org admin).
    - Expected: you end up somewhere you can actually use — Home, or your own workspace — **not** a
      flickering loop. The wording there is still generic; only the coach portal got a purpose-built
      page in this pass, which is a known and deliberate gap.

- [x] **17.** **📱 The sign-in screen's bottom bar.** On a phone, sign out completely and open `/auth/login`.
    - Expected: three tabs — **Home · Scores · Sign In** — with **Sign In lit up** as the tab you're
      on. Previously it showed only Home and Scores, with nothing highlighted and no indication of
      where you were.
    - Then tap through to **Create a free account**. Expected: the Sign In tab is still there but no
      longer highlighted, and tapping it takes you back to sign-in — a genuinely useful "already
      have an account?" shortcut.
    - ❌ If the bar looks squashed, mis-spaced, or a tab is cut off, say so.
    - *Worth a quick glance on a tournament public page and inside both demo sandboxes too — this is
      shared chrome. Neither sandbox shows this bar at all, so nothing should have changed there.*

#### What is deliberately NOT closed (so it doesn't look like a bug)
- **`past_due` orgs keep working.** A failed payment writes past-due, not cancelled — the customer
  gets Stripe's whole retry window before anything stops. Only Stripe *giving up* cancels.
- **Free (Basic) coach portals are untouched.** Those teams belong to a person, not to a paying org,
  so there is no subscription to cancel.
- A platform-admin **"subscription status → active" override still rescues an org** without touching
  Stripe. That escape hatch is intentional.

---

## Group 1B · Who can see a child

Guardian details, medical forms, a child's name on a screen someone outside the staff can reach. The
standing invariant across all of these: **if you ever see a child's name on a family-facing surface,
stop and say so.** §2.6a closes the group because it needs a real iPhone — park it for the phone sitting
if you have not got one to hand.

### 1.5 🖥 Player documents & guardian PII gating — **LIVE ON PRODUCTION**
*A signed medical form now needs BOTH Documents and Contacts access — an assistant with Documents
alone no longer sees any child's signed forms.* Plan stays ACTIVE (its migration is applied on dev
to prod on 2026-08-03 along with the code): `active/COACH_PLAYER_DOCUMENTS_PII_PLAN.md`. *(No owner
checklist in the doc — sketch below.)*
> 🤖 **Machine pass 2026-08-04** — `tests/uat/scenarios/coach-record-access-boundary.spec.ts`.
> Six probes on a seeded assistant holding Documents but not Contacts.

- [x] 🤖 Assistant with Documents but NOT Contacts: no per-player documents section anywhere; team
      TEMPLATES still visible.
      *Cleared: the per-player documents route refuses (403) on both read AND write, the player page
      renders the player with no Documents heading at all, and the team-templates route still
      returns 200. The refusal was checked to carry neither the file name nor the guardian address.*
- [ ] Grant the same assistant Contacts too: player documents appear and download.
      *🤖 Half cleared — with Contacts added the same route returns 200 and lists the seeded form, so
      the 403 above is a real gate rather than an empty shelf. **The DOWNLOAD is still yours:** it
      goes through a signed storage URL the pilot did not exercise.*
- [ ] Head coach + org admin: no change anywhere.
      *🤖 Half cleared — the head coach reads the document normally. **The org admin is still yours.***
- [ ] Turning ON Tryouts or Internal-notes access now asks for confirmation first.
      *Yours — a confirmation dialog is a judgement about wording, not a boundary.*

### 1.6b 🖥📱 Families follow the team (Chunk D Slices 0–2) — **LIVE ON PRODUCTION**
*One link a coach shares; grandparents follow the schedule; nobody sees a child.*
Plan: `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` §9 (build record + the six deviations).
~~⚠ Migrations 214–217 are DEV-ONLY.~~ **Applied to prod 2026-08-03.** ⚠ **The guardian tier — a parent connected to their own
child — is BUILT AND SWITCHED OFF pending counsel.** Everything in this section is the FOLLOWER
tier plus the substrate, which carry no child data and are not gated. Guardian steps are in §1.6c
and can only be run once the switch is on.
*(These slices were built in an earlier session; steps below were written against the shipped code,
not the plan headers.)*

> 🤖 **Machine pass 2026-08-04** — `tests/uat/scenarios/family-access-boundary.spec.ts` (20 probes,
> all green on a warm server).
>
> ⚠ **Three of this suite's probes had never actually run an assertion.** The stranger checks — a
> guessed join token, an anonymous team payload, and the link reset — called `fetch` from a page
> that had deliberately never navigated (being signed out is their whole point), so they threw
> `Failed to parse URL` and errored out before asserting anything. **The most exposed surface in
> the chunk was the one with no working probe.** Fixed in the pilot; all three now run and pass.
>
> ⚠ A fourth was a **false alarm**: it asserted the follower payload does not contain the string
> `"guardian"`, and Slice 2 later added a `guardian: null` FIELD. It was failing on a key name while
> nothing had leaked. Rewritten to assert the payload's shape instead of grepping it.

**Coach side — sharing and gatekeeping**
- [ ] Premium team → **Roster** (List view, not Depth chart): a **Team family access** card. Note
      it is on the roster INDEX, not the player page the mockup drew it on — deliberate, because
      every control on it is team-level. Flag if you disagree with the placement.
- [ ] **Create link** → copies. Open it in a private window: you get a request page showing the
      **org and team name and nothing else** — no roster, no player names, no counts. That page
      must never become a way to find out who is on a team.
- [ ] Request as a **family follower** (relationship only, e.g. "Grandparent") → the coach's card
      shows a quiet **waiting** count. Nothing should chase you by email or push.
- [ ] **Approve** → the follower sees the team. **Decline** someone → they can ask again (declining
      is not a permanent ban). **Manage → Remove** a follower → access ends immediately.
- [x] 🤖 **Reset link** → the OLD link stops working everywhere, and everyone already approved keeps
      their access. This is the "it got forwarded further than I meant" control.

**The visibility setting — enforced on the server, not by hiding buttons**
- [ ] Set **Schedule visibility** to each of **Staff only / Families / Public link** and confirm at
      each level: the family team view, a shared game page, the standing public team page, and a
      calendar a family already subscribed to. **Staff only must remove the DATA, not just the
      link** — a family sees a quiet "not available right now", never an error, and their
      connection stays intact.
      *🤖 **Three of the four surfaces cleared:** flipping to Staff only leaves the follower a 200
      with `state: hidden` and no opponent name (a quiet state, not an error, connection intact),
      404s the shared game page, and the public team page carries the schedule ONLY at `public_link`.
      **The fourth — the already-subscribed calendar — is NOT covered**, see the step below.*
- [ ] Sharpest check: subscribe a calendar at **Families**, then flip to **Staff only**. The
      calendar must stop updating. A minted link that keeps serving after you close the door is
      the bug this setting exists to prevent.
      *⚠ **NOT machine-covered, and it is the sharpest step in the section.** The suite proves a
      revoked follower cannot MINT a calendar token and that a guessed one 404s — but nothing
      asserts that an ALREADY-MINTED feed stops serving when visibility closes. That is the exact
      shape of bug this setting exists to prevent, and it currently has no probe. Worth a spec.*

**Family side — what a follower actually gets**
- [ ] The team view is **one chronological list, no sections**, opened scrolled to the next event.
      Finished games carry scores; upcoming ones carry time and place. Practices sit inline.
- [x] 🤖 **Nothing about any child anywhere** — no roster, no names, no attendance, no fees. This is
      the standing invariant of the whole chunk; if you see a child's name on a follower surface,
      stop and tell me.
- [ ] The team appears in **Following**, so a family reaches it where they already look.
- [ ] **Subscribe** the calendar into a real phone calendar; move a game in the portal and confirm
      it updates.
- [x] 🤖 Coach shares ONE game (**Share game link** on the event) → that page opens with **no account,
      on a second device**. A game you did NOT share must not have a page. Sharing is per-game and
      deliberate — never a standing feed of where children will be.
- [ ] Move a game, cancel one, **un-cancel** it, and post a final score → the follower is told each
      time. *(Un-cancel and corrected scores were both silent bugs caught in review — worth
      confirming they now speak.)*

**Substrate (Slice 0) — small, but each closes a real hole**
- [ ] **Email families → unsubscribe.** Send yourself one, use the footer link, then send again:
      you are excluded, and the coach sees only a **count** of opt-outs, never which family. Confirm
      the coach cannot re-subscribe anyone on their behalf.
- [ ] ⚠ **Known gap, not a defect:** free-tier teams still have no unsubscribe (nothing to key it
      against). Recorded and in the counsel packet.
- [ ] **Tryout offer email** → the landing page shows the child's **first name and last initial**,
      not their full name. That page is reachable by anyone holding the link, which is why.

**Known + accepted (recorded, don't file):** the rate limit on no-login links can be dodged by a
forged forwarding header (platform-wide, pre-existing); the four older no-login link types were not
retro-fitted with rate limiting; a phone that had the app open before this shipped may cache the
new family route once before updating.

### 1.6c ⛔ The guardian tier (Chunk D Slice 2) — SHIPPED, SWITCHED OFF, AND VERIFIED OFF · the walk-through stays blocked
*A parent connected to their own child — built, shipped OFF, waiting on counsel sign-off.*

> ## 🤖 PILOT FINDING — resolved 2026-08-04. ✅ Production is clean.
>
> **Owner confirmed 2026-08-04: the production environment variable is ABSENT**, and the code
> defaults the tier to off when it is unset. **The guardian tier has never been on for customers.**
> No incident, nothing to disclose, no counsel exposure.
>
> **What was real:** this DEVELOPMENT machine had the tier switched **on**, so the refusal behaviour
> the two steps below ask you to verify did not exist here. ✅ **Turned off and the dev server
> restarted 2026-08-04**, with a note beside the setting explaining why it stays off. Dev and
> production now agree, and this section is testable as written again.
>
> **⚠ The lesson worth keeping, because it will recur.** Four probes exist for the sole purpose of
> proving this switch holds, and they **self-skipped when the switch was on**. In the run summary
> they appeared only as "4 skipped" — no failure, no warning, no colour. A skipped guard reads
> exactly like a guard that passed. The gap was found by reading *why* a number was 4, not by any
> check going red. **A guard that disables itself in the state it guards against is not a guard.**
>
> ✅ **Fixed 2026-08-04:** those four now **fail loudly** and name the misconfiguration instead of
> skipping. When the tier is legitimately turned on after sign-off, that block gets deleted as a
> deliberate decision rather than quietly stopping.
>
> ⚠ **And the skip was hiding a probe that was broken anyway.** Once it started running, the fourth
> guard turned out to have never worked — the same latent fault found in the family suite. It runs
> now. **Two layers of silence over the same gap**, worth remembering the next time a suite reports
> a skip.
>
> **Tier 1 now runs 72 probes with nothing skipped and nothing failing** (it was 68 passing and 4
> silently skipped before this).

**⬜ STANDING PRE-RELEASE CHECK — re-answer this every release, it is not a settled fact:**
- [x] **Is the guardian tier switched off in PRODUCTION?** The setting must be **absent** from the
      production environment (the code defaults to off when unset). *Answered 2026-08-04: absent. ✅*
      ⚠ **This has to be re-asked, not remembered.** Someone can set that variable in a month and
      nothing in the app will announce it — the automated guards only see this machine. Until a
      counsel sign-off is recorded, a  here means a consent flow covering a child's
      information is live, which is an incident rather than a QA finding.

**Do not attempt the rest until sign-off is recorded and the switch is turned on.** Until then the
correct behaviour is refusal, which is the only thing worth checking now:
- [x] 🤖 Open the family link and choose the **parent/guardian** option: you get an honest "not open
      yet" hold state that points you at the follower path — **not** a hidden option, and **not** an
      accepted request parked somewhere.
      *Cleared: the join page reports the tier as off (so the browser is never the thing deciding),
      a well-formed guardian request with every consent ticked is still refused, and it **writes
      nothing** — the refusal is the gate, not validation happening to reject it. A coach invite
      also cannot be claimed while off.*
- [x] 🤖 No guardians card appears on any player page.
      *Cleared at the source: the coach-side guardian routes do not exist while the tier is off.*

**When the switch IS turned on, this is the walk:**
- [ ] Parent requests as a guardian, typing their child's **full name** + consents + age band →
      lands in the coach's queue. The form must show them nothing from the roster.
- [ ] The request appears on **every player's card** with the typed name and an explicit
      **"Approve as {player}"** — the coach's assertion that this adult belongs to THIS child must
      be visible in the button, not implied. *(Parent-initiated requests were invisible to every
      coach screen until review caught it.)*
- [ ] **Two households:** a verified guardian invites the second adult; a **third** is refused
      cleanly with a plain message, and the refusal holds even if two coaches approve at the exact
      same moment.
- [ ] **Coach invite → claimed at that same address** ⇒ connected with no second approval.
      **Claimed at a DIFFERENT address** ⇒ goes to the queue, and the row now shows **the address
      the person actually holds** beside the one you invited, saying the mismatch is why it's
      waiting. *(This was the blocking follow-up; fixed 2026-08-01.)*
- [ ] An **unclaimed invite cannot be approved** — it reads "waiting for them to accept" with a
      cancel. Approving one used to mint a guardian with no account and permanently consume a seat.
- [x] 🤖 **THE STANDING BOUNDARY — run this every release:** an approved **follower** requesting any
      guardian payload (the player band, the announcements archive, a season recap) must fail
      closed. And a guardian of one child must reach nothing about another.
- [ ] Guardian sees: their child's band, the announcements archive, and — once the season closes —
      the season recap (§1.7).

### 1.7 🖥 The coach byproducts (Chunk D Slice 3) — **LIVE ON PRODUCTION**
*Four things your coaching work now produces on its own: an after-game email already written, a
season recap per player, printable certificates, and two "is anyone using this?" counts.*
Plan: `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` §9.4 (build record + deviations).
~~⚠ Migration 219 is DEV-ONLY.~~ **Applied to prod 2026-08-03.** ⚠ The family-delivered half (the recap a parent reads, the
keepsake) is **dark until the guardian switch flips after counsel** — everything below is the
coach-side half and works today.

- [ ] **Draft the family email.** Schedule → open a game → save a final score. A *Draft the family
      email* line appears under the score; tap **Draft** → Email families opens with subject and
      message written (result + what's next) and a note saying where the words came from. **Nothing
      sends until you press Send.**
- [ ] Same game, **no score yet** → no draft line. **Cancelled** game → no draft line. A **finished
      season** → no draft line anywhere (a closed season must not offer to email a team that's done).
- [ ] After sending that draft, the "we drafted this" note is **gone** and the box is empty. Then
      **Reuse** a past announcement — the note must not reappear over someone else's old words.
- [ ] The draft's **"Next up"** names a genuinely upcoming event. *Sharpest case:* enter scores for
      TWO games on the same day, then draft from the first — it must not announce the second (which
      already happened) as next up.
- [ ] **Recap preview.** Roster → a player → **Family season recap** → **Preview**. You're seeing
      the parent's actual screen. Check attendance, "worked on this season", awards, playing time.
- [ ] **The honesty check — do this on a sparse player.** Pick someone with no development entries
      and no awards: those sections must be **absent entirely**, not empty boxes, not "no data yet",
      and nothing may imply you neglected them. A player with nothing at all recorded gets a short,
      plainly-worded state instead of a hero with holes under it.
- [ ] A test reading reads as **first → latest, as a fact** — no arrow, no green/red, and never the
      word "improved". *(We can't know whether faster or higher is better for your own test.)*
- [ ] Preview is **absent on a finished season** (live-season only, by design — see the open
      decision below).
- [ ] **Certificates.** Insights → "Who's earning it?" → print icon on any row. Then filter to one
      award type → **Print N certificates**. Letter, **landscape**, team colour frame, org name,
      award, player's **full name**, team · season, your note if you left one, and a signature line.
      *(Turn on "background graphics" in the print dialog or the frame won't render.)*
- [ ] **Recap count.** Season's End on a closed season → a **Family season recaps** line reading
      "N of M connected families have opened…". It should be **absent** on a season where no family
      was ever connected (a "0 of 0" would read as failure rather than "nobody signed up").
- [ ] **Club rollup.** Admin → Rep Teams: team cards show **Families** and **Waiting**, plus a
      club-wide line under the title. Counts only — confirm there's nowhere to click through to a
      family's name or email, and that a team with nobody connected shows neither number.
- [ ] Help: the Schedule's **"?"** now reaches the postgame-draft explanation; searching the coach
      guide for *certificate*, *season recap*, *keepsake* and *draft the family email* all land.
- **Open decision for you (not a defect):** the recap preview is live-season only, which is the
  archive's fail-closed default. Should a coach also be able to open a **past** season's recap to
  see what a family is reading? Small either way; your call.
- Known + accepted (recorded, not fixed): the club "Families" total counts links across all
  seasons, so a rolled-over team includes last season's guardians; and family-adoption counts have
  no row cap for a very large club (matches the existing sibling behaviour).

### 1.9b 🖥📱 Helpers — the parent who runs a station (Practice Plans Phase 4) — **LIVE ON PRODUCTION**

> **Mockups you approved:** `claude.ai/code/artifact/ebf2b469-88d7-4b09-b1e8-151c3e7d4773` (10 frames).
> **Where:** Team → **Staff** (the invite) · and a second sign-in as the helper.
> **No migration.** Nothing to apply. ⚠ 22/22 layout probes green at 361 / 390 / desktop; 1165 unit tests green.

**The point of it:** you can hand a parent the station they're running, on their own phone, without
printing a sheet with ten children's names on it that then goes home in someone's pocket.

**⚠ THIS ONE NEEDS A SECOND ACCOUNT.** The helper's own screens can only be judged by signing in as
one — invite an address you control, accept it, and look at the portal through their eyes. **The
probes could not cover any of this** (the test harness has one coach, and he's a head coach), so
what you see is the only verification these screens will get.

**The coach's side**

- [ ] **The choice comes first.** Open **Staff**. Before the email box there's *"Who are you
      inviting?"* with **Helper** and **Assistant coach**. Helper is preselected — that's deliberate,
      it's the smaller grant. Tell me if that default feels wrong.
- [ ] **Read the card underneath, as if you didn't build this.** It says what a helper *gets* and
      what they *never* get, in sentences. **Does it tell you enough to hand a stranger this access
      without worrying?** That is the entire job of that card — if it doesn't, say so.
- [ ] **The chat line.** One item on that card is marked differently: *"Your staff chat — helpers are
      never in it."* Until now, everyone on your staff list was in that room automatically. Check the
      line actually lands — it's the one thing you'd otherwise assume wrong.
- [ ] Switch to **Assistant coach** and the card changes to what an assistant gets, and the email
      label changes with it.
- [ ] **On your phone at 361/390.** The two options stack, both descriptions are readable, and
      nothing scrolls sideways.
- [ ] **A helper in the list has no permission grid.** Not a greyed-out one — none. That's on
      purpose: they hold none of those switches. **Make assistant coach** widens them in one tap with
      no re-invitation. Confirm removing one still reads clearly.
- [ ] **⚠ Your existing assistants are untouched.** Open an assistant's card: **Schedule** is now two
      switches (*see* it, and *change* it) and **Staff chat** is a switch too — **all of them still
      on**. Nothing should have been taken away from anyone. If any assistant lost anything, stop and
      tell me.

**The helper's side — sign in as them**

- [ ] **They land on the practice, not a dashboard.** One button: **Open my station**. Count how many
      taps it takes them to see their group. It should be one.
- [ ] **What's in the sidebar.** Should be the schedule and essentially nothing else. **No roster, no
      Development, no Insights, no Chat, no Settings, no Money.** If you can see a door they can't
      use, that's a bug — tell me which one.
- [ ] **Inside their station:** their group by name and number, what they're doing, what they're
      watching for, the coaching points. **No focus areas, no notes about any child.**
- [ ] **⚠ No Rotate now / Next block.** Instead a line naming you: *"<your name> moves everyone on."*
      Judge whether that reads as helpful or as a limitation being explained at them.
- [ ] **A day with no practice** — they should see when the next one is, with a real date and place.
- [ ] **A practice with no plan written yet** — they're told so, and told there's nothing to do. Make
      sure it doesn't look broken.
- [x] 🤖 **Try to get somewhere they shouldn't.** Paste a roster or Development URL into their browser.
      It must refuse, not show a blank page with the data underneath.
      *Cleared on six surfaces — roster, one player, the development board, the season review,
      attendance, and past practice plans. Each refuses, AND each refusal body was checked to carry
      neither the child's name nor the guardian address. This is the first time a real helper
      account has been probed; the existing helper spec covers only the head coach's side of it.*

### 1.9c 🖥 A1 — the roster switch is gone (2026-08-03) — **ON DEV `d8316e87`** · no migration

> **Mockups you approved:** `claude.ai/code/artifact/1f7c75ac-b7bc-42c7-b4bf-69fe71a70a5a`
> **Where:** Team → **Staff** (the duty grid) · the Roster and Insights pages · a second sign-in as a helper.
> **No migration. No new switch.** typecheck ✓ · 1174/1174 unit tests ✓ · 0 lint errors · all guardrails green.

**The point of it:** the "Roster: Hidden" switch was a promise the product couldn't keep — four
screens obeyed it and four ignored it. It's gone, names are visible to your whole staff, and the
switch that actually protects something (Contacts & birthdates) is untouched.

**The head coach's side**

- [ ] **Open Staff and look at an assistant's card.** The **Roster Hidden/View** control is gone.
      In its place, under the Everyday coaching switches, there's a line: *"Players' names and
      numbers are visible to everyone on your staff. Their contact details and birthdates are not —
      that's below."* ⚠ **Tell me if that sentence earns its place or reads as clutter** — it exists
      so you don't go hunting for a switch that no longer exists.
- [ ] **Check Contacts & birthdates still behaves exactly as it did.** Grant it, confirm the prompt
      still warns you properly, revoke it. **This is the one way this change could have quietly
      weakened something real** — it's the standing item you flagged when you ruled A1.
- [ ] **A helper's card still says "Helper."** Not "Assistant." That word is worked out from their
      switches, and the retired one was part of the sum — if it says Assistant, the fix didn't take.

**The assistant's side (second account, or promote a test helper)**

- [x] 🤖 **Grant an assistant team money and nothing else.** Open the dues page as them. **Names should
      appear beside the amounts** — that's the case that prompted your ruling. Previously they'd
      have seen "Player #12" and had to phone you.
      *Cleared **at the source, not on the page**: a money-only assistant's roster payload — which is
      where the dues screen gets its names — carries the player's first and last name, and does NOT
      carry the guardian address. The rendered dues screen itself is still worth your glance.*
- [x] 🤖 **An ordinary assistant can still open past practice plans.** Development → the practices
      list → open one from a finished season. ⚠ **This is the one place this change could have
      NARROWED** rather than widened — assistants reached it through the retired switch.
      *Cleared: an assistant on the plain defaults (`notes: false`) still gets 200 on a past
      season's plan, and a helper still gets 403 on the same URL.*

> 🤖 **Machine pass 2026-08-04** — `tests/uat/scenarios/coach-record-access-boundary.spec.ts`.
> ⚠ **This section has never been released** (it was the only such Tier 1 item on 2026-08-03; groups
> 1A, 1D and 1E have since joined it), so the machine pass here is a real gate rather than
> damage-finding. Both A1 risks were probed and
> neither fired: the contacts gate still withholds (a money-only assistant gets names and **not** the
> guardian address), and past practice plans did **not** narrow (an ordinary assistant still opens
> them, a helper still cannot). A row still carrying the retired pre-A1 `roster`/`planPlayerNames`
> keys was also probed — it neither opens nor holds a door, which is what "no migration needed" has
> to mean in practice.

**The helper's side (second account — same one as 1.9b)**

- [ ] **Their menu is unchanged:** the schedule and their practice plan. **No Roster, no Attendance,
      no Development, no Insights.** If any of those appeared, the section gate didn't hold.
- [x] 🤖 **Names still show on their practice plan** — that must not have regressed.
      *Cleared: a helper's own live practice-plan payload carries the player's name and NOT the
      guardian address — the whole shape of A1 in one response.*
- [x] 🤖 **Close the season and sign in as them.** They should meet *"This season has finished"* —
      **not** the team's season review with the share button on it. ⚠ **This is the regression this
      work exists to prevent**; it's the door you closed in the same sitting you ruled A1.
- [ ] **Try to reach the season review the other five ways**, as the helper: sign in at the portal
      root (it used to redirect you straight into it), the archive menu, both team pickers, and by
      typing the address. **Every one should land on "This season has finished."** Phase 4 only
      closed the sixth — the one nobody walks through.

**Your own side of the removal fix**

- [ ] **Remove a helper or assistant from a live season.** The confirmation should read *"loses
      access to this team immediately."* — unchanged when they're only staff.
- [ ] ⚠ **Now the case that was broken.** Add the same email address as a **family follower** on the
      Roster page, then remove that person from **Staff**. The confirmation should now say their
      coaching access ends, **and** that they still follow the team as a family member and will keep
      seeing your schedule and results, and point you at where to end that too. Their staff card
      should also carry a quiet *"Also connected to this team as a family member"* line. ⚠ **It's a
      note, not a button** — the two records stay separate on purpose, so there's deliberately
      nothing to click.
- [ ] ⚠ **The one thing with no automated cover.** That family note is the only piece of this work
      no test exercises (it needs real database rows, which the unit suite can't make). Worth two
      extra minutes: confirm it does **not** appear for someone whose follow request is still
      **waiting for your approval** — the first version of this got that wrong and would have told
      you they keep seeing your schedule when they can't see anything yet.
- [ ] **Open a finished season's Staff list.** The family note should be **absent** there — it
      describes today, and a past season should only ever show you what was true at the time.

### 1.11 🖥📱 Tryout Insights — report · development baseline · candidate memory — **LIVE ON PRODUCTION**

> **Mockups you approved (binding):** https://claude.ai/code/artifact/3b8bf1f9-c1c5-407c-9fa6-376a5bf8fee2
> **Where:** Coaches → **Tryouts** → the **Decide** and **Build team** tabs, plus any player's
> Development page.
> ~~⚠ Migration 223 is applied to DEV only.~~ **Applied to prod 2026-08-03 with 211–224; zero drift.**
> ⚠ **No rendered-layout check was run** (it needs a live dev server), so the memory strip's
> appearance — **especially the phone stack** — has had no automated eyes on it at all. Judge it hard.
> ⚠ **Needs a tryout with at least one PRIOR season of tryout data** to exercise the memory half.
> A first-season team correctly shows none of it — which is right, but tests nothing.

**The point of it:** the tryout stops being a one-day tool. It leaves behind a document you can hand
your board, a starting point for every new player's season, and — at the moment you're deciding —
what this kid looked like the last time they stood in front of you.

> 🤖 **Machine pass 2026-08-04** — `tests/uat/scenarios/tryout-blindfold-boundary.spec.ts` (17 probes).
> Every absence check is paired with its opposite: the same probe is run with the blindfold OFF and
> must then carry what it withheld. Without that pairing all of these would pass against a route
> that simply returns nothing.

**Phase 1 · the report** (Build team tab)
- [ ] **The funnel tells the truth about drop-off.** Registered → Attended → Evaluated → Offers
      extended → Accepted → On roster, with honest captions ("3 never checked in", "1 declined").
      Check each number against what you know actually happened.
- [ ] **⚠ "Offers extended" vs the Decide tab's "offered" — these are ALLOWED to differ**, and I
      relabelled the report row so they stop looking like the same number arguing with itself. The
      report counts every offer you **ever** made; the Decide tally counts who is offered **right
      now**. Offer someone, then change your mind, and the report should still count that offer.
      *(Frame 01 said just "Offered" — this is a deliberate deviation. Tell me if it reads wrong.)*
- [ ] **The fairness receipt states only what's true.** Run a tryout with **no blind mode** and
      confirm the blind line is **absent** rather than reworded. Never scored anyone? The whole
      receipt block should be gone, not empty.
- [ ] **Board summary (PDF)** — totals and roster names only. Confirm there is **no child's score and
      no cut decision anywhere in it**; this is the one you'd hand a parent.
- [x] 🤖 **Full detail (PDF/Excel)** sits behind a confirmation that names the consequence. While names
      are still hidden it must be **unavailable** — not merely warned about.

**Phase 2 · development baseline** (Build team tab, below the report)
- [ ] **Seed one.** After accepting anyone, **Start development from tryouts → Begin**. Walk two or
      three players.
- [ ] **⚠ "Don't add" must write NOTHING.** Answer it for every suggestion on one player, finish, then
      open that player's development page and confirm **no focus area was created**. This is the whole
      promise of the step.
- [ ] **A player nobody scored** should say so plainly and let you set focus by hand — never block.
- [ ] **Re-run the walkthrough.** Already-seeded players should be marked done and skipped. Then edit
      your scorecard and confirm an existing baseline is **not** rewritten.
- [ ] **On the player's development page**, the snapshot is visually **apart** from measurables
      (dashed edge) and says it's coach-eyes-only. Confirm it does **not** join any trend line.

**Phase 3 · candidate memory** (Decide tab)
- [ ] **⚠ THE FLOW THAT WAS BROKEN — test this first.** With names still hidden, open Decide (bibs
      only, no history — correct). Go to **Set up → Reveal names**. Come back to **Decide
      WITHOUT refreshing the browser**. Names must appear and the strips must load. *(This failed
      until review caught it — a mount-once load meant you'd have concluded the feature didn't work.)*
- [ ] **Confirm a returning player, still without refreshing.** Tap **Possible returning player —
      verify**, confirm the match, and the memory strip must appear **immediately** on that row.
- [ ] **The comparable case:** both years on the same scale → last season's score, this season's, and
      a **▲ +0.7**-style change between them. **Compare categories** opens it skill by skill.
- [ ] **⚠ The incomparable case — the honesty test.** Two seasons on **different scales** (1–10 then
      1–5) must show **both cards and NO arithmetic**, with a line naming the two scorecards. If you
      ever see a delta across mismatched scales, that's the defect.
- [ ] **An unverified match shows NO scores.** A "Possible returning player" you haven't confirmed
      gets the verify button and nothing else.
- [x] 🤖 **⚠ THE BLINDFOLD — check the absence.** While blind evaluation is on, confirm there is **no
      prior-season anything** on the **field scorer**, the **live scoreboard**, or **check-in**.
      Check-in's existing "tried out in {season}" marker is identity only and unchanged — that one
      stays. A bib number must be just a bib number.
- [ ] **The report's group line** (Build tab, under Turnout): with **3+** verified returning
      candidates comparable on one scale, it states how the group moved. With **1 or 2**, it must be
      **absent entirely** — silence, not a hedged sentence.
- [ ] **📱 Phone (390 and ~360).** The two seasons should **stack** with the change between them, and
      the decision buttons stay full-width and reachable. **Nothing automated has looked at this.**
- [x] 🤖 **As an assistant coach without tryouts access:** no tryout surface at all, as today.
      *Cleared across six tryout routes — memory, scoreboard, candidates, report, overview and
      decisions — using an assistant who holds money, contacts, notes and documents but NOT tryouts,
      so the grant is provably the thing gating candidate PII rather than seniority in general.*
- [ ] Read the guide: **Help → How to run tryout day**, and the new FAQ *"Can I see how a returning
      player did at last year's tryout?"*

### 2.6a 📱 The family experience on a real phone (Chunk D) — **LIVE ON PRODUCTION**
*Moved out of §2.6 on 2026-08-03. These four are the only phone passes in the ledger where being
wrong reaches a child rather than a layout. Wording unchanged.*
**⚠ A real iPhone. Headless Chromium cannot answer any of these** — two defects in this repo's
recorded corpus existed only on a notched iPhone and in iOS Safari's touch handling.
- [ ] **Chunk D 0–2 — do this one as a FAMILY, on a real phone, not as a coach.** The whole
      follower experience is phone-first and arrives from a group chat: open the family link on a
      phone, request, get approved, and confirm the schedule opens **scrolled to the next event**
      without you scrolling. Then subscribe the calendar into the phone's own calendar app.
- [ ] Chunk D 1: open a **shared game link** on a phone with **no account and no app installed** —
      the grandparent case this feature exists for.
- [ ] Chunk D 3: save a score on a phone → **Draft the family email** is reachable and the compose
      screen opens with the words in it (this is a real game-day-on-the-sideline moment).
- [ ] Chunk D 3: the recap **preview** on a phone — the stat tiles should stack to one column on a
      narrow screen rather than squashing to two.

---

## Group 1C · Money

A family billed wrongly, or a coach handed a number we invented. The rule that runs through all three:
**no dollar figure ever originates from us** — template amount cells ship empty.

### 1.2 🖥 Budget starter (Chunk G) — **LIVE ON PRODUCTION** · ⚠ review funnel still owed
*First-season coach answers 5 tap-only questions → seeded budget worksheet; no dollar figure ever comes from us.*
Plan stays ACTIVE (its /simplify → /review → /docs pass is still owed; QA can proceed — expect a
possible small follow-up after the funnel). Plan: `archive/COACH_PORTAL_CHUNK_G_BUDGET_STARTER_PLAN.md`. *(No owner checklist in the doc — steps below are the sketch.)*
- [ ] Zero-budget team, write coach: Season Budget Plan shows the first-run card with three doors
      (Start · See a finished example · Add lines yourself).
- [ ] Run the 5-question starter: worksheet placeholders are literally "$" — **no numeric hint
      anywhere**; type some amounts, leave others blank; priced → real lines, unpriced → the
      "Not in your plan yet" strip; ×N entry-fee helper shows its arithmetic at 2+ tournaments.
- [ ] Checklist strip chip opens Add Line prefilled with category/item, amount EMPTY.
- [ ] Sample sheet (all three entry points): clearly fenced fictional team, zero write affordances,
      both tabs render.
- [ ] Read-only money assistant: NO starter, NO strip, NO Add Line — sample door only.
- [ ] Eyeball the five flagged mockup deviations (segmented control, square tick, olive text,
      conditional ×N helper, arithmetic-in-note) — approve or flag.

### 1.3 🖥 Money by Month (Chunk H) — **LIVE ON PRODUCTION**
*Spreadsheet-shaped months view + generalized payables page + 3-template import/export.*
Archived plan: `archive/COACH_PORTAL_CHUNK_H_MONEY_BY_MONTH_PLAN.md`. *(No owner checklist in the doc — sketch below.)*
- [ ] Months view on a data-rich team: rows/columns/totals sane; four lenses cycle; Difference
      shows "—" for future months, never a false "under budget".
- [ ] Cash-flow rows: a shortfall month is called out in plain words.
- [ ] Second-season team: prior-season column + "last season only" group.
- [ ] Cell drill-ins open EXISTING forms (never a new editor); read-only assistant gets read panels,
      no drill-in, no import.
- [ ] "Expenses & Payables" rename + new Payment schedule tab (Unpaid default / Paid / All).
- [ ] Import: download a template — **every amount cell empty**; paste rows; editable preview with
      per-row verdicts; nothing writes until confirmed; zero-row commit reports failure honestly.
- Notes: month grid deliberately scrolls sideways on phones. The cumulative chart changed on
  purpose (undated budget no longer smeared across months) — flag, don't file.

### 11 🖥📱 The Money Overview on a season that hasn't started — ✅ **OWNER QA PASSED 2026-08-12** (two passes) · no migration
> **Close-out note, 2026-08-12.** The owner walked both passes and passed them, then asked for `/review`.
> The review then **changed behaviour they had already looked at** — the two-column fold threshold was
> raised because the first value folded on tablets and flickered on resize. What the owner verified on a
> wide desktop is unaffected (still two columns, same split, same order). But the **five checks marked
> `[ ]` in the second-pass block below post-date their walk and no human has looked at them** — they were
> proven by measurement across fourteen widths, not by eye. Left unchecked deliberately rather than
> ticked on my own evidence; they are cheap to sweep on the next pass through this screen.
>
> Every box below is left exactly as the owner set it — which lines they exercised one by one isn't mine
> to record, so nothing here is ticked on my evidence. The five that matter for a follow-up are the ones
> about **resize behaviour, tablet portrait, the in-season rail at every width, the archived season's
> column hairlines, and the columns' feet.**
*Owner-reported: four numbered sections and six "nothing here yet" cards below the tab bar on a team
with nothing set up. The 1·Plan → 4·Review stack is now gone at every stage; both Overview shapes
end in one index. Mockup: Claude artifact `f28ebd03` (option A). Deployment state lives in the
release-history record, not here.* **Fastest setup:** `node scripts/seed-qa-day-fixtures.mjs` — it
prints the direct link to the deliberately-empty **QA Money U11** team, which is the first state
below. Re-running resets it.
- [ ] **Brand-new team, nothing entered.** Money → Overview is the guide card ("Start with your
      season budget") and **one list underneath**. No 1·Plan / 2·Collect / 3·Spend / 4·Review
      headings anywhere. No $0 tiles. No "What's coming up" panel.
- [ ] The list is headed **"Everything in Money"** and shows **all seven screens** with a status
      each — Not started · Not set · None yet · None logged · None assigned · None pending · Needs
      a budget — grouped under quiet **Plan / Collect / Spend / Review** markers, in that order.
- [ ] Every row goes somewhere: tap each one and land on that tab, with the tab bar following.
- [ ] **On a 390px phone**, the whole thing fits without hunting: guide card, its lime button, and
      the list. The card's second paragraph (dues → reminders → tryouts) is **absent on the phone
      and present on desktop** — that is deliberate, not a truncation bug.
- [ ] **Budget built, dues not generated.** The four tiles (Money In / Out / On Hand / Headroom)
      **come back** as soon as any money has moved, with the cash-basis sentence above them. A
      budget alone does NOT bring them back — a plan is not cash.
- [ ] Same team: the rail's rows now carry **real figures** ("$12,400 set", "$1,200 raised"), and
      "What's coming up" appears only once something can actually fall due.
- [ ] **Running season** (dues out, payments in): the Overview is unchanged from what passed QA —
      three story cards, the Next-30-days ledger, and **"More in Money"** below. Confirm the rail
      still lists the same five rows in the same order and nothing gained a step marker.
- [ ] Running season with an empty next-30-days: the ledger still shows its **all-clear line**.
      That is correct — it is an answer, where on an empty team it was noise.
- [ ] **A finished (archived) season**: the Overview still opens, the rail is there, and the
      forward-looking panel/ledger is absent. Org Allocations and Payment Requests do not appear.
- [ ] **A read-only assistant coach**: same Overview, no write affordances, no lime button.

**Came out of `/review` — worth a look because they change screens that already passed QA:**
- [ ] **A row never trades its money for a warning.** On a team with overdue dues, the Player Dues
      row reads "$400.00 of $900.00 · 2 overdue" — both, not just the count. Same on Expenses
      ("$640.00 paid · 2 due") and Org Allocations. This shows on the **in-season** dashboard too.
- [ ] **Budget vs. Actual with no budget** reads "Needs a budget", not a dash — on both shapes.
- [ ] **The Overview refreshes when you come back to it.** From a team with no dues: open Budget,
      generate installments, then tap Overview. It must show the NEW state (the guide card moves on,
      the Dues row fills in) without a page reload. Watch for a flicker or a lost form: switch to
      Expenses, half-fill a form, go to Overview and back — the form must still be there.
- [ ] **A team carrying an unpaid allocation from LAST season** (org-linked, nothing set up this
      season): "What's coming up" must still appear and show that debt. This is the defect review
      found — an earlier build hid the panel using this season's counts and buried the old debt.

**Second pass, same day — the list folds into two columns on a wide screen.** Mockup: Claude artifact
`b4f5898b`. *Approved after the owner asked whether the rows were the right size for the screen; the
rail was 464px tall with ~800px of the width carrying nothing.* ⚠ **The fold threshold was RAISED
during `/review` (720 → 940px of card width) because the first value folded on tablets and flickered
on resize — measured widths below are post-fix and are what to check against.*
- [ ] **On a wide desktop window (1280 and up)**, "Everything in Money" is **two columns**: **Plan**
      and **Collect** down the left, **Spend** and **Review** down the right. The whole list fits
      without scrolling, and the hairlines between the step groups are gone in this state.
- [ ] **Read it as a coach would:** down the left column, then down the right, and the season is still
      in order — Plan → Collect → Spend → Review. Keyboard-tab through it: same order.
- [ ] **The step labels** (Plan / Collect / Spend / Review) are a touch darker here than the card's own
      "EVERYTHING IN MONEY" label, so they read as headings for the rows rather than as another card
      label. They stay lighter, and keep their hairlines, wherever the list is one column.
- [ ] **Drag the window narrower and watch it the whole way down.** It should switch to one column
      **once**, somewhere around 1250px, and then stay one column all the way to phone width. ⚠ **If
      it flips back to two columns anywhere on the way down — around 850px is where to look — that is
      a regression of the fix `/review` made.** It used to do exactly that, because the portal's
      sidebar appears around 940px and takes width back, so the card is briefly *wider* at 900px than
      at 1000px.
- [ ] **A tablet in portrait (roughly 820–860 wide) is ONE column.** Two columns there would be ~350px
      each, which squeezes the row names.
- [ ] **On a phone, nothing changed at all.** One column, rows the same height as before.
- [ ] **⚠ The in-season dashboard's "More in Money" must be UNCHANGED at EVERY width** — one column,
      five rows, in the narrow slot beside the Next-30-days ledger. Check it wide, at a tablet size,
      and on a phone. That rail never had the width problem and must never fold; this is the check
      most likely to catch a mistake here.
- [ ] **A finished (archived) season** does fold into two columns on a wide window — its list takes the
      full width because the forward-looking ledger is absent. Five rows, no step labels, three left
      and two right, and **both columns start with a hairline** (there is no step label to open them).
- [ ] **Row heights are unchanged everywhere** — the mockup's tighter desktop rows were deliberately
      not built (a touchscreen laptop reports a mouse, and would have been served small targets).
- [ ] **Both columns end level-ish.** No stray gap under one column's last row that the other lacks.

### 2.3 📱 Money on a phone (Chunk A) — **LIVE ON PRODUCTION**
Archived plan: `archive/COACH_PORTAL_CHUNK_A_MONEY_ON_A_PHONE_PLAN.md`.
- [ ] Budget line with period splits: full-width tappable fields; backdrop tap asks "Discard
      changes?"; "Keep editing" preserves everything.
- [ ] Budget vs. Actual: sideways-scroll hint; line names pinned; the page itself never scrolls
      sideways.
- [ ] Expenses (both tabs), Fundraiser leaderboard + Log Amount, Org Allocations: stacked cards,
      real full-width inputs; Allocations cross-links to Payment Requests.
- [ ] Money hub headline numbers agree on "(paid only)".
- [ ] Read-only assistant: same readable pages, zero write buttons, no blank card rows.
- [ ] Desktop: Budget vs. Actual uses the window width (no ~960px inner scroll column).
- [ ] No native browser alert anywhere in Money (a failed delete shows an inline error).

### 12 🖥📱 Every button in Money moved — **LIVE ON PRODUCTION 2026-08-14** (job 256) · migration **231** ✅ on prod
*Page-level action ruling 2026-08-13 (Phase 1). The hub header gains constant `Import ▾ / Export ▾`;
every tab's create drops into that tab's own control row; three exports that never existed were
written; the tab bar becomes navigation only.* Plan:
`active/COACH_HEADER_ACTIONS_CONSISTENCY_PLAN.md` §4.1. Binding mockup: artifact `44162825`.
**Setup:** the same `qa-money-lab` team as §11, plus one team with real budget lines, expenses,
payables and a fundraiser — the exports have nothing to say on an empty season and will tell you so
rather than hand you an empty sheet (that message is itself worth seeing once).

**The menus (desktop):**
- [ ] `Import ▾` and `Export ▾` sit left of the "?" and are **identical on all seven tabs** — walk
      every tab and confirm neither changes.
- [ ] `Import ▾` lists Budget lines · Expenses & payables · a divider · **Recent imports**.
- [ ] **There is NO Export in the Money header** — only `Import ▾` and the "?" (owner ruling
      2026-08-13, final placement; the hub-wide Export menu was built, then removed when Budget
      vs. Actual grew a second Export button).
- [ ] **Every tab has its own Export in its control row**, right-hand end: Budget Plan · Player
      Dues · Fundraisers · Expenses & Payables · Allocations · Payments · Budget vs. Actual.
      **Overview has none** (a dashboard, not a dataset).
- [ ] ⚠ **Budget vs. Actual has exactly ONE Export in BOTH views** — Categories and Months. This
      is the defect that started the change; check it first.
- [ ] **Each one exports what is on screen.** Switch Budget vs. Actual to Months and pick a
      reading (Budget / Scheduled / Actual / Difference) — the file matches. On Expenses, switch
      sub-tab and set a tag filter — the file follows both.
- [ ] **Picking Export opens a "Choose a file type" dialog** titled e.g. "Export Player dues".
      Each choice names the type, its extension, and what it is for. Escape, the X and a
      backdrop click all close it without downloading.
- [ ] Tab with nothing in it: the dialog says so **inside the dialog** rather than downloading
      an empty sheet.
- [ ] ⚠ **A read-only money assistant still sees Export on every tab** (reading is not writing)
      and no create buttons. A layout move must not have changed who can do what.
- [ ] Open each of the **three new** exports and read the file: budget lines carry a **Kind**
      column (Cost vs Expected funding — a fundraising target must not read as spending) and their
      payment months in one cell; expenses & payables come out as **one ledger with a Type column**;
      fundraisers show totals only and **never a per-player breakdown**.
- [ ] Player dues export: the **Status** word beside each player matches the word in the table.
- [ ] On a plan **without** PDF: PDF is **absent from the dialog entirely, not greyed or
      locked** — Player dues then offers Excel and CSV only. (Verified on the `tournament`-plan
      test org 2026-08-13; worth re-checking on a Club-plan team, where PDF should appear.)

**Phone (390px):**
- [ ] Money's header is **title and "?" only** — Import is gone.
- [ ] **Export is gone from the spreadsheet-only tabs** (Budget Plan, Fundraisers, Expenses,
      Allocations, Payments) and **survives on Player Dues and Budget vs. Actual as PDF alone**
      — on a plan that includes PDF. A phone gets things you can read, show or send.
- [ ] The empty budget and the empty payables list **still offer an import** at this width.

**The tabs:**
- [ ] Budget Plan: **+ Add Line** now sits in the List / By period row, **lime-filled**, and the
      header band that used to hold it is gone.
- [ ] Expenses & Payables: **+ Add Expense · + Add Payable** (both lime now) and **Manage tags** in
      the filter row; the button reads **"Import"**, never "Import payables".
- [ ] Player Dues: **Set dues for all players · Send Due Reminders** are above the table, and the
      "Sent N reminders" line still appears under them.
- [ ] Fundraisers and Payments each gained one thin right-pinned row with their create in it.
- [ ] **Payments with zero requests**: the create is still there (it is the only way to make a first
      one).
- [ ] Budget vs. Actual: no export in the header; switch to the **Months** view and the export
      appears beside the lens picker — and exports **the grid you are looking at**, not the
      category table.
- [ ] Nothing hangs off the tab bar, and the tab labels are still full words at every width.

**⚠ The phone (390px) — this is the half most likely to be wrong:**
- [ ] Money's header is **title and "?" only** — both menus are gone.
- [ ] **An empty budget still offers "Import a spreadsheet"** in its first-run card, and the paste
      tab inside works with no file picker.
- [ ] **An empty payables list offers "Import a schedule"** — this door is new; without it the
      paste path would be unreachable on a phone.
- [ ] Every button in a tab toolbar is comfortably tappable (nothing thin or short).

**Access:**
- [ ] **Read-only money assistant**: sees `Export ▾` and **no `Import ▾`**, no creates in any tab
      toolbar, no import door in any empty state.
- [ ] **Archived season** (past year): no `Import ▾` at all; exports still return that season's data.

**Recent imports (new record — migration 231):**
- [ ] Import a small budget, then open `Import ▾ → Recent imports`: it names the dataset, the sheet
      shape, the counts, when, who, and whether it was pasted or a file.
- [ ] Import **while sitting on a different tab** (e.g. start on Fundraisers): the Budget Plan tab
      shows the new lines when you switch to it, and **any half-typed form you left on another tab
      is still there**.
- [ ] An import where every row fails does **not** appear in the history.

---

### 13 🖥📱 A dues payment is a record — Pass 1, the receipt book — **LIVE ON PRODUCTION 2026-08-14** (job 256) · migration **232** ✅ on prod

**What changed:** a payment is now its own record. Player Dues gains a **Record payment** button in
each player's drawer (amount · date received · method · note); the sheet states where the money
lands before saving. The Paid column finally includes part-payments; a part-covered installment
reads **"$200.00 of $300.00"** in amber instead of "Unpaid"; Mark Paid becomes a one-tap shortcut
that records whatever is still uncovered (it can never double-charge); a payment row can be removed
(voids its ledger line — the undo mark-paid never had). Money arriving beyond the schedule
auto-becomes an overpayment credit (owner ruling — no prompt), labelled `auto` in Credits with no
delete of its own. Every dues installment ever marked paid (both DBs at release) became one
migrated payment adopting its existing ledger entry — history should read identically.

Plan: `COACH_DUES_PAYMENT_RECORD_PLAN.md` · mockup artifact `ccc923b8`. **Pass 2 (same day) put
every READER on payment facts too:** the Money-hub Collections tile, Budget vs. Actual's
dues-collection card, the month grid's cash-flow ACTUAL (now bucketed by the month money
ARRIVED), the Dues-Coming-Due panel (quotes remainders), the Budget tab's collected figure, the
roster player profile's dues summary, and the Season Refund Calculator's balance column. The dues
table's footer "Outstanding" was renamed **"Balance owing"** (it always summed the credits-
subtracted balance; "Outstanding" is the credits-excluded figure the digest quotes). **Pass 3 (same day) closed the edges:** reminder emails now chase the REMAINDER and thank the
family for what's arrived (all three paths); the bulk dues re-run keeps payments for everyone
and rewrites the plan (payments beyond a new total auto-credit); the weekly digest's due-date
line quotes remainders; and the coach demo + QA fixtures seed payment records behind every paid
stamp. Refund credit provenance deliberately descoped (plan, Pass 3 log). **Owner follow-up
same day:** the Automatic Dues Reminders card is now ONE compact row with a "See an example"
button — a modal explaining when every reminder goes out over a rendered sample of the real
email (same template as the send, so it can't drift).
- [ ] **Reminders row + example**: the row reads in one line; "See an example" opens the modal;
      the sample email shows one full row and one part-paid "thank you, $200.00 of $300.00" row;
      close by X or clicking outside; the toggle still flips and persists.

**✅ /simplify + /review RUN 2026-08-13 (high-risk, 5 lenses) — 2 Criticals + 1 High + 5 Mediums
confirmed and FIXED** (symmetric overpayment-credit reconciliation on every schedule/money
change; the per-player Edit-schedule path stopped vanishing overpaid money and now re-projects;
the Basic→Premium upgrade writes payment records behind carried-over paid fees; Mark Paid
regained concurrency-safe idempotency and covers the clicked installment; ownership check;
books-safety hardening). Two review checks join the walk:
- [ ] **Raise dues after an overshoot**: record more than a player's schedule (auto credit
      appears), then re-run Set dues for all players with a HIGHER total — the auto credit
      shrinks/disappears and Balance owing reads total − payments exactly.
- [ ] **Lower one player below what they've paid**: Edit schedule down past their payments —
      an "Overpayment (dues changed)" credit appears (this one has a delete button), status
      reads In credit, and installments show covered.

**Pass 2 additions to the walk (~5 min, same fixture):**
- [ ] With the part-paid player from above: Money hub **Collections tile** shows their $100 in
      collected; if their installment is past due, the overdue amount counts only the **missing**
      part, and a fully-covered-late installment counts nothing.
- [ ] **Budget vs. Actual → month grid, Actual lens**: each recorded payment lands in the month
      of its **received date** (backdate one a month to see it move); the dues-collection card's
      collected includes part-payments.
- [ ] **Money Overview → what's coming up**: the part-paid installment's row quotes the
      **remainder** (and shows the player's name instead of grouping).
- [ ] **Roster → player profile**: the dues line shows the part-paid dollars.
- [ ] Dues table footer now says **"Balance owing"** where it said "Outstanding".

**The one walk that matters (~10 min), on a dev team with dues set ($300×4 quarterly works):**
- [ ] Record **$100, e-transfer, dated last month** on an unpaid player. Drawer: Payments section
      appears with the receipt; installment #1 shows **$100.00 of $300.00**; table row: Paid
      $100.00, Balance drops $100, Status **Partial**.
- [ ] The chase card ("N have not paid yet") **no longer counts them**, and per-player Remind is
      gone from their drawer. Ask the Front Office "Who hasn't paid anything yet?" agrees.
- [ ] Org-admin ledger (Accounting → team ledger): a **"Player dues — {name}"** income entry dated
      **the day you typed**, not today.
- [ ] Record **$250 more**: #1 flips to Paid (dated the completing payment's day), #2 shows
      $50.00 of $300.00.
- [ ] **Mark rest paid** on #2: it records only the $250 remainder (check the new payment row and
      the ledger amount — NOT $300).
- [ ] Record more than everything left: the sheet warns inline, saving creates an **Overpayment**
      credit marked `auto` (no trash can on it), player goes **In credit**.
- [ ] **Remove** that last payment: the credit disappears with it, the ledger entry shows **void**,
      coverage rolls back.
- [ ] A player marked paid **before today** (migrated): drawer shows one payment per old stamp,
      note "Migrated from installment #N marked paid", dated the original day; removing one is
      possible (it voids the original ledger entry — that's intended; don't do it on a row you
      want to keep).
- [ ] **Read-only money assistant**: sees Payments list, no Record payment, no trash cans, no
      Mark Paid (that button was reachable read-only before this pass; the server always refused).

### 13b 🖥📱 The ledger says where the money went — **ON DEV 2026-08-14**, not yet released · no migration

Pass 4 of the payment record, all from one owner review of the screenshot above. Binding mockup:
`claude.ai/code/artifact/e73e9842-300d-484c-808e-f3c76bacf780`. Same fixture as §13.

**⚠ A LIVE PRODUCTION DEFECT WAS IN THAT SCREENSHOT.** Paid rows read the literal words **"Paid
Invalid Date"** — a date formatter written for a date-only column being handed a timestamp. Three
screens had hand-rolled one and all three were wrong: this drawer and the By-installment grid
printed "Invalid Date"; the admin rep-team allocation schedule read a bare date as UTC midnight and
showed every due date **one day early**. One shared formatter now takes both shapes.
- [ ] A **paid** installment row reads `✓ Paid <a real date>` — never the words "Invalid Date".
- [ ] Same player in **By installment** (the lens toggle): the covered cell reads `paid <date>` and
      agrees with the drawer.
- [ ] **Admin → Rep teams → an allocation**: each installment's Due date matches the date the coach
      sees for the same installment (this was a day early).

**The four columns.** Each installment now shows Installment / After fundraising / Paid / Owing, and
the four tiles at the top are those columns totalled — which is why the table has **no** totals row.
- [ ] Blair (or any part-funded player): the row arithmetic holds across — installment minus what
      fundraising covered equals **After fundraising**; minus **Paid** equals **Owing**.
- [ ] The four tiles equal the four columns added up. **Credits −$250** is gone; **After
      fundraising** stands in its place, and the green strip below still names the credit and offers
      **Pay out**.
- [ ] The **Note** column carries one sentence per row — `✓ Paid <date>`, or `$50.00 covered —
      <effort>`, or `✓ Covered by fundraising — <effort>`. Every row is **one line tall**.
- [ ] The drawer is wider than it was; the table does **not** scroll sideways on a desktop.
- [ ] A row with nothing to say (unpaid, no credit, not yet due) has an empty Note — that is
      correct, not a bug.

**📱 Phone — the collapsible list.**
- [ ] Each installment is **one line closed**: its due date, and either the amount owing (red),
      *Paid*, or *Covered*. An overdue one carries the ⚠.
- [ ] Tapping opens Installment / After fundraising (only when fundraising touched it) / Paid /
      Owing, the note, and the record button.
- [ ] The four season tiles are still at the top — that is where the season answer lives now.
- [ ] Nothing scrolls sideways at 390px.

**The record control — renamed, and shrunk to a tick on desktop.**
- [ ] 🖥 On a desktop row the control is a small **banknote tick**, not a filled button. Hover it:
      the tooltip quotes the amount and the date — *"Record as paid — $150.00, dated today"*. Click
      it and a real payment appears in the **Payments** list below, removable like any other.
- [ ] 🖥 Tab to it with the keyboard: it takes a visible focus ring and Enter records. (An icon with
      no name and no focus is the failure mode this design is guarding against.)
- [ ] 📱 On a phone the control keeps its **words** and appears **only inside an open card** — the
      collapsed bar must carry NO record button, because that bar is itself the tap target that
      opens the card.
- [ ] ⚠ Expenses, payables and allocations keep their own **Mark paid** buttons unchanged — do not
      expect those to become ticks.

**⚠ THE STATUS COLUMN NOW ANSWERS "IS THIS FAMILY BEHIND?"** — it used to grade season completion,
so a family paying every installment on time and a family a month late both read *Partial*.
`Partial` and `Unpaid` are gone; the words are **Past due · Up to date · Fully paid · Settled ·
In credit · Not set**.
- [ ] A player who has paid every installment that has fallen due, with more to come, reads
      **Up to date** — in ordinary ink, not green (green is reserved for finished seasons, so the
      column stays quiet).
- [ ] A player who has paid **nothing** but whose first installment is **not due yet** also reads
      **Up to date**. ⚠ This is the point — they owe nothing today, and the old "Unpaid" cried wolf.
      Their Paid ($0.00) and Balance columns still tell the rest of the story.
- [ ] A player with a bill past its date reads **Past due**, in red, **with a ⚠ beside it** (colour
      never carries the verdict alone).
- [ ] The count of **Past due** rows equals the footer's **"N overdue"** exactly. ⚠ These were two
      separate calculations before; they are now one.
- [ ] A player whose late bill was **covered by fundraising** is NOT Past due — credits settle
      bills, so nothing is being asked for.
- [ ] Export **Player dues** to a spreadsheet: the Status column says the same words as the screen,
      including *Past due*.

**The confirm, and the two new Edit doors** (owner-directed 2026-08-14).
- [ ] Clicking the banknote tick now opens a **confirmation** naming the amount, the player, the
      installment number and today's date — and saying it can be edited or removed afterwards.
      Cancel does nothing at all; confirming records the payment.
- [ ] **Edit a payment**: the pencil beside a payment opens the same sheet, prefilled. Change the
      amount and save — the Payments list shows the new figure, the season **Paid** tile moves with
      it, and the team's books show the old entry **voided** and a new one posted on the date you
      gave. ⚠ The old entry is not rewritten; both should be visible in the ledger.
- [ ] Edit a payment's **date** into a different month and confirm the money moves month in Budget
      vs. Actual's cash-flow row (payments are bucketed by the month they arrived).
- [ ] **Edit a credit**: a credit you added by hand (a contribution, a forgiven balance) carries a
      pencil; changing its amount updates **After fundraising** and **Left to send** immediately.
      ⚠ The credit **Type** is deliberately locked while editing.
- [ ] ⚠ **A fundraiser credit has NO pencil** — it reads *from fundraiser* instead. Same for a
      reimbursement (*from expense*) and an overpayment (*auto*). This is the point: those numbers
      belong to the record that created them.
- [ ] ⚠ **Lower a credit below what's already been paid out** to that family — it must be refused
      with the same message the delete gives ("remove the payout first"), not silently accepted.
- [ ] **Read-only money assistant**: no pencils anywhere, on payments or credits.

**⚠ THE RE-RUN GUARD — the most important walk here.** Until now `Set dues for all players` gave
every player the identical schedule, flattening any per-player arrangement in silence.
- [ ] Give ONE player a hand-set schedule (open them → **Edit schedule** → different amounts/dates
      from the rest of the roster; e.g. a deposit then a balance).
- [ ] Run **Set dues for all players** again with different dates. The "this roster already has
      dues" screen now **names that player**, says how many families' **due dates change**, and
      offers **two** buttons.
- [ ] Choose **"Keep the 1 I set by hand"** → the success screen says one player kept their
      schedule; re-open that player and their hand-set amounts and dates are **completely
      unchanged**, while everyone else has the new ones.
- [ ] Run it again and choose **"Apply to everyone"** → that player is flattened to the team
      schedule (this is still allowed — it must simply be the answer you chose).
- [ ] A roster with **no** hand-set schedules shows the old single **"Replace the dues schedule"**
      button and no name list.
- [ ] Payments still survive both answers (the §13 promise is unchanged).

**⚠ THE FIVE DEFECTS `/review` CAUGHT — walk these, they are the ones that would have hurt.**
- [ ] **A rolled-over season must NOT name the whole roster.** On a team whose dues were carried
      forward from last season (or migrated from free), run **Set dues for all players** — the
      confirm screen must name **nobody** as hand-set. ⚠ Before the fix it named EVERY player, and
      "Keep the N I set by hand" would have applied your change to nobody at all.
- [ ] Now give ONE player a different schedule and re-run: only **that** player is named.
- [ ] **A stale edit target must not eat a receipt.** Open a player → pencil a payment → close the
      drawer with the **X** (not Cancel) → reopen the player → press **Record payment** → enter a
      DIFFERENT amount → save. You must end with **two** payments in the list. ⚠ Before the fix the
      original was silently replaced.
- [ ] Same check with a credit: pencil a credit, close with X, reopen, press **Add Credit** — you
      get a blank *new* credit, not an edit of the old one.
- [ ] After a failed correction (hard to force by hand — read the message if you ever see one): it
      must never tell you to "re-enter" the payment, only to check the Payments list first.
- [ ] **Read-only money assistant** still sees no pencils, no banknote ticks, no confirm dialog.

### 14 🖥📱 The Money hub's old doors close — **LIVE ON PRODUCTION 2026-08-14** (job 256) · no migration

**What changed:** the seven standalone Money pages the tabbed hub replaced (the ones with no tab
bar — you hit one from "view player dues") no longer exist as destinations. Every old URL forwards
permanently into its hub tab, deep-link details intact (a bookmarked budget line, the schedule
sub-tab, an archived season's `?year=`); every link in the product — including six *inside* Money
that were quietly ejecting you from the hub, the team Overview's budget tile, the roster page's
"Manage dues", the month grid's drill-downs, and the public demo's own tour step 4 and Off-season
chip — now lands inside the hub with the tab bar present. Nothing about what the screens show
changed. Admin-side accounting is deliberately untouched (it was never made a hub).

**The walk (~5 min, any money-rich team):**
- [ ] Player Dues → generate/set dues → follow any cross-link out of the sheet: you land on a
      Money screen **with the tab bar present**. There is no longer any route into a tab-less
      Money page.
- [ ] Type an OLD address by hand (e.g. `…/accounting/dues`, `…/accounting/budget-vs-actual`):
      it forwards to the hub with the right tab active. Try one with a detail
      (`…/accounting/expenses?tab=schedule`): the schedule sub-tab opens.
- [ ] Inside the hub: Expenses' "Player Dues" / "Open allocations", Payment Requests ⇄
      Allocations cross-links, and BvA's empty-state "Create a budget plan" all switch tabs in
      place — a half-filled form on another tab survives. (Budget's own "View dues →" was
      retired by the §15 rework — the Dues tab above it is the door now.)
- [ ] Month grid (BvA → Months, Budget lens): a line's cell still opens the edit form pre-filled;
      switching to another tab afterwards drops the `line` deep-link from the URL (it must not
      refire later).
- [ ] Fundraiser detail (a real sub-page, kept): "Back to Fundraisers" returns to the hub's
      Fundraisers tab.
- [ ] **Public demo** (no login): the Off-season chip and tour step 4 land on Budget vs. Actual
      *inside* the hub — narration strip appears, the variance section gets its ring, and the
      step checks off. Press step 4 again while standing on another Money tab: it switches tabs
      rather than claiming "you're already here".
- [ ] Archived season (Chunk F): open a past season's Money → tabs still work read-only, and an
      old-style deep link with `?year=` forwards without losing the year. **Cross-links inside the
      archived hub (Expenses' links, BvA's empty state) now keep you IN the archived season** —
      before this pass they silently jumped to the live one (pre-existing leak, fixed during
      review). (Budget's "View dues →" no longer exists — see §15.)

---

### 15 🖥📱 The Budget Plan reads as three figures — **LIVE ON PRODUCTION 2026-08-14** (job 256) · no migration

**What changed:** the budget page's tall summary ladder became a two-line **plan card**: Planned
costs · Expected fundraising · Player installments, side by side. The third figure is tagged
**Estimated** (costs less fundraising, with per-player and Generate beside it) until dues go out,
then becomes the official **Scheduled** total from the schedules — and a deliberate over-schedule
reads as a quiet "includes a $X buffer above the plan", never a red flag; only scheduling *short*
of the plan draws amber. The kind is renamed **"Expected fundraising"** everywhere (line form,
sections, BvA, exports) and money coming in shows **positive in green — no minus signs**. Funding
lines no longer ask for a spending category. Rows: amounts line up in one money column, each line
carries a single pencil (desktop), the **whole row opens the editor**, and **Delete moved into the
edit form** behind the same confirm. On a phone the rows are completely clean — tap a line to
edit. The "✓ installments generated" banner and the built-page "See a sample budget" link are
gone (the sample is empty-states-only now). `/review` run (high-risk, 4 lenses): 9 confirmed
findings all fixed, 16 old layout-baseline defects retired.

**The walk (~7 min, QA Money U11 or any money-rich team):**
- [ ] Budget tab, dues already out: card reads Planned costs · Expected fundraising ·
      Player installments **Scheduled**, no per-player figure, and the buffer caption states
      your planned overage in plain ink — nothing red on a healthy page.
- [ ] Delete a cost line (row → pencil/row-tap → **Delete line** → confirm): the plan drops,
      the third figure's caption flips to the amber "short of covering the plan" with
      "Set dues for all players" beside it — both the card and the list's closing row agree.
      Re-add the line; both go quiet again.
- [ ] Add Line → flip "A cost" ⇄ "Expected fundraising": the Category & Item picker disappears
      for fundraising and Description gains the required *. Clear the description on an EXISTING
      fundraising line and save: it blocks with the error (no silent old-name revert).
- [ ] List view: every amount — line, category total, fundraising, installments — sits in one
      right-aligned column; fundraising figures are green with **no minus sign**. By-period view:
      same, and its closing row says "Costs less fundraising" (it spreads the plan, not the
      schedules).
- [ ] Phone (or narrow window): rows are clean — no icons; tapping a line opens its editor;
      the › chevron on a split line expands periods without opening the form; the card stacks
      its three figures vertically.
- [ ] Set an estimated total: it becomes the Planned costs figure with the "your estimate ·
      $X itemized" caption; itemize past it and the caption goes red. Clear it from inside the
      editor.
- [ ] Empty-team check (starter team): first-run card unchanged, sample reachable there — and
      confirm the built page offers **no** sample link anywhere.

---

### 16 🖥📱 The Overview's Budget card shows plan vs. actual — **LIVE ON PRODUCTION 2026-08-14** (job 256) · no migration

**What changed:** the Money Overview's Budget card stopped quoting a computed **$/player** — an
even split of the plan that no family was actually billed (it read $700 while every schedule said
$600) — and now draws the plan against reality as **three small bars on one dollar scale**:
**Spending** (paid, inside planned costs), **Player dues** (collected, inside what's actually
*scheduled* — the real figure), and **Fundraising** (raised, inside what was budgeted). Each row
says its own state in words — "$650.00 left", "$1,200.00 still out", "$350.00 to go". The
headroom headline, chip, and footer links are unchanged. Spec = approved mockup artifact
`64d49b0e` (2026-08-14). Directional honesty is deliberate: going **over the plan** is a striped
segment past the bar's end plus the chip and "▲ $X over" (never colour alone — the olive and the
danger red are near-identical to red-green colour-blind eyes); **beating a fundraising goal**
keeps the ordinary fill and gets "✓ $X past goal" instead.

**The walk (~4 min, QA Money U11 or any money-rich team, then squeeze the window):**
- [ ] Money Overview (dues out): Budget card shows the three rows on one scale, an
      actual/planned legend, and **no $/player anywhere**. The dues row's total matches the
      Budget Plan card's **Scheduled** figure exactly (§15's page) — the two screens must agree.
- [ ] The bars are proportionate to each other: dues + fundraising visibly ≈ the spending
      track when the plan is fully funded.
- [ ] Log (or imagine via a team that has one) spending past the plan: chip flips to
      **over budget**, headline goes red, and the overrun is a striped stub past the bar's end
      with "▲ $X over" — visible as more than a colour change.
- [ ] A team with no expected-fundraising line and nothing raised: the Fundraising row is
      absent entirely, not a $0 row. Raised money with no budgeted goal reads "raised · no goal
      set".
- [ ] Phone width: rows wrap their figures below the labels without the card scrolling
      sideways; the two footer links still sit on one bottom band level with the other cards.
- [ ] Archived past season's Money Overview: the card renders read-only — in the rare
      "nothing scheduled" state it must show **no** "Generate installments" door there (live
      seasons keep it).

### 17 🖥📱 Player Dues gains a "By installment" lens — **LIVE ON PRODUCTION 2026-08-14** (job 256) · no migration

**What changed:** the Player Dues tab now has a view toggle on its toolbar — **Season totals**
(the existing table, untouched, still the default) and **By installment**. The new lens opens
with a **Collection schedule band** (the Budget plan card's language: one term per installment —
collected of assessed, due date, "✓ Fully collected — 6 of 6" / "⚠ $280 still to collect · 2
behind" / "2 of 6 paid early · due in 18 days", with a small meter), then a **player ×
installment grid**: each cell is that player's installment with its state — ✓ paid + date,
"$120 of $200" part-payments, ⚠ overdue, quiet "upcoming". Two new columns close each row:
**Due next** (past-due remainders + the next upcoming installment — the "what does this family
owe me right now" figure, credits deliberately excluded so it always equals what reminders
chase) and the familiar Balance. On phones the grid becomes **collapsible per-player cards**,
closed on the due-next figure with a caption ("⚠ $80 past due + $200 due Sep 1"); opening one
lists the installments and ends with the season balance + a **Full record ›** door to the
player drawer. Spec = approved mockup artifact `d7162867` (2026-08-14). The view choice rides
the URL (`?duesView=installments`).

**The walk (~4 min, QA Money U11 or any team with schedules + mixed payments):**
- [ ] Toggle appears on the dues toolbar's left only when at least one schedule exists; the
      default is Season totals and that table is pixel-for-pixel what it was.
- [ ] By installment: band terms' collected-of-assessed sums match the grid's footer per
      column; a fully-collected installment reads green with words, a behind one reads amber
      with ⚠ **and** words, a future one stays neutral (no false alarm before the due date).
- [ ] Part-paid family: the cell says "$X of $Y" — the same figures the player drawer's
      chips show for the same installment.
- [ ] **Due next** column: an on-track player shows only their next installment (not the whole
      balance); a behind player shows past-due + next with the split in the caption; a fully
      paid player shows a **muted** $0 (settled is quiet, not green); in-credit shows the
      credit; no schedule shows "Not set".
- [ ] Footer: "To collect now" = the due-next column summed; "Balance owing" matches the
      totals view's footer for the same roster.
- [ ] Hand-edit one player's installment due date (player drawer → Edit schedule): the column
      header keeps the team's common date, that player's cell shows their own date, and the
      band term says "dates vary".
- [ ] Phone width: the grid is replaced by collapsed cards (no sideways scroll); tapping a
      header expands it; **Full record ›** opens the drawer; a not-set player's card opens the
      drawer directly. Row-click on desktop still opens the drawer from both views.
- [ ] The URL carries `duesView=installments`; reload lands on the same lens; an archived
      past season renders the lens read-only like the rest of the tab.

**Round 2 (owner feedback 2026-08-14, same day):** table headers were much smaller than their
data rows — the list-table heading recipe (0.72rem, faint ink) had never been reconciled with
the grid heading Budget Plan / Budget vs. Actual use (0.78rem, darker ink); **the shared list
heading now matches the grid heading, which resizes the header row of EVERY list table in the
coach portal**, not just Money (phones unaffected — cards hide the header row). The phone
band's giant empty blocks were a real layout bug (a horizontal sizing rule turning into a
170px minimum HEIGHT once the band stacked) — fixed. And **Send Due Reminders now confirms
before emailing**: a modal states the scope — past due or due within 3 days, remainders only,
one email per family, 7-day no-repeat — and **the manual send now includes past-due
installments** (it was forward-only; the automated 30/7 waves stay forward-looking on
purpose). Past-due rows in the email say "was due {date}" and the subject switches to
"outstanding".
- [ ] Table headers on Player Dues (both lenses) now read at the same size/ink as Budget vs.
      Actual's column headings — and spot-check one non-Money table (e.g. Roster) since the
      recipe is shared portal-wide.
- [ ] Phone: the Collection schedule band's terms sit compact (no tall empty blocks).
- [ ] Send Due Reminders → modal appears, states past-due + 3-day scope; Cancel sends
      nothing; Send fires and reports as before.
- [ ] On a team with a past-due installment: the send now reaches that family; the email row
      reads "was due {date}" and asks for the remainder only.

**Round 3 (owner feedback 2026-08-14, same day):** column headers spell out **"Installment
1"** (grid and phone cards both); **the many-installments question is answered structurally,
not by a threshold** — the grid now lives in the hub's horizontal scroller (the Budget-vs-
Actual month-grid pattern): up to ~5 installments nothing changes, beyond that it scrolls
sideways with the swipe hint and the Player column pinned, at any count, and the band wraps
into rows; **phones lost the lens toggle** — the collapsible cards ARE the phone view (they
answer both questions), so below 640 the band + cards always render, the totals table and
toggle stand down; and **all three toolbar buttons go icon-only on phones** via the page-header
ruling's mechanism — including the shared Export trigger, which sits on all seven Money tabs,
so every Money toolbar tightens at once.
- [ ] Headers read "Installment 1 / due Mar 15" on desktop; phone card rows say
      "Installment 1 · Mar 15".
- [ ] A monthly-style schedule (7+ installments — hand-add dates via a player's Edit
      schedule): the grid shows the swipe hint, scrolls sideways, Player column stays pinned
      with the header tint intact; a 3-installment team sees no pin, no hint, no white stripe.
- [ ] Phone: no Season totals / By installment toggle — the band + cards are simply the view,
      from either desktop lens URL; Export / Set dues / Send Due Reminders are icon-only
      (tap targets still ≥44px, labels read out by screen readers). Check one OTHER Money tab
      on a phone: its Export is icon-only too (shared trigger).

✅ **/review RUN 2026-08-14 (high-risk tier, 4 lenses + rendered gate), all 5 confirmed
findings FIXED** — sharpest: the reminder modals left the phone bottom nav tappable underneath
(overlay registration added), and the lens param was riding every other Money tab's URL (now
dropped on tab switch — so the lens resets when you leave Dues and come back; a bookmark still
opens it). Toggle buttons met the 44px floor; same-day installments now sum in Due next
(suite 1,727). Full log in DUES_BY_INSTALLMENT_PLAN.md. ⚠ The rendered sweep also carries 4
tap-floor findings on overview/team-hub/schedule/history — NOT this project's (other
uncommitted work; their owners' sessions should clear them before release).

### 18 🖥📱 Help reads as a menu of answers — ✅ **OWNER QA PASSED 2026-08-14 (ALL EIGHT BATCHES)** · batches 1–6 **LIVE ON PRODUCTION 2026-08-14** (job 256); batches 7 · 8 · 8b **ON DEV**, committed `978ed7f1`, awaiting a release · no migration

**What changed:** the scannable-format standard's first shipment (plan:
`HELP_SCANNABLE_FORMAT_PLAN.md`, steps 1+2). The help system gained **sub-topics**: a long
guide section is now a short overview plus titled sub-answers. The "?" drawer renders them as
an **"In this topic" expander list** (the FAQ accordion pattern; the first one starts open when
the drawer shows a single section); the full guide renders them as **anchored sub-headings
with a jump-chip row** at the top of the section. New content primitives — numbered steps,
term|meaning definition rows, and an inline tip/caution note — render identically in both.
**The Money topic is the first conversion**: its 28-paragraph wall is now an overview + 10
sub-topics in the treasurer's order (dashboard cards → getting around → budget → periods →
dues → payables → month view → import/export → tags → assistants). Same facts, re-set — no
prose invented, no fact dropped. Every other section in every guide is untouched (nothing else
declares sub-topics yet), and search metadata, section anchors, FAQs and the page→section
drawer mapping are all unchanged.

**The walk (~4 min, any premium team + the coaches help guide):**
- [ ] "?" on any Money screen (hub or a tab): the drawer shows the Money summary, then
      "In this topic" with 10 titled expanders — the first (dashboard cards) already open,
      showing definition rows for Collections / Cash on hand / Budget and a green tip note.
      Tapping others opens them; the "Open the full guide" door still sits at the foot.
- [ ] Expander toggles survive scrolling and reopening other rows (uncontrolled, like FAQs).
- [ ] Coaches help guide → Money section: a row of jump chips sits above the intro; tapping
      one scrolls to that sub-heading; hovering a sub-heading reveals a **#** you can copy.
- [ ] Deep links: `…/coaches/help#premium-money-dues` lands on the dues sub-topic;
      `#premium-money` still lands on the section top; an FAQ deep link still opens its
      accordion.
- [ ] Search inside the guide: "record payment" still finds the Money topic and its FAQs;
      "payables" matches (sub-topic titles are searchable).
- [ ] The new shapes read right: numbered step discs on "recording payments", term|meaning
      rows (term column, meaning beside it), amber warning note on overpayments.
- [ ] Phone: definition rows stack (term above meaning), jump chips clear the 44px tap floor,
      the drawer's expander rows too; nothing scrolls sideways.
- [ ] Warm theme (the portal default): bolded phrases, definition terms and note titles all
      legible on the cream ground — this is the surface the `--white-75` ramp-token lesson
      lives on.
- [ ] A guide with NO converted sections (e.g. Tournaments admin guide) renders exactly as
      before — no chips, no expanders, no layout shift.

✅ **/simplify (4 lenses) + /review (high-risk tier, 4 lenses) RUN 2026-08-14, post-QA — 5
confirmed findings FIXED, all verified green after.** Sharpest: the "?" drawer opened every
Money page on the *dashboard cards* sub-topic regardless of which page the coach was on — each
of the nine Money screens now opens the drawer on **its own** sub-topic (Dues → recording
payments, Budget vs. Actual → month view, etc.). Also fixed: the drawer now **closes on
navigation** instead of lingering over the next page (this also removes a duplicate-anchor
exposure when the full guide rendered under an open drawer — a pre-existing gap this change
had enlarged); jump chips and sub-heading `#` anchors follow the guide's own hash contract
(no history-entry per click, no double smooth-scroll); the sub-topic anchor resolver can no
longer mint colliding anchors for same-titled sub-topics (pinned by 2 new tests; suite 1,753);
and the dropped "$100 a month against $300 installments" worked example is back in the dues
sub-topic. `/simplify` had earlier collapsed the drawer expanders onto the FAQ accordion's own
chrome (one shared component, three consumers) and unified the three deep-link lookups.
**Post-review spot-checks (~2 min):**
- [ ] "?" on Player Dues opens with "Player dues & recording payments" already expanded (not
      the dashboard cards); "?" on Budget vs. Actual opens the month-view sub-topic; the
      Money hub Overview still opens the dashboard-cards sub-topic.
- [ ] With the drawer open, navigate anywhere (e.g. tap into a player) — the drawer closes.
      Switching Money tabs (same page, different tab) keeps it open by design.
- [ ] In the full guide, click three jump chips then press Back ONCE — you leave the help
      page (no stepping back through each chip click).
⚠ Found during the review's gate, NOT this project's: a type error in the team-workspace
provisioning module (a rep-program-year type gained `creditApplication` mid-flight) — belongs
to the dues-payment-record session's open Pass 3 work; left untouched.

**Batch 2 (2026-08-14, same day — step 3 of the plan):** the four next-worst coach topics and
the worst tournament topic converted to sub-topics, on the machinery QA'd above. **Practice
plans** (17 paragraphs → 8 sub-topics), **Your drills** (16 → 7), **Letting families follow
your team** (16 → 6 — its hand-written sub-headings became real anchors), **Game day on the
bench** (13 → 8), and **the public tournament site** (16 → 9, including two paragraphs that had
grown past 400 words each). Same discipline as Money: prose re-set, not rewritten; every
section's id, keywords, searchText, links and FAQs untouched. Measured coverage: sections over
the six-paragraph standard went **20 → 15**, and nothing above 12 paragraphs remains anywhere.
- [ ] "?" on the practice-plan editor opens the plan topic as an expander menu, first one open
      ("The shape of the night: blocks") — and the numbered steps read as numbered steps.
- [ ] Coaches guide → Practice plans / Your drills / Letting families follow: each has a
      jump-chip row; chips scroll to their sub-heading; the family topic's old sub-headings are
      now the sub-topic titles (no duplicated heading left behind).
- [ ] Game day topic: the arm-care "where that pitching number comes from" note and the
      "moments are yours" note read as notes, not buried sentences.
- [ ] Tournaments guide → the public site topic: 9 chips; the follow/navigation sub-topics that
      were single giant paragraphs now read as several, with term|meaning rows for phone vs.
      computer navigation.
- [ ] Spot-check one UNCONVERTED long topic (e.g. Player Development) — still renders as plain
      paragraphs, no chips, no layout shift.

**Batch 3 (2026-08-14, same day — step 3 finished at the substantial end):** the seven
remaining 11–12-paragraph topics converted — **Your tournament records**, **Player
Development**, **Export formats**, **Season's End**, **Plan templates**, **The opponent book**,
and **Adding assistant coaches and helpers**. Export formats' own `<h3>` headings became its
sub-topics (the exports guide is the third to use the primitives). **13 of 147 sections now
carry sub-topics; 8 remain over the standard, all at 7–9 paragraphs** — ruled convert-on-touch
rather than swept, since at that length the bolded lead-ins still work.
- [ ] Coaches guide: Assistant coaches, Player Development, Opponent book, Plan templates,
      Season's End and Your tournament records each open with a jump-chip row; chips land on
      their sub-heading.
- [ ] The two safety-shaped notes read as notes, not buried sentences: **Contacts &
      birthdates is the switch that protects** (assistant coaches) and **moving a session's
      date moves every reading in it** (Player Development).
- [ ] Exports guide → Export formats: four sub-topics (Excel · CSV · Calendar · PDF), and the
      **PDF needs Tournament Plus** gate reads as an amber note.
- [ ] "?" on a coaches page that maps to a converted topic opens on a sensible first
      sub-topic (none of these needed per-page targeting — check one anyway).
⚠ A pre-existing lint warning sits in the exports guide's PDF-privacy paragraph (untouched by
this work, flagged only because the whole file was linted) — left alone deliberately.

**Batch 4 (2026-08-14 — the sweep; step 3 COMPLETE):** owner ruled the remaining eight 7–9¶
topics in rather than convert-on-touch, because **the "?" is one control and must behave the
same everywhere**. Converted: Chat with your coaches, What the Coaches Portal is, Running a
practice at the field, Create/edit/launch a tournament, How to turn on the tools you need, How
to message your team, Game-day details, Building lineups. **Every long topic in the help system
now follows the standard — 21 sections, 109 sub-topics, zero over the line.** Short sections
took 2–4 grouped sub-topics deliberately, never one-per-paragraph.
- [ ] The consistency check that motivated this: open "?" on four or five DIFFERENT coach
      pages in a row (Overview, Schedule, Lineups, a practice, Money). Every one opens the
      same shape — summary, then a titled expander list. No wall of paragraphs anywhere.
- [ ] Free-portal pages too (Explore / Announcements): same shape, and the numbered send steps
      on "How to message your team" read as steps.
- [ ] Tournaments guide: Chat and Create-a-tournament both have chips; the six-step
      open-registration list is numbered.
- [ ] Nothing reads as over-split — no topic is a list of one-line accordions you must open to
      read a single sentence.

**Batch 5 (2026-08-14 — screenshots; the scannable-help project is COMPLETE):** help guides can
now carry pictures, and the first two are in the Money topic — the **Player Dues table** (where
Record payment lives) and **Budget vs. Actual's month grid**. Each is a framed figure with a
caption that stands on its own, and **tapping it opens it full-size**. Images are captured by
script from the **Riverdale demo world only** — enforced, not remembered: the script refuses the
whole run if a manifest path points anywhere else, because the alternative is a real family's
name in the product's own documentation. The demo's own "LIVE DEMO" banner and tour bar are
suppressed before capture, so the pictures show the product a coach actually sees.
- [ ] Coaches guide → Money → "Player dues & recording payments": a framed screenshot sits
      under the opening line, with a caption beneath it and a "Tap to enlarge" affordance.
- [ ] Tap it: the picture opens large and centred over a dimmed page; **Escape closes it**, so
      does clicking the dark area, so does the Close button.
- [ ] The picture shows **Riverdale Ridge 12U** (fictional) — and **no "LIVE DEMO" banner, no
      phase dock, no guided-tour bar**. If any demo furniture is visible, the capture is wrong.
- [ ] Same check on the Budget vs. Actual month-grid picture, in the month-view sub-topic.
- [ ] Phone width: the figure scales to the column, the caption wraps, nothing scrolls sideways;
      the enlarged view still fits.
- [ ] Warm theme: the frame and caption are legible on the cream ground.
- [ ] The "?" drawer shows the same figures at drawer width without overflowing.

**Batch 6 (2026-08-14 — the guide becomes a reading surface):** owner-spotted, two changes.
**(1) No portal furniture — none at all.** The full guide opens in its own tab, so the sidebar,
the desktop top strip and the phone bottom nav are gone; they were three ways out of a document
nobody navigated into. A "← Back to your portal" bar was built and then **removed on owner
ruling the same day**: both doors into the guide force a new tab (the panel's *Open the full
guide* and the sidebar's *Help*), so the portal is still sitting in the tab the reader came
from and a way back is furniture for a journey nobody took. The guide's own breadcrumb still
moves between guides. This is parity with the admin side, which has treated help as a focused
surface since Stage C. **(2) One fixed look.** The guide now renders **dark whatever the account's theme**, matching the "?" panel —
which has always been dark even in a warm portal, because it floats free of the portal's skin.
So help stops being an app screen that changes colour and becomes documentation.
- [ ] Coach portal on the **warm** theme → open "?" on any page → **Open the full guide**: the
      new tab is DARK, with no sidebar, no top strip, no bottom nav.
- [ ] There is **no bar and no back link** — the page starts at the guide's own breadcrumb.
      Closing the tab is the way out; the portal is untouched in the tab behind it.
- [ ] Both doors still open a NEW tab: the panel's **Open the full guide**, and **Help** in the
      portal sidebar. (If either ever opens in place, this surface needs a way out again.)
- [ ] Jump chips: comfortably tappable, and a long chip label **wraps** instead of pushing the
      page sideways.
- [ ] Hover a sub-topic heading on desktop: the **#** permalink appears and copies a link. On a
      phone it is absent by design (an invisible control is not a tap target).
- [ ] **Normal portal pages are unchanged** — sidebar, bottom nav and the warm theme all
      exactly as before. Check one team page and one Money tab.
- [ ] Admin help (`/admin/help`) is unaffected — it was already a focused surface.
✅ Rendered sweep: **0 new findings, and 11 baseline entries stopped reproducing** — the dark
surface fixed contrast failures the warm theme was causing on this page, and dropping the
portal chrome removed its tap-floor debt from the help screen.

**Batch 7 — ✅ OWNER QA PASSED 2026-08-14.** (2026-08-14 — the eight topics the sweep couldn't see): the standard that drove
batches 1–6 counted paragraphs, so it was blind to lists. "How to run tryout day" is the longest
topic in the product — **1,386 words** — but it is three paragraphs plus one 16-item list, so it
scored 3 and was never touched. The standard now measures **words of body copy, list items
included** (`npm run measure:help`), and the eight sections it caught are now menus of answers
like the rest. **No copy was rewritten** — the same sentences, re-set into titled sub-topics.
- [ ] **Coaches guide → "How to run tryout day"**: eight sub-topics, from *Before the day* through
      *Turning the tryout into each player's starting point*. Read the whole thing — the steps must
      still describe the tryout in the order it happens, with nothing dropped between sub-topics.
      (The old step 3 pointed at "step 8" for revealing names, which was already the wrong number;
      it now names the sub-topic instead.)
- [ ] **Coaches → "Getting around your Premium portal"**: six sub-topics. The sidebar tour is now a
      term/meaning list — check Squad, Season, Money, Communication and Team admin all still read
      correctly, and that Money still says it was called Accounting.
- [ ] **Coaches → "How to chat with your tournament organizer"**: five sub-topics.
- [ ] **Tournaments → "Build and adjust the tournament schedule"**: five sub-topics, including the
      rain-delay tool and who gets notified when a published game moves.
- [ ] **Tournaments → "Build a playoff bracket"**: four sub-topics.
- [ ] **Org Admin → "Your public organization page"**: four sub-topics.
- [ ] **Rep Teams → "Shared library"**: three sub-topics; the Club-plan opponent-book switch is now
      its own answer.
- [ ] **Platform Admin → "How to cancel a customer subscription"**: the 10-step SOP is now two
      five-step halves — *get to the control*, then *confirm and record*. Read them back to back and
      confirm no step was lost at the seam.
- [ ] In the **"?" panel** on any page above, the same topics open as expander lists (not walls).
- [ ] Every existing help link still lands where it did — the section anchors did not change.
✅ Rendered sweep on the coach help screen: **0 new layout findings** (jump chips on the new
sub-topics clear the tap floor and wrap at phone width).

**Batch 8 — ✅ OWNER QA PASSED 2026-08-14.** (2026-08-14 — the guide stops being one long page): owner-ruled after mockups
(artifact "Help Guide, One Topic at a Time"). Opening the full guide used to hand a coach all 40
topics and 22,131 words on one page. Now **the contents list is a two-level menu and one article
fills the screen**: pick a topic and it opens in the menu to show its answers underneath; pick an
answer and that answer *is* the page. The coaches guide is 129 articles plus 20 topic pages. The
"?" panel is deliberately untouched.
- [ ] Open the full guide from the portal sidebar: it lands on a **contents page** — the guide's
      intro, then every topic as a card, grouped, with an answer count on the ones that have them.
- [ ] Click **Managing your team's money**: the menu opens it and lists its 11 answers underneath;
      the page shows the topic's overview and an **In this topic** list. Nothing else is on screen.
- [ ] Click **Player dues & recording payments**: that answer alone fills the page, headed by its
      own title, with "5 of 11 in Managing your team's money" underneath (the topic name links up).
- [ ] **Previous / Next in this topic** at the foot walks the eleven answers in order, then rolls
      on to the next topic. Check the label changes from "in this topic" to "topic" at the seam.
- [ ] The menu marks **both** levels — the open topic and the answer you're reading. Only the open
      topic shows its answers; every other topic stays a single row.
- [ ] A topic with no answers under it (e.g. **Taking attendance**) has no arrow and opens straight
      to the article.
- [ ] **Search**: type "season settlement". Results now come in three groups — Topics, **Answers**,
      Questions. Clicking any of them *opens* that article rather than scrolling to it.
- [ ] ⚠ **The deep links are the whole risk.** From a Money screen, press **?** then **Open the
      full guide** — it must land on the Money topic. Then check a few in-product help links land
      on something that answers their question, not the top of a long page.
- [ ] ⚠ **The "?" panel must be exactly as it was**: same expander list, same pre-opened answer for
      that page, same "Open the full guide".
- [ ] **On a phone**: the guide opens on the contents page; tapping a topic and then an answer is
      two taps; a sticky **← <topic name>** bar at the top of an answer goes back up. The contents
      *tree* is deliberately not shown on a phone — the pages themselves are the contents.
- [ ] Jump chips and the little **#** permalinks beside sub-headings are **gone** — an answer has
      its own address now. Confirm nothing looks like it lost a control.
- [ ] Admin and platform-admin guides behave identically (they share the layout).
✅ Rendered sweep: 0 new findings, and **61 baseline entries stopped reproducing**. All 102
anchored help links and 9 drawer sub-topic targets resolve; 14 sampled links walked in a real
browser across four guides and three roles.
⚠ **Known gap, deliberate:** the answers on a topic page are **titles only** — the one-line
description per answer (150 lines of new copy) was not written. Say the word and it goes in.

**Batch 8b — ✅ OWNER QA PASSED 2026-08-14.** What `/review` caught and fixed (same day): twelve real defects, all fixed and
re-checked in a browser. Worth spot-checking these specifically:
- [ ] On a topic page with several questions, open one from search, then open a **second** one.
      Both must open. (The second used to do nothing at all.)
- [ ] In the contents menu, click the header of the group you're already in. It must **collapse**
      that group — not reveal every group in the guide.
- [ ] Read a long answer, scroll to the bottom, then click "**— all topics**". The contents page
      must start at the top, not part-way down.
- [ ] Tab through the menu and press Enter on a topic. Focus must land on the new article's title
      (a keyboard reader was previously left on the link with the page changed underneath).
- [ ] Platform-admin guide: `…/help/platform-admin#faq-who-can-run-bulk` must open that question.
      (Its three page-level questions had no working address at all.)
- [ ] Tournaments guide: the contents page must list **Tournament workflow at a glance**, and both
      the menu and the contents page must show the four sub-headings — *Create the tournament,
      Define the structure, Build the schedule, Playoffs*.
- [ ] Open a question from search and check the address bar names **the question**, so the link you
      copy reopens it.
- [ ] On a phone, at the narrowest width you have: the back bar must not push the page sideways —
      check the org-admin guides as well as the coach one.
- [ ] **"← All guides" is gone from every guide** (owner ruling). It never led to a list of guides:
      it chopped the last piece off the address, which on the coach side landed you back in the
      portal — a second copy of it, in the tab you'd opened purely to read. A guide's navigation is
      the menu beside it, and admins still reach the hub from the admin sidebar's own Help entry.
- [ ] **The trail matches the menu, level for level.** On an answer it reads *Coaches Portal /
      Premium Coaches Portal / Managing your team's money / Player dues & recording payments* — the
      guide, its group, the topic, and the article you're on. It used to show only the guide and the
      topic, which made an answer look like it sat directly under the guide.
- [ ] Every step above the current one is a link, and each goes UP within the guide: the guide name
      to its contents, the **group** to the contents page landed on at that group, the topic to that
      topic. The last step is the article you're reading and is deliberately not a link.
- [ ] A guide with sub-groups (Tournaments) shows all five: *Tournaments / Schedule & Playoffs /
      Build the schedule / Build and adjust the tournament schedule / Rained out or running behind*.
- [ ] At phone width the trail **wraps** onto more lines — it must never push the page sideways.
- [ ] The contents page has no trail above its title at all — it would have repeated the heading
      directly beneath it.

### 19 🖥📱 Fundraising pays the bill — **LIVE ON PRODUCTION 2026-08-14** (job 256) · migration **233** ✅ on prod

**What changed:** a credit is now **money the team owes a family**, and it lands on their real
installments instead of only lowering a balance column. An $800 installment with $500 of
fundraising against it reads **"$300.00 to send"** with the earning named underneath; cover the
whole bill and it reads **Covered by fundraising** — deliberately *not* "Paid", because Paid
stays cash. The player drawer's Balance stat became **Left to send** (dues − cash − credits), and
when the team is holding a family's money the drawer says so in words. A new team-wide setting at
the foot of Player Dues — **Credits reduce: the last payment first** (default) · *the next payment
first* · *they don't — settle at season's end* — decides which bill a credit meets. Reminder
emails open with the earning ("your family's fundraising has earned $500.00 toward dues — thank
you") and ask only for the rest; a family whose credits settled everything is never chased at all.
Logging a fundraiser result now previews **Where it lands** before saving. This is **Pass 1 of 3**
(plan: `COACH_SEASON_REFUND_REVAMP_PLAN.md`) — money-out and the derived refund sheet follow.

**Where:** Money → **Player Dues** (table, drawer, the settings row at the foot) · Money →
**Fundraisers** → open a fundraiser → **Log amount** · the Money **Overview** tiles · the reminder
email preview (**See an example** beside Automatic Dues Reminders).

**Fixture:** `qa-money-lab` → **QA Mid Season U14** (`qa-money-head@dev.local` / `devpass123`) —
built for exactly this: a drive that closed mid-season, so the applied / owed-back distinction is
actually visible. Re-seed with `node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money`.
The cast, one player per rule: **Ash** paid the whole season in cash before the drive closed ·
**Blair** is on schedule and has the biggest rebate · **Cam** is part-paid and behind, with no
fundraising · **Drew** has paid nothing but earned a rebate · **Em**'s balance was forgiven ·
**Fin** has left the team holding their rebate · **Gio/Hal** are the ordinary case.

- [ ] **Blair's bills tell the story.** Open Blair on Player Dues: their last installment reads
      **Covered by fundraising** (not "Paid"), the one before it asks for a reduced amount, and
      the line underneath names the **Bottle Drive**. The stat grid reads Total dues · Paid ·
      Credits · **Left to send**.
- [ ] **Ash is the self-correcting rule.** Ash paid everything in cash before the drive closed, so
      their rebate found no bill to lower: no installment shows a credit, and the drawer says
      **the team is holding $X of this family's money**. (This is the money Pass 3 hands back.)
- [ ] **Drew is the one that matters most.** Drew has paid nothing at all but earned a rebate.
      Their installments must ask for the **lowered** amounts — never the gross — and they should
      still appear in the chase list for what's genuinely left.
- [ ] **Em was forgiven.** Em's bills read as covered and Em is not chased. Nothing about Em says
      the team owes them money (forgiveness is debt relief, not their money).
- [ ] **Change the setting and watch the bills move.** At the foot of Player Dues set **Credits
      reduce** to *the next payment first* — Blair's relief should jump to their next bill instead
      of the last. Set it to *they don't — settle at season's end*: every bill goes back to its
      full amount and the credits become money owed back. Set it back to **the last payment first**.
- [ ] ⚠ **The one the review caught.** While on *settle at season's end*, check the status word on
      a family with a big unapplied credit: it must **not** say "Settled" or "in credit — in their
      favour" while they still owe cash. (It said exactly that before the fix.)
- [ ] **Status words.** Across the table: **Fully paid** = cash covered it · **Settled** = credits
      did part of the work · **In credit** = the team holds money that's theirs · **Partial** /
      **Unpaid** as before.
- [ ] **The email.** Open **See an example** beside Automatic Dues Reminders: the sample opens with
      the fundraising thank-you and one row reads "$X to send of the $Y … — $Z covered by
      fundraising (Bottle Drive)". Then send yourself a real one from a player with a credit.
- [ ] **Where it lands.** Money → Fundraisers → open the Bottle Drive → **Log amount** on a player
      with open bills: typing an amount previews exactly which bills drop and by how much, *before*
      saving. Save it and the dues screen agrees with what the preview promised. The roster column
      reads **Left to Send**.
- [ ] **Nobody is chased for a covered bill.** A bill fundraising has fully covered must not show
      as overdue anywhere — not the red date in the drawer, not the "N past their due date" line,
      not the Overview's overdue count.
- [ ] **The season-end team still reads true.** On **QA Season End U15** (every family paid in full
      *before* the drive closed) nothing should have been applied to a bill — every credit dollar
      is money owed back. That team is Pass 3's subject.
- [ ] 📱 Phone: the same rows on a 390px screen — the drawer, the settings row, and the
      By-installment cards all read without sideways scroll.

Migration **233** applied to prod 2026-08-14 (job 256). ⚠ **The coach demo shows this on DEV only** —
Pass 3 seeded the Bottle Drive into the sandbox, but a seed change does not travel with a code
release, so the PRODUCTION demo still has no fundraiser (see §21's note). Full build + review log
in the plan's Pass 1 section.

### 20 🖥📱 Money goes out — **LIVE ON PRODUCTION 2026-08-14** (job 256) · migration **234** ✅ on prod

**What changed:** the books gain an **outbox**. Until now a credit could only ever lower a family's
bills; now the coach can hand it back in cash, and a family who pays for something out of pocket
is properly owed for it. Three things to try:

- **Pay out.** On a player's record, beside the line saying what the team is holding, a **Pay out**
  button opens the mirror of Record payment — how much, **the day the money left**, how it went,
  an optional note. It posts one **money out** line to the team's books dated that day, and each
  payout sits in the record as its own receipt with a remove that **voids** the books entry.
- **Paying out puts their bills back up.** If that money was lowering an installment, handing it
  over in cash means it can't do both jobs — the bill returns to its full amount and reminders go
  back to asking for it. The sheet says so before you save. This is why the button appears even
  when a family's credit is currently *on* a bill.
- **Paid by.** An expense now asks who paid: the team (as always), or **a family, out of pocket**.
  Choose a family and the cost counts in the budget exactly as before, **no cash leaves the team**,
  and that family is owed the money as an ordinary credit.

**Where:** Money → **Player Dues** → open a player (the Pay out strip, the sheet, the Paid out
list) · Money → **Expenses & Payables** → **Add Expense** → **Paid by**.

**Fixture:** the same `QA Mid Season U14` as §19 (`qa-money-head@dev.local` / `devpass123`), re-seed
with `node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money`. It now ships **Ash** with
half their rebate already paid out ($75 of $150), and **Gio's family** having covered a $120 pizza
night out of pocket.

- [ ] **Ash's receipt.** Open Ash: the Paid out list shows −$75.00 with its date and method, and
      the strip above says what's still held. The team ledger has a matching money-out line dated
      the day it left (not the day it was typed).
- [ ] **Pay out the rest**, then check Ash's bills and the reminder figures — nothing should still
      be counting that money as a credit against their dues.
- [ ] **Remove a payout** (trash icon on the row): the money goes back to being owed, the bills
      drop again, and the books entry is **voided**, never deleted — check the team ledger shows
      the void rather than a vanished row.
- [ ] **Pay out a credit that is currently on a bill.** Open **Blair** (whose rebate is lowering
      their last installment): the Pay out button must be offered, and paying out must put that
      installment back to its full amount.
- [ ] ⚠ **The ceiling.** Try to pay out more than a family has in credit — refused, with the real
      figure in the message. Try to pay out against **Em** (whose balance was *forgiven*): there
      should be nothing payable, because forgiveness was never the family's money.
- [ ] **Gio's pizza.** Money → Expenses: the $120 "Team pizza night" is there, **already settled**
      (no Mark paid to press), and Gio's family now holds a $120 credit. Budget vs. Actual counts
      the $120 as spending; the Money Overview's **cash out / cash on hand** must NOT — that money
      never left the team's account.
- [ ] **Add your own out-of-pocket expense** from Add Expense → Paid by → a family: the note under
      the picker states the consequence before you save.
- [ ] ⚠ **Deleting a credit that's been paid out** is refused with a reason pointing at the payout
      (try it on Ash) — the books must never owe a family less than they've already received.
- [ ] 📱 Phone: the Pay out sheet, the Paid out list and the Paid by picker at 390px.

**On production 2026-08-14** (mig 234 applied to prod). This is **Pass 2 of 3**;
the season-end settlement sheet (Pass 3) is where all of this is put to work. Full build + review
log in the plan.

---

### 21 🖥📱 The season settlement sheet — **LIVE ON PRODUCTION 2026-08-14** (job 256) · migration **235** ✅ on prod

**What changed:** the **Season Refund Calculator is gone** — the box you typed the pot into, and
the Calculate button. In its place, at the foot of Player Dues, is a **settlement sheet** that is
true all year: what the team owes each family, what there is left to share, and every row payable
from where you read it.

The number you used to type was wrong in a way no screen could see. Fundraising posts the **full**
amount raised to the books and the player's rebate is a credit — so the figure in circulation for
the review team ($1,575) had the rebates taken out once, and the calculator then took them out
again. The pot now derives, and **shows its work**: dues received, fundraising raised, spent →
cash the team holds → minus what it owes families → **surplus to share**.

**The only control left is hold back** — an intention ("keep $500 for next year's equipment"),
capped at the surplus, and refused against money the team owes families with that reason on screen.

**Where:** Money → **Player Dues** → scroll to **Season settlement** (the header says what the team
is holding before you even open it). The open sheet has its own link — `?settlement=open` — so you
can send someone the sheet rather than the page.

**Fixture:** `qa-money-head@dev.local` / `devpass123`, re-seed with
`node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money`. **`QA Season End U15`** is the
subject — ten families, dues settled, $675 owed back, $2,200 cash held, **$1,525 to share =
$152.50 each**. Use **`QA Mid Season U14`** to prove the sheet is honest *before* season end.

- [ ] **The pot adds up in front of you.** Open the section on U15: $6,050 + $2,500 − $6,350 =
      **$2,200 held**, less **$675 owed** = **$1,525 to share**. Not $90, and not $1,525 minus the
      rebates a second time.
- [ ] **The table.** Ten rows, four columns. Owed back totals **$675.00**, shares total
      **$1,525.00**, refunds total **$2,200.00** — the rows re-add to the cash on hand exactly.
- [ ] **Open a row** (click it). Umar's $307.50 breaks into his Cookie Dough rebate, the $50 his
      family over-sent, and one of ten shares. Every row explains itself this way; nothing is
      explained in the table.
- [ ] ⚠ **Pay one family and watch nobody else move.** Pay out a row in full: it reads
      **Paid — <date>** and stops asking, the cash-held line drops by exactly that much, and
      **every other family's share is unchanged**. This is the thing the sheet exists to promise.
- [ ] **Remove that payout** from the player's record (§20's trash icon): the row comes back
      exactly as it was, and the books entry is **voided**, never deleted.
- [ ] **Change what one family takes** (the *Change* button on a row): **a set amount** →
      whatever it frees up moves to the others immediately, and the total never changes;
      **no share** → their share is shared out among the rest, and **they still receive their own
      owed-back money** — that is theirs, not yours to redirect.
- [ ] **Forgive a balance.** On U14, open **Cam** (behind on dues) → Change → *Forgive the balance*.
      Their bills stop being chased, and the forgiven amount counts as their share already
      received — forgive a little and they still get a smaller cheque; forgive more than a share
      and they take no cash while everyone else's rises. Undo is on the same sheet.
- [ ] ⚠ **The hold-back.** Set it to $500 → every share drops and the totals still add up. Try to
      set it above the surplus → refused, naming the most you can hold back and why.
- [ ] ⚠ **The waiting-on strip.** On U14 (families still owe), the sheet says **whose money the
      others are waiting on** and what the payouts come to against what the team is holding. A
      family who nets negative reads **Still owes** in amber — with the words, never the colour
      alone.
- [ ] **Year-round honesty.** U14 is mid-season: the section still renders and still says what the
      team is holding. Where the season has planned spending left, a line under the pot says so.
- [ ] ⚠ **A finished season is a record.** Open a completed season's Money → Player Dues: the sheet
      renders with **no Pay out, no Pay all, no hold-back, no Change**.
- [ ] ⚠ **Read-only money coach.** Sign in as `qa-money-read@dev.local`: the whole sheet is
      readable and not one control is offered.
- [ ] 📱 Phone at 390px: the pot card, the table (it stacks into cards, it does not scroll
      sideways), an opened row, and the Pay out sheet.

- [ ] ⚠ **Club money, if this team has any.** Where a team has approved club funding or payments to
      the club, a line under the pot says that money **isn't counted** and why. This is a real
      limitation, not a bug: those records aren't filed against a season, so the sheet can't tell
      how much belongs to this one. **A decision is owed here** — see the note below.

**On production 2026-08-14** (job 256; migrations 230–235 applied to prod; prod HEAD `8fe59ded`).
This completes the three-pass money model; full build log in the plan.

### 22 🖥📱 Team settings becomes six closed groups, and the dues settings move into it — **ON DEV 2026-08-14**, not yet released · no migration

The two team-wide dues settings — **Automatic Dues Reminders** and **Credits reduce** — used to sit
as two cards at the bottom of Player Dues, a screen a coach opens every week to chase money. They
are set-once decisions, so the **controls** moved to Team settings under a new **Money** group and
the **sentence** stayed on Player Dues. Team settings itself became six collapsed groups, each
stating its current value on its own header line.

**Do this on a team with dues already set** (the coach sandbox works, or your own test team).

- [ ] 🖥 Open **Team settings**. Six groups, **all closed**, each with its value on the right —
      the division, the season and its status, the lineup caps, the money line, the sharing state,
      the org link. **You should be able to read how the team is set up without opening anything.**
- [ ] Open each group in turn. Every setting reads the same way: name, a line of plain English,
      the control on the right. Nothing you could do before has gone.
- [ ] Change the division and save. Change a lineup cap and **Save rules**. Both still work, and
      the closed header line updates to match.
- [ ] Open **Money**. Flip **Automatic Dues Reminders** off and on — it saves immediately, no Save
      button. Change **Credits reduce** — same. **See an example** opens the real reminder email.
- [ ] 🖥 Go to **Player Dues**. Under the table, one quiet line states both settings and offers
      **Change in Team settings**. Follow it: the Money group **opens, scrolls into view and
      flashes once**. It must not dump you at the top of a page of shut cards.
- [ ] From **Depth Chart**, use **Edit in Settings →** on the caps bar. Same behaviour — the Game
      day group opens and flashes.
- [ ] ⚠ **A team with no dues at all.** Player Dues shows a **No dues set yet** block carrying both
      controls inline *and* **Set dues for all players**. Set dues for one player: the block is
      replaced by the table and the one-line statement. The two must never both be on screen.
- [ ] Set **Credits reduce** to **"They don't — settle at season's end"** — the third option. Both
      the collapsed Money header and the Player Dues line must read as English
      (*"Credits don't reduce bills — settled at season's end"*), NOT "credits reduce they don't".
- [ ] Open **Game day**, type a number into a rule but do **not** save, then collapse the group.
      The header must still show the **saved** rules, not what you just typed. Reload to confirm.
- [ ] ⚠ **A finished season.** Open Player Dues in a past season. **The whole policy line is
      absent** — not just the link. A finished season's dues table cannot state a live setting as
      though it were the one in force at the time. (Whether an archive should restate its OWN
      policy is an open question for you — see the plan.)
- [ ] ⚠ **The treasurer.** From **Staff**, set an assistant to money **View & edit** and turn
      everything else off. Sign in as them: **Settings appears in their nav**, and the page contains
      **only** the Money group — no division, no lineup rules, no organization link. This is the
      whole reason the door widened; if they can reach anything else, that is a defect.
- [ ] A **money view-only** coach: Settings does *not* appear in their nav (nothing there for them
      to change), and the Player Dues policy line still reads correctly.
- [ ] 📱 Phone at 390px: settings group headers wrap so the value drops under the group name rather
      than crushing it; every control clears a 44px tap target.

- [ ] 🖥 **The coach demo.** Open the coach sandbox, take the guided walk to the money step, and
      read its last sentence — it should end by saying which bill a credit lands on is your call,
      set once, with Player Dues printing the answer and Team settings owning the change. Then open
      that team's **Team settings → Money** and confirm it says what the sentence promised.

**Help was updated in the same change** — the Team settings guide now describes the Money and
Sharing groups, and a new question answers *"Where did the dues reminder and credit settings go?"*

### 23 🖥📱 A fundraiser opens inside Money, and a past one tells the truth — **ON DEV 2026-08-14**, not yet released · no migration

Opening a fundraiser was the last screen in Money that threw a coach **out** of the hub — the tab
row, the Import door and the season chip all left with it. It now opens **where the list was**, as
a state of the Fundraisers tab. The same change fixed something quieter and more expensive: a past
season's fundraiser used to be shown beside **this** season's players, with the write buttons live.

**Part A — the everyday route** (a live season, head coach)

- [ ] 🖥 **Money → Fundraisers → open a drive** (the name, or **Open fundraiser**). The **tab row is
      still there** and **Fundraisers is still lit**. Click **Player Dues**: one click, straight
      there — not back-then-sideways. This is the whole point of the change.
- [ ] **← All fundraisers** puts the list back. Then open the drive again and press the **browser's
      Back button** — same result. Neither should reload the whole page.
- [ ] With a drive open, copy the address, open it in a new tab: **the same drive opens**, hub and
      all. Then visit an **old-style** address (`…/accounting/fundraisers/<id>`, from a bookmark or
      an old email) — it must land on the same screen, not 404.
- [ ] **Log an amount** for a player, then **← All fundraisers**. The list's **Total raised / Team
      keeps / Credits** for that drive must **already show the new figure** — no reload. (On the old
      page this was free; inside the hub it had to be built, so it is worth one deliberate check.)
- [ ] The drive's own **Settings** button sits beside its name, *not* up in the Money header. Change
      the rebate % and save; the facts line under the title updates.
- [ ] Switch to another tab (say **Expenses**) and come back to **Fundraisers**: you land on the
      **list**, not back inside the drive you left.
- [ ] 📱 Phone at 390px: the tab row scrolls sideways, the leaderboard stacks into one card per
      player, and **Log amount / Edit amount** are full-width and finger-sized.

**Part B — a finished season** ⚠ *this is the defect being closed; please do not skip it*

- [ ] 🖥 Use the season switcher to open a **completed** season, then **Money → Fundraisers**. Open
      one of that season's drives.
- [ ] **The players listed must be that season's roster.** If you recognise someone who only joined
      **this** year, stop — that is the original defect and it is a Tier 1.
- [ ] The **`… · Complete`** chip is on the Money header above, and a line under the leaderboard says
      whose roster this is.
- [ ] **No Settings button. No Log amount. No Edit amount.** Anywhere on the screen.
- [ ] **← All fundraisers** returns you to that season's list — **still in the archive**, not
      teleported back to the live season.

**Part C — a read-only money assistant** (live season)

- [ ] Sign in as an assistant with money **View only**: they can open a drive and read every figure,
      and there is no Settings button and no way to log an amount. Reading was never the issue.

### 24 🖥📱 Sponsors sit beside fundraisers, and the budget can tell them apart — **ON DEV 2026-08-15**, not yet released · migration **237** (dev only)

A bottle drive and a sponsor cheque are both money in, and the portal had one shape for them — the
drive's. Recording a $500 sponsor meant inventing a "fundraiser" and logging it against one player
while the rest of the roster sat at "—". The tab is now **Fundraising** and holds both.

**Part A — the list**

- [ ] 🖥 **Money → Fundraising.** Each row is **one line**: name, a kind chip, three figures, status
      and a chevron. The settings, dates and notes are inside the record, not on the row.
- [ ] The figures above the list split into **Raised — fundraisers** and **Raised — sponsors**, with
      pledged money called out separately. **All / Fundraisers / Sponsors** filters the list; the
      figures above do **not** move when you filter — they describe the season, not the filter.
- [ ] The **Status** column hugs its chips on the left, lining up with the money columns to its left
      and the chevron to its right.

**Part B — recording a sponsor**

- [ ] **＋ New** asks which kind first. Pick **Sponsor**: the form changes to a business name, an
      amount, a status, who brought it in, and their credit.
- [ ] Set the credit as a **percentage** and confirm the line underneath states the dollars
      ("= $125.00 off …"). Switch to **$** and confirm it states the percentage instead.
- [ ] Choose **Nobody in particular** for "brought in by" — the credit field should disappear
      entirely. There is nobody to credit.
- [ ] Save a **Received** sponsor with a family and a credit. Open **Player Dues** and confirm that
      family's bill dropped by exactly that amount, named after the sponsor.
- [ ] ⚠ Save a **Pledged** sponsor. It must appear in the list and in the pledged figure, and must
      **not** appear as money in on the books or as a credit on anyone's dues.
- [ ] Open the pledged one and change it to **Received** — now the money posts and the credit lands.
      Change it back to **Pledged** and confirm both are removed again.
- [ ] Open a sponsor: it shows **one row** (who brought it in, the amount, what they kept) — never a
      roster of dashes.

**Part C — the team default**

- [ ] 🖥 **Team settings → Money.** Set **Default player credit** to 50 and leave the field. Its
      collapsed header line should now mention it.
- [ ] Create a new fundraiser AND a new sponsor — both should open pre-filled at 50%.
- [ ] ⚠ Change the default to 25 and re-open an **existing** fundraiser. Its rate must be unchanged.
      The default fills in new records only; it never reaches back.

**Part D — the budget** ⚠ *this is the half that could go wrong quietly*

- [ ] 🖥 **Budget Plan → add a line.** There are now three kinds: a cost, expected fundraising, and
      **expected sponsorship**. Add one of each.
- [ ] The plan shows **two separate money-in sections**, each with its own total.
- [ ] ⚠ **Check the arithmetic.** Note the per-player figure, then add a $1,000 **expected
      sponsorship** line. Per player must go **DOWN**, by $1,000 ÷ your roster. If it goes UP, stop
      — a sponsorship is being counted as a cost and every family is being over-billed.
- [ ] **Budget vs. Actual** shows fundraising and sponsorship as separate comparisons.
- [ ] Export the Fundraising list — the spreadsheet has a **Kind** and a **Status** column.

**Part E — a finished season**

- [ ] Open a completed season's Fundraising tab: sponsors and drives both read as records, with no
      way to add or edit either.

### ⚠ ONE LIVE DEFECT ON THE PRODUCTION SHOP WINDOW — needs an owner decision

**The guided tour on the production coach sandbox now describes a fundraiser that isn't there.**
Pass 3's money beat gained the sentence *"One family owes nothing at all on their last bill: their
player sold $240 of bottles… the row reads 'covered by fundraising'"*. That copy is CODE, so it
shipped with job 256. The Bottle Drive itself is **seed data**, and a seed change does not travel
with a code release — verified against the live prod database: the `riverdale-ridge` org has **zero
fundraisers and zero credits**. A prospect taking the tour reads a sentence about a screen that
does not exist.

This is the exact drift class the demo rule in `CLAUDE.md` exists to catch: the product changed, the
story over the top of it did not follow. `check:demos` self-heals on dev only and never writes to
prod, and the nightly re-anchor shifts rows that exist — it cannot create a fundraiser.

**Two ways out, owner's call:**
1. **Re-seed the prod coach demo** (`scripts/seed-demo-coach.mjs --allow-prod`). ⚠ It WIPES and
   rebuilds the demo season's children. It is the intended repair and the demo is fictional, but it
   is a destructive write to a **public, live** marketing surface and must not be run casually.
2. **Revert the tour sentence** until the prod demo is re-seeded, so nothing on prod claims
   something untrue.

Doing neither leaves a false sentence in front of prospects.

⚠ **ONE OPEN QUESTION FOR YOU, surfaced by the review:** money a club pays a team (or a team pays
its club) is recorded against the **team**, never a season. The Money hub has always summed it
team-lifetime — fine for a live dashboard. It is **not** fine on this sheet, which sets a cash
payout ceiling and can be opened for a finished season, so the settlement deliberately **leaves it
out and says so**. The alternative is to start recording those requests against a season, which
means a migration and a backfill. Worth deciding before a club-linked team settles a season.

### 24 🖥📱 The dues grid quietens, and the settlement becomes a close-out — **ON DEV 2026-08-14**, not yet released · no migration

**What changed, in one line:** you asked why the dues table had so much text; fixing that turned up
**two things that were wrong on production**, and the settlement changed shape as a result.

**The dues grid (By installment).** Every cell used to carry an amount *and* a sentence — "paid May
12", "covered by fundraising", "overdue". The instalment's amount and date now sit **once, in the
column heading**, and each cell is a mark plus a figure **only where money is still owed**: tick =
nothing left to send, ⚠ + amount = late, half-circle + amount = part-way, faint dot = not due yet.
So every figure left on the grid is money to chase. **The grid no longer says whether cash or
fundraising settled a bill** (your call) — the player's own record still does. The footer's four
repeated "COLLECTED" cells are **deleted**: the Collection schedule band above already said all
four, with meters.

**The settlement is now a close-out, not a payment console** (your ruling). It moved from a
full-width drawer that doubled the page into **one line that opens a window**. It pays everyone
**once**, and only when the season is genuinely done; a family needing money sooner is paid from
their own record, which works all season and is unchanged.

**The two production defects this found:**
1. The Refund column was `owed back + even share − still owes`, and **`still owes` was on no
   column** — so seven rows of correct arithmetic read as arbitrary. It is now a real column and
   every row reads across; the footer totals every column, and the refunds total to exactly the
   cash the team can pay out.
2. **"Pay all" was never gated on the money existing.** The sheet already computed the shortfall and
   printed a warning *beside the live button*. Now nothing can be paid until every family is square
   **and** the team is holding enough.

Also: **negatives render in brackets** — `($152.86)` — across every coach money screen; and the
**hold-back moved above the total** it was already inside (as printed, the column was short by
exactly the hold-back).

**Where:** Money → **Player Dues**. The lens toggle picks the grid (`?duesView=installments`); the
settlement line sits at the foot and still has its own link (`?settlement=open`).

**Fixture:** the same `QA Season End U15` as §21 for a *closable* season, and `QA Mid Season U14`
for a season that must refuse. Re-seed with
`node --env-file=.env.local scripts/seed-qa-day-fixtures.mjs money`.

**Part A — the grid reads as marks, not sentences**
- [ ] **By installment** on a mid-season team: no cell carries a sentence; the amount and due date
      appear **once** in each column heading.
- [ ] A settled instalment is a **tick with no date**, whether the family paid it or fundraising
      covered it. A part-paid one shows **what is left**, not the full instalment.
- [ ] The key under the grid names all four marks. **Colour is never the only signal** — check the
      marks differ in shape, not just hue.
- [ ] A player on a **different amount or date** from the team still shows their own in the cell.
- [ ] Footer: **no labels**, just the two season figures under *Due next* and *Balance*, and the
      player count on the left. The band above still carries each instalment's progress.
- [ ] **Phone:** the grid becomes a card per player and those cards still spell each instalment out
      in words — the marks are a desktop shorthand, not the phone's only answer.

**Part B — the settlement refuses, and says why**
- [ ] `QA Mid Season U14`: the foot of Player Dues is **one line**, and opening it **does not change
      the page's length**.
- [ ] It opens on **"Not ready to close yet"**, and beside the money summary **"Before the season can
      close"** lists every condition at once. The two blockers are set in heavier ink than the two
      warnings.
- [ ] **Pay everyone and close the season is dead**, and clearly reads as dead — not as a
      highlighted button. Nothing anywhere offers to pay one family from this sheet.
- [ ] The money summary reads down: **hold back is above** *Surplus to share*, drawn as a
      subtraction, and **the column adds up as you read it**.
- [ ] Every row reads across: **owed back + even share − still owes = refund**. A family who owes
      shows a figure **in brackets**.
- [ ] Tap a row: the arithmetic explains the number, with **Change what … takes** beside it.
      Changing one family's share moves the others immediately.
- [ ] Close it, record a payment on the grid behind it, reopen it — **the figures are current**, not
      the first open's answer.

**Part C — closing a season that is ready**
- [ ] `QA Season End U15`: the checklist turns to **ticks**, the heading becomes **Ready to close**,
      and the button comes alive.
- [ ] The footer states what is going out and to how many families. **Pay everyone** writes one
      payout per player and the sheet stops asking.
- [ ] ⚠ **While it is recording, the hold-back and every row's Change are dead.** (They were not,
      until review; two money writes could overlap.)

**Part D — a payout that fails must say so**
- [ ] Hard to stage, worth one attempt: interrupt the network mid-close-out. **The failure message
      must remain on screen** after the sheet re-reads itself. (It did not, until review — the error
      was wiped in the same instant it was set, and a failed money write showed nothing at all.)

**Part E — permissions and a finished season**
- [ ] A money **view-only** assistant: no Change, no hold-back control, no close-out button —
      anywhere in the window.
- [ ] A **finished season** renders the settlement as a record with no controls.

⚠ **STILL OPEN, needs your ruling** — raised and not yet decided:
- The grid's **Due next** column still carries a caption under each figure (the same two-line shape
  removed from the instalment cells). It was kept because it is the only place saying *when* the
  next money is due and how much is already late. Decide whether it goes.
- **Closing the season does not lock the books.** It pays everyone; further edits stay possible. A
  lock is a separate decision (assumed, stated, not ruled).

---

### 25 🖥📱 A budget line stops reporting the whole category's spending — **ON DEV 2026-08-15**, not yet released · no migration

**What changed, in one line:** on Budget vs. Actual, expanding a budget line showed money spent
against its payment periods — and that money was the whole **category's**, copied onto every line
in it. A Facilities category holding *Dome rental*, *Field rental* and *Storage* reported the same
$340 dome invoice **three times**, including against lines with no spending at all.

**Why it happened:** an expense records a **category** and nothing finer — there is no field saying
which budget line it pays for. The line row above the periods already said so honestly, printing
`—` for its actual and variance; only the expanded periods invented a figure.

**What it does now:**
- A category holding **one** line keeps its period figures. There is nothing else that spending
  could belong to, so the number is correct and worth having.
- A category holding **two or more** lines shows `—` for each period's actual and variance,
  matching the line row above.
- Those categories carry one quiet sentence under their lines: *"Facilities has 3 budget lines, so
  spending is matched to the category, not to a line."*

**Nothing else moved.** Category totals, the report total, headroom, the Dues Collection card, the
Months view, and all three export formats are unchanged — none of them ever claimed a per-line
figure. This is a display correction only; the real per-line actual arrives with
`COACH_BUDGET_LINE_ALIGNMENT_PLAN.md`, which needs a migration.

**Where:** Money → **Budget vs. Actual** → **Categories** view. Expand a category, then expand a
line inside it (only lines with a payment schedule expand).

**Fixture:** any team whose budget plan has a category with **more than one line**, at least one of
them split into payment periods, and one **paid** expense filed under that category.

**⚠ The case that matters — the multi-line category**
- [ ] A category with **3 lines** and one paid expense in it: the category header still shows the
      full amount under **Actual**, with its variance.
- [ ] Expand it, then expand each line's periods: **no period on any line reports money.** Actual
      and Variance read `—` throughout. (Before this, one of them showed the money — and so did the
      other two.)
- [ ] The sentence under the lines names the category and its line count, and reads as an
      explanation rather than an error.
- [ ] The **Total** row at the foot is the same figure it was before.

**The case that must NOT have been lost**
- [ ] A category with exactly **one** line: expand it — its periods **still show real money in
      green with a variance**, and those figures still add up to the category's Actual.
- [ ] A period in that category with genuinely nothing spent still reads `—`, not `$0.00`.

**Everywhere else — confirm nothing changed**
- [ ] Switch **View** to **Months** and read the **Actual** lens: category rows carry figures, line
      rows read `—`, and the note under the grid still explains why. (Unchanged — it never had
      this bug.)
- [ ] **Export** from both views (xlsx and PDF): line rows still have blank Actual and Variance,
      and every total matches the screen.
- [ ] The Money hub **Overview** and its budget card are unchanged.
- [ ] **Phone:** expand a multi-line category and swipe the table sideways — the sentence stays
      pinned at the left edge while the money columns scroll, so the explanation is still readable
      beside the dashes it explains. *(No automated check covers this — the rendered sweep never
      expands a category, so this step is the only proof the pinning works.)*

**Help**
- [ ] Coaches help → search **"dash under actual"** or **"budget line shows nothing"**: the answer
      *"Why does a budget line show '—' under Actual?"* comes back, and what it says matches the
      screen.

---

### 26 🖥📱 Table column headings stop being the faintest words on the screen — **ON DEV 2026-08-15**, not yet released · no migration

**What changed, in one line:** the heading row on every coaches-portal table — DESCRIPTION, CATEGORY,
AMOUNT — sat on a tinted band that made it the brightest strip on the page while carrying the
faintest text on it. The tint is gone and the words are a step stronger, so a heading now reads as a
label for the rows beneath it rather than a bar you look past.

**Why it happened:** the heading passed every accessibility check, and still does — it was never
below a threshold. What made it hard to read is that it was **2.4× fainter than the data rows it
labelled** while sitting on a louder surface than they did. Nothing automated measures that
relationship, which is why five gates stayed green through it.

**Worth knowing:** this was raised as a dark-mode problem and was not one — the light/warm portal was
measurably worse. Both are fixed.

**Where:** anywhere in the coaches portal with a table. Money → **Expenses & Payables** is the screen
it was reported on; **Player Dues**, **Fundraising**, **Payments** and **Allocations** all carry the
same tables.

**The main thing to look at**
- [ ] Money → **Expenses & Payables**: the heading row no longer sits on a blue band. It reads as a
      quiet panel, and the words DESCRIPTION / CATEGORY / AMOUNT / STATUS are clearly legible without
      leaning in.
- [ ] The headings no longer draw your eye *before* the rows do — the money figures should be the
      loudest thing in the table.
- [ ] Move through **Player Dues**, **Fundraising**, **Payments**, **Allocations**: every table's
      heading looks the same as every other. No screen still shows the old tinted band.
- [ ] Open **Budget Plan** and **Budget vs. Actual** beside them: their headings and the list tables'
      headings now look like one family. (Matching these was half-done in the 14 Aug pass — this
      finishes it.)

**Both skins — this is the half that is easy to skip**
- [ ] Switch your account theme to the **light/warm** portal and repeat the first two checks. The
      olive wash should be gone and the headings should read strongly on white.
- [ ] Switch back to **dark** and confirm nothing regressed.

**⚠ The one part with no automated cover — please look at it directly**
- [ ] **Insights** (team → Insights, with enough games logged to draw a table): its headings were the
      faintest in the whole portal and moved the furthest. Confirm they are legible, that the columns
      still line up, and that the table is not newly cut off or forced to scroll sideways on a phone.
      *(The test fixture renders no insights table, so this change was reasoned from the shared rule
      rather than measured — it is the only step here without evidence behind it.)*
- [ ] **Practice plan** builder: same check on its grid. Headings a touch larger; confirm nothing is
      clipped at phone width.

**A separate fix riding along — club branding**
- [ ] Nothing to see on a normal club, and that is the expected result. A club whose brand colour is
      **not** the platform blue should no longer see that colour tinting table headings, row
      highlights or chips inside the coaches portal — staff tools stay platform-blue regardless of
      club branding, which is what the July ruling already required. If you have a red- or
      orange-branded club to hand, that portal is the place to confirm it.

**Nothing else moved.** No data, permissions, totals or behaviour changed anywhere — this is
presentation only.

---

## Group 1D · The opponent book, and the club that shares it

Four phases of one project, best read in order — P1 builds the book, P2 merges spellings and writes the
numbers, P3 fills it from the tournament, and the Club Shared Book opens it to sibling teams. The
exposure here is **notes about other people's children** and, in §1.16, a boundary between two clubs.
Test them on one team with a repeated opponent and you get all four for the price of the setup.

### 1.12 🖥📱 Opponent Scouting Book — Phase 1 — **ON DEV `72034c15`** · ✅ mig 225 on prod 2026-08-06
*Log a one-line observation right after the score; it files itself under that opponent; the book resurfaces on the schedule the week you meet them again.*

Where: **Insights → "Who are we up against?"** tile, and any game's drawer → **Scouting** tab.
Test on a team with games against a repeated opponent (toronto blue jays5 has the [qa] fixture
season; or name the same opponent on two games and score them).

- [ ] **The tile.** Insights shows a seventh tile, "Who are we up against?" — count of opponents on
      file and how many are "in the book". With zero games it reads its honest sparse line instead.
- [ ] **The list.** Every opponent you've ever named on a game, newest meeting first, all-time
      record chip (green when winning, red when losing). The amber dot appears only where
      something is written. Search filters as you type.
- [ ] **The card.** Record + {runs} for/against + streak; every meeting season by season with
      scores and W/L/T; a scrimmage wears an EXH badge and is **excluded from the record chip**
      (the record must equal Season Wrapped's counting for the same games).
- [ ] **The book line** (head coach, or an assistant granted notes): type a sentence, tap away —
      "Saved ✓" pill; reload the page and it's there with its "updated {date}" stamp. An
      assistant WITHOUT notes sees it read-only and gets no editor.
- [ ] **Log an observation** from the card: one line + optional tag chip → it appears under
      "General" with your name when more than one person has written. **As a Helper** (schedule
      only): you can still log — attributed — but see no book-line editor.
- [ ] **The eraser.** As head coach, hover an observation → ✕ removes it (anyone's). As an
      assistant/helper, ✕ appears only on your own.
- [ ] **The capture door.** Open a game vs a booked opponent, enter/save the final score → beside
      the saved scoreline a quiet link: "Add to the book on {opponent} ›". Tap → the Scouting tab
      opens; log from there and the observation lands **nested under that game** on the card.
      It must be a link, never a popup.
- [ ] **Scouting tab on any named-opponent game:** record chip + last meeting + book line + the
      two freshest observations + "Everything we know ›". A game with a blank/TBD opponent shows
      **no Scouting tab and no chip** — never a dead end.
- [ ] **Record chip on schedule rows:** upcoming games vs a known opponent wear your record
      (`2–1`) in the row; it disappears once a score is entered (the slot belongs to the score).
- [ ] **📱 Phone (390):** card is single-column, tag chips wrap, the save button goes full-width,
      the drawer tab row scrolls if tight.
- [ ] **Archive absence (the ruling):** open a **completed past season** — no Opponents tile, no
      Scouting tab, no scouting anywhere. The book serves only the live season.
- [ ] **Numbers-not-names microcopy** is present under both capture inputs ("jersey number or
      position, never by name").
- [ ] Read the guide: **Help → The opponent book** (Premium group) — and search the help hub for
      "scouting" and "opponent" (both should land on it). The platform-admin help mirror carries
      the same section automatically.
- [x] 🤖 `/simplify` (12 fixes) + `/review` funnel (high-risk tier, 4 lenses, 13 confirmed
      findings fixed incl. stale "last met", wrapped-rule fetch gap, alias-proofing, archive
      chip leak; 1 Critical refuted as another session's work) — all green after: typecheck,
      1,197 unit tests, verify:changed. Rendered layout check NOT run (no dev server) — worth
      one visual glance during this QA.

### 1.13 🖥📱 Opponent Scouting Book — Phase 2 — **ON DEV `d87fb31b`** · ✅ mig 225 on prod 2026-08-06
*Merge two spellings into one opponent; the card writes its own scouting lines from your results
and lineups; one tap briefs the staff room; the masthead nags once in game week.*

Where: an opponent's card (Insights → Who are we up against? → row), any game's drawer →
**Scouting** tab, and the team masthead in game week. Best tested on a team with the same
opponent under two spellings (name one game "Oakville Thunder", another "Thunder 12U") and 3+
scored games against one of them.

- [ ] **"Same team as…" (merge).** On a card as head coach (or notes-granted assistant): an
      **Identity** section at the foot with a quiet *Same team as…* control. Open it → the picker
      lists the OTHER book entries with their record chips. Pick one → a confirm panel states
      both records **and the unified record** before anything happens. Merge → one card: records
      combined, the other entry's observations now nested under its games here, its book line
      appended **labelled** (e.g. `[Thunder 12U] …`), and "also answers to '{spelling}'" listed.
- [ ] **Aliases hold everywhere.** After the merge: the list shows ONE row; the schedule's
      record chip appears on upcoming games under **either** spelling; either spelling's game
      opens a Scouting tab showing the unified card.
- [ ] **Un-merge.** The ✕ beside "also answers to…" splits them again on reload — the old
      spelling regroups as its own (empty-book) entry; observations logged while merged **stay
      with the merged card** (deliberate — un-merging doesn't guess which team a note meant).
- [ ] **An assistant WITHOUT notes** sees no Identity section at all.
- [ ] **"The numbers vs them"** (card, between the stat tiles and the book line): with **3+**
      counted meetings — home/away split (only when you've played both), this-season vs
      all-time (only when older seasons exist), averages, "all N decided by 2 or fewer" (only
      when literally true), biggest win · worst loss. **Every line wears a "from N games"
      chip.** With ≤2 meetings the whole block is **absent** — silence, not hedging.
- [ ] **"What worked"** (needs 2+ saved lineups vs them, pitcher sports): with lineups saved on
      2 wins and a loss where a different player pitched — "In both wins, {player} started at
      pitcher; in the loss they didn't" and "N players saw the field in every win". Scrimmage
      lineups must never feed these lines.
- [ ] **Share to staff chat** (card and Scouting tab, staff-chat holders only): tap → "Shared ✓";
      the staff room shows a snapshot **as you** — matchup + record, book line, the numbers,
      tagged observations (capped with "+N more in the book"). Edit the book line afterwards —
      the chat message must NOT change. On a team with **no staff room** (Free/Team-plan
      unentitled) the button is absent on both surfaces.
- [ ] **Game-week masthead nudge.** With a game vs a booked opponent (≥1 observation) inside
      the next 7 days: one quiet line under the team masthead — "You play {opponent} {day} —
      N observations in the book ›" → lands on that game's drawer with the Scouting tab open.
      ✕ dismisses it **for that game only** (next week's game brings it back); it never appears
      on an archived season, nor for an opponent with an empty book.
- [ ] **Drawer tag filters.** On a game whose opponent has tagged observations: chip row
      (All + only tags in use) above the observations; picking a tag filters the two shown +
      the "+N more" count. Absent when nothing is tagged.
- [ ] **Several in one sitting.** Log an observation in the drawer → "Saved — add another?"
      appears, the input clears and keeps focus; log two more → "3 saved this sitting".
- [ ] **📱 Phone (390):** numbers lines stack with their chips beneath; merge picker rows and
      confirm panel stay tappable; the masthead nudge stays one readable line.
- [ ] **Archive absence (the ruling, again for P2):** a completed season shows no numbers
      block, no merge control, no share, no nudge — no scouting anywhere.
- [ ] Read the guide: **Help → The opponent book** — the duplicate-spelling FAQ now teaches
      the merge (no more "coming in a follow-up phase"), and a new FAQ explains why the
      numbers block can be absent. Search the hub for "merge", "numbers vs them", and
      "share to staff chat" (all should land on it).
- [x] 🤖 Unit coverage: merge/un-merge round-trip incl. observation re-pointing, alias-aware
      chip lookup, insight floors at both boundaries, snapshot formatting + chat-cap
      truncation, normalizer idempotence, retry-idempotent summary merge. `/simplify`
      (10 fixes incl. route-shadowing trap removed — merge/aliases now nest under the
      opponent — masthead kept feature-free, one shared tag-filter + confirm-card pattern)
      then `/review` (high-risk funnel, 5 lenses, 13→6 confirmed findings fixed: merge
      retry double-append, non-idempotent key normalization, concurrent-merge guard,
      double-tap guards, late-error + stale-response guards; residual: a milliseconds-wide
      opposite-direction merge race would need an atomic DB function = migration — owner
      call if wanted). All green after: typecheck, 1,234 unit tests, verify:changed.
      Rendered layout check NOT run — worth one visual glance during this QA.

### 1.14 🖥📱 Opponent Scouting Book — Phase 3 — **ON DEV `d87fb31b`** · ✅ mig 225 on prod 2026-08-06
*The book fills itself: a mirrored tournament game's Scouting tab shows the opponent's other
results this weekend, assembled from the tournament we host; and the week you build practice,
Saturday's book meets Tuesday's plan.*

Where: a **mirrored tournament game's** drawer → **Scouting** tab (the tournament must run on
FieldLogicHQ), and the **practice-plan screen** in a week with a booked game. The Game-Day
handoff slice was **deliberately skipped** — Game-Day Mode is still unbuilt; both plans list it
as the integration point when it ships. Best tested with a team registered in an ACTIVE platform
tournament (published division) whose opponent has 2+ scored games that weekend.

- [ ] **"Their tournament so far"** (mirrored game only): open the game's Scouting tab → a
      dashed block between the book line and the observations — the opponent's OTHER results
      in **this tournament** (W/L letter + score + who + time), their standing ("2nd in
      Pool B" when pools exist, "in their division" otherwise), runs for/against, and a
      provenance line naming the tournament ("…refreshed each time you open this").
- [ ] **The game against YOU is not in the list** — it says "their OTHER results", and means it.
- [ ] **Refreshed on read.** As the organizer, enter a score for another of the opponent's
      games → reopen the drawer tab → the new result is there. No caching, no capture.
- [ ] **Same tournament only (the scope ruling).** The block never shows results from any
      OTHER tournament, however many this opponent has played on the platform.
- [ ] **Absent, not apologized for:** a league game or a hand-entered external-tournament game
      shows the Scouting tab exactly as before — no block, no placeholder, no excuse line.
      Same for a first game of the weekend (opponent has no results yet).
- [ ] **Public data only:** team names, scores, standing — no opposing rosters, no player or
      coach names anywhere in the block. (The payload's key set is pinned by a unit test.)
- [ ] **Practice-week bridge:** build/open a practice plan dated ≤6 days before a booked game
      whose opponent has book content → one quiet lime-spined panel above the plan: "You play
      {opponent} {day} — the book:", the book line in quotes, the freshest observation with
      its author, and **Full book · N observations ›** → lands on the opponent's card.
- [ ] **Aliases hold (P2's merge, felt here).** Name the week's game "Thunder 12U" after
      merging that spelling into "Oakville Thunder" → the panel still appears and its link
      lands on the merged Oakville Thunder card.
- [ ] **Absent otherwise:** no booked game in the 6 days after the practice → no panel; the
      game's opponent has an empty book (no line, no observations) → no panel; a book-line-only
      book → panel shows the line alone (no observation row); observations-only → the freshest
      observation without a quote line. Never a pop-up.
- [ ] **An assistant who can read the plan sees the bridge too** — it rides the same
      schedule capability as the rest of the practice screen.
- [ ] **Archive absence (the ruling, again for P3):** a completed season's read-only practice
      plan shows no bridge panel; an archived season still shows no scouting anywhere,
      including the intel block.
- [ ] **Forfeit honesty:** a forfeited game in the intel list wears a small **forfeit** chip,
      and its (invented) scoreline stays out of the for/against total beneath — the numbers
      should visibly disagree, and the chip is the explanation.
- [ ] **📱 Phone (390):** the intel rows stay one line each (opponent name truncates, never
      wraps the score away); the bridge panel wraps readably above the plan blocks.
- [ ] Read the guide: **Help → The opponent book** — new paragraphs teach "Their tournament
      so far" (incl. the honest platform-only constraint) and the practice-week panel, and a
      new FAQ answers "why don't my other games have it?". Search the hub for "their
      tournament so far" and "practice plan opponent" (both should land on it).
- [x] 🤖 Unit coverage: intel presence rules (draft tournament / unpublished division /
      non-accepted opponent / no results → absent), source-game exclusion, accepted-names-only
      resolution with placeholder fallback, forfeit counted as a result but excluded from
      totals + flagged, **per-game published-division check**, pool-scoped standing via the
      real tie-break engine, **pinned no-names payload key set**, bridge game picker (6-day
      window boundaries, cancelled/TBD/practice/behind-the-practice exclusions). `/simplify`
      (6 fixes: shared route-context resolver adopted, duplicate ordinal removed, one-line
      observation fetch instead of the whole log, parallelized independent lookups, derived
      type + CSS reuse) then `/review` (high-risk funnel, 5 lenses, 9→4 confirmed findings
      fixed: the per-game division check above — a game filed under a never-published
      division could have surfaced after a mid-tournament team move; the forfeit chip;
      epoch-safe game ordering; a latent stale-intel flash) then `/docs`. All green after:
      typecheck, 1,266 unit tests, verify:changed. Rendered layout check NOT run — worth one
      visual glance during this QA.

### 1.16 🖥📱 Club Shared Book P1 — the club's collective scouting memory — **ON DEV `d9add3cd` + `0ad5d2cc`** · ✅ mig 227 on prod 2026-08-06

> **`/review` ran 2026-08-05 (high-risk tier, retrospective — this shipped before the funnel).**
> Five lenses: cross-org leakage · plan gating · correctness · data/contract/migration ·
> regression/blast-radius. **Zero defects attributable to this work.** The two-org leakage boundary,
> the double opt-in (both switches default OFF in the migration), the server-side Club-plan gate, the
> sibling history cap and the "club layer never breaks the page" contract all hold under attack; the
> perf follow-up was verified NOT to have widened data scope. The write-guard allow-lists were **not**
> edited — the diff added a *negative* test proving the club book can never become an archive door.
> One **pre-existing, platform-wide** gap surfaced and is NOT a club-book defect: a platform-admin
> cancellation marks the subscription cancelled but never demotes `plan_id`, and no plan gate checks
> subscription status — so **every** paid feature survives cancellation, not just this one.
> ✅ **That gap is what §1.19 was built to close** (2026-08-06). This review is where it was found.
*Teams inside one club can opt in to read each other's opponent books. The 12U B coach opens
Thunder's page and inherits the A team's read on them — labelled, read-only, never blended.*

**Two switches have to be on before anything appears**, which is most of what this QA proves.
Setup, in order: (1) the org must be on the **Club** plan; (2) **Rep Teams → Shared library →
"Teams can share their opponent books with each other" → On**; (3) on **each** team, **Team
settings → "Share our book with the club" → on**. You need **two teams in the same club** with
some scouting content, ideally on the **same opponent name**. ⚠ Dev-server **restart required**
first (new files + shared modules + a migration). ⚠ **mig 227 is applied to DEV only** — do not
promote this to master before applying it to prod.

- [ ] **🖥 The admin's key:** on a Club-plan org, Rep Teams → Shared library shows the sharing
      switch at the top with the plain-language deal. Turn it **off** → open any team's
      **Team settings**: the "Share our book with the club" section is **absent entirely**
      (not greyed, not locked). Turn it back on → the section appears.
- [ ] **🖥 The coach's key + the words:** on team A, Team settings → the section reads *"Your
      book line and observations become readable by your club's other sharing teams, labelled
      with your team and each writer's name. **You'll see their shared books while you share
      yours.** Stop sharing any time — your book disappears from their pages immediately."*
      Switch it on → "Sharing with the club".
- [ ] **🖥 Both ways:** turn sharing on for team A **and** team B. On team B, open
      **Insights → Opponents → {shared opponent}**: below B's own timeline a **"From your club"**
      section appears with an **amber left edge** (your own book line stays lime/olive), showing
      **A's name**, **A's record chip**, **A's book line** labelled *"Their book line"*, and
      A's latest observations each signed **"— {writer} · {team}"**. Now do the reverse on team
      A — B's block should appear there. **Records are separate per team, never added together.**
- [ ] **🖥 Read-only across team lines:** in that club block there is **no eraser, no editor,
      no tag filter** — nothing you can click to change another team's words. Your own timeline
      above still has all of its controls.
- [ ] **🖥 "All N from {team}":** give one team **3+ observations** on the shared opponent →
      the sibling block shows **two**, then an "All 5 from 12U A ›" link that expands the rest
      in place.
- [ ] **📱 The glance (phone, ≤640):** on a game against that opponent, open the schedule
      drawer's **Scouting** tab → one quiet **amber** line: *"Your club has N more observations
      on {opponent} ›"*. Tap it → lands on the opponent card's club section, and **N should match
      what you count there** (the tab fetches only that number, by a different route than the
      card — worth confirming once that the two agree). **No sibling notes are shown inline in
      the drawer**, and the masthead nudge / practice-week panel still speak only for your own
      team's book.
- [ ] **🖥 The list marker:** Insights → Opponents — the row for that opponent wears a small
      amber book icon (hover: "Your club has shared notes on …"). A row the club knows nothing
      about wears none.
- [ ] **⚠ RECIPROCITY (the one most likely to be got wrong):** turn team B's switch **off**,
      leaving A's on. On B: the opponent card's club section is **gone**, the drawer line is
      **gone**, the list marker is **gone** — immediately, no cache to clear. Meanwhile on
      **A**, B's block has also disappeared (B stopped sharing). Turn B back on → everything
      returns.
- [ ] **⚠ THE GATE (non-Club org):** on a **Team-plan / standalone Premium** team, or any
      non-Club org: Shared library has **no** sharing switch, Team settings has **no** section,
      opponent cards have **no** club layer, and there is **no locked tease or upsell anywhere**.
      The feature should be completely invisible.
- [ ] **🖥 The archive is untouched:** switch to a **completed** season — no club layer appears
      anywhere, and Opponents is still absent from the archived-season nav (the book is a
      live-season instrument, unchanged by this build).
- [ ] **🖥 Different spellings still find each other:** on team A, merge a second spelling
      ("Thunder 12U") into the shared opponent via "Same team as…". On team B, open the
      opponent under **its** spelling → A's block should still appear.
- [ ] **🖥 Nothing leaks between clubs:** if you have a second organization with scouting
      content, confirm none of it ever appears in this club's layer. *(A two-org fixture test
      asserts this in code as well.)*
- [ ] **🖥 The record agrees on both screens** *(review fix — the one you'd most likely notice)*:
      note the record chip on team A's block inside team B's club section, then open **team A's
      own** opponent page for that same opponent. **The two must read the same.** Best tested on
      a club team with several seasons of games behind it.
- [ ] **🖥 Two spellings, two book lines, neither lost** *(review fix)*: on team A, write a book
      line on the opponent, then write a **different** book line on a second spelling of the same
      team (don't merge them). On team B, A's block should show **both lines**, one per line —
      not just the first.
- [ ] **🖥 A club hiccup can't break your own page** *(review fix, best-effort to test)*: the
      club section is an extra, never a blocker. If it ever fails to load, your own record, book
      line and observations must still render normally — you'd see the page minus the club
      section, never an error page.
- [ ] **🖥 The guide explains it:** open the coaches **Help** guide → search *"from your club"*.
      The scouting section should describe the club layer and the two switches, and two FAQs
      should answer *"what exactly do the other coaches see?"* and *"why don't I have that
      section?"*. On the admin side, the **Rep Teams** guide's Shared library section should
      describe your switch. *(Search only matches keywords, so this is a real check.)*

*(Built to mockup artifact `def742fe-…` Stage 8, owner-signed-off 2026-08-04. Deviation to flag:
none — 8a/8b/8c are built as drawn. The one added judgement is the sibling-block ORDER: the team
with the most observations reads first, then alphabetical.)*

*(✅ Post-build funnel run 2026-08-05: `/simplify` → `/review` → `/docs`. The review was
high-risk tier, 5 lenses, and **could not break any of the three gates** — cross-org leakage,
plan-gate bypass and reciprocity bypass all held under direct attack. Six defects found and
fixed; the four user-visible ones are checkbox items above. The fifth and sixth need no manual
test: observation totals are now counted exactly, and **both sharing switches re-read the
server's answer if a save fails** rather than assuming — so a switch can never sit showing "not
sharing" while the club can in fact read that team's notes. If you want to exercise that last
one, kill your network mid-toggle: the switch should settle on whatever the server actually
recorded, not on a guess.)*

---

## Group 1E · Game day on the bench — ⚠ ONE sitting, one phone

Three phases now sit on **the same screen**, and the ledger asks you twice not to test them separately.
Set one game's start time near now, open the console on a phone, and walk §1.15 → §1.17 → §1.18 without
putting it down. The bench-order check that §1.15 flags as a deviation is answered in §1.18 — do not
test it twice.

### 1.15 📱🖥 Game-Day Mode P1 — the bench console — **ON DEV `bcd695a3`** · no migration
*One phone screen for running a game: who's on the field right now, tap-to-substitute, the
score, attendance — every change saved into the same lineup the reports already read. Families
hear exactly once, at End game.*

Where: on a game day (window: arrival/2h-before-start → 3h after the end), the **schedule row**
and **Lineups hub row** grow a lime `Game day` pill, and the **masthead's "Game day" line**
becomes the door. Deep link: `…/teams/{teamId}/game/{eventId}`. **Test on a phone (≤640)** —
this screen is built for a bench, one-handed. ⚠ Dev-server **restart required** first (new
files + shared modules). ⚠ To test "live", set a game's start time near now (the window is
arithmetic, nothing is stored).

> ⚠ **Do §1.15 and §1.17 in ONE sitting — P2 has since landed on this same screen.** Two things
> below will look different from what P1's list describes, and neither is a defect: the footer
> now carries a **Note** button (so four labelled buttons, not three — that crowding is §1.17's
> first check), and the after-game recap gains a **"Moments from this game"** card *if* you
> logged any. Everything else in this section is unchanged by P2.

- [ ] **📱 Entry points appear only in the window:** a game later this week shows NO pill
      anywhere; edit its start to ~now → schedule + lineups rows grow the pill, masthead line
      links (“Open the bench ›”). Cancelled game: no pill even mid-window.
- [ ] **📱 The bench swap (two taps, one decision):** open the console → tap a bench player →
      tap an on-field player → sheet offers **From inning N on** / **This inning only**.
      Confirm → board updates, “Saved ✓” appears, and the **lineup builder shows the same
      change** (it wrote the one real grid). An open field position shows as a dashed
      “Open — RF” target while choosing.
- [ ] **📱 Abandonment is harmless (the D4 property):** make a swap in inning 2, close the
      tab mid-game, reopen the lineup builder → innings 3+ still hold the pre-game plan;
      nothing else changed anywhere.
- [ ] **📱 Quiet score:** tap the score → +1 a few runs on each side (as a FAMILY-connected
      account, confirm **no notification arrives per run**). The sheet says so in words.
- [ ] **📱 End game = the one notification:** End game → confirm sheet shows final score
      (editable), derived **WIN/LOSS/TIE** badge, tonight’s counts → Confirm & notify →
      family gets exactly ONE final-score notification; the schedule row now shows the score
      + result (result was derived server-side — set a score via the console only and check
      the row still gets W/L).
- [ ] **📱 Review mode:** after ending (or reopening the link tomorrow) the same URL is a
      read-only recap: playing-time-tonight bars + a door labelled **“Playing time — season
      report”** (NEW VOCABULARY — it must NOT say “Is playing time fair?”). Never a 404.
- [ ] **📱 Scouting handoff, door 1:** the opponent’s name in the console header is dotted-
      underlined → tap → your book on them as a sheet (observations, and on a platform-
      tournament game “Their tournament so far”). A TBD-opponent game shows a plain title, no
      door.
- [ ] **📱 Scouting handoff, door 2:** after End game, the recap carries the quiet line
      “While it’s fresh — add to the book on {opponent}?” → same capture sheet (log an
      observation right there). It’s a passive line — skipping never re-asks, nothing pops.
- [ ] **📱 Who’s here:** the sheet’s four words are the schedule tab’s exactly — **In · Late ·
      Out · No reply**. Mark an ON-FIELD player Out → the board immediately asks who covers
      their position (bench players become the targets).
- [x] **⚠ DEVIATION FOUND 2026-08-05 — RULED AND FIXED IN P3, test it in §1.18 instead.** The
      bench list was in roster order, not longest-benched-first, though mockup frame 2’s caption
      said *"Longest-benched sits on top"*. You ruled it **P3 scope** (not a P1 defect) on
      2026-08-05; it is built, with the freeze rule that decides what happens mid-inning.
      **Don’t test it here — §1.18’s first three checks cover it.**
- [ ] **📱 No-lineup fallback:** open the console for a game with no saved lineup → three
      doors (Start from a template / Everyone plays / Skip lineup). “Everyone plays”
      auto-fills a rotation and the board lights up; “Skip” runs score+attendance only.
- [ ] **🖥📱 Mirrored tournament game:** score zone is read-only (“Scored by the tournament —
      standings update automatically”), End game is absent; subs + attendance + the book door
      still work.
- [ ] **📱 Helper view (needs the helper test account):** schedule-only helper opens the
      console → “{Head coach} runs the bench.” banner, no steppers, no footer, and **no board
      at all** — the lineup data itself rides the `lineups` grant (adversarial review
      tightened this: strategy data must not flow to a bundle the capability model excludes).
      ⚠ DEVIATION from mockup frame 10, which drew the helper seeing the board read-only —
      capability model won; re-draw or re-rule if you want the board back. An attendance-only
      assistant gets Who’s here + score view, no board, no subs.
- [ ] **🖥 Archived season shows no entry point:** flip to a completed season — no Game day
      pill on any surface, and the masthead stays “Complete”. (The console route itself
      resolves only the ACTIVE season by construction.)
- [ ] **Read the guide:** Help → the Premium Coaches Portal group gains **“Game day: running
      the bench from your phone”** — the one-notification promise, the abandonment honesty,
      and the helper/assistant zone answers are all stated. Search the hub for “game day”,
      “substitution”, and “end game” (all should land on it).
- [x] 🤖 Unit coverage (54 new tests): window boundaries incl. arrival-time math; swap math
      (inherit-the-remaining-schedule, single-inning, open-slot, immutability, no-ops);
      result derivation; quiet-flag guard (score-fields-only / window-only / never mirrored —
      rejected, not silently honored); review-mode selection. Existing mirrored-game 409
      tests + the season-write-guard contract green **with no list edits** (the console joins
      neither archive list — live-season instrument by ruling). typecheck ✓ · 1,322 unit
      tests ✓ · verify:changed ✓ · 0 lint errors in the touched files. ⚠ Rendered
      `check:layout` NOT run (needs a dev server + a seeded probe GAME — the screen list has
      no game event in its fixture yet); worth one visual pass here.
      ✅ `/simplify` run (9 cleanups: one shared window/URL source for every entry point,
      memoized schedule map, parallel masthead fetches, ONE shared attendance-options module,
      shared save pill/ordinal/result rule, deduped sheets). ✅ `/review` run (high-risk
      funnel, 5 lenses, 25→17 confirmed findings ALL FIXED, 1 refuted, 3 accepted-by-design.
      The two Criticals: a console attendance tap silently ERASED a player's stored
      attendance note; and one deactivated player left in an old lineup poisoned every save
      for the whole game while End game proceeded silently. Also fixed: in-flight-save edit
      loss (score + lineup), End game accepting a cleared field as 0–0, stale substitution
      decisions applying over a changed board, pocket-the-phone save flush, helper lineup
      leak above.) Worth re-testing during QA: mark attendance from the console then check
      the schedule tab still shows the player's note; deactivate a rostered player who's in
      tonight's lineup, open the console, make a sub, confirm it saves.

### 1.17 📱 Game-Day Mode P2 — moments — **ON DEV `f03e0e46`** · ✅ mig 228 on prod 2026-08-06
*One line a coach types at the bench because they want to remember it. It reads back in the
end-game wrap, on the tagged player's page, and as one quoted line on Season Wrapped — and it
feeds nothing else, ever.*

Where: the bench console's footer grows a **Note** button (game day only, in the live window).
Deep link is P1's: `…/teams/{teamId}/game/{eventId}`. **Test on a phone (≤640)** — the footer
now holds four labelled buttons and that crowding is the point of check 2. ⚠ Dev-server
**restart required** first (new files + a migration). ⚠ Set a game's start time near now to
get the live window.

- [ ] **📱 The Note button is there, and only for people who drive:** open the console as head
      coach mid-window → footer reads **Who's here · Note · Full grid · End game** (plus the
      undo arrow once you've made a sub). Every button still takes a thumb comfortably — if it
      feels tight, say so; the fallback is moving *Full grid* up into the board header.
- [ ] **📱 Capture, and the one-sitting loop:** tap **Note** → type a line → **Save note** →
      the sheet stays open, says **"Saved — add another?"**, the keyboard stays up, and the
      line appears above the field with its time. Add a second → "2 saved this sitting". Close
      the sheet → the footer button now reads **"2 TONIGHT"**. Nothing pops, nothing pulses,
      nothing ever re-asks.
- [ ] **📱 Tagging is optional:** save one with no player tag and one tagged to a player (chips
      under the field). The tagged one shows the player's name as a chip on the line; the
      untagged one is just the line — a moment about the night.
- [ ] **📱 The 280 limit is honest:** the counter appears as you type and the field stops at
      280. **There is deliberately no edit** — a typo is removed with ✕ and retyped. Remove one
      and confirm it goes (and that the footer count drops).
- [ ] **📱 The wrap remembers:** **End game** → the confirm sheet now lists **Tonight's
      moments** above the buttons, and the closing line reads *"Moments stay with you and your
      staff. Confirming sends families the final score — nothing else."* Confirm → family gets
      exactly ONE notification, the final score, same as P1.
- [ ] **📱 A night with no moments is untouched:** run a game without tapping Note → the End
      game sheet is **identical to the P1 screen you signed off** — no empty state, no "you
      didn't add any notes", no section at all.
- [ ] **📱 After the game:** reopen the console link → the read-only recap now carries a
      **"Moments from this game"** card under playing time. No capture affordance (the window
      is closed) — read-only, as designed.
- [ ] **🖥📱 The player's page:** open a player you tagged → a **"Moments you logged"** block
      sits just above the Family season recap preview, newest first, with the honest season
      count when there are more than 8. The line under it says families don't see these.
      ⚠ **Confirm the family recap preview is UNCHANGED** — no moment may appear inside it
      (this is your Q3 ruling made real).
- [ ] **🖥 Season Wrapped, including last season:** close a season (or open an already-closed
      one) → Season's End's Wrapped card carries a **"From the bench · N moments"** strip with
      the most recent line and its game. A season nobody logged one for shows **no strip**.
      ⚠ **Then tap "Share your season"** — the exported image must NOT contain the moment
      text. That exclusion is enforced by an allow-list and pinned by a test, but eyeball it.
      ⚠ Also confirm the share image still shows everything it used to (record, streak,
      closest game, attendance, top award, lineup fact) — the allow-list touched that path.
- [ ] **📱 The unsaved-moment warning (from review):** type a line in the Note sheet, DON'T
      save, close the sheet, tap **End game** → an amber line says you have a moment typed but
      not saved. Go back, save it, return → the warning is gone and the moment is in the wrap.
- [ ] **📱 Who can't:** a schedule-only Helper's console has no footer at all, so no Note
      button (unchanged from §1.15). An **attendance-only** assistant DOES get Note — that's
      your Q1 ruling: anyone who drives the console may capture. Their console still has no
      board and no subs.
- [ ] **🖥 The archive stays closed for writing:** in a completed season there is no Game day
      pill anywhere, so no console and no way to add or remove a moment. Wrapped is the one
      place a finished season shows them (your Q4 ruling) — read-only, by construction.
- [ ] **⚠ Deviations to approve or flag (three):**
      1. **Wording.** The button says **Note** (as drawn), but every heading says **moments**
         — "Tonight's moments", "Moments you logged". The mockup said "Tonight's notes"; I
         changed it because "Notes" already means privacy-gated player notes in this portal
         and two drawers with one name is a real confusion.
      2. **The recap handoff is coach-side** (mockup frame 16, your Q3) — frame 17 was not
         built.
      3. **Wrapped's strip is one quoted line + a count**, most-recent, never a "best of" —
         we don't judge a coach's writing.
- [x] 🤖 Unit coverage (25 new tests, 1,381 total green): validation (1–280 on the trimmed
      body, optional tag, an **off-roster tag REJECTED** rather than silently filed nowhere),
      newest-first ordering incl. stability for two same-second captures, per-player selection
      (tagged only, capped, honest total), Wrapped's slot (most recent + count, null on an
      empty season, survives a deleted game's label), the capability ruling (head coach yes /
      any single drive grant yes / schedule-only Helper **no**), and **the D4 test with
      teeth**: season analytics are byte-identical with and without moments, the analytic
      stats key set is LOCKED against ever growing a moments field, and the share-card data
      is now built from an **allow-list** so no future payload field can reach the exported
      PNG. Existing mirrored-game 409 tests + the season-write-guard contract green **with no
      allow-list edits** (the moments routes join neither archive list). typecheck ✓ ·
      1,390 unit tests ✓ · verify:changed ✓ (0 lint errors in touched files) · rendered
      `check:layout` NOT run (still needs a seeded probe GAME — the footer-crowding check
      above is the human substitute).
      ✅ **`/simplify` run** (6 fixes): a real gating gap — the Wrapped moment was riding the
      card's own wide door (`hasRecordAccess`, a union of 7 duties) so a money-only or
      documents-only assistant would have read it; now on `canLogGameMoment`, failing closed.
      The share-card allow-list moved INSIDE `generateWrappedCardBlob` so no caller can bypass
      it. The player page stopped fetching the team's whole season to show 8 rows (now filtered
      + counted in SQL). Two of four indexes matched no query — replaced with one composite
      (mig 228 re-applied to dev, table was empty). DB ordering gained the `id` tiebreak so
      same-second captures can't swap between loads. One duplicate card frame removed.
      ✅ **`/review` run** (high-risk funnel, 5 lenses, 8→7 deduped→**4 confirmed and fixed**,
      3 refuted). The one High: the delete rollback restored a whole-list snapshot, so on a
      flaky connection a failed erase could resurrect an already-deleted moment or wipe one
      captured while it was in flight — the same defect class P1's review fixed for attendance;
      now re-inserts only its own row. Also fixed: an unsaved moment was silently unrecoverable
      after End game (the wrap now warns first); a stale capture error greeted a later re-open;
      a moment tagged to a since-deactivated player rendered a generic "Player" chip (chip now
      omitted, line never hidden). **The security/tenancy and regression lenses came back
      CLEAN** — no cross-team/cross-org/past-season write path, no family or notification leak
      path, and the share-image change drops nothing the card used to print.
      ✅ **`/docs` run**: the game-day guide gains the Note button, the one-sitting loop, the
      no-edit rule and the who-can-log line; two new FAQs (**"Do families see the notes I write
      at the bench?"** and **"Can I edit a note after I save it?"**); the Season's End and
      player-profile guides gain their moments paragraphs. Search terms added for "note",
      "moment", "first triple", "who can log a moment".
- Notes: **mig 228 is DEV-ONLY / PROD-PENDING**, so the schema-parity gate is red for this
  table (and for the Club Shared Book's 227) until both are promoted — expected, not a defect.

### 1.18 📱 Game-Day Mode P3 — playing-time polish — **ON DEV `d8316e87`** · no migration
*Three small things on the same bench console: the bench puts the longest-sitting player on top,
the arm-care chip finally works for teams that set one season-wide pitching cap, and the screen
stops going dark between pitches.*

Where: the same screen as §1.15/§1.17 — `…/teams/{teamId}/game/{eventId}` inside the live
window. **Test on a phone (≤640).** ⚠ Dev-server **restart required** first (new files + shared
modules + a payload change). ⚠ Set a game's start time near now to get the live window.

> ⚠ **Do §1.15, §1.17 and §1.18 in ONE sitting** — three phases now sit on this one screen.
> **This section answers §1.15's flagged bench-order deviation** ("the bench is in roster order,
> not longest-benched-first"): you ruled it P3 scope on 2026-08-05 and it is built here. Tick it
> off in §1.15 by reference — don't test it twice.

- [ ] **📱 Longest sitting on top:** with three or more on the bench, the list leads with
      whoever has sat longest and the group label reads **"Bench — longest sitting first"**.
      Ties fall back to your roster order — two players who have sat the same amount never
      trade places for no reason.
- [ ] **📱 It holds still under your thumb (the rule):** mid-inning, sub a player OFF the field.
      They join the **bottom** of the bench and **nothing above them moves**. Tap **›** to the
      next inning → the list re-sorts once, and the new longest sitter is on top. This is the
      whole point: a list that re-shuffles between the moment you look and the moment you tap is
      how the wrong child gets sent in.
- [ ] **📱 The label never lies:** the case above where you bench someone who had already sat
      several innings — they land at the bottom carrying a red "5th straight inning sitting"
      chip. The label quietly drops to plain **"Bench"** while that's true, and comes back at
      the next inning. (Found by the review; worth one look because it's the only moment the
      order and the chips can disagree.)
- [ ] **📱 The pitching chip, for a team that never set per-player caps** — the actual reason
      this phase exists. On **Team settings → lineup rules**, set **max innings pitched** to 3
      and make sure your pitcher has **no** personal cap on their profile. Open the console →
      their row now reads **"2 of 3 innings pitched"**, red at 3. **Before this it showed
      nothing at all.**
- [ ] **📱 A personal cap still wins:** give that same pitcher their own max innings of 5 on
      their profile → the chip reads **"… of 5"**, not 3. ⚠ **Known and deliberate:** the
      lineup **auto-fill** still enforces the *stricter* of the two (it would use 3). Flagged,
      not changed here — say if you want them reconciled, it's its own piece of work.
- [ ] **📱 Silence stays silence:** clear both caps → **no chip at all** on the mound. The
      console never invents an arm-care ceiling you didn't set.
- [ ] **📱 Screen staying on:** the header chips row (beside Field / Arrive / uniform) carries
      **Screen staying on**, lit, from the moment you open a live game. Leave the phone
      untouched on the bench for a few minutes → **it doesn't sleep**. Tap the chip → it reads
      **"Screen sleeps normally"** and the phone behaves as usual again; the choice sticks for
      the rest of the game.
- [ ] **📱 It lets go when it should:** tap **End game** → the recap must **not** hold the
      screen awake. Same for opening the link the next day, and for a **schedule-only helper**
      (no chip at all — their battery is never spent on a board they can't touch).
- [ ] **📱 Nothing else moved:** no new notification of any kind, nothing new stored, the
      recap and moments unchanged, and an archived season still shows no way in.
- [x] 🤖 Unit coverage (30 new tests): the bench streak arithmetic; the sort keys and their
      roster-order tiebreak; the freeze end-to-end (a mid-period substitution moves no existing
      row, and the boundary re-sort promotes the new longest sitter); the label's
      still-sorted predicate; and cap resolution (personal over game override over season
      default, neither set = no chip). typecheck ✓ · **1,426 unit tests ✓** · P1's 54 game-day
      + P2's 22 moments tests + the mirrored-game 409s + **the season-write-guard contract all
      green with NO allow-list edits** (the console stays a live-season instrument). 0 lint
      errors in the touched files.
      ✅ **`/simplify` run** (7 cleanups): the freeze became one named helper instead of three
      hand-written copies; the sort keys are computed once per row instead of per comparison;
      **a third spelling of "the cap that applies to this player" was converged** onto the one
      shared rule (the season analytics rollup had its own copy); the wake lock became a small
      reusable hook rather than 35 lines inside a 1,500-line screen; the toggle chip styles off
      the accessibility state it already carries instead of a new attribute.
      ✅ **`/review` run** (high-risk funnel, 4 lenses, 5 findings → **2 confirmed and fixed**).
      The real one is the third checkbox above: the frozen order could keep the
      "longest sitting first" label while the chips said otherwise — the label now checks
      before it claims. Also hardened: two overlapping wake-lock requests could leave one
      untracked, i.e. a phone left awake after a game. **The security/tenancy and
      regression lenses came back CLEAN** — the new season-cap field is gated exactly like the
      lineup data it belongs to (a helper without lineup access still receives none of it), it
      carries no personal data, and the shared-helper convergence changes no number on any
      family-facing surface.
      ✅ **`/docs` run**: the game-day guide gains the bench-order rule, where the pitching
      number comes from, and the screen-staying-on paragraph; two new FAQs (**"Why don't I see
      the innings pitched chip for my pitcher?"** and **"Why did the bench list change order —
      and why didn't it?"**). Search terms added for "longest sitting first", "innings pitched",
      "arm care", "screen keeps turning off".
      ⚠ **Rendered `check:layout` NOT run — for the third phase running.** No dev server was up,
      and the sweep's fixture still has no seeded probe GAME, so the console screen isn't in it.
      This phase changes the board at 340px (a longer bench group label, a new header chip), so
      it is worth one deliberate look on a phone during QA. **Do not read this as passed.**
- Notes: **no migration** in P3. The parity gate stays red only for P2's 228 and the Club
  Shared Book's 227 — unchanged by this work.

---

# TIER 2 — daily coach actions

The work a coach does every week: Overview, the past season, practice plans, tryout day, the
first week with a new team. Wrong here is friction and lost trust, not harm.

---

## Group 2A · At a desk — the week's work

Overview, asking about your team, the archive, and both halves of Practice Plans. One sitting at a
desktop window.

### 1.1 🖥 Overview says ONE thing (Chunk I) — **LIVE ON PRODUCTION**
*One priority card, a six-tile board, a quiet tail — replacing nine contradicting bands.*
Archived plan: `archive/COACH_PORTAL_CHUNK_I_ONE_THING_PLAN.md` (its PM brief's "not started" header is stale — trust the plan).
- [ ] As head coach, open Overview on four teams: game-today · game-this-week · quiet 3+ weeks ·
      pre-season. Each shows exactly ONE anchor card, the right shape, six tiles incl. the money
      pair (Dues + Budget), and "Close out the season" on the quiet team.
- [ ] As a default assistant (money off): board shows Attendance + Playing time instead of money;
      quiet team's season-check card has NO button (sentence only).
- [ ] Assistant with money **read**: money tiles visible, zero money write actions anywhere.
- [ ] Assistant with lineups off, game-day team: anchor's action falls back to "Take attendance"
      (⚠ amended by §1.1b — once that attendance IS taken the card correctly goes button-less);
      Playing-time slot falls back to Development.
- [ ] Assistant with attendance off, game-day team: anchor goes informational (no button);
      Attendance tile is absent (not greyed).
- [ ] Assistant with schedule off: "Nothing on your schedule" never appears.
- [ ] Money coach with NEITHER dues nor budget set up: slots 5–6 collapse into one "Set up your
      team's money" tile and Attendance fills the gap (not a missing tile).
- [ ] A finished tournament sits in the tail with a "Finished" chip, never in the anchor slot.
- Note: two coaches on the same team correctly see DIFFERENT anchors — not a bug.

### 1.1b 🖥📱 The game-day card stops contradicting itself — **LIVE ON PRODUCTION 2026-08-14** (job 256) · no migration
*Owner-reported: the card showed "✓ Lineup ready" and a "Build lineup" button at the same time,
offered "Take attendance" beside a headcount proving attendance was taken, and named the venue
"1". Mockup + diagnosis: Claude artifact `137039b5` (option B). Deployment state lives in the
release-history record, not here.*
- [ ] Game today, **lineup set and attendance taken**: no "Build lineup", no "Take attendance"
      anywhere on the card. Two GREEN chips instead — "10 of 12 in" and "Lineup set".
- [ ] Same team, **hours before the game**: the card has NO button at all. This is correct, not a
      missing control — the chips carry everything and the console has nothing to run yet.
- [ ] Same team, **from the call time (or 2h before start) until 3h after the end**: the button
      appears as "Open game day" and lands on the bench console.
- [ ] Clear the lineup → the button returns as "Build lineup" and its chip flips to amber.
      Clear attendance instead → "Take attendance" returns.
- [ ] The where-line reads the VENUE and the surface — "Lab Field, Diamond 1" — never a bare
      number, and the noun matches the sport (Diamond / Rink / Court / Pitch).
- [ ] The gap in "10 of 12 in" is explained IN FULL — mark one player late, one absent and leave
      two unanswered, and the row reads "1 late · 1 out · 2 no reply". The numbers always add up.
- [ ] Every chip that goes somewhere is tappable. An assistant WITHOUT attendance access sees no
      attendance chip, and one without lineup access sees no lineup chip — the card says nothing
      rather than guessing about a read they are not cleared to make. (It must NOT say "Attendance
      not taken" to them; that was the old strip's lie.) Time, place, call time and uniform still
      show to everyone on staff.
- [ ] Cold-load the Overview on a game day with the lineup built and attendance taken: the card
      must appear ALREADY correct — it must never flash "Build lineup" or "Take attendance" first.
- [ ] The "Next up" tile below and the card now use the SAME words: "Lineup set" / "Lineup not set".
- [ ] A practice (not a game) shows no chips, and stops offering "Take attendance" once taken.

### 1.10 🖥 Ask the Front Office, Phase A — **LIVE ON PRODUCTION**
Archived plan: `archive/ASK_FRONT_OFFICE_PLAN.md` + `_PM_BRIEF.md`. Mockups (binding):
https://claude.ai/code/artifact/14a812e8-1fe0-429c-9c54-beab7a581038

On **Insights**, between "What stands out" and the report tiles, a one-line bar: **Ask about your
team**. It opens six ready-made questions; each answers in a sentence with the records underneath.

- [ ] **At rest it is ONE LINE.** Open Insights and confirm the bar costs almost no height and shows
      no questions until you tap it. It should read as a bar to tap, **not a search box** — if your
      instinct is to click and start typing, that's the defect, tell me.
- [ ] Tap it. Six questions on a diamond team. Tap **"Who hasn't played a position lately?"** — a
      position row opens **already on the position with the longest gap**, and the answer names a
      player, a gap, and the last game they played there.
- [ ] **⚠ THE SHARPEST STEP — the receipts must prove the sentence.** Whatever date the sentence
      cites ("the last time was July 12 vs Falcons"), a receipt row for **that exact game** must be
      in the list below. This broke in four places during review; it is the feature's whole promise.
      Tap through several positions and check the citation every time.
- [ ] Tap a **receipt link** — it should take you to the full report, and the back button should
      return you to the page where you left it (this is why it expands in place, not in a pop-up).
- [ ] **"What does each family still owe?"** — if you have siblings on the roster, they must appear
      as **ONE family with a combined balance**, not two rows. Check a family whose surname differs
      from the players'.
- [ ] **"Who's missed the most practices?"** — the number must match the dates listed underneath.
      If someone has an unrecorded (no-reply) practice, it must **not** count against them.
- [ ] **On a brand-new team with nothing recorded:** every question says plainly that nothing is
      recorded and names **the one thing** that would fill it in. No zeros, no blanks, no apology.
- [ ] **As an assistant coach WITHOUT money access:** the two money questions are **absent from the
      list entirely** — not greyed, not erroring on tap.
- [ ] **As an assistant with money but NOT guardian contacts:** the family answer labels families by
      **player names** ("Maya and Sam's family"), and siblings are still grouped as one.
- [ ] **In a completed season:** the ask bar is **absent from Insights**, not an empty box.
- [ ] Read the guide: **Help → Asking about your team**, and confirm the Insights help "?" opens it.

### 1.4 🖥📱 The frozen past season (Chunk F) — **LIVE ON PRODUCTION**
*Open any season you coached, read-only, exactly as you could see it then.*
Archived plan: `archive/COACH_PORTAL_CHUNK_F_FROZEN_SEASON_PLAN.md`. *(No owner checklist in the doc — sketch below.)*
**The one rule: switch seasons with the IN-APP switcher, then go TWO screens deep — the worst bug
this chunk ever had was invisible to fresh-page-load testing.**
- [ ] Rolled-forward team (live 2026 + closed 2025): switch to 2025 (sidebar on desktop) and walk
      roster → schedule → attendance → lineups → money (all five sub-pages) → documents →
      development → awards → staff → tryout history → insights. Every screen shows 2025 data,
      zero write controls, "2025 · Complete" chip present.
- [ ] Assistant whose money access DIFFERS between seasons: past season shows what they had THEN.
- [ ] Staff on a past season: capability controls read-only; "Remove access" still works and is
      refused-by-server for the removed person immediately; the one explanatory sentence reads
      right (open micro-item D-F4 — approve or reword).
- [ ] Phone: season switcher lives in the More sheet; the chip doubles as the exit (open
      micro-item D-F3 — does the chip feel tappable enough?).

### 1.8 🖥📱 The drill library (Practice Plans Phase 2) — **LIVE ON PRODUCTION**

> **Mockups you approved:** `claude.ai/code/artifact/d0f7ea26-c159-49ce-b5ec-6af60bd24173`.
> **Where:** Development → **Your drills**, plus the picker inside any practice plan.
> ~~⚠ Migration 218 is applied to DEV only.~~ **Applied to prod 2026-08-03 (with 213).**

**The point of it:** write a drill once — the setup, what you're watching for, the coaching points —
and adding it to a practice becomes four taps instead of retyping the same warm-up every Tuesday.

- [ ] **Write one.** Development → Your drills → **New drill**. Confirm there is **no "how many of
      it" field** anywhere, and that nothing suggests a category to you — the list should be *your*
      words, empty until you type them.
- [ ] **Use it.** Open a practice → **Add a block** → **From your drills** → **Preview** → add.
      The station should arrive named, set up, kitted and taught — and **empty of people**.
- [ ] **⚠ The read-only rule, which is the thing to judge hardest.** On that station the drill's own
      words are **text, not boxes**. Who runs it, who's at it and **Just for tonight** are still
      editable. Does that divide feel right in your hand, or does it feel like a wall?
- [ ] **The escape hatch.** Tap **Edit just for this practice** — every word should stay, everything
      unlocks, and the "From your drills" chip disappears. Then check the library: that drill's count
      should have **gone down by one**, because it isn't that drill any more. *(This is the whole
      bargain — the count stays honest because editing breaks the link. If it feels punitive, say so.)*
- [ ] **Two drills, one block = a rotation.** Add a second drill to the same block; the rotate toggle
      should appear on its own. This is how a carousel gets built now.
- [ ] **Save what you already wrote.** On a station you typed yourself, **Save to my drills…** should
      ask exactly one question (category, optional) and change **nothing** about tonight's practice.
- [ ] **Retire one**, then confirm a practice that already used it still reads exactly as before.
      Then restore it.
- [ ] **Add from a past season** — only meaningful if this team has plans from a previous year.
      Anything already in your library shows **greyed out** rather than hidden.
- [ ] **⚠ Wording check (I changed this deliberately):** it says **"In 8 plans"**, never "Used 8×",
      and **"Not in a plan yet"**, never `0`. We don't record what actually got run, so "used" would
      be a claim we can't back. Tell me if that reads as pedantic on screen.
- [ ] **The focus rail now filters.** With drills that have categories in a plan, off-type focus
      areas should go **faint but stay exactly where they are** — nobody disappears, nothing
      reorders, and a player with no category set stays at full strength.
- [ ] **The club's shared set** (org admin → Rep Teams → Shared library → **Drills**): add one, then
      confirm a coach sees it in their picker marked **Club**, can use it, and has **no rename or
      retire buttons at all**. ⚠ It starts empty and there's nobody to fill it on day one — that's
      the accepted cost of building both halves now.
- [ ] **In a completed season:** the **Your drills** door should be **absent** from Development, not
      a link that errors. Your drills are not lost — they belong to the team, not the season.
- [ ] **As an assistant coach** (schedule access, not head coach): the library should be **readable**
      with no write buttons, and **Save to my drills…** should not appear anywhere.

### 1.9 🖥📱 Plan templates, the recap & looking back (Practice Plans Phase 3) — **LIVE ON PRODUCTION**

> **Mockups you approved:** `claude.ai/code/artifact/7ac29440-1e16-4b0e-a22b-9e0093470107` (12 frames).
> **Where:** Development → **Plan templates** · any practice plan · Insights → **Development**.
> ~~⚠ Migration 221 is applied to DEV only.~~ **Applied to prod 2026-08-03 (with 213 + 218).**
> ⚠ 18/18 layout probes green at 361 / 390 / desktop; 913 unit tests green.

**The point of it:** you have a Tuesday you'd run again — keep it, and start from it next week. Then
say how it went afterwards, so "what did we do about hitting last spring?" has an answer.

- [ ] **Save one.** Open a practice with a plan → **Save as template…**. It should ask exactly one
      question (tags, optional), pre-filled from what the practice is already about, and change
      **nothing** about tonight. Check the wording says players and staff aren't saved.
- [ ] **Build one from nothing.** Development → **Plan templates** → **New template** on a team with
      none. You should land in a **full blocks-and-stations editor**, not a rename box.
      *(You ruled this: refusing at zero while allowing it at one is arbitrary. Judge whether the
      room earns its keep at zero, or whether it feels like a lot of screen for an empty list.)*
- [ ] **⚠ A template holds no people.** In that editor confirm there is **no Choose players, no
      "Who runs it", no group draw and no "Just for tonight"** — absent, not greyed out. The
      rotation keeps *how often groups move* but not the groups.
- [ ] **Use it.** On a practice → **Start this plan from…**. It should be **ONE control with two
      tabs** — a template *or* a previous practice — not two buttons. The old "Copy from a previous
      practice" wording should be gone.
- [ ] **⚠ THE SEAM — judge this hardest.** After loading a template, the line at the top says
      *"Started from X. This plan is yours now — edit anything."* Everything **is** editable — except
      a station that came from **your drills**, which stays read-only inside it. **Two opposite rules,
      one screen apart.** Does that read as coherent, or as a bug?
- [ ] **Nothing leaks either way.** Change tonight heavily, then reopen the template — unchanged.
      Edit the template, then reopen the practice — unchanged.
- [ ] **Rename / Retire / Restore** in the room. A retired template **dims in place** rather than
      vanishing, and a plan already started from it reads exactly as before.
- [ ] **"Started 8 plans"**, never "Used 8×", and **"Not started a plan yet"**, never `0`. Same
      honesty rule as the drill library. Tell me if it reads as pedantic on screen.
- [ ] **The filter chips.** One flat list narrowed by tags — never headings. **"No tags"** appears
      whenever it applies, so a template can't get lost by having none.
- [ ] **Your tags** (button in the room, or in Your drills). Rename one and confirm it re-labels
      **everywhere at once**. Then **Merge** two near-duplicates and confirm every drill, template,
      practice and focus area came along. ⚠ Club-shared tags should not be listed here at all.
- [ ] **How it went.** Under the plan, write a note. It should autosave, say *"about the practice,
      not about a player"*, and say families never see it. ⚠ **Confirm there is no per-player
      version anywhere** — that is a hard line, not an omission.
- [ ] **A practice with no note says so** — *"Nothing written down for this one"*, never blank.
- [ ] **⚠ The coverage answer — the one screen that names a child who's been missed.** Insights →
      **Development**. Check: **roster order only**, **no sort control on any column**, and the
      *In a plan* column shows a **tick or the words "— not in a plan yet"** — never a count, a
      percentage or an average beside a name. **The exact flag wording is yours to approve.**
- [ ] **⚠ It stays QUIET when it can't answer honestly.** On a team with fewer than three plans, or
      where you never named players in one, that column and its finding should be **absent** — not a
      screen of flags. *(This is deliberate: naming players in a plan is optional, so flagging your
      whole roster would be us misreading our own data as a coaching failure.)*
- [ ] **Practices you've run.** Filter to a tag and confirm you get every practice with that tag,
      what was in it, and what you wrote. **This is the payoff for writing recaps at all** — judge
      whether it feels worth the writing.
- [ ] **⚠ Two kinds of truth, one page.** Coverage says *planned*; only this section describes what
      happened. Tell me if that divide is legible or just looks inconsistent.
- [ ] **⚠ THE NEW ARCHIVE DOOR.** Switch to a **completed season** and open Insights → Development →
      **Open the plan →**. It should open **read-only**, with the season on the page and **no edit,
      delete, run or save controls at all**. *(You ruled this door open explicitly — everything else
      in Practice Plans stays live-season only.)*
- [ ] **And the door stays narrow.** In that same completed season, the **Schedule** must still show
      **no practice-plan section** — that was closed in 1b and is not reopened.
- [ ] **In a completed season the Plan templates door is ABSENT** from Development, not a link that
      errors. Templates belong to the team, not the season, so nothing is lost.
- [ ] **As an assistant coach** (schedule access, not head coach): the template room is **readable**
      with **no Rename, Retire, New or Your tags buttons at all**, and **Save as template…** doesn't
      appear on a plan.

---

## Group 2B · On a phone — and one of them outdoors

⚠ **§2.5 cannot be judged at a desk.** It is the run-the-practice screen, and the whole argument it makes
is about arm's length in daylight — do it standing up, one-handed, ideally outside. The other three are
ordinary phone passes and can be done anywhere.

### 2.1 📱 Mobile overlay safety + Tournaments revival (Batch 1) — **LIVE ON PRODUCTION**
Archived plan: `archive/COACH_PORTAL_LAUNCH_BATCH1_PLAN.md`.
- [ ] Every add/edit form (Add Player, Add Expense, dues credit/schedule, budget line, payment
      request, fundraiser) opens as a full-height sheet, back-arrow header, Save visible above the
      home indicator, bottom nav hidden while open.
- [ ] Long form scrolled to bottom: last field not trapped under the sticky Save bar.
- [ ] More menu on a short phone (~360×667): scrolls internally; team switcher + sign-out reachable.
- [ ] Tournaments page, three states: org team with admin-linked registration → tournament listed;
      org team without → honest "your org admin links these" copy; standalone team → "register with
      this email" + Browse public tournaments link. Sorting: live first, then upcoming, then past.
- [ ] Warm + dark themes, org-linked + standalone teams. Use a FRESH tab (the one past
      "misaligned labels" report traced to a stale tab).
- [ ] Budget modals on desktop got a slight chrome change (shared panel background) — eyeball, not
      a regression. Roster initials avatars removed on purpose.

### 2.2 📱 The "first week" bundle (Batch 2) — **LIVE ON PRODUCTION**
Archived plan: `archive/COACH_PORTAL_LAUNCH_BATCH2_PLAN.md`.
- [ ] Bulk add on an empty roster: paste mixed formats (`12 Jordan Smith` / `Jordan Smith` /
      `Jordan Smith 12`) → preview reads them; fix one row, remove one, commit. Then the
      spreadsheet tab with the CSV template.
- [ ] Duplicate jerseys (in-paste and vs. existing roster) flagged BEFORE saving.
- [ ] Add Player / Add Event: only essentials show; "+ Add details" reveals the rest; editing a
      record with extra data shows details pre-expanded.
- [ ] Permissions: granting money/contacts asks first; revoking is instant; removing an assistant
      uses the app's styled dialog, not the browser's.
- [ ] New team: momentum ring lights up across roster → game → lineup → announcement → budget;
      game-today still outranks it; ring retires when all five are done-or-skipped;
      Skip + Undo round-trip works.
- [ ] 390 and 360 widths: no sideways overflow, no button under the nav; warm + dark.
- Note: paste captures names + numbers ONLY (no emails/DOB — by design); 200-row cap with a
  visible truncation warning.

### 2.5 📱 Running a practice at the field (Practice Plans 1b) — **LIVE ON PRODUCTION**
*Tuesday night, one hand, gloves on: the plan you wrote now reads one block at a time.* 1a (writing
the plan) already PASSED your QA and is committed; **this is the second half only.**
Plan: `archive/COACH_PRACTICE_PLANS_PLAN.md`.
**Do this one OUTSIDE, or at least standing up and holding the phone one-handed — the whole screen
is an argument about arm's length, and it can't be judged sitting at a desk.**
**Fastest way in:** open a practice that has a plan → **Run practice** (also on the plan's own
toolbar). No plan handy? Ask the agent to seed a probe practice — it prints a direct link.
- [ ] **Readable at arm's length in daylight.** Block title, the countdown, the note. If you have to
      bring the phone closer, say so — that's the one thing this screen exists for.
- [ ] **Next block / Back** are easy to hit without looking. Nothing needs a swipe or a long-press.
- [ ] **A rotation:** the three group cards say who's where and who's running it; **Rotate now**
      moves everyone on; after the last round the button goes back to **Next block**.
- [ ] **Let a block run past its time on purpose.** The clock turns amber and says "Rotation due" —
      and then just waits. ⚠ **Confirm it never beeps, buzzes or moves on by itself.**
- [ ] **Start it "late":** open it, tap Next block a minute in, and check that block gets its full
      length from that moment rather than reading as already overdue. *(This was your ruling — it's
      the behaviour most worth a real-world sanity check.)*
- [ ] **"My station":** tap a station. Does it tell whoever's running it what they're doing, **what
      they're watching for**, and who's coming next? Is that genuinely enough to hand to an
      assistant who's never seen the plan?
- [ ] **Who's here tonight** opens folded shut at the bottom, read-only, and the names match
      attendance.
- [ ] **Nothing to fill in anywhere.** If you find yourself looking for a "we did this" tick, tell
      me — that's a deliberate omission and worth re-opening only if it bites you in practice.
- [ ] **In a completed season:** open an archived practice — the practice-plan section should be
      **absent entirely** (not a link that errors). *(This closed an existing bug; your call.)*
- [ ] Help "?" on the run screen opens a guide about **that** screen, not the builder.

### 2.6 📱 Phone passes of the desktop items (quick)

> The four **Chunk D** lines that used to sit here moved to **§2.6a in Tier 1** — a family reaching a
> child's schedule on a phone is an exposure question, not a layout one. Wording unchanged.

- [ ] Chunk G starter end-to-end on a phone (tap-only questions).
- [ ] Chunk H months grid scrolls sideways with first column pinned (by design).
- [ ] Chunk F: switcher in More sheet; "2025 · Complete" chip as the way back out.
- [ ] **The drill library (§1.8) on a phone — this is where it actually earns its keep.** The whole
      claim is *"a plan becomes four taps"*, and the moment that has to be true is a coach on a couch
      with about four minutes. Build a block from a saved drill end-to-end on the phone: **Add a
      block → From your drills → Preview → Add**. Count the taps. If it isn't roughly four, the
      feature hasn't delivered its point and I'd rather know that than hear it works.
- [ ] The drill library on a phone: a station that came from a drill should read as a **short block
      of text**, noticeably shorter than one you typed yourself — that contrast is deliberate, so
      you can tell at a glance where a station came from without reading a chip.
- [ ] **Plan templates (§1.9) on a phone — this is where the whole feature is meant to pay off.**
      The claim is *"next Tuesday starts from last Tuesday"*, and the moment it has to be true is a
      coach on a couch with four minutes. Do it end-to-end: **Start this plan from… → A template →
      the template → edit one block**. If it isn't faster than rebuilding, the feature hasn't
      delivered its point and I'd rather know that than hear that it works.
- [ ] **"How it went" on a phone, at home, after a practice** — that is the only moment it will ever
      be written. If typing it there feels like paperwork, it won't get written, and everything the
      looking-back list is for goes with it.
- [ ] The Development report on a phone: the coverage table reflows to **stacked cards** at ~360,
      and **Practices you've run** keeps its date, name and tags readable without sideways scroll.
- [ ] The read-only past plan on a phone: it should read as a **record** — no controls anywhere, the
      season visible, and one way back to the list.

---

## Group 2C · The free portal

The only section in the ledger about the free tier. Needs free-tier coach accounts in the coherence
states.

### 3.1 📱 FREE coach portal — Overview coherence (DF-1…DF-7) — **LIVE ON PRODUCTION**
Archived plan: `archive/FREE_COACH_OVERVIEW_COHERENCE_PLAN.md` (its PM brief's "nothing built" header is stale).
- [ ] One accepted upcoming tournament: ONE "Your tournament" block with the ⇄ fan-view link,
      no duplicate event card, 2-up tiles, Tournaments tile full-width with "See all →".
- [ ] Two tournaments, one live today: block names the LIVE one.
- [ ] All tournaments finished: block names the most recent, correct status chip.
- [ ] Brand-new team: "Let's set up your team" visible WITHOUT scrolling; tool tiles read "Not on"
      + one line each (no zeros); Tournaments tile reads 0.
- [ ] A real figure always beats "Not on" (tool off but data exists → number shows).
- [ ] Entry fee owed: Fees tile shows it in alarm styling even with the fees tool off.
- [ ] Mixed accepted + rejected entries: a REJECTED registration never headlines; a live event's
      card still shows its true status (not implied-accepted).
- [ ] Cross-check the PREMIUM Overview still names its live event correctly (shared logic was
      touched).
- Known + accepted: "ANNOUNCEMENTS" tile label wraps to two lines at 360px — override or accept.

---

## Group 2D · House league schedule — a field is picked, not typed

One sitting at a desk, one org. **The whole section is ON DEV (`240e8fbf`, 2026-08-08). Its migration 229 is
now APPLIED TO PRODUCTION (2026-08-10, verified against live `information_schema`)**, so the
release-manager step this gate used to carry is discharged — the code is safe to promote whenever QA
clears it.

Setup: `dev-league-org` (or `dev-club-org`) → **Dev House League 2026** (both already hold seeded
games with typed locations like "Maple Grove Park — Diamond 1", which is deliberate — they exercise
the typed-text path). The org venue library starts **empty everywhere**, and that is the first step,
not an obstacle.

### 8 🖥 House league fields + double-booking protection — **ON DEV** (mig 229 ✅ on prod)
Plan: `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` Phase 4. Owner rulings baked in: fields come from the
org Venue Library (not per-season copies); games and practices are ONE booking pool; "TBD" is not a
field name.

**The empty-library floor, then the library**
- [ ] With no venues defined: season → Schedule → **Add Game** shows a plain text location box plus
      a "typed locations can't be checked" hint linking to the Venue Library. Nothing is blocked.
- [ ] Organization → Venues: create "Maple Grove Park" with two diamonds. Back on the schedule,
      the game/practice/generator forms now offer a **dropdown** of those surfaces, with
      "Somewhere else (type it)" as the explicit escape. The label reads **Diamond** (softball
      season) — not a hard-coded "Field".

**The block, and the one pool**
- [ ] Game A on Diamond 1 at 6:00 PM saves clean. Game B, same diamond, 7:00 PM → **save refused**,
      and the message names game A, its time, and the diamond. Different diamond or 7:30+ → saves.
- [ ] A **practice** on Diamond 1 overlapping game A → refused, naming the game. Reverse order too:
      a saved practice blocks a game. (A booking is a booking.)
- [ ] "Any surface" at the park clashes with a specific diamond booking at the same time — the
      conservative rule, on purpose.
- [ ] **Scoring is never hostage:** on a clashing pair created via the generator (below), set a
      final score on one → saves without complaint. Only where/when changes are checked.
- [ ] Cancel (or postpone) one of a clashing pair → the slot frees; the warning strip clears on
      next load.

**Warn, don't block, where blocking would be wrong**
- [ ] Two games typed "Riverside Park" (same time) → both save, with a "possible clash" notice that
      says the match is on a typed name and may be two different places.
- [ ] Two games marked "TBD" → never a clash; they join the "no diamond set" count instead.
- [ ] **Generator** with a picked default diamond and 4 teams → saves (never blocks) and reports
      how many generated games stack on the same surface; the strip and the per-card
      **Double-booked** badges then show them.

**The honesty line**
- [ ] Games with no field at all: the schedule page shows "N scheduled bookings have no diamond
      set — not being checked", exactly as tournaments do. The seeded typed-location games do NOT
      count here (typed text IS checked, against itself).

**Edges**
- [ ] A game with an end time (6–9 PM) blocks an 8 PM booking — the default assumption is only
      90 minutes, so the long game is the proof the end time matters.
- [ ] An overnight practice (11:30 PM–12:30 AM) saves as one hour, not minus-23.
- [ ] Clearing the date but not the time on an existing game → a clear error, not a silent
      non-save.
- [ ] Help → House League → search "double-booked" → the new FAQ surfaces; the schedule recipe
      describes the Venue Library flow.
- Known + accepted: two admins saving clashing bookings in the same instant both land — the strip
  flags it on the next load (self-healing, by design). Two admins editing the SAME game is
  last-write-wins (app-wide pattern, logged as follow-up, not a Phase 4 defect).
- Families see nothing new; the public league schedule doesn't show locations.

---

## Group 2E · Tournament schedule — a field is picked, not typed

One sitting at a desk, one org. **The whole section is ON DEV (2026-08-08), no migration** — pure
code, safe to promote independently of 229. Built to the owner-approved Phase 2 mockups.

Setup: any dev org with a tournament that has venues configured (e.g. the Summer Classic pattern),
PLUS one tournament with **zero venues** (Bye Demo / Free Cup are the natural labs — they're the
fixtures this failure minted). For the library lead, one League/Club org with `org_venues` rows.

### 9 🖥 Tournament field picking + clear + import report — **ON DEV** (no migration)
Plan: `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` Phase 2. Owner rulings baked in: League/Club get the
Venue Library lead in the zero-venue prompt; setup copy says "venues", the sport noun stays on
surface picking; import auto-resolves EXACT name matches only.

**Picking is the default, typing is a choice**
- [ ] Add/Edit game window: the venue box is a **picker** (grouped by venue, with "Any diamond at
      …" per venue) — not a text box. "Somewhere else (type it)" reveals the text input, with a
      "typed locations aren't checked" hint. The label reads **Diamond** on a softball event.
- [ ] The inline schedule row's picker gets the same shape, including "Somewhere else (type it)".
- [ ] The bracket builder's field select gains the same "Somewhere else (type it)" escape.
- [ ] Pick a field → the displayed name is **derived** ("Lions Park — Diamond 2", em dash) on every
      surface (list, public schedule, exports) — whatever text was in the box before is gone.

**Clearing genuinely clears (the Phase 1 parked defect)**
- [ ] Inline row: set the picker to "— No diamond —", save, reload → the game truly has no field
      and joins the "not being checked" count. (Before: silent no-op, the old field survived.)
- [ ] Same from the Edit window, and after a timeline drag the placement matches the drop.

**Zero-venue tournament is asked, not indulged**
- [ ] On a tournament with no venues: the game window's field area is the **"No venues set up
      yet"** prompt (create + type-anyway link), not a silent text box. Same prompt on the empty
      timeline.
- [ ] On a **League/Club** org: the prompt leads with **[Import from your Venue Library]**, which
      lands on the Venues page with the import picker already open. Tournament-tier org: no
      library button.
- [ ] "Type a location anyway" reveals the text input — nothing is blocked.
- [ ] Create a venue from the prompt → the picker appears in place with the new venue selected.

**Import: exact matches link, the rest is named**
- [ ] Import a file whose Location column exactly names a real field (any casing, "Park - Diamond"
      hyphen or em dash) → the preview shows those rows linked to the real field, canonical label.
- [ ] Include rows with "Diamond 7" (×2) and "Main Field" (×1) → the preview shows a panel:
      **field names that didn't match**, each with its game count — and the file still commits.
- [ ] "TBD" rows do NOT appear in that panel (placeholder = no field, not a failed match).
- [ ] Two venues each with a "Diamond 1": a bare "Diamond 1" row stays text with a "matches more
      than one" warning — never auto-guessed.

**Scorekeeper filter reflects the day**
- [ ] A day with games on 2 of 5 configured fields: the "All fields" filter lists those 2 only.
- [ ] A game placed by typed text shows as a "…" (typed) entry, and picking it filters to that game.
- ✅ The volunteer's original empty "All fields" dropdown is **CLOSED as fixture timing, not a product
  defect** (Phase 0, 2026-08-10): the QA-lab seeder only learned to create venues on 2026-08-07, the
  same day as the report, so until that landed those games had no venue and the filter was correctly
  empty. Nothing to test here, and nothing to hand back.

**Found in `/review`, fixed — worth a targeted poke**
- [ ] Edit ONLY the notes on a game whose stored label still shows the legacy hyphen → save →
      **no family/coach "game moved" notification** goes out (the label silently canonicalizes;
      moves are judged on the actual field record now, and a test pins it).
- [ ] Generator-created game still on a temporary lane: repoint it to a real diamond, then run
      Resolve Facilities for that lane → the repointed game **keeps your pick** (it used to snap
      back to the lane's venue in silence).
- [ ] Scorekeeper: set the field filter, change the date to a day without that field → the filter
      **snaps back to All fields** instead of showing an empty board.
- [ ] Cross-club wall (needs two orgs): as org A's admin, attempt the Venue-Library import with
      org B's library-venue id → **404**, and on a Tournament-tier org the action is refused
      outright; renaming/deleting org B's library facility by id is also refused.

**Expected at QA, not defects**
- Legacy games show "Venue - Field" with a hyphen until next touched — the canonical em dash lands
  on the next save/import through them (an import update will honestly list "Location" as a change).
- The Edit window no longer *forces* a location: saving with "— No diamond —" is legal and counts
  as unchecked — that is the honest state, and the health panel says so.
- A generator-lane game shows in the pickers as "Somewhere else (type it)" with the lane's label —
  display honesty gap, logged; the Resolve Facilities panel remains the lane surface, and picking
  a real field now detaches the lane correctly.
- Known + accepted: `check:demos`' coach-sandbox attendance drift pre-dates this work (seeded coach
  data; the tournament sandbox passes and its tour copy was re-checked against these screens).

### 9b 🖥 Matching typed locations to real fields — **ON DEV** (no migration)
Plan: `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` Phase 3. Built to the owner-approved mockups
(Artifact *Phase 3 — Matching typed locations to real fields*). Owner decisions baked in: banner on
the schedule page; Undo now plus re-point forever; **completed games do convert**.

> ⚠ **Do this section on `battle-of-the-bats` (Milton) — and set its status to Active first.**
> The tournament is `completed`, so the Review button is deliberately disabled (a completed
> tournament is read-only platform-wide; this screen does not carve an exception). Event Settings →
> status Active. It is the only fixture with both typed names AND real field records, which is what
> makes the payoff visible. **Set it back to Completed when you're done.**

**Measured before-state (live dev, 2026-08-10) — this is the answer key**

| Tournament | Names shown | Games | Suggested |
|---|---|---|---|
| Battle of the Bats | 4 | 108 (all completed) | Diamond 1 / 2 / 3 exact; **Diamond 4 has no match** |
| Crimson Cup (`branded-light`) | 1 — "Field 1" | 12 | none (its fields are "diamond #1/#2") |
| Free Cup | 1 — "Community Park" | 15 | none — **zero venues configured** |
| Bye Demo | **0 — the panel is empty** | — | all 21 typed games are lane-tethered |

**The banner and the panel**
- [ ] Schedule page, Battle of the Bats: an amber banner reads **"4 locations typed by hand"** with
      "108 games name a diamond as text…" and a **Review** button. It sits with (not instead of)
      the "temporary facilities unresolved" banner — check they stack legibly.
- [ ] Review → one row per NAME with its game count, not one row per game. Four rows, biggest first.
- [ ] Diamond 1 / 2 / 3 carry a green **Exact match** chip and arrive pre-filled with the real
      diamond. Diamond 4 carries an amber **No match** chip and an empty picker.
- [ ] Under each picker, a line states the exact text that will land: *"Games will read Lions
      Sports Field — Diamond 1"*. You never type that string — confirm it reads correctly before
      applying.
- [ ] Footer counts changes and games ("3 changes · 88 games"). Apply → the three rows become green
      **Applied** rows with an **Undo**, and the banner drops to 1 name.

**The three outcomes**
- [ ] **Confirm:** apply Diamond 1 → open the schedule, those 39 games now show the real field, and
      a **rename of that diamond on the Venues page immediately propagates to them** (proof they
      hold a reference now, not text).
- [ ] **Create:** on Diamond 4, choose *+ Create "Diamond 4" at Lions Sports Field* → applies, and
      the new diamond appears on the Venues page. ⚠ Check the create option is **absent** for
      Diamond 1 (that name already exists there — a second one would be permanently ambiguous).
- [ ] **Leave as text:** choose it on any row → the line explains it stays checked only against
      other games typed the same way. Nothing is written.
- [ ] Free Cup (no venues): the only offer is *+ Create "Community Park" as a venue*, plus a
      "Set up venues" link. Apply → the venue is created and 15 games point at it.
- [ ] Bye Demo: the banner does not appear at all. Correct — its games belong to Resolve
      Temporary Facilities.

**⚠ The payoff — the reason this phase exists**
- [ ] BEFORE converting Battle of the Bats, note the schedule health panel's conflict count.
      AFTER converting Diamond 1 and Diamond 2, it should rise by **22 overlapping pairs**
      (17 on Diamond 1, 5 on Diamond 2). Those are real double-bookings that no part of the
      product could see, because 108 games said "Diamond 1" as text while 25 pointed at the
      record. **A rise here is the pass condition, not a regression.**
- [ ] The **"games not being checked" count does not move** — a typed name already counted as
      located. That is expected; the number that moves is the conflict count above.

**Undo, and the durable half**
- [ ] Immediately after applying, press **Undo** → the exact original wording comes back (check a
      game that used odd casing keeps its odd casing), and the row returns to the pending list.
- [ ] Close the panel and reopen it → the Undo buttons are gone. Expected: the record is
      session-scoped (no database change in this phase).
- [ ] Below the pending rows, **"Already linked to a diamond"** lists each field with its game
      count. Re-point one group to a different diamond → all its games move together. **This is
      how a wrong pick is fixed tomorrow**, so confirm it works after a reload.

**Nobody gets messaged (the most important check)**
- [ ] Sign in as a family/coach following a Battle of the Bats team, or watch the notifications
      table: convert a name affecting their game → **no "game moved" notice, no push, no email.**
      A conversion changes the field reference, which the product legitimately reads as a move, so
      this is the one failure that would reach real people. A test pins the route against it.

**⚠ Found in `/review`, fixed, and NOT unit-testable — these two need your eyes**
The test harness here only runs pure logic (no browser, no request tests), so these two fixes are
covered by you or by nothing:
- [ ] **An explicit "Leave as typed text" must survive an Apply.** Set row A to a real field and
      row B to **Leave as typed text**. Apply. → Row B must STILL read "Leave as typed text"
      afterwards. (Before the fix it silently snapped back to its pre-filled suggestion, so the
      *next* Apply — made for some unrelated row — would have converted a name you had twice
      declined to touch.)
- [ ] **A stale panel must not leave litter behind.** Open the panel, then in another tab delete a
      venue that one of the "Already linked" groups points at. Back in the panel, select that group
      for a move AND pick "Create …" on a typed row, then Apply. → It refuses with a clear message,
      and **no new empty venue/field appears** on the Venues page.
- [ ] **Undo must not trample someone else's edit.** Apply a name, then (another tab) hand-edit one
      of those games to a different field. Now press Undo. → The message says how many were undone
      and that 1 game was changed by someone else and left alone — and that game keeps the other
      admin's field.
- [ ] **The refusal must not loop.** Two tabs, same tournament. In tab A select two names for Apply.
      In tab B resolve one of them. Back in tab A, Apply → it explains the schedule changed, **and
      the rows refresh**. Apply again → the remaining name goes through. (Before the fix, the panel
      re-submitted the same doomed request forever.)
- [ ] Narrow the window to ~700px: the banner's **Review** button and the **×** sit side by side
      without Review stretching across the row.

**Dismissing the nudge**
- [ ] On a tournament where you deliberately left names as text, press the banner's **×** → it
      hides. Reload → still hidden. Now type a NEW location on a game → the banner returns.
      (Browser-scoped by design: "leave as text" cannot be stored without a schema change.)

**Expected at QA, not defects**
- Converting completed games makes a finished tournament start showing retrospective double-booking
  warnings for games already played. Owner-decided 2026-08-10: the product should not lie about the
  past, and it is what makes the 22 pairs visible.
- Exact matches arrive pre-selected. Apply is still your click — nothing converts without it.
- "Field 1" is never offered as "diamond #1". Near-misses are deliberately not guessed.
- ⚠ **The write path has not been exercised over HTTP by an agent** — no dev server/auth in the
  build session. The read side was validated against the live dev database (the table above is its
  real output) and the write logic is unit-tested, but **your first Apply is the first real one.**
  Undo immediately after the first Apply to confirm the round trip before doing the rest.
- Undo does NOT delete a venue or field the apply created — an undone creation leaves an empty
  record on the Venues page. Deliberate: deleting records on an undo is more dangerous than leaving
  an unused one. Delete it by hand if you don't want it.
- Creating a name that a venue already owns is refused rather than duplicated (a second
  "Diamond 1" in one park would make that name permanently ambiguous), so a retry or double-click
  cannot produce twins.

---

# TIER 3 — polish

Findability, close behaviour, the creation preview and the sandbox. Wrong here is visible and
annoying, and costs nobody anything they cannot get back.

---

## Group 3A · The coach portal — words, findability, close behaviour

§6 leads because it is the one section that asks you to **ratify wording** rather than find a defect —
it is a reading exercise, and nine invented phrases are waiting on your veto. The other three are live
damage-finding.

### 6 🖥📱 The words the app uses about playing time — **ON DEV `d8316e87`** · no migration
*A copy-only sweep. Every playing-time metric is identical; only the framing changed. The app now
says where minutes went — it never says whether that was fair. Your ruling, 2026-08-04.*

Where: Insights, the Overview board, Lineups, Attendance, a player's profile, and the family
season recap. **Nothing behaves differently** — bench warnings, pitching caps, auto-fill and the
A-squad modes all work exactly as before, so this is a reading exercise, not a clicking one.
No dev-server restart needed (copy only).

- [ ] **🖥 Insights doorway + report title:** open **Insights** → the playing-time tile now reads
      **"Where is playing time going?"**, and so does the report when you open it. The old
      "Is playing time fair?" appears nowhere.
- [ ] **🖥 Overview tile:** on a board that shows the **Playing time** tile (an assistant coach
      without money access is the reliable way to see it), the verdict reads **"Evenly spread"**
      or **"Leans on a few"** — never "Fairly even" / "Uneven". With too few lineups saved it
      still reads "Not enough yet".
- [ ] **🖥 Lineups — the empty state:** a team with no games yet shows the Lineups intro, whose
      payoff line now ends "…Insights uses it to show **where playing time has gone** across the
      season."
- [ ] **🖥 Lineups — auto-fill and Reshuffle:** open a game's lineup → the note under **Auto-fill**
      reads **"Auto-fill spreads bench time evenly across the roster."** Hover **Reshuffle** →
      the tooltip reads "Fresh arrangement with even bench rotation…". Fill the grid, then tap
      **Reshuffle** → the confirm says "…a fresh **arrangement with even bench rotation**, using
      your current auto-fill settings."
- [ ] **🖥 Lineups — the bench pill:** switch to the **Playing time** view of a filled lineup →
      beside "Bench: 1–3 innings each" the pill now reads **"Evenly spread"** (or **"Leans on a
      few"** when the spread is more than one inning), matching the Overview wording. ⚠ **Judgment
      call — say if you'd rather it stayed short** ("Even" / "Uneven"): it's a small pill and the
      long phrase is the price of consistency with the tile.
- [ ] **🖥 Position preferences tooltip:** open a player → position preferences → the help bubble's
      last line reads **"Bench time rotates evenly (no back-to-back sits)"**, describing what the
      generator does rather than promising fairness.
- [ ] **🖥 Attendance:** the season attendance page's explanatory line now reads "A season view to
      **inform playing-time decisions** and spot when someone's drifting away — not a ranking."
- [ ] **👨‍👩‍👧 The family recap — the highest-stakes one.** Open a player → **Family season recap**
      → **Preview**. A player whose minutes sat near the team middle now reads **"Right in the
      team's typical range all season"**. The above/below lines are unchanged ("Above/Below the
      team's middle for time on the field"). Read this one as a parent: nothing on the screen
      should sound like the platform is grading your coaching.
- [ ] **🖥 Help stays in step:** open **Help** and read the **Insights**, **Lineups**, **Overview
      tiles** and **Family season recap** entries — every quoted phrase matches what the screens
      now say. Then **search "fair"** — the results still come up (the old word is kept as a
      search term on purpose, because coaches will keep typing it); the answers they open just no
      longer use it.
- [ ] **⚠ Tryouts must be UNTOUCHED — the deliberate exception.** Open **Tryouts**: "names stay
      hidden **for fairness**" is still there, and the **Tryout report** still carries its
      **Fairness receipt** heading and lines. That is an evaluation-integrity promise, a different
      concept, and you ruled it stays. If any of that wording changed, the sweep overreached.

**Words I invented beyond the four you ratified** (each is a judgment call — veto any individually):
"where minutes have gone", "where the innings are going", "Auto-fill spreads bench time evenly
across the roster", "Fresh arrangement with even bench rotation", "Bench time rotates evenly",
"inform playing-time decisions", "rotates everyone evenly", "keeps bench time even across the rest
of the roster", and the lineup pill borrowing the Overview's "Evenly spread" / "Leans on a few".

**Flagged, not changed:** the tournament **schedule generator** still offers "Default **fairness**
across rest, facility moves, daily load, and time slots." That is scheduling equity between teams,
not playing time — out of scope here. Say if it deserves its own ruling.

### 1.6 🖥 Findability, desktop half (Chunk B) — **LIVE ON PRODUCTION**
Code-verified built. Archived plan: `archive/COACH_PORTAL_CHUNK_B_FINDABILITY_PLAN.md`.
- [ ] Sidebar reads **"Email families"** (not "Announcements") and it's obvious which door reaches
      parents vs. staff (Chat).
- [ ] Attendance, Chat, Settings — and on a closed season, Season's End + Insights — each carry a
      "?" opening a guide about THAT screen.
- [ ] A never-toured cold account's Overview leads with the welcome/tour card; dismiss → gone for
      good; tour still reachable from Help. (Needs a genuinely fresh account — dismissal is
      permanent.)

### 2.4 📱 Findability, phone half (Chunk B) — **LIVE ON PRODUCTION**
- [ ] More sheet: **Notifications** row at top with unread count; count also badges the More tab;
      the feed opens; "Notification settings" reaches account settings.
- [ ] More sheet reads "Email families"; sheet still fits its height cap at 361px.
- [ ] As an assistant: rows/icons present, nothing offers an action they can't perform.

### 4 🖥📱 Cross-cutting: the dismiss/Escape sweep — **LIVE ON PRODUCTION**
*One shared close-behavior for ~19 menus/panels; Escape now works where it didn't; iOS tap-to-dismiss fixed.*
Archived plan: `archive/DISMISS_BEHAVIOUR_SWEEP_PLAN.md`.
- [ ] Desktop spot-check ~6 converted panels (both More menus, notification bell, an admin schedule
      filter, the payee picker, chat emoji picker): open, interact, click-away closes, no visual
      change.
- [ ] Escape on the 7 previously-uncloseable panels: closes AND focus returns to the trigger.
- [ ] **REAL iPhone, Safari — the one check automation cannot do:** tap blank space outside an open
      More menu → it dismisses. Also: a scroll gesture starting outside a panel closes it — does
      that feel OK, not twitchy?
- [ ] Chat: clicking a reaction now also closes the emoji picker (improvement, not regression).
- Deliberately NOT converted (don't file): chat reaction/poll popovers (needs its own approval),
  the coach team switcher (deferred — file was mid-edit elsewhere). Known pre-existing, ticketed:
  payee dropdown ignores Enter/Space for keyboard users.

---

### 10 🖥📱 Forty screens open the same way — the page-header ruling, BOTH passes — ✅ **PASSED 2026-08-12**, no defects raised · commits `ad43cae1` (Pass 1) · `8e3014b3` (Pass 2) · `8247ae03` (the two owner call-backs) · no migration
*Owner walked the whole ruling in one sitting — desktop + phone, an archived season and an
assistant-coach account — and the two follow-ups in part H. **Two changes came out of the walk and
are already built and in the pass:** the Overview's title-only icon exception was retired, and the
next-event card went from five stacked rows to three (228→144px desktop, 267→199px phone), which put
the board's first row back above the fold on a phone. This section is closed; it needs no re-walk
before release.*
*Presentation only. Nothing calculates differently, no new data is fetched, no route changed, and
the archive allow-lists are untouched. What changed is the first inch of every screen.*

**The rule, in one line:** nothing renders under a page title. The team name and the season belong
to the sticky masthead; a fact that used to sit in a subtitle now leads the body it describes, or
teaches from an empty state, or is gone. Actions sit right of the title; the help "?" holds the
top-right corner at every width.

⚠ **One sitting, and you need three things open:** a desktop browser, a **390px phone**, and — for
the last two steps — one **archived season** and one **assistant-coach** account. Restart of the dev
server IS required before this section (new files + shared chrome).

**A. The shape, on a desktop.** Walk the left nav top to bottom — Overview, Schedule, Roster,
Attendance, Lineups, Development, Insights, Money, Tryouts, Documents, Email families, Coaching
staff, Team settings, Tournaments, Season's End.
- [x] Every screen: **one row** — icon, title, then actions, then "?" at the far right. No second
      line under any title, anywhere. If you find one, that is the defect this whole pass exists
      to remove.
- [x] Every section icon is the **same size** (they used to be two sizes), and seven screens that
      had no icon at all now have one: Documents, Email families, Team settings, Tournaments,
      Season's End, Link Organization, Roster player page.
- [x] The "?" is in the **same corner on every screen**. Open it on three or four — the guide that
      opens should be about *that* screen, not the help index.
- [x] No breadcrumb trail anywhere ("Coaches Portal › …" is gone from four screens — the masthead
      and the title already say where you are).

**B. The renames — do they read better, or did we break your muscle memory?** Your call.
- [x] **Insights → the coverage report** is now titled **"Is everyone getting attention?"** (was
      "Development", which is also the name of a different screen — that pairing is what we were
      trying to break).
- [x] **Tryouts → history** is now **"Tryout history"** (was "Tryouts", same as the live hub).
- [x] **Season's End** now titles itself "Season's End" rather than repeating the team name.

**C. Where the facts went.** Each of these used to be a subtitle. Confirm the fact is still findable
and now reads as part of the thing it describes:
- [x] **Team board** (Development → Team board): "Roster order — a coverage view, not a ranking" now
      leads the board itself. ⚠ **This wording is binding** — if it is missing above a board that
      HAS rows, that is a defect. (Above an empty board it is deliberately absent — there is no
      roster order there to misread.)
- [x] **Playing time**: the "one row per player, from your saved lineups" provenance is now folded
      into the line above the table that says how many games it is based on.
- [x] **Lineup builder / Practice plan**: the date, time and "View on schedule" link now sit below
      the header as the first line of the body.
- [x] **Evaluation session**: the session date. As head coach you see it in the editable Date field;
      **as an assistant with read-only access** it appears as a line above the readings. Check both.
- [x] **Tryout history**: "N sessions" joined the turnout strip rather than becoming a second strip.
- [x] **Plan template editor**: "shape · started N plans" now leads the editor.

**D. On a 390px phone.** Same walk, faster.
- [x] Every header fits **one line for the title + "?"**, with the actions on a right-pinned row
      beneath. Nothing scrolls sideways.
- [x] Secondary buttons are **icons only**; the one lime primary keeps its words. Every header
      control is comfortably finger-sized.
- [x] The masthead's role tag folds away when you scroll (the collapsed bar stays bare team name).

**E. Going back.** Every drill-in (a Money panel, a template, an opponent, a past practice, the
awards certificate, a player) has **one** back link, top-left, with an arrow.
- [x] Tap several. They all look and behave identically, and each lands one level up — **carrying
      the season you were viewing** if you are in an archive.

**F. In an archived season** (switch via the chip beside a title, or the season switcher).
- [x] The "{year} · Complete" chip sits **inside the title** on every screen that has one, and it is
      still the way back out to a live season.
- [x] **A past practice plan** (Insights → "Is everyone getting attention?" → a practice) now shows
      that chip instead of a hand-written one — and the chip is now a working season switcher there,
      which it was not before.
- [x] Nothing new became reachable in the archive. If a screen you did not expect opens read-only,
      say so — the allow-lists were deliberately untouched.

**G. As an assistant coach.** Sign in as an assistant on the same team.
- [x] Actions you are not granted are **absent, not disabled** — exactly as before the pass. This is
      the one thing a header migration could plausibly have broken, so it is worth a careful look on
      Money, Lineups, Roster and Development.
- [x] Your role reads **"Assistant Coach"** in the masthead beside the team name.

**H. The two things you sent back (added 2026-08-12).** Both on the Overview.
- [x] **The Overview now has a section icon** like every other screen — so the page title starts at
      the same place on all forty. Walk the nav again and check nothing else is still missing one.
- [x] **The next-event card is shorter.** It was 228px on a desktop and 267px on a phone; it is now
      144px and 199px. **On a 390px phone the Dues / Budget / Record row should now be visible
      without scrolling** — that's the whole point of the change, so it's the one thing to check.
- [x] The card still says the full date and time. It deliberately repeats what the team bar says,
      because the bar's copy disappears once you scroll on a phone — scroll down and confirm the
      card is still telling you when.
- [x] **The action button now sits beside the title** instead of under it. On a phone it may drop to
      its own full-width row when the title is long — that's intended; what's not intended is a
      squashed or hard-to-hit button. Check both a game and a practice.
- [x] **Game day should still be the fullest version of this card** — score, who's in, lineup ready,
      any arm-care warning. It legitimately stays taller than the others; confirm nothing went
      missing from it.
- [x] The other situations use the same card: a brand-new team ("Welcome"), a quiet week, a season
      that looks finished, and pre-season's next step. Copy is unchanged in all of them — you're
      checking the shape holds, not re-reading the words.

*Automated checks that already passed, so don't spend your time re-doing them: typecheck, 1,595 unit
tests, the full token/contrast/snapshot/dictionary chain, and the rendered 29-screen layout sweep at
four widths. Two real rendered defects were found and fixed by that sweep and are worth a glance:
the practice plan no longer scrolls sideways on a desktop, and the Lineups page's "Season insights"
link is now a proper tap target.*

---

## Group 3B · The shop window — what a prospect walks into

The creation preview and both no-login demos. ⚠ **This group is only mostly polish:** §5.2's **J2**
(the Playoffs tab) and **J3** (Results opening on something) changed the navigation of **real customers'**
tournaments, and §5.4 is the newest thing in the ledger. Everything else here costs a prospect's
impression and nothing more.

### 5.1 🖥 Tournament creation live preview (v1 + colour presets v1.1) — **LIVE ON PRODUCTION**
*While an organizer fills in the setup wizard, a phone beside the form assembles their public
tournament page in real time. Desktop-only; below ~1280px the wizard is untouched.*
Plan (with build notes): `archive/TOURNAMENT_CREATION_LIVE_PREVIEW_PLAN.md`.

Sign in as an org admin. Do this at a window **wider than 1280px** unless a step says otherwise.

- [ ] **Blank creation.** Create Tournament (from the sidebar, and again from Manage Tournaments).
      The phone appears to the right. Type a name — it lands in the headline as you type; before you
      type, the headline reads a grey "Your tournament name".
- [ ] Set a start date a few weeks out. The badge forms a full date range AND a countdown —
      "First pitch in N days". Sanity-check N against a calendar.
- [ ] Edit the public link. The address under the phone follows it. Clear it → it shows a placeholder,
      never a broken-looking URL.
- [ ] Dates in the past/present: a tournament starting **today** reads "Tournament in progress" (no
      countdown); one that already ended reads "Tournament complete".
- [ ] Step 2 (divisions): the phone's stat row fills in — division count, total team spots, and the
      event's length in days. Add/remove a division and watch it follow. **Skip** the divisions step
      → the counts go back to "TBA" rather than claiming divisions that won't exist.
- [ ] Walk through to the end. The preview stays beside you on every step and never blocks a button,
      and creating the tournament still works exactly as before.
- [ ] **Reuse path.** Create Tournament → reuse setup from a past event. The preview is **already
      filled in** the moment that screen opens (name + dates carried over). Change the name/dates and
      it follows. Its stat row stays "TBA" — divisions get copied after you create the draft, and the
      preview deliberately doesn't guess at them.
- [ ] **The no-change check (most important).** Narrow the browser below ~1280px on both paths: the
      preview is *gone entirely* — no gap, no stacked panel, no shifted buttons. The wizard should
      look and behave exactly as it does on today's shipped version. Also check a phone-width window.
- [ ] **Honesty check.** Open a real published tournament page for this org in another tab and
      compare: same colours, same date wording, same countdown wording. Note — an org whose plan
      doesn't include custom branding will correctly see the FieldLogicHQ default colours in the
      preview, because that's what its public pages actually publish in.
- [ ] The "blank or reuse?" chooser screen has no preview — that's deliberate (nothing is filled in
      yet), not a missing panel.

**Colour presets (v1.1) — needs a Tournament Plus org AND a free-plan org to judge properly:**
- [ ] **Plus org, blank creation.** A row of nine colour circles sits above the phone, starting on
      your organization's current colours with that theme's name underneath. Click through a few —
      the whole preview repaints (hero wash, date badge, Register button).
- [ ] **The pick is real.** Choose a colour that is clearly *not* your org's, finish creating the
      tournament, then open its public page (or Branding under tournament settings). It should have
      the colour you picked.
- [ ] **Untouched stays inherited.** Create another tournament without touching the row. Its Branding
      screen should show no tournament-specific theme — it follows the organization. (This is the
      point: change your org colours later and that event follows along; the one you deliberately
      coloured does not.)
- [ ] **Reuse path.** Reuse a past event that has its own colours, with "Public presence" ticked. The
      swatch row and phone should show *that event's* colours, not your organization's. Untick
      "Public presence" → both fall back to your org colours. Re-tick → back again.
- [ ] **Override on reuse.** With "Public presence" ticked, pick a different swatch and create the
      draft. The new tournament should have the colour you picked, not the copied one.
- [ ] **Free-plan org: nothing at all.** Sign in as an org on the free Tournament plan and open the
      wizard on a wide window. The preview appears, but there must be **no swatch row, no greyed-out
      circles, and no upgrade prompt** — as if the feature doesn't exist.
- [ ] **Permission check.** A member without the manage-branding permission (Members → permissions)
      should also see no swatch row, even on Tournament Plus.
- [ ] **Keyboard.** Tab into the swatch row and press Enter/Space — it should select, with a visible
      focus ring.
- Note: an organization using a *custom* colour rather than one of the nine presets will see no
  circle highlighted and the caption "your organization's own colours" — correct, not a bug.
- Note: the row only exists where the preview does, so a narrow window has no colour control.
  Branding under tournament settings remains the full-time home for colours, logos, and banners.
- Note: the phone shows the top of the page only (headline, dates, registration line, stats). No
  schedule or standings — that's the agreed v1 scope, not an omission.
- Note: there is deliberately **no colour picker** in the wizard. Custom colours are a paid feature
  and putting the swatches in free signup is a pricing decision you haven't made yet.

### 5.2 🖥📱 The "See it live" sandbox — **PHASE 1 LIVE; the tour rebuild, live pill, health panel and Playoffs tab are ON DEV `21b8e0e8`**
*A stranger with no login and no email walks into a real tournament that is running right now, on
both sides of the product: the fan pages ticking on their own, and the actual admin portal as a
demo organizer. Nothing they do is saved and nothing is ever sent to anyone.*
Plan (with build notes 1–34): `archive/TOURNAMENT_ADMIN_SANDBOX_PLAN.md`.
Binding visual spec: `archive/TOURNAMENT_SANDBOX_MOCKUPS.html` (the tour is superseded by artifact
`f1fcaff5-7777-4a9f-a166-8557686214fc`).
The narrative walkthrough (what to do, what to expect, what to judge at each beat) was delivered in
chat 2026-08-03 at the owner's request rather than as a file. This list is the tick-box record.

> **⚠ Status — this section is split down the middle.** *(Corrected 2026-08-03, re-checked 2026-08-06.)*
> **LIVE on production:** the door (**A**), the banner (**B**), the operator side (**D**), the
> locked send (**F**), the curated corners (**G**), the invented-contacts check (**H**), the
> marketing doors (**I**, still hidden in prod by default) and no-collateral-damage (**J**).
> **ON DEV, never released** (`21b8e0e8`, plus the sealing work in `d8e00f74`): the rebuilt guided
> tour (**C**), the live pill (**C2**), the pre-expanded Schedule Health panel (**E**), the sealed
> demo (**K**), the Results fix (**J3**) and the **Playoffs tab (J2)**. **J2 and J3 change what
> real customers see** — the tournament nav and the Results screen's default — so they are the two
> slices here whose blast radius is not the demo, and the reason this Tier 3 group is not purely
> cosmetic.

**Before you start — two prerequisites, both easy to forget:**

- [ ] **Check the demo's clock is actually running.** *(Re-verified 2026-08-04: it now delivers on
      its own — you should NOT need to start anything.)* Earlier in this work the demo sat **exactly
      two hours behind** with every instrument reporting healthy, which is why your first pass went
      badly: nothing was live, and two tour buttons genuinely did nothing.
      That can no longer hide. The platform-admin freshness panel now carries **two** demo rows —
      one for the schedule *firing* and one for the app *actually doing the work*. **If the second
      lags the first, delivery is broken**: run the ticker by hand in a spare terminal for the
      session (command in the plan, `--watch`) and treat the demo as untrustworthy until it's fixed.
      Confirm before you start: watch the banner countdown move, and a live score change on its own
      within a few minutes.
- [ ] **Check it's presentable at EVERY hour, not just now** *(new 2026-08-04)*. Run the full-day
      sweep (`scripts/sweep-demo-sandbox.mjs`). It replays the whole day — 84 moments across all
      twelve replays — and asserts a game is live, both dashboard cards have something in them, and
      the schedule stays healthy. ⚠ *This exists because the demo's "Up Next" card quietly emptied
      for about an hour every evening: the filler game sat four hours out, which for the late
      replays landed after midnight. Nobody caught it because every spot check happened in the
      afternoon.* If you QA in the evening and something looks thin, run this before assuming it's
      you.
- [ ] **Check it's presentable.** Run the sandbox health probe. It asserts that a game is live right
      now, the dashboard has work in it, the bracket is correct, and the schedule reads HEALTHY.
      If it reports a problem, fix that before judging anything else — you'd be QA-ing a broken set.
      It now also tells you *why* when the demo is stale, instead of quietly passing.
- [ ] **Use a FRESH private window.** The door deliberately refuses to replace an existing session,
      so if you are already signed in as yourself you get the fan side and the operator steps route
      via the door. That is correct behaviour, not a bug — but it is not what a prospect gets.

**A · The door (no login, no email)**
- [ ] From a signed-out window go to `/see-it-live`. You arrive on the **fan page** of the Riverdale
      Summer Classic. **No form, no modal, no email field appears at any point** — if one ever does,
      that is a breach of a binding decision, not a preference.
- [ ] It takes **under a minute** from pressing the door to seeing a score that moved on its own.
      Watch a live game for ~30–60 seconds without touching anything.
- [ ] Press it a second time from the same window — you land in the same place, nothing breaks.

**B · The banner (this is the honesty claim; it has to be visible)**
- [ ] The dark sandbox banner sits **above everything**, including the FieldLogicHQ navbar. It reads
      "Live sandbox", the promise, a **counting `mm:ss`** and **Start your own — free**.
      ⚠ *This was the first QA defect: the navbar painted over it and the promise vanished. If any
      bar covers it again on any page, that is the same class of bug.*
- [ ] The countdown actually counts down, second by second, and does not reset when you change page.
- [ ] Scroll a long page (Schedule, Standings). The banner **never scrolls away** and there is **no
      way to dismiss it** — no ✕, no collapse.
- [ ] Nothing underneath is hidden or cut off: the navbar, the score ticker and the page's own
      heading all sit fully below the banner, on the fan side AND in the admin portal.
- [ ] **The event title is not clipped by the live-score ticker** on the Overview page at desktop
      width. ⚠ *You caught this one: the hero reserved room for the navbar and the ticker but not
      the FieldLogicHQ strip above them, so the ticker sat on the title.* **Check a REAL customer's
      in-progress tournament too — the same bug was there**, hidden until now because the effect
      only shows once an event is underway.
- [ ] **Narrow the window to phone width.** ⚠ *Rewritten 2026-08-04 — the old check told you to
      confirm the chip rail scrolled sideways. There is no chip rail any more, and nothing scrolls
      sideways: that WAS the bug.* You should see the banner, then one row carrying the step you're
      on and one button, then the live score on its own line. **Nothing scrolls sideways, and no
      part of the tour is off-screen** — measured, 45% of it used to be. The platform's bottom tab
      bar is gone (see K), so the page reclaims that space too.

**C · The guided tour** *(rebuilt 2026-08-03 — this replaces the old chip rail entirely)*

*Your verdict on the first version was "I don't know what these buttons are supposed to accomplish,
they don't seem to do anything." That was literally true: two of them did nothing at all whenever no
game was live. What you are checking now is that pressing anything always produces something you can
see.*

- [ ] The tour is **one row**: "Guided tour · Step 1 of 4", a live score pill, four numbered dots,
      and **one lime button carrying the step's own words** ("Watch the score change by itself →").
      There is never a generic button whose effect you have to guess at.
- [ ] **The most important check.** Press the button. **A lime-edged sentence appears immediately
      underneath** saying what just happened. It stays until you move on — it does not time out.
      ⚠ *If pressing anything ever produces no visible change whatsoever, that is the original bug
      and the whole rebuild has failed.*
- [ ] Press it **when nothing is live** (the four-minute gap between the semifinal and the final —
      the pill will say "Between games"). It must **still** produce a sentence. This is the exact
      case that used to do nothing.
- [ ] The dots show position: the current step is filled lime, finished ones show a ✓. Pressing a
      dot jumps you there. A step only earns its ✓ **after it has delivered** — after you've seen
      it, or after the page it sends you to has loaded.
- [ ] Walk all four steps. They run **fan side → bracket → organizer's seat → break the schedule**,
      and your progress **carries across the flip** — you should not start again on the admin side.
- [ ] **Step 2 lands you on the actual bracket diagram**, roughly centred, with SEMIFINALS /
      FINALS and the unresolved **"Semifinal 1 winner"** slot visible. ⚠ *It used to drop you on
      the Playoffs page, which is a seeding write-up and never draws that slot — you caught this.*
      Note the nav will highlight **Standings**, because that is where this product puts the
      bracket. **Judgement call for you:** should the new **Playoffs** tab lead with the bracket
      instead of the seeding write-up? That is the shipped layout, not something this project
      changed — but the demo makes it obvious.
- [ ] After the final step, the row reads **Done** and offers **"↺ Walk it again"** (owner call
      2026-08-10: the banner's signup button is pinned directly above at every moment, so the row's
      duplicate pitch was cut; the restart clears the checks and re-arms the tour).
- [ ] Progress lasts the visit and is gone in a brand-new private window.
- [ ] **The step count is the same whether or not you are signed in** (four, always). Only where the
      operator steps *point* changes — signed in as yourself, they route via the door.
      ⚠ *The old ledger said you'd see two chips signed-in. That was wrong about the shipped code.*

**C2 · The live score strip, and the run landing** *(reworked after your second pass)*

*You pressed "watch the score change by itself", the score sat at 3–8, and you reported it broken.
The clock was fine — it moved five minutes later. The button was the problem: it promised something
that arrives on the tournament's clock, not on your click. Step 1 is now called **"Show me the game
that is live"**, and the waiting is handled explicitly.*

- [ ] Press step 1. The sentence underneath ends with **"Next run in about 1:32 — watch it land"**
      (or, if the next run is further off, **"— carry on, and it will flag itself"**). That number
      **counts down every second**. ⚠ *You should never be left staring at a score with no idea
      whether or when it will move.*
- [ ] The strip shows the game, the score, and **"changed 2:27 ago"**, counting up.
- [ ] **Wait for a run** (up to ~7 minutes; do something else in the demo meanwhile — the strip
      follows you onto every page, including the admin side). When it lands: the strip **lights up
      lime**, reads **"just scored"**, and the sentence becomes **"There it is — now 11–4."**
      ⚠ *This is the moment the whole sandbox exists to sell. It used to happen in total silence.*
- [ ] During the gap between games the strip turns amber and reads **"Between games · final in
      2:41"**, counting down.
- [ ] ⚠ **Across a replay boundary — the check you can only do by waiting** *(added 2026-08-04)*.
      The adversarial review found the strip announcing **"There it is — now 0–0"** at two moments
      where nothing had scored: when the semifinal hands over to the final, and at every replay
      reset. Twice per cycle, for ever — the exact false claim this rebuild existed to remove.
      **Watch the banner countdown reach zero.** When the tournament replays, the strip must go
      quiet and simply show the new game — **never "just scored", never a celebration at 0–0**.
      Same at the semifinal→final handover.
- [ ] In the closing couple of minutes before a replay, the sentence must **not** promise
      "Next run in about…". There is no next run — the tournament resets instead.

**D · The operator side (the beat that sells)**
- [ ] From the fan page, "See the organizer's side" lands you on the **real game-day dashboard** —
      Now Playing, Up Next, Needs a Score, Schedule Health. It is the shipped dashboard, not a mock.
- [ ] **Needs a Score is not empty** and **Up Next is not empty**. A dashboard with nothing to do
      sells nothing; the seed guarantees both.
- [ ] The banner's wording changes on this side to "You're signed in as a demo organizer. Changes
      show on your screen but are never saved."
- [ ] Flip back to the fan view from the header pill. Both directions work.

**E · Try to break it (the moment the sandbox is built around)**
- [ ] Open the Schedule. The **Schedule Health panel is already expanded** and the lime invitation
      line — *"Try it — drag a game onto a slot that's already busy…"* — is visible **without you
      clicking anything**, with a **Put it back** button.
      ⚠ *It used to arrive collapsed, so the tour rang a closed drawer and the invitation was hidden
      behind a click nobody knew to make. A real customer's schedule still opens collapsed.*
- [ ] Drag a game onto a slot that creates a clash. **Your move stays on screen** and the health
      score and conflict count **react immediately**. It must NOT snap back.
- [ ] A quiet toast appears: *"Nothing is saved in the sandbox."* It never says "error" or "failed",
      never blames you, and disappears on its own.
- [ ] Press **Put it back** — the schedule returns to how it was. You cannot wedge the demo.
- [ ] Reload the page. Your change is gone, because it was never written down.
- [ ] Try a few other saves anywhere in the portal (edit a team, change a setting). Every one of them
      should produce the same calm toast — **never a raw error screen**.

**F · Locked, not broken**
- [ ] Open Communications and compose a message to coaches. Subject and body type normally — you can
      see exactly what an organizer would write and who it would reach.
- [ ] The **Send button is greyed out before you press it**, with a line beneath: *"🔒 The sandbox
      never sends anything to anyone."* It must not look like a send that failed.

**G · The curated corners (hidden, never dead-ended)**
- [ ] In the sandbox's admin sidebar there is **no Data Tools, no Settings & Access, and no Event
      Settings**. Everything else — dashboard, teams, schedule, results, check-in, staff kit,
      communications, chat, venues, divisions, rules, public site — is present and reachable.
- [ ] Check the same on a phone-width window: the More sheet must not offer them either.
- [ ] ⚠ *Judgement call for you:* hiding **Event Settings** follows the ratified "deep settings
      forms" wording but costs the demo a genuinely product-y screen. If you'd rather show it, say
      so — it is a one-line change.

**H · It cannot be mistaken for a real association**
- [ ] Every contact you can find in the demo is an obviously invented `@example.com` address.
- [ ] The demo tournament does **not** appear on Discover or in public search on this site.
- [ ] View the fan page source and confirm it asks search engines not to index it.

**I · The marketing doors (development only)**
- [ ] On the homepage, the **Tournament** persona card carries a second link — *"See it live — no
      signup →"* with a pulsing dot — and the card as a whole still goes to the organizer page when
      you click anywhere else on it.
- [ ] On `/for-tournament-organizers`, a lime-outlined **"See it live →"** sits beside "Start Free",
      with the line *"No signup. Walk into a tournament that's running right now."* underneath.
      "Start Free" is still visibly the primary action.
- [ ] The other three persona cards are unchanged.
- [ ] ⚠ These are **hidden in production by default**. Turning them on for real customers is a
      separate release step you and I do together, with its own decisions-log entry.

**K · The demo is sealed — no wandering out** *(new 2026-08-04, your request)*

*Build note 25 had deliberately let a visitor walk out onto the marketing site with the demo hat
coming off. You reversed that: a prospect who wanders out of a demo has simply been lost. Ten doors
were closed; audited to zero at desktop and phone width, on both sides.*

- [ ] On the fan pages, the **FieldLogicHQ wordmark is still visible but no longer clickable**, and
      there is **no Discover link, no account icon, no Sign In**. Hidden rather than greyed out — a
      control that looks pressable and isn't is worse than one that never invited the press.
- [ ] **On a phone there is no bottom tab bar** (Home · Scores · Chat · Account all led out).
- [ ] In the **organizer's seat**, same again: wordmark inert, no account door.
- [ ] **Two doors deliberately remain, and must still work:** the **⇄ ADMIN** flip (the tour's third
      step) and **Start your own — free** in the banner. Follow the CTA and confirm it reaches
      signup — that is the entire point of the demo.
- [ ] Try to leave any other way. You shouldn't be able to. ⚠ *Tell me if that reads as a cage
      rather than a frame — it's a judgement call and it's yours.*
- [ ] **On a REAL org, none of this applies:** wordmark links, Discover is there, and the phone
      bottom bar is back with its usual spacing. *(Checked in J below too — it matters most there.)*

**J3 · Results opens on something — ANOTHER real-customer change** *(new 2026-08-04)*

*You landed on Results and got "No games found." on a tournament with fifteen games. It was showing
only games still needing a score, and that division's were all played. Changed for everyone.*

- [ ] In the demo, **Results shows games immediately** — no empty screen.
- [ ] The status chips above still work; switching to just "needs a score" narrows as before.
- [ ] **Turn every status chip off.** You should get *"N games here — all hidden by the status
      filters above"* and a **Show all games** button that brings them back. It must never just say
      "No games found" when games exist.
- [ ] Pick a division with no playoff games and switch to the Playoff view: it should tell you how
      many games are in the pool round and offer to switch, rather than going blank.
- [ ] **On a REAL org:** Results opens showing everything on a tournament you have not filtered
      before. ⚠ *If you have used that screen already, your own filter choice is remembered — that
      is deliberate. Check in a private window to see what a new organizer gets.*

**J2 · The Playoffs tab — a REAL-CUSTOMER change, please look properly** *(new 2026-08-03)*

*The bracket page has existed for a long time with **no way in from anywhere**: no entry in the side
rail, the phone tabs or the desktop top bar, on any tournament. The overview only offered a link
once every pool game had finished. The demo made it obvious — its tour sent strangers there and left
them stranded — but this was every customer's gap, so it is fixed for everyone.*

- [ ] On a **real** tournament that has a bracket set up, **Playoffs** now appears in the nav
      **directly after Standings** — in the desktop side rail, the phone tab row, and the desktop
      top-bar links. Check all three; they should agree.
- [ ] Open it. The page renders (it always did), and the tab is marked as the current page.
- [ ] On a tournament with **no bracket configured**, there is **no Playoffs tab**. It must not
      appear speculatively.
- [ ] On a tournament where you have **hidden Standings**, there is **no Playoffs tab** — the
      bracket is a seeding view, so hiding standings must not leak seeding through it.
- [ ] **A bracket-only tournament shows its Playoffs tab AND its bracket page** *(fixed 2026-08-04)*.
      ⚠ *These could previously never show a bracket at all — the page hid itself because that
      format has no standings, and the tab matched the page. The format most defined by having a
      bracket was the only one that couldn't display one.* Its nav has no Standings tab (correct —
      there is no round robin), and Playoffs sits where Standings would have been.
- [ ] **On a real tournament whose bracket was built without setting a "teams qualifying" number**,
      the tab still appears. ⚠ *My first gate keyed on that number and silently skipped a live
      customer event with 29 playoff games already scheduled.*
- [ ] Everywhere: **the tab appears exactly when the page renders.** Never a tab leading to
      "Playoff Picture unavailable", never a bracket page with no way in.
- [ ] The tab does **not** appear and disappear as pool play finishes. It is there from the start
      or not at all.
- [ ] Nothing else in the nav moved or changed.

**J · No collateral damage to real customers** *(the most important section)*
- [ ] Open a **real** org's public tournament page and its admin portal. No banner, no tour row, no
      toast, nothing moved by a pixel — the navbar, sidebar, event header and score ticker sit
      exactly where they always did.
- [ ] A real org's **Schedule Health panel still opens collapsed** on the schedule screen.
- [ ] The full nav (Data Tools, Settings & Access, Event Settings) is present for a real org.
- [ ] Sign in as a real org admin, then type a **different** org's `/admin` URL. You should land on
      **your own workspace** — not a login page, and above all not a flashing loop. *(This loop was
      pre-existing and hit anyone doing this; the sandbox just found it.)*

**✅ RESOLVED (and it turned out to be stale):** the signed-in-door question was already ruled
(2026-08-03, option a) and already BUILT — pressing "See it live" while signed in lands on a
confirm screen before your session is touched. Re-affirmed with mockups 2026-08-04 and the
screen's copy aligned to them. **QA (30 seconds, you're the perfect tester since you're always
signed in):** press the door while signed in as yourself → you should see *"Step into the
organizer's seat?"* naming your email, with a lime **Continue** button and a quiet **"Stay in my
account — watch as a fan"**. Decline → you're on the fan page, still signed in. Press again and
continue → you're the demo organizer; signing back into your own account works normally after.

### 5.3 🖥📱 The moments dock (Phase 2) — **ON DEV `c1aed60c`**

The demo's year in three tabs. One org, three tournaments; nothing about the write block, the
outbound silence or the door changed. ⚠ *The dev scheduler still doesn't reach this environment —
run the tick by hand before QA if the countdown looks stale.*

**A · The dock itself** (start at `/riverdale-minor-ball/summer-classic`)

- [ ] A slim **"The year"** row sits between the banner and the tour: **Registration week
      (3 weeks before) · Game day (happening now, red dot) · The morning after (ended yesterday)**.
      Game day is underlined.
- [ ] Press **Registration week**. You land on the Invitational's public page, the underline moves,
      the banner's clock slot now reads **"First pitch in 3 weeks"** (not "Replays in…"), and the
      narration strip says you jumped three weeks back.
- [ ] Press **The morning after**. The Season Opener's page: **"Tournament complete"** hero,
      champion banner (**Cedar Hollow Cyclones def. Riverdale Rapids**), final record below; the
      clock slot reads **"Wrapped up yesterday"**.
- [ ] The **live score pill keeps showing the Summer Classic's game in every moment** — the proof
      the demo is alive follows you.
- [ ] On a phone (~390px): all three tabs fit on one line, nothing covers the banner, and the
      page never scrolls sideways.

**B · Registration week, organizer's seat** (flip to the operator side first)

- [ ] Press **Registration week** in the dock. You land on the **Teams** screen already editing
      the Invitational, with **Registration Health arriving expanded**: score, **11/16 · 69%
      filled**, 3 unpaid, **1 past due**, 2 pending review.
- [ ] **U11 reads full (8/8) with 2 waitlisted** — the close-registration moment. U13 has spots.
- [ ] **Accept** a pending team: the change shows on screen and the familiar **"Nothing is saved
      here"** toast appears. Refresh — it's back to pending.
- [ ] The sidebar's **"Editing Tournament"** dropdown now exists and agrees with the dock.

**C · The morning after, organizer's seat**

- [ ] Press **The morning after**. You land on the **Post-Event Summary**: registration totals
      (8 accepted / 1 rejected), payments fully collected, 15/15 games, U11 champion, and the
      **"Reuse setup"** nudge. Pressing it produces the blocked-save reassurance, not an error.

**D · The tour, now six steps**

- [ ] The tour reads **Step N of 6**. Steps 1–4 behave exactly as you QA'd them.
- [ ] Step 5 **"Go back three weeks"** lands on the Invitational's Teams screen, rings the health
      panel, and narrates the week's work. Step 6 **"Skip to the morning after"** lands on the
      Post-Event Summary and narrates the close. **Done** ends on **"↺ Walk it again"** (the row's
      signup duplicate was cut 2026-08-10 — the banner's pinned CTA is the one ask).
- [ ] Old tour progress does not carry over (the step list changed shape — everyone starts fresh).

**E · Nothing leaked**

- [ ] Signed out entirely, the two new events' public pages render read-only; registering on the
      Invitational is blocked with the toast; no email of any kind arrives for anything above.

### 5.4 🖥📱 The Coach Sandbox — five moments + the guided tour — **ON DEV · P1 `7a7092ea` · P2 `c57f6462` · P3 `a2923e5b`**

The coach twin of the "See it live" demo: one tap, no login, into the real premium Coaches Portal
on the fictional **Riverdale Ridge Baseball** — five teams frozen at five moments of a year, a warm
demo banner, and the **phase dock** ("The season · Tryout day / Off-season / Season start /
Mid-season / Season's End").
⚠ *Prep: the dev server needs a restart before this QA (shared modules changed). The nightly
re-anchor (migration 226) has been scheduled on both databases since 2026-08-08 — if dates still
look stale, re-run the seed (`node --env-file=.env.local scripts/seed-demo-coach.mjs`) or the tick
by hand.*

**A · The door** (private/incognito window, signed out)
- [ ] **1.** Open `/see-it-live/coaches` → you land on the 12U team's Overview, signed in as the demo
   coach, with the WARM banner ("You're in the coach's seat, on a fictional team…") and the
   five-chip phase dock under it. No login, no email, no interstitial.
- [ ] **2.** The dock highlights **Mid-season**; the banner's right slot reads "There's a game this
   Saturday" — never a countdown.
- [ ] **3.** **⚠ ON A PHONE, JUDGE THE DOCK HARD.** Five chips are wider than a 390px screen (measured: 510px).
   The row now scrolls so the chip you're standing in is always visible, and you swipe for the rest
   — but you see roughly three and a half at a time. **Tell me if that reads as "there are five
   moments" or as "the row is cut off."** The alternative is two rows of chips, permanently taller.

**B · The five moments** (one tap each; a narration line appears on arrival)
- [ ] **1.** **Tryout day** → the live scoring board: 28 candidates by bib (never names), two evaluators
   partway through, one split opinion (bib 14, Hitting: 5 vs 2). Sessions dated TODAY.
- [ ] **2.** **Off-season (14U)** → Money, budget vs. actual: a $11,700 plan on six real categories phased
   across four months, ~$4,000 already spent against it, and one expense filed as **unbudgeted**
   ("Team photo day", $180) — that's deliberate, it's the report earning its keep. Check the
   **month grid** columns line up with the calendar, and that **Expenses** shows a Spring
   Invitational balance still owed with a due date ahead.
   - ⚠ *This team's season year is NEXT year, on purpose — an off-season team is building a season
     it hasn't played. Confirm the masthead year doesn't read as a bug to you.*
   - **Money → Dues:** two instalments in, one family a payment behind ($225).
   - **Schedule:** Sunday skills sessions and cage nights. Open the past Sunday with the plan on
     it → three stations, three groups, a rotation clock. Then the one still AHEAD → the plan
     should be walkable/runnable.
   - **Development:** four focus areas (one already achieved) and a testing session — 3 tests,
     11 of 13 players. **The two who missed must show a dash, never a zero.**
- [ ] **3.** **Season start (10U)** → Schedule: opening day two Saturdays back, three games played (2-1) and
   twelve ahead with practices between them. **No past game may sit there unscored.** Lineups shows
   exactly ONE saved lineup — the opener's — and nothing after it. Roster is complete with numbers
   and positions; dues are current bar one family.
- [ ] **4.** **Mid-season** → Overview: record 14-3-1, "Saturday's lineup isn't set" as the one thing,
   attendance dip on Tuesdays, $240 overdue across two families, 1 waiver missing (on the
   player's profile), playing-time outlier + a pitcher at the arm-care cap under Lineups.
   **New:** the last Tuesday and Thursday practices now carry written plans — check the schedule
   shows them as run-and-recorded, and that the Overview's one thing is STILL Saturday's lineup.
- [ ] **5.** **Season's End** → the closed 2025 year: Season Wrapped (18-6-2, a 6-game streak, 9 of 12
   families opened the recap), and every archive door opens read-only.

**C · Look, don't keep**
- [ ] **1.** Try to save anything — build Saturday's lineup, score a candidate, edit the budget. The
   change shows on screen, the warm toast says nothing is saved, and a refresh proves it.
- [ ] **2.** "Email families" style sends: composable, never delivered (fictional example.com people,
   plus the send paths refuse the demo org).

**D · A signed-in customer presses the door**
- [ ] **1.** While signed into YOUR account, open `/see-it-live/coaches` → the "Step into the coach's
   seat?" confirm screen. Declining keeps your session; continuing swaps to the demo.

**E · The calendar holds** (after the re-anchor runs)
- [ ] **1.** Come back tomorrow: the tryout is still "today", the game still "this Saturday", opening day
   still two Saturdays back, and the winter sessions still on Sundays — **not Mondays**. The five
   moments move in whole weeks so weekdays never drift; a session that has changed weekday means
   the re-anchor is broken, not merely late.

**F · Hygiene**
- [ ] **1.** Riverdale Ridge appears nowhere public: not in /discover, not in the sitemap, no public org
   pages.
- [ ] **2.** **⚠ A name collision to judge (found during the docs check, NOT changed).** The product has
   its own built-in *sample budget* for a made-up team called **"Riverdale 12U"**, offered as
   "See a finished example" on a budget page that is still empty. Inside the sandbox that is
   reachable: open the **11U** (the tryout team, which has no budget) → Money → Budget vs. actual
   → and you can open a sample for "Riverdale 12U" while the dock is showing you *Riverdale Ridge
   12U*, a different fictional team, one tap away. Both are invented and nothing leaks between
   them — but "clearly labelled as a made-up team" loses its force inside a demo that is already
   a made-up team. **Tell me whether that reads as confusing.** The fix, if you want one, is a
   rename on one side or the other; it is not a help-content problem, so I left it alone.

**G · The guided tour (Phase 3, new 2026-08-05)** — *seven presses that walk one season.*
Open the demo in a fresh private window each time you start this section; the tour remembers where
you got to for the rest of the browser session.

- [ ] **1.** **The opening.** You arrive and the tour row reads **"The season, guided"** with one button,
   **"Walk the year →"**. It should feel offered, not started: **nothing may move until you press.**
- [ ] **2.** **Press it seven times** and let each one land. Every press must produce a sentence in the hat —
   that sentence is the deliverable, and a press that changes nothing is the defect. In order you
   should reach: the tryout board (28 ranked, names still hidden) → the 14U's testing session
   (**two dashes, never zeros**) → the 10U's lineups (one saved, twelve waiting) → the 12U's
   budget → the 12U's playing-time table → **one player's page** → the closed 2025 season.
- [ ] **3.** **Step 4, the money — new data.** The 12U now has a real ledger: ~$9,205 spent against a $9,400
   plan. **Diamond rentals should sit OVER plan**, and it should be the only line that does. That
   is deliberate (two rainouts moved to weeknights) — a demo where every line comes in under budget
   teaches a prospect the report flatters them. **Tell me if the over-plan line reads as a bug
   rather than as honesty.**
- [ ] **4.** **Step 6, what a parent gets.** It lands on **Felix Aubert (#30)** — the same player step 5 just
   showed you at the bottom of the playing-time table. Press **Preview** and read it as his parent
   would. **This is the judgement call I most want your eye on:** showing the recap of the kid who
   has been on the field least is either the sharpest thing in the demo or one step too far. Say
   the word and I'll point it at a neutral player.
- [ ] **5.** **Step 7 closes the loop** — the recap you just read, counted: nine of twelve families opened
   theirs. Then open one of the read-only archive doors from that page to prove the year is
   browsable, not a screenshot.
- [ ] **6.** **🖥📱 The hat, on a phone.** Measured at 390px: **155px on arrival**, up from 112px, and
   **198–216px while a sentence is showing**, up from 182px. Two things buy that back and both need
   your eye: **the moments dock hides itself while the tour is speaking** (it comes back the moment
   the sentence clears — tell me if it reads as missing rather than as standing aside), and **the
   promise is now shortened on a phone to "Changes show on screen, but nothing is saved"**, taking
   the place of "There's a game this Saturday". Before this, on a phone, *the honesty promise
   appeared nowhere at all until you pressed something.*
- [ ] **7.** **Nothing may claim motion.** No countdown, no pulsing dot, no step that says "watch this
   change". If anything on screen suggests it is updating while you look at it, that is a defect.
- [ ] **8.** **Blind scoring holds.** No step, anywhere, may show you a candidate's name on the tryout board.

**⚠ Three pre-existing problems the tour design uncovered — NOT fixed, and worth your ruling:**
- The dock's Tryout-day sentence promises **"one split opinion to argue about tonight."** The
  disagreement (bib 14, hitting: 5 from one evaluator, 2 from the other) is real in the data and
  **no screen in the product renders it** — every surface shows the 3.5 average. The sentence is
  pointing at something a visitor cannot find.
- The **evaluator-bias readout never fires** on this data ("runs hot / runs cold"). The product
  compares each evaluator against the average of the *other* evaluators' averages, so one harsh
  scorer out of two moves both by half the drift. Making it fire needs a harsher demo evaluator
  **and** a way to link to the right tryout stage; I left both alone.
- The **tryout hub opens on "Decide"**, not on the live scoreboard, because scores are already in.
  That is the product working as designed, but it means the moment's most interesting screen is one
  tab away and not linkable. The tour's step 1 points at what the hub actually opens.

### 5.5 🖥📱 Marketing pages — "live products lead" + the availability sweep — **ON DEV, uncommitted**
*The homepage, /pricing, /for-tournament-organizers and the nav were rebalanced (2026-08-08,
owner-ratified) so the two promoted products lead everywhere and nothing hand-writes "coming soon"
any more. Covers Batches 1 + 1.5 of `HOMEPAGE_TRUTH_AND_ENTRY_POINTS_PLAN.md`. All anonymous — no
sign-in needed; a private/incognito window is ideal.*

**Homepage, signed out, desktop:**
- [ ] The hero shows **two** large cards — Tournament and Coaches Portal, both "Free to start · no
      credit card" — and below them one quiet **"On the roadmap"** strip naming the house-league and
      club questions with their links. No coming-soon card anywhere in the hero.
- [ ] The hero's top badge line reads **"Tournament Plus & Premium Coaches Portal free through
      Dec 31, 2026"**.
- [ ] "One platform. Every role." has **two** full deep-dive cards (Tournament Organizer ·
      Free to start, Head Coach · Free to start) and **two** compact one-line rows (House League
      Admin, Club Executive — "In development", linking to their pages). Nothing here says the
      Coaches Portal is coming soon.
- [ ] The pricing band opens with the **Founding Season callout naming BOTH products and both
      prices**, with two doors: "Start your organization →" and "Start your coaches portal →" (the
      second lands in the coach start flow).
- [ ] The plan grid shows **three cards** — Tournament (Free), Tournament Plus, and **Premium
      Coaches Portal** (both paid cards wear the same Founding Season badge) — and below it one
      "Coming soon" strip naming League Plus and Club **with their prices** and a single Express
      interest button that opens the interest form pre-marked for both.
- [ ] The old thin "Coaches Portal … Coming soon / Express interest" strip is **gone**.
- [ ] The nav reads **Tournaments · Coaches · Leagues · Clubs · Pricing**.
- [ ] The Coaches Portal card's "Start free" leads somewhere a coach can actually start — never an
      interest form.

**/pricing, signed out:**
- [ ] "What does your role look like?" — the **coach segment is second**, its CTA says **Start
      free** (not Express interest), and it leads to the coach start flow.
- [ ] The plan section is titled **"Available now"** and shows the same three-cards-plus-strip as
      the homepage. The note under it names both Founding Season prices.
- [ ] Nothing anywhere on the page lists the Coaches Portal among things "coming soon" — check the
      "Coming Soon" deep-dive panel ("Coming next" must say League Plus and Club only) and the very
      bottom banner above "Get Started Free".
- [ ] FAQs: "Can I buy League Plus, Club, or the Coaches Portal today?" answers that the coaches
      portal **is buyable now, free until Jan 1**.
- [ ] **Signed-in org operator re-check (the one regression risk):** sign in as an org admin and
      revisit /pricing. Your tier is still marked "Current plan", the org cards' buttons still open
      your billing screen — and the **Premium Coaches Portal card must NOT say "Choose …" or point
      at org billing**; it keeps its own coach door in every state.
- [ ] **/for-tournament-organizers:** the Coaches Portal cross-sell at the bottom now says **Start
      free** and links to the coaches page (League Plus and Club beside it stay express-interest).

**Phone (390px-ish), signed out:** the hero cards stack, the roadmap strip wraps without clipping,
the three plan cards stack with the strip after them, and the modules rows wrap to readable lines.

**Why this matters enough to check:** the shop window spent two weeks telling coaches a live product
didn't exist, and the worst instance quoted the $29 price while refusing the sale. Every claim above
is now derived from the same gate the checkout uses — this QA proves the derivation, after which the
surfaces cannot silently disagree again.

---

## ✅ Group 3C · The day-of volunteer bars — PASSED 2026-08-07

**§7 — the scorekeeper and gate check-in screens get a bottom.** ON DEV, never released.
Chrome only: no capability, route, database or API change anywhere in it.

> ### ✅ Owner QA PASSED 2026-08-07 — all nine parts
>
> **Six defects were found and fixed during the run**, four of them in the fixture rather than the
> feature, which is worth knowing because three would have wasted a later sitting:
>
> | # | Found at | What it was |
> |---|---|---|
> | 1 | Part 1 | **Fixture:** the day's games were seeded against UTC, so any run after ~8pm Eastern put them on TOMORROW and the board said "No games today". Now uses the local calendar day. |
> | 2 | Part 3 | **Feature:** the filter count grew the button, which squeezed the date and clipped the day — "2026-08-0". The date can no longer be the thing that gives; the count is a badge, not words. |
> | 3 | Part 3 | **Feature:** two calendar icons on one date field. Ours removed; the browser's is the one that opens the picker. |
> | 4 | Part 3 | **Feature:** the browser's own **Clear** button (which cannot be removed) left the board showing games for a day it could no longer name. Clearing now means "back to today". |
> | 5 | Part 3 | **Fixture:** the field dropdown was empty because the fixture typed field names onto games without creating field records. Fixed — and it surfaced a real product problem, see below. |
> | 6 | Part 6 | **Feature:** "Open the public site" dead-ended at a private club (that page 404s by design). The row was then **removed entirely** on the owner's plainer argument: a volunteer has no errand on a club's marketing home page. |
>
> **Two judgement calls resolved as built** (say so if either was actually a reluctant yes):
> the single-duty two-tab bar stays, and sign-out at one tap behind the Account tab stays.
>
> ⚠ **Left OPEN by defect 6:** the gate check-in shell now has no public door at all. That is the
> original top-nav D9 finding resurfacing — **not decided**, and recorded that way in the plan.
>
> ⚠ **Escaped scope — a real data-integrity problem** found via defect 5: a game answers "which
> field?" three unrelated ways, and **39% of games on dev carry a typed field name with no field
> record, which double-booking detection skips entirely.** See
> `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN_PROMPT.md`. Not a blocker for this section.

⚠ **The automated layout sweep does not cover these two screens at all** — checked, not assumed.
Its screen list is coach-portal-only, so the three rules that fixed bottom chrome usually breaks
(44px tap targets · nothing trapped under fixed furniture · no sideways scroll) are **not**
watching this. Your phone is the only thing checking it.

**Accounts — all three are seeded by `--cancel-lab`, password `devpass123`:**

| Who | Sign-in | Duties | Should see |
|---|---|---|---|
| QA Lab Scorekeeper | `qa-lab-scorer@dev.local` | both | Score · Gate · Account |
| Dana Scorer | `qa-lab-scorer-only@dev.local` | score only | Score · Account |
| Pat Gate | `qa-lab-gate-only@dev.local` | gate only | Gate · Account |

The two single-duty accounts are new (2026-08-07) and exist **only** for this section: every role
that can score can also check teams in, so a single-duty volunteer cannot be produced by role and
had to be built with explicit capability overrides. Re-run the seeder to reset.

Screens: `/qa-cancel-lab/scorekeeper` · `/qa-cancel-lab/check-in`

### A · What the scorekeeper opens on (dual-duty account, phone)

- [x] Sign in as **QA Lab Scorekeeper**, open the scorekeeper screen.
- [x] **Before scrolling at all: at least one game card is fully visible.** This is the entire
      point of the change — it used to be none.
- [x] The three counter tiles (To Score / Review / Final) are **gone** from the top.
- [x] Visible at the top instead: the date, **Today**, and one **Filters** button.
- [x] At the bottom, two bars: the buckets (To Score 2 · Review 0 · Final 0 · All 2) with their
      counts, above a Score · Gate · Account tab bar.
- [x] The header reads FIELDLOGICHQ over **the full club name** — "QA Cancel Lab (Tournament)",
      not cut off mid-word. No Check-In link, no Sign Out, no Feedback. The ⇄ pill is still there.

### B · The buckets earn the thumb

- [x] Scroll to the bottom of the game list. The bucket bar stays put.
- [x] From there, tap **Review** — the list empties and Review highlights, **without scrolling up**.
- [x] Tap **To Score** — both games back. Tap **All** — reads 2.

### C · The fold cannot lie

- [x] The date field has **one** calendar icon, on the right, and tapping it opens the picker.
      (Ours was removed 2026-08-07 — two calendar icons on one field is one icon explaining the
      other, and the browser's is the one that actually works.)
- [x] Open the picker and press its **Clear** — the field must refill with **today** and the games
      stay. That button is the browser's and cannot be removed; an empty date used to leave the
      board showing games for a day it could no longer name.
- [x] Tap **Filters** — search, field and division appear.
- [x] The **field dropdown lists Lab Field 1 and Lab Field 2.** If it only offers "All fields",
      the fixture predates 2026-08-07 — re-seed. (That empty dropdown is what surfaced the
      game-location data-integrity problem; see `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN_PROMPT.md`.)
- [x] Pick **Lab Field 1** — only the 10:00 game remains.
- [x] Collapse Filters. **A lime count badge shows "1" on the button, and the date beside it still
      reads 2026-08-07 in full.** A folded panel hiding an active filter would make a filtered
      board look like an empty day; and the badge is a badge rather than extra words precisely so
      the button cannot grow and clip the date (the defect this replaced).
- [x] Clear the filter.

### D · Entering a score, over the bars

- [x] Tap a game. The score sheet opens **over** both bars — deliberate: entering a score is a
      modal act, and covering the navigation is what stops a volunteer wandering off mid-entry.
- [x] With the number keyboard up, Cancel and Finalize are both reachable and clear of the home
      indicator.
- [x] Save a score. The **To Score count in the bar drops and Final rises** — the bar is the only
      place those numbers live now.

### E · The tab bar

- [x] Tap **Gate**. The check-in board opens with its own bucket row: All · Not arrived ·
      Checked in · No-show, with counts. Gate is the current tab.
- [x] Tap **Score** — straight back. One tap each way, no header hunting.

### F · Account — and the one step here that is not cosmetic

- [x] Tap **Account**. The sheet names you: "QA Lab Scorekeeper", the email, and the duties you
      hold at this club. On a borrowed phone at a gate this is the question that matters most.
- [x] **Install this app** → the install prompt appears. (Nothing on desktop Chrome is correct —
      it is a phone affordance.)
- [x] **There is NO "open the public site" row.** Removed 2026-08-07 during this QA: a volunteer
      has no errand on the club's marketing home page, and at a club that is not public that page
      404s by design — so the row dead-ended (this QA club is private, and it did). The door a
      volunteer might genuinely want is a specific *event's* public schedule, which is what the
      scorekeeper's ⇄ pill already resolves to. ⚠ Leaves the gate shell with no public door at
      all — an OPEN question (the original top-nav D9 finding), not a settled one.
- [x] ⚠ Back on the scorekeeper, Account → **Sign out**. **This is now the only exit on a phone.**
      It used to sit in the header precisely because a volunteer on a borrowed or shared phone had
      no way to end their session. If this is at all hard to find, say so — the fallback is
      already decided (Sign Out returns to the header) and it is a one-line change.
- [x] After signing out, the Back button must not put you back on the board.

### G · One duty only — the design's weakest case, and a wall test

- [x] Sign in as **Dana Scorer**. The scorekeeper shows **two** tabs: Score and Account. No Gate.
- [x] Type the check-in URL directly. It must **refuse with "Access Denied"** — a door being
      absent from the bar is presentation; the wall is the actual protection.
- [x] Sign in as **Pat Gate**. Check-in shows **two** tabs: Gate and Account. No Score.
- [x] Type the scorekeeper URL directly. It must **refuse**.
- [x] ⚠ **A judgement, not a pass/fail:** for these two — who are the majority of real volunteers —
      is a two-tab bar where one tab is the screen they are already on worth 62px of their screen?
      If it reads as hollow, the fallback is the bucket bar alone for them, with Sign Out back in
      the header.

### H · Desktop must be untouched

- [x] Both screens at desktop width: **no tab bar, no pinned bars.** The buckets sit where they
      always did, and the Check-In link and Sign Out are back in the header.
- [x] ⚠ **The one deliberate desktop change:** the volunteer gate board's arrival filter is now a
      four-across row rather than an inline pill in the toolbar — it matches the scorekeeper twin.
- [x] **The admin gate screen** (`/qa-cancel-lab/admin/tournaments/check-in`) must be **completely
      unchanged**: inline segmented filter, its own bottom nav, and *not* three stacked bars. It
      shares the board component with the volunteer screen, so this is the collision to check.

### I · A real iPhone (not Chromium)

- [x] On a notched iPhone: nothing sits behind the home indicator, both bars clear it, and the
      score sheet's buttons stay reachable. This is the exact failure the lineup builder's Undo
      bar shipped with, and the sweep that would normally catch it does not run here.

---

---

## §27 · Correcting a money record — edit, delete, and one Add door

**Built on dev 2026-08-15 · not on production · ⚠ carries migration 236, which must reach prod
BEFORE this code does.** Plan: `COACH_EXPENSES_EDIT_DELETE_PLAN.md`. Mockups: artifact `d693ab01`.

**Why this section exists:** expenses were the only money record in the portal that could not be
edited or deleted. A mistyped amount was permanent. This adds both — and deleting something already
paid **moves money on the team's books**, which is why the walk-through below spends most of its
time on that one action.

**Fixture:** the coach money lab — sign in as the money head coach on a team with at least one
**paid** expense, one **unpaid** expense, and one payable whose **deposit is paid and balance is
not**. Money → Expenses & Payables.

---

### A · The pencil, and the row

- [ ] Every row shows a **pencil** at its right. Clicking it opens the record.
- [ ] Clicking **anywhere else on the row** opens the same record.
- [ ] **Select some text in a row** (drag across a description) and release. It must **not** open
      the form — a click that ends a text selection is a copy gesture, not a tap.
- [ ] **Mark Paid** on an unpaid expense still marks it paid, and does **not** also open the form.
- [ ] On a payable, **Payment details** still expands the deposit/balance pair in place, and does
      **not** also open the form.
- [ ] Sign in as a **read-only money assistant**: no pencil, no Add, no Delete anywhere. The rows
      must not be clickable either.

### B · Editing something NOT yet paid

- [ ] Open an unpaid expense. Change the description, category and amount. Save. All three stick.
- [ ] Open it again — the form shows what you saved, and the details group opens by itself because
      it holds values.
- [ ] Close a form you have changed **without** saving: you are asked before it is discarded.
- [ ] Open a record and close it **untouched**: no discard prompt. (A prompt here would be the
      guard crying wolf until it is ignored.)

### C · ⚠ Editing something already PAID — the lock

- [ ] Open a **paid** expense. The amount is shown as a **locked** field with its value visible,
      the date it was paid, and the sentence telling you to delete and re-enter. It is not greyed
      into silence, and it is not hidden.
- [ ] Change its **description** and save. It saves.
- [ ] Change its **category, notes and tags** and save. They save.
- [ ] Open the **part-paid payable**. The **paid half** is locked and shows its figure; the **open
      half is still fully editable**. Change the open half's amount and due date — they save.
      ⚠ If the whole row is frozen, that is the defect this rule exists to prevent.

### D · ⚠⚠ Deleting — the money consequence

- [ ] Delete an **unpaid** expense. The confirmation says plainly that no money moves. It deletes.
- [ ] Before deleting a **paid** expense, note the team's **cash on hand** (Money → Overview).
- [ ] Delete that paid expense. The confirmation must state the **dollar amount** coming back —
      *"already posted $X out of the team's books … cash on hand goes back up by $X"* — before you
      can confirm.
- [ ] Confirm. Then re-check **cash on hand**: it must have moved by **exactly that amount**.
      ⚠ If the figure quoted and the figure moved disagree, stop and report it — the dialog and the
      reversal are supposed to read the same source.
- [ ] Delete a **part-paid payable**. The amount quoted must be the **paid half only**, not the
      total.
- [ ] Delete an expense a **family paid out of pocket**. The dialog must say **no money moves** AND
      that the credit the team owed that family goes with it. Afterwards, check that family's dues
      record — the credit is gone.

### E · ⚠ The rename-then-delete case (the subtle one)

This is the hole migration 236 predicted. It only shows on records paid **before** this release, so
it needs a record that already existed on dev.

- [ ] Find an expense that was **already paid before today**. **Rename it**, and save.
- [ ] Now **delete** it. The reversal must still happen and cash on hand must still move by the
      right amount.
      ⚠ The failure to watch for: it deletes quietly, tells you money came back, and the team's
      cash on hand **does not change**. That is a posted entry left behind with nothing explaining
      it — report immediately if seen.

### F · One Add button

- [ ] On the **Expenses** sub-tab, press **Add**. The form opens with **Expense** already selected.
- [ ] On the **Payables** sub-tab, press **Add**. It opens with **Payable** already selected.
- [ ] Type a description and an amount, then **switch the type**. What you typed is still there.
- [ ] The save button names what it will create — **Add Expense** / **Add Payable**, never "Save".
- [ ] Payable-only fields (deposit/balance split) appear only on the Payable side; **Paid by**
      appears only on the Expense side.
- [ ] Open an **existing** record: there is **no type switch** — it states which kind it is and
      tells you to delete and re-add if it is wrong.

### G · Payment method

- [ ] In the details group, click **Payment method**. Suggestions appear — common methods, plus
      anything your teams have used, most-used first with a count.
- [ ] Type a partial match: the list filters.
- [ ] Type something new entirely: it tells you the spelling is new to your club, and still saves.
- [ ] Save a record with a method, then open a new form — that method now appears in the list.

### H · Tags, and the empty states

- [ ] Tag chips show on **expense rows and payable rows** (payables previously hid them one click
      in). There is **no** per-row "Add tags" link any more — tags are edited in the record's form.
- [ ] Filter by a tag, then **Export**. Open the file: there is a **Tags** column.
- [ ] Switch to a sub-tab with **nothing in it**. The Expense-vs-Payable comparison appears under
      the empty state, with real examples.

### I · Phone (390px) and the layout

- [ ] Rows become cards. The pencil becomes a **full-width "Edit" button** at the foot of each card.
- [ ] **The page does not scroll sideways.** ⚠ This is the exact defect found and fixed during the
      review; if the page slides horizontally at all, report it.
- [ ] Budget Plan on a phone is **unchanged** — its pencil still leaves the layout and the row is
      the door. (Budget moved onto the shared control; it should look and behave exactly as before.)
- [ ] Tab to the rows with a **keyboard**: the pencil is reachable and announces what it edits.

---

**If Part D or Part E fails, treat it as blocking** — everything else here is a correction to how a
screen reads, but those two are the books being wrong.

## §28 · Practice plans get a front door

**Built on dev 2026-08-15 · not on production · no migration, no new API, no route removed.**
Plan: `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` (Phase 1). Mockups: artifact `ed56fe2c`.

**Why this section exists:** a practice plan could only be reached by opening the Schedule, finding
the right practice, and scrolling its panel — so a coach preparing Thursday's session on Wednesday
night had to remember which day it was on before the product would help. Lineups, built far less
often, already had a nav door, a hub and a readiness filter. This gives practice plans the same.
**Nothing was taken away:** the Schedule panel keeps its own "Plan this practice" button.

**Fixture:** a live season with at least **three upcoming practices** (one of them with a plan
already, one without), at least **one past practice**, and — for part D — a practice starting within
the next couple of hours.

---

### A · The door

- [ ] **Practice plans** appears in the sidebar under **Season**, directly beneath Schedule.
- [ ] On a phone, it appears under **More → Season**.
- [ ] Its icon is distinct from Tryouts' (the two must not share one).
- [ ] Opening it, then opening a plan, then a running practice — the nav item stays highlighted
      the whole way down.

### B · The list

- [ ] **Coming up** lists upcoming practices soonest-first; **Recent practices** lists past ones
      most-recent-first, capped at six.
- [ ] Each row shows **Plan set** or **No plan**, and a practice with a plan also shows what the
      plan is (blocks, minutes, rotations) on its meta line.
- [ ] The dates and times shown match what the **Schedule** shows for the same practices.
- [ ] Exactly **one** row carries the green button, and it is the **nearest upcoming practice with
      no plan**. If every upcoming practice is planned, there is no green button anywhere.
- [ ] Tapping a row opens the existing plan editor, unchanged.

### C · The "Needs a plan" filter

- [ ] The filter shows a count matching the number of unplanned practices.
- [ ] Turning it on leaves only unplanned practices; turning it off restores the full list.
- [ ] **Plan the last unplanned practice while the filter is on.** The list empties and says "All
      caught up" — and the filter chip is **still there** so you can switch it back off. (If the
      chip disappears, that is the defect this step exists for.)

### D · Running a practice

- [ ] A practice starting within about three hours, **and which has a plan**, shows a separate
      **Run practice** button beside its row.
- [ ] A practice in that window **without** a plan shows no Run button.
- [ ] A practice next week shows no Run button, planned or not.

### E · Templates

- [ ] A **Plan templates** link sits at the bottom of the list and opens the existing templates
      page — the same templates you see under Development. There must be **no second list** of
      templates on the practice hub.

### F · Who sees what

- [ ] **Assistant coach with schedule access but not head coach:** sees the hub and the list, can
      open a plan, but is not offered "Plan this practice" as an action they can complete.
- [ ] **Assistant without schedule access:** the nav item is absent; visiting the page directly
      explains what practice plans are and who to ask.
- [ ] **Assistant who cannot manage the schedule:** no **Plan templates** link (it would refuse
      them on arrival).

### G · Past seasons — the one that matters

- [ ] With the season switcher, move to a **completed season** while standing on this page. You get
      a short explanation that plans are a live-season tool — **never a list of practices**.
- [ ] In that completed season, **Practice plans is absent from the sidebar and from More.**
- [ ] Switch back to the live season: the list returns.

---

**If part G fails, treat it as blocking** — a list of archive practices whose plans all refuse to
open is the "link that 404s wearing a politer face" this portal has a standing rule against.

## §29 · The budget speaks in category + item, and so does spending

**Built on dev 2026-08-15 · not on production · ⚠ carries migration 240, which must reach prod
BEFORE this code does.** Plan: `COACH_BUDGET_ITEM_ALIGNMENT_PLAN.md`. Mockups: artifact `945391e9`.

**Why this section exists:** a coach picked the item **Entry Fees** and their plan rendered a row
called **"test"** — the shared word invisible, the typed text the identity. Two reports cannot be
lined up on words somebody typed, which is why the budget now groups **category → item**, the item
names the row, two lines on one item **sum**, and spending records the same two things. The payoff
is the question that started it: *what item did we get charged for that we never budgeted?*

⚠ **This replaced the budget-line picker built the same week.** If you QA'd that, forget it — the
"What is this against?" control and the "Not in the budget" choice are both gone, and whether
something was planned is now worked out for you.

**Fixture:** the coach money lab, or the demo's 12U. You need a team with a budget plan, at least
one category holding **two lines on the same item**, and spending that includes **one cost on
something the plan never mentions**. The demo is seeded exactly this way.

---

### A · The plan reads two levels

- [ ] Budget Plan → **List**. Every row under a category is named by its **item**, not by anything
      anyone typed.
- [ ] A category with **two lines on one item** shows **one row** with the summed total and a
      "2 lines" caption. Opening it reveals both lines, each still editable.
- [ ] Open a cost line for editing. There is **no Description field** — Category & Item is marked
      required, and **Notes** is the one free-text box.
- [ ] Try to save a cost line without picking an item. It refuses, names what is missing, and puts
      you in the picker.
- [ ] Choosing a category **no longer auto-picks an item**. ⚠ If "Misc" appears anywhere in the item
      list, stop — a report row called "Misc" is what this change exists to prevent.
- [ ] Open an **Expected fundraising** line. It still has **Description, required**, and no category
      or item — unchanged from your August 13 ruling.

### B · Recording a cost

- [ ] Add an expense. It asks **"What is this?"** — a category, then an item.
- [ ] Picking an item fills the **description** with its name, ready to type over.
- [ ] ⚠ **Type your own description first, then change the item.** Your words must survive; only a
      description you never touched is replaced.
- [ ] Pick an item your plan has **no line for**. A warning says it will show as spending you didn't
      plan for. There is **no "Not in the budget" choice** anywhere — nothing asks you to declare it.
- [ ] Add a payable the same way. The field is identical on both kinds.

### C · ⚠⚠ The report — what this was all for

- [ ] Budget vs. Actual → **Categories**. Rows are **category → item**, and the two lines sharing an
      item are **one row** carrying both amounts.
- [ ] The cost on something unplanned appears as **its own row, flagged "not budgeted"**, inside its
      own category, with a **dash** where Budgeted would be. It is **not** in a separate list at the
      foot of the report — that section is gone.
- [ ] ⚠ **Add up a category's item Actuals. They must equal the category's own Actual**, and the
      categories must add up to the season Total. If the Total is *larger* than the categories, stop
      and report it — that is unplanned spending being counted twice.
- [ ] Now **add a budget line** for that unplanned category+item. The flag clears and the row starts
      comparing against your plan.
- [ ] ⚠⚠ **Switch the view to Months.** It must show **the same rows** as Categories — the two lines
      sharing an item are ONE row here too, and the unplanned item is present. If Months shows more
      rows than Categories, stop and report it: that is one screen grouping the same plan two
      different ways, which is exactly what this change exists to remove.
- [ ] **Export** the Categories view. Same two levels, same figures; an unplanned row is **blank**
      under Budgeted, never zero.

### D · Whose words are whose

- [ ] In the item picker, use **+ Add custom item**. It saves and is selectable immediately.
- [ ] Open **another team's** budget form. ⚠ **Your new item must not be in its list.** This is the
      ruling — if it appears, stop and report it.
- [ ] As a club admin: **Accounting → Budget**, and scroll to **"Items your teams have added"**. Your
      new item is listed with the team that owns it and how many lines use it.
- [ ] Press **Publish to all teams**. The message says what happened. Re-open the other team's form —
      the item is **now** there.
- [ ] If two teams had both invented the same name, publishing says how many copies it absorbed and
      how many budget lines moved. ⚠ Check those teams' plans still show the same totals.

### E · The importer, and a team with no plan

- [ ] Import budget lines from a sheet whose line names are **not** in the item list. Every imported
      row still arrives **named** — the names became items belonging to your team.
- [ ] On a team with **no budget plan**, add an expense: the category and item picker still works,
      and the report shows what was spent under those headings with nothing to compare against.

---

**If C's totals disagree, treat it as blocking.** A season total larger than the sum of its
categories is unplanned spending counted twice — the exact failure this design set out to remove.

## §30 · Sponsorships, the follow-ups — two doors, tags on money coming in

**Built on dev 2026-08-15 · not on production · ⚠ carries migration 239, which must reach prod
BEFORE this code does.** Plan: `COACH_SPONSORSHIPS_PLAN.md` §8. Proposal + mockups: artifact
`50fe3e42`. **Sits on top of §24 — walk §24 first if it is still owed**, because everything here
assumes a team that already has both a drive and a sponsor.

**Why this section exists:** sponsorships shipped and four things did not follow it. The product
disagreed with itself about the word *Fundraising* one click apart; a fundraiser or sponsor was the
only money record that could not be tagged, so the money-tag report could only ever answer what a
label COST; the Money overview offered one door to a tab holding two different things; and the demo
world — the shop window — could not show the distinction at all.

### A · The two doors

- [ ] Money → **Overview**. Under *Everything in Money* (or *More in Money* in season) there are now
      **two** rows where there was one: **Fundraisers** with a green dot and **Sponsorships** with a
      blue one, matching the chips inside the tab.
- [ ] The Sponsorships row shows even on a team with **no sponsors** — "None yet · add one" — the
      way the drives row already introduces itself. A team with a pledge reads its received figure
      and the pledged one **beside** it, never added together.
- [ ] Tap each row. Both land on **Fundraising**, each already filtered to its own kind — and the
      **address bar says which** (`&kind=sponsor`). Copy that URL into a new tab: it opens the same
      filtered view.
- [ ] Press **Back** from a filtered view — it steps back through the filter, not out of Money.
- [ ] ⚠ **The filter must not follow you.** From a filtered Fundraising list, switch to
      **Expenses**, then back to **Fundraising**: the list shows **everything** again. A kind that
      rode along would silently hide half a coach's records on an unrelated visit.

### B · Tags on money coming in

- [ ] Fundraising → **＋ New**. The form has a **Tags** box at the bottom, for either kind. Pick an
      existing money tag — it is the **same list** the Expenses form offers, not a second one.
- [ ] Type a name that does not exist and use **+ Create**. The new tag appears immediately, and is
      then offered on the **Expenses** form too.
- [ ] Save. Open the record: the tags show as chips **inside it**. ⚠ They are deliberately **not**
      on the list row — a label drawn beside every row is drawn as many times as the list is long.
- [ ] Open **Settings** on that record, change the tags, save, reopen: the change stuck.
- [ ] Start editing tags and close the sheet without saving — **it asks before discarding**.
- [ ] **Export** the Fundraising list. There is a **Tags** column carrying the names.
- [ ] ⚠ **The export follows the view.** Filter to Sponsors, export: the file has sponsors only, and
      the scope line says *Sponsors only*. This is new — it used to dump the whole season whatever
      was on screen.

### C · The demo world (this is the shop window, so it is QA)

- [ ] Open the coach demo (no login) → 12U → Money → **Fundraising**. Beside the Bottle Drive there
      is a **$750 sponsor, Riverdale Dental**, with a blue Sponsor chip and a Received chip.
- [ ] Open it: one row, **"Nobody in particular — a club-wide sponsor"**, no credit.
- [ ] ⚠ **Player Dues must be UNCHANGED**: still **$240 overdue across exactly two families**, still
      one instalment at **$90 of $120**. The sponsor credits nobody precisely so those stay true —
      if either has moved, stop and say so.
- [ ] Run the guided tour to the **money** step. Its last sentence now names the sponsor and
      explains that a pledge counts in the plan and not in the books. It should read as one thought
      with the sentences before it, not an addendum.

### D · What must NOT have changed

- [ ] The Fundraising tab is still called **Fundraising**; the filter's middle chip is still called
      **Fundraisers** (it names a kind, not the tab).
- [ ] Help → Money → *Getting around the Money hub* and the FAQ *How do I switch between… Money
      screens* both say **Fundraising**, and mention the two Overview rows.
- [ ] Budget Plan → add a line → pick **Expected sponsorship**: the explanatory paragraph under the
      picker is the sponsorship one, and the **Category & Item** picker is hidden (it is cost-only).
      Pick **Expected fundraising**: the other paragraph, picker still hidden. Pick **A cost**: the
      picker returns.

---

**If A's last step fails — the kind filter following you to another tab — treat it as blocking.** A
coach who visits Fundraising a week later and sees half their records missing, with nothing on
screen saying a filter is on, has no way to work out what happened.

## §31 · The Attendance page answers once

**Built on dev 2026-08-15 · not on production · no migration, no new API, no route removed.**
Plan: `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` (Phase 2). Mockups: artifact `ed56fe2c`, §01.

**Why this section exists:** you opened Attendance on a team with an empty schedule and found three
"nothing here" blocks stacked on three different left edges. The page had three regions that each
decided independently that they had nothing to show, and none of them knew the other two were also
empty. It is now one decision, and one answer per situation.

**Fixture:** most of this needs **three different teams** (or one team taken through the states in
order) — a team with **no games or practices at all**, a team with **events but nothing marked**,
and a team with **real attendance recorded**, at least one of whose players has never been marked.
The last one is the everyday case and is the only part you can do on an existing team.

### A · The state you photographed — nothing on the schedule

- [ ] A team with **no games or practices**: Attendance shows **one card, centred, and nothing
      else**. No second "No attendance recorded yet" block. No paragraph about how figures are
      counted floating above it.
- [ ] The card offers **one** button, **Open schedule** — and nothing else. ⚠ The mockup drew a
      second "How attendance works" button here and it was **cut on purpose**: the **?** in the top
      corner of this same screen already opens that help. If you see two ways to reach the help
      panel one line apart, that is the defect, not the fix.
- [ ] ⚠ Look at the **left edges**. The card is deliberately centred *because it is alone*; nothing
      else should be starting at a different place beside it.

### B · Events exist, nobody marked yet — the common first-week case

- [ ] Attendance shows the **"Take attendance"** shortcut card, then **one quiet line**: *"Nothing
      recorded yet — totals fill in here as you mark each game and practice."*
- [ ] Under it, **your actual roster**, every player listed, with a **dash** under Games and under
      Practices. This replaces the old second "nothing here" message on purpose — it proves the
      roster is connected and shows the shape that's coming.
- [ ] The shortcut card, the line, and the table all start on **the same left edge**.

### C · The report in normal use

- [ ] **Games** and **Practices** appear as **column headings once**, at the top — not repeated in
      small type inside every row.
- [ ] A player nobody has marked all season reads **"not tracked yet"**, not a pair of zeros.
- [ ] Under the table: a collapsed line, **"How these figures are counted"**. Open it — the wording
      you already approved is there in full, including *"to inform playing-time decisions … not a
      ranking"*. ⚠ It should be **shut when the page loads**, and it should not appear at all in
      states A or B above.
- [ ] Tap a player's name → their profile opens, as before.

### D · On a phone (390px or your own)

- [ ] The table becomes **one card per player**, and each figure gets its label back ("GAMES",
      "PRACTICES") — the headings are a desktop treatment only.
- [ ] Nothing scrolls sideways, and tapping a player's name is comfortable (the tap target is the
      whole row's height, not just the word).

### E · A past season — ⚠ the one behaviour change beyond layout

- [ ] Switch to a **completed season**, open Attendance, tap a player.
- [ ] **You should stay in that season.** Previously this opened the player's *current* season
      instead — a silent jump from the year you were reading. Check the season chip on the player
      page says the year you came from.

### F · An empty roster (skip if you have no such team)

- [ ] A team with **events but no active players**: one quiet line, alone, with **no button**. That
      is deliberate — a coach can hold the attendance duty without roster access, so we do not offer
      a door that would refuse them.

---

**What has NOT changed, and is worth confirming stayed put:** attendance is still marked on the
Schedule, inside a game or practice — this page never recorded anything. The "Take attendance"
shortcut still points at your next (or most recent) event. The back link to Insights is untouched
here; a later phase removes it when Attendance moves into Insights.

## §32 · Attendance becomes a report inside Insights

**Built on dev 2026-08-15 · not on production · no migration, no new API, no route removed.**
Plan: `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` (Phase 3). Mockups: artifact `ed56fe2c`, §04.

**Why this section exists:** you asked why Attendance had a back link to Insights when you had not
come from Insights. It had two front doors — a sidebar item and an Insights tile — so a fixed back
link was wrong for whoever used the other one. Rather than patch the link, Attendance now has one
parent. **Nothing about taking attendance changed:** it is still marked on the Schedule, inside a
game or practice.

**Fixture:** your normal live team, plus — for part D — a team with a **completed season**.

### A · The sidebar is one item shorter

- [ ] Open any team. **Attendance is no longer in the sidebar.** Roster → Lineups → Development sit
      together with nothing between the first two.
- [ ] On a phone, tap **More**. Attendance is not in the sheet either. ⚠ If it is in one nav and not
      the other, that is the defect — they are supposed to move together.

### B · Insights is now the way in

- [ ] Open **Insights**. Among the report doors is **"Who's showing up?"** — with the team's
      attendance rate beside it, or *"Take attendance at a practice or game to start"* if there is
      none yet.
- [ ] Tap it. The page opens, and its **heading reads "Who's showing up?" too** — the same words as
      the door. ⚠ If the door and the page disagree about their own name, flag it; that is exactly
      what having one parent is meant to prevent.
- [ ] The **← Insights** back link at the top takes you back to the hub you just came from.

### C · Taking attendance is untouched

- [ ] Open **Schedule** → a game or practice → the **Attendance** tab. Mark someone present. This is
      still the only place attendance is ever recorded, and it should look and behave exactly as it
      did before.
- [ ] Back on the report, the **"Take attendance"** shortcut card still points at your next (or most
      recent) event and opens it on that tab.

### D · A finished season — ⚠ rewritten after the 2026-08-15 review, please read before testing

- [ ] Switch to a **completed season**. **Attendance IS still in the sidebar here**, and that is on
      purpose, not a miss. In a past season "Insights" goes to the results archive rather than the
      reports hub, so this is the only way back to that season's attendance.
- [ ] ⚠ **There is NO "Take attendance" card here**, and no "Open schedule" button if that season
      had nothing on it. A finished season shows the report and nothing else. *(Before the review
      the card did appear — and tapping it did nothing at all, because it hunted for that old event
      on THIS year's schedule.)*
- [ ] If nothing was ever marked that season, the line above the table reads **"No attendance was
      recorded for this season"** — past tense. It must not promise totals will "fill in as you
      mark", because nothing will.
- [ ] **Known, not fixed, not blocking — please don't log it as new.** The **← Insights** link here
      goes to the season **results** page, and that page does not yet honour *which* season you
      asked for: if you still coach this team you will see **this** year's results there, with no
      chip saying so. Found by the review, written up as the top follow-up on this rail, and
      deliberately out of this project's scope.

### E · An assistant coach (skip if you have none set up)

- [ ] An assistant who holds the **attendance** duty can still reach the report through Insights.
      This was flagged in the plan as something you might have to rule on; it was checked and no
      coach loses access, so there is nothing to decide — but it is worth one look.

### F · The second door is closed (added by the review)

- [ ] Open **Roster** (list view). ⚠ **There is no "Attendance" button in its header any more.**
      That button was the report's second front door, and it is why the back link was still wrong
      for anyone who used it — Insights is the only way in now, which is what makes "← Insights"
      truthful. Reaching the report from Insights is the tested path.
- [ ] On a **brand-new team with players but nothing on the schedule**: the page should go straight
      from its loading shimmer to the single "Nothing to take attendance for yet" card. ⚠ It must
      **not** briefly show a full table of players and then take it away — that flicker was real and
      is what the review caught.

---

**Where this leaves the sidebar:** Attendance is gone, Practice plans arrived (§28), and the full
regroup landed too (§33).

## §33 · The sidebar stops rearranging itself

**Built on dev 2026-08-15 · not on production · no migration, no new API, no route removed, no item
renamed.** Plan: `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` (Phase 4). Mockups: artifact `ed56fe2c`, §03.

**Why this section exists:** you asked why Tryouts was at the bottom, why Schedule sat apart from
Attendance, and what "Explore" was. All three had one root cause — the groups described *what the
data was about* rather than *what a coach is doing*. The groups now run hottest-first, and **nothing
is conditional**: every group is always there, in the same place.

**Fixture:** your normal live team, plus — for part D — a team that has **never run a tryout and
never entered a tournament** (that is the state the old shelf existed for), and an **assistant
coach** login if you have one.

### A · The order, on a desktop

- [ ] Open a team. The sidebar reads, top to bottom: **Overview**, then **Season** (Schedule,
      Practice plans, Lineups, Tournaments), **Progress** (Development, Insights), **Money**,
      **Communication** (Chat, Email families), **Team** (Roster, Tryouts), **Team admin** (Staff,
      Documents, Settings).
- [ ] **"Squad" is now "Team"**, and it has moved to near the bottom with Roster and Tryouts still
      in that order.
- [ ] There is **no "Explore" heading anywhere**.
- [ ] Every item still opens the page it always did. ⚠ Nothing was renamed — if any item's *wording*
      changed, flag it, because item names are what decide who is allowed to see them.

### B · The same order on a phone

- [ ] On a phone, tap **More**. The sheet shows the **same six groups in the same order**.
- [ ] The bottom bar itself is unchanged (Overview, Schedule, Chat, Roster, More), which is why
      those four don't repeat inside the sheet.
- [ ] Nothing scrolls sideways.

### C · The first-run tour and the guide

- [ ] If you can trigger the portal tour on a fresh team, its first card's small heading should say
      **Team**, not Squad, and its wording should no longer claim roster, lineups and development
      "sit together" — they're in three different groups now.
- [ ] Help → *The sidebar: where every tool lives* lists the six groups in the new order, and Help →
      *Finding Lineups…* no longer describes tools waiting under an "Explore" heading.

### D · ⚠ The behaviour that's actually gone — worth confirming on a brand-new team

- [ ] On a team that has **never run a tryout and never entered a tournament**: **Tryouts and
      Tournaments are still in the sidebar**, in Team and Season respectively. Previously they'd
      have been hidden away under "Explore" and would have *jumped* into position later.
- [ ] Open each one — each explains what it's for. That's the job the shelf was doing badly.

### E · An assistant coach (skip if you have none)

- [ ] Sign in as an assistant with limited duties. They see **fewer items**, but every item they do
      have is **in the same place it is for you**. A whole group disappears only if they can't see
      anything in it.

---

**Free portal note:** the free coach portal has its own **Explore** tab — where a free coach switches
the optional tools on. That is a different thing entirely and is deliberately unchanged.

**One open question, flagged not decided:** on a strict "how often do you open it" rule, Chat
probably outranks Money. Money sits above Communication because it's the bigger product pillar. Say
the word if you'd rather they swap.

## §34 · The lineup builder tells the time at the field

**Built on dev 2026-08-16 · not on production · no migration, no new API, no route change, nothing
renamed.** Plan: `COACH_NAV_AND_PRACTICE_PLANS_PLAN.md` §6 and §6a. No mockups — this is the
project's follow-up debt, not a design change.

**Why this section exists:** the Lineups *list* was fixed in an earlier pass and the **builder next
door was missed**. It printed each game's date and time in **the reader's own device timezone**
rather than the team's — so a coach checking a lineup from another province was told the wrong start
time. The same string is stamped onto the **printed lineup poster and batting-order card**, so the
wrong time was going onto paper handed out at the field. Three other items rode along with no
visible surface (a faster team load, a more reliable "next game" pick, and bookkeeping).

**Fixture:** your normal live team with at least one scheduled game. Part B needs a second device or
browser profile set to a **different timezone** — on Windows, changing the system clock's zone and
reloading is enough.

### A · The builder still reads correctly at home

- [ ] Open a game's lineup (Lineups → a game → build). The date and time in the page header match
      what the **Schedule** and the **Lineups list** say for that same game — all three agree.
- [ ] Times still read like **"9:00 a.m."**, not "09:00". ⚠ Flag it if any screen switched to a
      24-hour clock.

### B · ⚠ The actual defect — needs a second timezone

- [ ] Set a second device (or browser profile) to a **different timezone** — Vancouver is the easy
      test. Sign in and open the same game's lineup.
- [ ] The date and time shown are **identical to what you see at home** — the field's clock, not the
      reader's. Before this change they differed by three hours.
- [ ] Do the same on the **Lineups list** and the **Schedule** — all three agree on both devices.

### C · The printed sheets

- [ ] From the builder, download the **lineup poster** and the **batting-order card**. The date line
      on each carries the same date and time as the screen.
- [ ] Repeat from the second-timezone device. **The printed sheets must not differ between the two.**

### D · Nothing else moved

- [ ] Everything else on the builder behaves as before — building, saving, templates, printing,
      undo/redo.
- [ ] Attendance → the "take attendance for your next game" shortcut still offers the game you'd
      expect (the soonest upcoming one, or the most recent if the season is behind you).
- [ ] Opening a team feels no slower — three database lookups were removed from that path.

### E · The season-rollover warning (skip unless you can make the fixture)

- [ ] Only testable on a team holding **both a draft season and a live one at once**. Start next
      season from a live season that has an **unfinished tryout** (candidates still awaiting an
      outcome). The dialog shows **"Your tryout isn't finished…"**.
- [ ] Previously this warning could go missing depending on which season the database happened to
      answer with first. Nothing is at risk either way — a rollover has never carried tryout data —
      so this is a "does the heads-up appear" check, not a data check.

---

**Nothing here is user-facing beyond A–C.** If B and C read the same on both devices, this section
passes.

## §35 · Club money screens explain themselves, and a payment request becomes a record

**Built on dev 2026-08-16 · not on production · NO migration.** ⚠ **One NEW server capability: a
coach can now change a PENDING payment request.** Mockups: artifacts `2c74c60d` (empty states) and
`0e714ace` (rows + record window). Adversarial review run 2026-08-16 — four defects found and fixed,
three of them money-integrity; parts **D** and **E** are the ones that exercise them.

**Why this section exists:** you asked what Allocations and Payments even were. They turned out to be
the two Money screens that never explained themselves — and pulling on that found a table drawn
unlike its siblings, a one-tap irreversible delete, and a report label saying what an empty column
already said.

**Fixture:** a **club-run** team (these two tabs do not exist otherwise) with an allocation carrying
an overdue instalment, and payment requests in all three states. `qa-money-lab` / **QA Mid Season
U14** is seeded for exactly this — 3 allocations (2 overdue) and 5 requests. ⚠ Those records were
written straight to the database, so the **club's own accounting ledger has no matching entries** —
do not use this team to check club-side reconciliation.

### A · The two screens now say what they are

- [ ] On a team with **no** club billing, open **Money → Allocations**. It explains what an allocation
      is, where it comes from, and that you cannot create one. **No button** — you genuinely can't act.
- [ ] **Money → Payments** with no requests explains **Pay Org** and **Request from Org** with real
      examples, and offers **Make a request**.
- [ ] ⚠ Neither screen links to the other any more. Deliberate — the tab row is two words away.

### B · The tiles and the tables

- [ ] Summary tiles on **Allocations** and **Payments** **fill the width** instead of crowding left.
      Same on **Fundraising** and its drill-in.
- [ ] Allocations: an overdue instalment's badge is **red**, matching the Overdue tile above it.
- [ ] Allocations: the **paid / due** figures line up in columns down the list.
- [ ] Payments: every row is **one line tall**; the type reads **Pay Org** / **From Org** on one line.

### C · The record window

- [ ] Tap any payment request row — it opens the record. A **pencil** while pending, an **eye** once
      the club has reviewed it.
- [ ] The **declined** one is read-only with the club's written reason **at the top**.
- [ ] The **approved** one is read-only; method and review date are inside, not crammed in a column.
- [ ] The footer sits tight to the bottom and the Notes field scrolls fully into view.

### D · ⚠ Editing a pending request — THIS IS THE NEW ABILITY

- [ ] Open a **pending** request, change the amount, **Save changes**. The row updates.
- [ ] Reopen and close without typing — **no discard prompt**. Change something and close — **it asks**.
- [ ] ⚠ While a save is in flight the window **cannot be dismissed** (no X, no click-outside, no
      Cancel). *Found in review: without this, a slow save could close a different record you had since
      opened and throw away typing with no prompt.*
- [ ] If the club approves it while you have it open, saving should say **it has already been
      reviewed** rather than silently overwriting. *This is the one that could have left a request
      saying one amount while a different amount actually moved.*

### E · ⚠ Withdrawing — MOVES REAL MONEY IF IT RACES

- [ ] **Withdraw request** now sits in the window, not on the row, and **asks first**, saying plainly
      that nothing is kept.
- [ ] While the confirmation is up, **Save changes and Cancel are both dead**. *Found in review: a live
      Save under a yes/no question let you save the very edit you were abandoning.*
- [ ] A withdraw that loses a race to an approval should **say so**, not report success.

### F · A read-only money assistant

- [ ] With money access view-only, rows still open — but every window is **read-only, including a
      pending one**, and there is no Make a request, no Save, no Withdraw.

### G · The report loses two labels

- [ ] **Budget vs. Actual**, both **Categories** and **Months**: rows for things never budgeted no
      longer carry a **"not budgeted"** / **"not in your plan"** tag. The **empty Budget column** says it.
- [ ] The amber row tint stays in Categories. ⚠ **Months has no cue at all now** — it only ever had the
      label. Flag it if that reads wrong; it is a deliberate consequence, not an oversight.
- [ ] Exports still write "(not budgeted)" — kept on purpose, because a spreadsheet is filtered.

### H · Warm theme, and a phone

- [ ] ⚠ **In the warm theme**, check the status badges — Pending / Approved / Denied / Overdue / Pay
      Org / From Org. Their ink was **deepened** to clear the contrast floor (they were failing at
      4.06:1 against 4.50). Confirm they still read as the right colours.
- [ ] At **phone width**, Payments rows stack into cards and the row control becomes a labelled
      **Edit** / **View** button. Nothing scrolls sideways.

**Known and accepted:** on a desktop the row's Edit/View control stays 24px, under the 44px touch
floor — recorded as a deliberate exception, because it is drawn once per row and your ruling was that
a full-size control on a twelve-row list out-shouts the figures beside it. It **is** raised at tablet
widths, and on a phone it is already a full-width labelled button.

## §36 · A past season shows that season

**Built on dev 2026-08-16 · not on production · no migration, no new API, no route change.**
Plan: `COACH_ARCHIVE_RAIL_PLAN.md` Phase 1. Mockups: artifact `8dae1e81`, §01–§02.

**Why this section exists:** opening a finished season and tapping **Insights** gave you a page that
never asked which season it was meant to describe. It answered from whether you still coach the team
— a different question entirely — so a coach who stayed saw **this** season's games under a past
year, and a coach who had moved on saw **no games at all**.

⚠ **THIS IS THE MOST IMPORTANT QA IN THE LEDGER RIGHT NOW, because nothing automated can see it.**
The rendered test fixture has **no completed season**, which is exactly how the defect survived. Your
eyes are the only proof. Walk it together with **§32 part D**, which has the same fixture gap.

**Fixture:** a team with at least one **completed or archived** season *and* games with scores in it.
Ideally do part C with a second sign-in that no longer coaches that team.

### A · The season is named, and it is the one you asked for

- [ ] Open a team, switch to a **past season**, open **Insights**.
- [ ] A **season chip** appears beside the page title naming that season (e.g. *2024 Season ·
      Archived*). ⚠ Before this change there was no chip at all — if you don't see one, stop and say so.
- [ ] The games listed are **that season's**, and the record line above them matches. Cross-check a
      couple against what you remember, or against Season's End for the same year.
- [ ] Change season from the chip. The page reloads to the other season's games, and **the header and
      the table never disagree** — no flash of one season's games under the other's name.

### B · What a record doesn't offer

- [ ] ~~In a past season there is **no back link** at the top.~~ ⚠⚠ **SUPERSEDED BY §37 — do not
      report this as a defect.** When Phase 1 shipped, the archive pointed Insights straight at this
      page, so there was genuinely nothing above it to go back to. **Phase 2 (§37) made the Insights
      hub the archive's door**, so this page has a real parent again and the back link is **expected
      in every season now** — and it must carry you back to *the same season*.
- [ ] There are **no tag filter chips** in a past season. Tags are a list you edit today, so
      filtering an old season by them would be answering a question nobody could have asked then.
- [ ] The **"Past seasons" list IS still at the foot**, with its *Season Wrapped →* links — it is the
      team's scrapbook, not a duplicate of the season chip. ⚠ An earlier draft of this walk said it
      should be hidden here; that was wrong and was corrected before you read it, because
      **Season's End links straight to this list** as "Compare every season".
- [ ] If the season genuinely had no scored games, the message reads in the **past tense** ("No
      results were recorded"), not "Once a game gets a score, it shows up here."

### B2 · ⚠ Switching seasons quickly — the bug the review caught

- [ ] From a past season, switch season **twice in quick succession** using the chip (e.g. 2024 →
      2023 → 2024). The table always settles on the season named in the chip.
- [ ] ⚠ **It must never end up stuck on "Loading report…".** Before the fix, a slow response for an
      abandoned season could land last and strand the page on a spinner **permanently** — no
      reload, no recovery. If you ever see a spinner that does not resolve, stop and tell me.
- [ ] Also: from a past season's **attendance** report, tap **Insights**. You stay in **that
      season**. ⚠ Where it lands changed in §37 — it now opens the **Insights hub** for that season
      rather than the results page. Either way the test is the same: the year must not change.

### C · ⚠ The coach who moved on — the half that was completely broken

- [ ] Sign in as someone who coached the team **that season but does not coach it now** (an assistant
      from last year). Open the team's past season → **Insights**.
- [ ] **They see the season's game log.** Before this change the whole table was suppressed for them —
      the archive's results door showed no results.
- [ ] They see the same record and the same games you do for that season.

### D · The live season is untouched

- [ ] On the **current** season, Insights → *How are we doing?* looks and behaves exactly as before:
      back link to Insights, the tag filter chips, the game log, and the **Past seasons** list at the
      foot with its *Season Wrapped →* links.

---

**If A and C both read correctly, this section passes.** B is polish; D is the regression check.

## §37 · Insights itself learns which season it is describing

**Built on dev 2026-08-16 · not on production · no migration, no new API.**
Plan: `COACH_ARCHIVE_RAIL_PLAN.md` Phase 2. Walk it straight after **§36** — same fixture, and §36's
part B has one step §37 deliberately overturns.

**Why this section exists:** §36 fixed the *results* page. The **Insights hub above it** was worse —
it held no season resolver at all, so a coach who no longer coached the team hit a **"Team not
found"** wall on a page describing the season they ran themselves. The archive worked around this by
pointing **Insights** past the hub at the results page, and that one workaround is why **Attendance**
had a menu line in a finished season that it has in no live one. Phase 2 removes the workaround: the
hub reads its season, the archive's Insights door opens it, and Attendance goes back to living behind
Insights in both seasons.

⚠ **Same fixture gap as §36 — nothing automated can see any of this.** The rendered test fixture has
no completed season. Your eyes are the only proof.

**Fixture:** a team with a **completed or archived** season that has games, attendance and (ideally)
an award in it. Part D needs a second sign-in that no longer coaches that team.

### A · The archive's Insights door opens the hub

- [ ] Open a team, switch to a **past season**. In the menu, **Attendance is gone** — that is
      intended, not a regression. Everything else is still there.
- [ ] Tap **Insights**. You land on the **hub** (scoreboard band, "What stands out", report tiles),
      *not* straight on the game log. A **season chip** beside the title names that season.
- [ ] The scoreboard figures are **that season's** — cross-check the record against Season's End for
      the same year.

### B · Every tile stays in the season, and two are deliberately absent

- [ ] **Who's showing up?** is on the hub. Tap it → that season's attendance report, still in that
      season. ⚠ **This is Attendance's only route into a past season now** — if this tile is missing
      or lands you in the live season, stop and tell me, because the menu line was removed on the
      strength of it.
- [ ] **How are we doing?**, **Where's the money?**, **Who's earning it?** and **Is everyone getting
      attention?** each open **that same season**. Check the chip on each page.
- [ ] ⚠ **"Where is playing time going?" and "Who are we up against?" are NOT offered** in a past
      season. That is a decision, not an omission — playing-time figures are recalculated from saved
      lineups each time, and opponent notes are the book you keep *today*, so neither can honestly
      claim to show that year. Both are still there on the live season.
- [ ] The **Ask about your team** bar does not appear in a past season (it answers from the live
      season only).

### C · Awards, which had a wrong number even in the live season

- [ ] On the **live** season, open Insights → **Who's earning it?** The line reads *"N awards given
      this season"*. ⚠ **If your team has run more than one season, that number was previously
      counting every award you have ever given.** It should now count only this season's.
- [ ] In a **past** season, the leaderboard shows **that season's** awards only — not this year's.
- [ ] In a past season there is **no "Give an award"** button, **no "Manage award types"**, and **no
      remove (bin) icon** on any row.
- [ ] The **printer icon is still there** — printing a certificate reproduces something that already
      happened, which is exactly what you open a finished season to do. Print one: the certificate
      names **the season the award was won in**, not the season running today.

### D · ⚠ The coach who moved on — the wall that was there before

- [ ] Sign in as someone who coached the team **that season but not now**. Open the team's past
      season → **Insights**.
- [ ] They reach the **hub**. Before this change they got **"Team not found"** on it.
- [ ] What they can see matches what they were allowed to see **that season** — e.g. an assistant
      with no money access last year sees no dues figures for last year, even if they have money
      access on a team today.

### D2 · ⚠ The team's season history is now the head coach's alone (owner ruling 2026-08-16)

**What changed and why:** the season-by-season list — each year's record, roster size, tryout
acceptance and money summaries — was being shown to **any** coach who had ever staffed the team, for
**every** season, *including years before they arrived and after they left*. Money figures were
correctly scoped; nothing else was. You ruled it head-coach only, the simple way, with no tenure
windows.

⚠ **This restricts the cross-season summary ONLY.** An assistant who coached a past season still
opens that season and reads everything in it. If you find an assistant losing anything *other* than
the list of years, that is a defect — tell me.

- [ ] As the **head coach**: Insights → *How are we doing?* still shows **Past seasons** at the foot
      with its *Season Wrapped →* links, and Season's End still offers **Compare every season**.
- [ ] Sign in as an **assistant** on the same team. On *How are we doing?* the **Past seasons
      section is absent entirely** — not an empty box, and not the words "None yet" (that would be
      claiming the team has no history, which is false).
- [ ] That assistant's Insights tile for *How are we doing?* shows **no "N past seasons on file"**
      — the clause is gone, not showing `0`.
- [ ] That assistant's **Season's End offers no "Compare every season"** door.
- [ ] ⚠ And the important half: that same assistant can **still open a past season they coached**
      and read its roster, schedule, attendance and results normally.

### E · Switching seasons, and the live season untouched

- [ ] From the hub, switch season **twice in quick succession** with the chip. It always settles on
      the season named in the chip and **never sticks on "Loading insights…"**.
- [ ] From the **live** attendance report, switch to a past season with the chip. You land on **that
      season's attendance report** — not bounced to Season's End. ⚠ This is the step that proves
      removing Attendance from the archive menu did not remove the section itself.
- [ ] On the **live** season the hub is unchanged: all seven tiles, the Ask bar, the findings.

---

**If A, B and D read correctly, this section passes.** C is the awards fix (worth its own look
because it corrects a live-season number too); E is the regression check.

## Not in this ledger (why)

- **Quiet Mode onboarding** — your QA already PASSED (2026-07-29). Blocked on release only: its
  database change must be applied to prod BEFORE the code promotes. Plan stays active as that gate.
- **Practice Plans (1a/1b)** — in-flight project with its own live build prompt; QA rides its own
  handoff.
- **Nav Unification D1/F/G** — QA passed 2026-08-01; top-nav repair phases will bring their own QA
  slices per phase.
- ~~**Chunk D family experience**~~ — **now IN this ledger** (it is no longer "not built"):
  §1.6b Slices 0–2 · §1.6c the guardian tier · §1.7 Slice 3 · phone passes in §2.6.
  All four slices are **LIVE on production**. Migrations 214–217, 219 and 220 were applied to prod
  on 2026-08-03.

## After a session

Tell me which sections passed (and any defects). I'll fix defects, run any owed review funnels
(Chunk G), mark the TODO lines complete, and archive the remaining active plans (G, PII, Quiet Mode
graduate at release time).

**⚠ A Tier 1 defect on a LIVE section is an incident, not a backlog item.** If a step in group **1B**
or **1C** fails, stop the session and tell me immediately rather than finishing the list — the fix
ships the same day, the way the invisible-help-text defect did on 2026-08-03.

**What still gates on your OK before customers see it** *(re-checked against git, 2026-08-06)* —
this is now most of the newest work, not two odds and ends:

| Gate | Sections | Also needs |
|---|---|---|
| Group **1A** | §1.19 — a cancelled subscription actually stops | — |
| Group **1D** | §1.12 · §1.13 · §1.14 · §1.16 — the opponent book + club sharing | — (migs 225 + 227 shipped) |
| Group **1E** | §1.15 · §1.17 · §1.18 — game day on the bench | — (mig 228 shipped) |
| Inside **1B** | §1.9c — the roster switch | — |
| Inside **3A** | §6 — the playing-time wording sweep | — |
| ~~Inside **3A**~~ | ✅ §10 — the page-header ruling, both passes — **PASSED 2026-08-12**, gate cleared | — (no migration, no route change) |
| ~~Group **3C**~~ | ✅ §7 — the day-of volunteer bottom bars — **PASSED 2026-08-07**, gate cleared | — (no migration) |
| Group **2D** | §8 — house-league fields + double-booking | mig **229** applied to **prod** before promoting |
| Most of **3B** | §5.2's C · C2 · E · J2 · J3 · K · §5.3 · §5.4 | — (mig **226** applied both envs 2026-08-08) |

⚠ **One database prerequisite is left, and this ledger cannot tick it:** migration **229**
(house-league venue references, 2026-08-08) is applied to **dev only** — §8's code reads the new
columns unconditionally, so promoting it to master without applying 229 to prod breaks every league
schedule page for live customers. Quiet Mode's migration (209) is in the same queue.
Release-manager steps, not QA steps — but if missed, those sections break in production in ways
that passed QA on dev. *(225, 227 and 228 cleared this queue on 2026-08-06; **226 cleared
2026-08-08** — the coach re-anchor is scheduled on both databases and both demo worlds are live on
production.)*
