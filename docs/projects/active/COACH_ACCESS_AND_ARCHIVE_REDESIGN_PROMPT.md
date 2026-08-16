# New-chat prompt — coach access & the archive: review the design, then propose a better one

Paste everything below the line into a fresh chat.

---

You are doing a **design review and re-design**, not a build. Two related questions, one nearly
settled and one genuinely open. **Do not write feature code until the owner has approved a design.**

The owner's words are the spec, so here they are directly:

> "User management is access to the screens/data in the account, not per season. Trying to keep it
> simple, so even being able to see old users by season is not really that useful. Historical season
> data is only relevant for things that a coach might want to reference later (practice plans,
> attendance/lineup stats, budget info, etc.). In fact, it might be a good idea to really think of
> the best approach to viewing this archived data in the app — do we want to toggle season by season
> or present it screen by screen more surgically? I.e. do we just allow someone who can access
> practice plans have the ability to reference archived plans, or a treasurer in money able to see
> historical budgets, vs. toggling a whole season on the page? What is a better user experience?
> For archived data I would rather start with the simpler approach of **not accessing anything** and
> piece by piece bring in historical information as we deem relevant, vs. the other approach of
> granting access to everything and figuring out what to trim. **Less is more in this case.**"

> "**There are no live clients**, so you don't need to consider backwards compatibility — just come
> to the best solution for the product."

---

## Question 1 — access (nearly settled, confirm and build)

**Access belongs to the ACCOUNT, not to a season.** You are on a team's staff or you are not; what
you can see is decided by your role's permissions, full stop. Seasons stop being an access dimension.

The defect this fixes is real and worth understanding before you touch anything:

- The staff screen is **per season**. Removing an assistant removes their row for **that season
  only**.
- Access is granted by holding a row on **any** season.
- So **removing a coach does not remove them.** The assistant dropped in January still opens last
  year's roster, schedule, money and results — indefinitely. Nothing tells the head coach, and the
  only real revocation is to switch into every past season and remove them again.
- There is no way to express *"remove entirely"* vs *"replace but keep historical access"*, and the
  system silently picks the second.

Owner rulings already taken (2026-08-16): removal **revokes access without deleting the record** —
a past season's staff list still names who really coached it, and re-adding someone restores access
immediately. And a coach's permissions are **their current ones**, everywhere.

⚠ **The one expensive way to get this wrong is LOCK-OUT, not leakage.** A team whose season has
finished and has not rolled over yet still has staff. "Season over" is not "off the team". Any rule
keyed on "has an ACTIVE season" locks out real coaches on the day their season ends.

⚠ This **reverses governing rule 1** of Chunk F ("you see a past season as you were allowed to see it
AT THE TIME"), which is stated in `CLAUDE.md` and enforced in `lib/coach-season-read.ts`. That rule
existed *because access itself was historical*; once only current staff are in, their current grant
is the honest one. Update `CLAUDE.md` in the same unit of work or the next session builds against a
rule that no longer holds.

Background: `docs/projects/active/COACH_CURRENT_STAFF_ACCESS_PLAN.md` + its PM brief. **Verify it
rather than trusting it** — see the warning at the bottom about this project's history with plans.

---

## Question 2 — the archive (WIDE OPEN, and the reason this prompt exists)

**Today the archive is a PLACE.** A season chip switches the whole portal into a past year; a
separate archive menu (`lib/coach-nav-visibility.ts`) lists which sections that year offers; a
build-enforced allow-list governs what may join. Everything is season-scoped, and the unit of
navigation is *the season*.

**The owner is asking whether that is the right shape at all**, and leaning hard toward: it isn't.
Historical data should surface **inside the tool that uses it**, for the people who already use that
tool — archived practice plans inside Practice Plans, prior budgets inside Money for the treasurer —
rather than by toggling an entire year.

### ⚠⚠ START HERE: the product ALREADY does the surgical thing, in at least five places

This is the most useful fact in this document, and it is empirical rather than theoretical. Before
designing anything, go and read how these work, because they are the existing proof of the model the
owner is describing:

| Surface | What it does |
| --- | --- |
| `development/drills/past-seasons` | copies a coach's own past drills FORWARD into the live library |
| `development/plan-templates/past-seasons` | same, for plan templates |
| `tryout-memory` | last season's tryout score, inline on this season's decision board |
| `tryout-report` | "returning candidates improved +X", built from prior-season pairs |
| Player card → **Previous seasons** | a player's past focus areas and measurables, in place |

**Every one of these is historical data delivered inside a live screen, to someone already doing the
live job — and none of them needs a season toggle.** They are also, notably, the ones nobody has had
to fix for wrong-season defects. Ask why. Then ask what the season-toggle archive is actually *for*
once these exist.

### The questions to answer

1. **Is "the archive" a place, a lens, or nothing at all?** Make the case, don't assume. Consider a
   third option the owner hasn't named: some history may belong to **Season's End / Season Wrapped**
   (a look-back artifact) rather than to either model.
2. **Start from ZERO and justify each addition.** The owner is explicit: begin with *no* historical
   access and add pieces as they earn it. For each candidate — practice plans, attendance/lineup
   stats, budgets, rosters, results, awards, documents, tryouts — answer: **who needs to reference
   this later, while doing what?** If you cannot name the moment, it does not go in v1.
3. **Where does it live on screen?** A "past seasons" section? A year filter on an existing list? A
   picker inside a form ("start from last year's plan")? Different answers may be right for
   different data, and that is fine — but say why each.
4. **What happens to the season switcher and the archive menu** if the surgical model wins? Deleting
   surface area is a legitimate and probably desirable outcome. **Do not preserve things out of
   politeness** (see below).
5. **What does a coach lose**, honestly? Name it. If the answer is "the ability to browse a whole
   past season", say whether anyone actually wanted that.
6. **Money and guardian PII** ride ordinary role permissions under Question 1. Sanity-check that
   against the surgical model — a treasurer seeing prior budgets is the owner's own example, so it
   is in scope, but say it out loud.

---

## ⚠⚠ A large amount of very recent work may be superseded. That is fine. Say so plainly.

**Do not preserve any of the following because it is new.** It was built in good faith under the old
model; the owner is now questioning the model. Judge it on the merits and recommend deletion where
deletion is right.

- **Coach Portal Chunk F** — the whole frozen-season architecture: the season-read rail, the archive
  nav, governing rules 1/2/3, the build-enforced allow-lists in
  `tests/unit/coach-season-write-guard.test.ts`.
- **The archive rail, Phases 1 and 2** (`COACH_ARCHIVE_RAIL_PLAN.md`, commits `ac0cf565`,
  `a5ece270`, `a4a6b43a`) — made the Insights hub and its doors season-aware, pointed the archive's
  Insights door at the hub, and retired Attendance's archive-only menu line. **All of it assumes the
  season-toggle model.** If that model goes, much of this goes with it.
- **The head-coach-only scrapbook restriction** (`12cf1b19`) — already superseded by Question 1's
  ruling and slated for revert. Ledger **§37 part D2** should retire with it.
- **Ledger sections §36 and §37** — owner QA that may become moot. Check before asking the owner to
  walk them.
- `coach-history-awards` joined the rendered layout sweep (`11f35290`) and surfaced two **real,
  pre-existing** tap-target defects on the live awards screen (*Manage award types* at 15px, *Give an
  award* at 33px, against a 44px floor). Those are **left failing on purpose** and are independent of
  everything above — do not baseline them away.

**What is genuinely worth keeping regardless of the model** (all fixes to real defects, none
model-dependent): the awards report no longer counts every season's awards as "this season"; the
stale-request guards that stopped pages stranding on a spinner; the certificate printing the season
the award was actually won in.

---

## ⚠⚠ This project's specific trap: plans here have been wrong, repeatedly

Verify anything you are about to build on. This is not generic caution — it has bitten three times in
two days:

1. A handoff prompt described the layout check as "informational only, still passes" when it was
   failing with 141 findings, and named two pages as having a defect **neither had**.
2. The archive rail plan's own audit table marked the opponent scouting book as ready for the
   archive. It was not, and a standing owner ruling with a **build-enforced test** said it must not
   be. The plan's framing would have led to building the exact opposite of the ruling.
3. That same plan understated the awards work threefold, and missed that the report was **already
   cross-season in the LIVE season** — a defect nobody would have found without an archive door
   making it matter.

**Read the guard tests, not the plan docs**, when you want to know what is actually true:
`tests/unit/coach-season-write-guard.test.ts`, `tests/unit/coach-archive-season-rail.test.ts`,
`tests/uat/scenarios/coach-frozen-season-smoke.spec.ts`.

Two more lessons from the same days, both of which will bite this work:

- **A test can certify a defect the moment its premise expires.** Two did. Both were findable *only*
  because each stated its own expiry condition in words. When you change a premise, grep the specs
  for it — and when you delete a rule, **rewrite its tests to assert the new rule rather than
  deleting them**. A test that stops asserting anything is worse than one asserting the wrong thing.
- **A guard must not be opt-in, and must not derive its input from the thing it guards.** Both
  mistakes shipped here and both were caught by mutation-testing the guards.

---

## Constraints

- **No live clients.** No migration path, no backwards compatibility, no deprecation window. Design
  the right thing. Deleting a feature is on the table.
- Branch is **`dev`**, shared with other sessions. Stage explicit pathspecs only, never `git add -A`;
  bracketed directories need `:(literal)` pathspecs. Several files currently carry two sessions'
  edits — check `git diff` per file before staging, and hunk-stage where needed.
- The rendered layout fixture **has no completed season**, which is how the original season-blindness
  defect survived. If your design keeps any archive surface, that gap still applies to it.
- Owner does browser testing. Anything needing his eyes goes in `docs/projects/active/OWNER_QA_LEDGER.md`.

---

## What to produce

1. **A design proposal**, in plain language, presented in the conversation for approval **before any
   code**. Lead with what a coach does differently. Include what gets **deleted**.
2. A recommendation on each candidate piece of historical data: **in v1, or not, and why** — with the
   default being NOT.
3. An honest account of what is superseded, and what it costs to unwind.
4. Only after approval: a plan + PM brief in `docs/projects/active/`, then build.

**Push back if you disagree with the owner's direction** — he has changed course twice already on
this exact question after being shown evidence, and would rather be argued with than agreed with.
But argue from what the code actually does, not from what a plan says it does.
