# Club Shared Book — Implementation Plan ("the club's collective scouting memory")

**Status:** ✅ **P1 BUILT 2026-08-05 on `dev` (UNCOMMITTED)** — the whole §7 P1 loop: both
switches, the card's "From your club" layer, the drawer teaser, the list marker, the Club-plan
gate. Owner QA = `OWNER_QA_LEDGER.md` **§1.16**. ✅ **Post-build funnel COMPLETE 2026-08-05**
(`/simplify` → `/review` → `/docs`; see §10 below). ⚠ **mig 227 applied to DEV only** — apply to prod before any master
promote (`node scripts/apply-migration-api.mjs supabase/migrations/227_club_shared_book_opt_in.sql --prod`).
Sequencing gate cleared: Game-Day Mode P1 landed at `bcd695a3`.

**What P1 actually shipped, against the plan:**
- Storage: `organizations.club_book_sharing_enabled` + `rep_teams.share_club_book` — **two
  columns, not the `coach_settings` jsonb** (§6's open question, decided at build against the
  live schema: a shared jsonb bag makes every write a read-modify-write, and the sibling query
  wants a column to filter on).
- Gate: new feature key `club_shared_book` → `club` in `lib/plan-features.ts`.
  **`lib/plan-config.ts` is untouched** — it carries no per-feature list, so a feature key has
  no home there. `PLAN_PRICING_FACTS.md` reconciled + drift check run in the same change.
- Architecture: assembly lives in the PURE module (`lib/coach-club-book.ts`) behind a
  `ClubBookReader` seam; `lib/coach-club-book-server.ts` is the db adapter only. The seam
  exists so the **two-org leakage fixture runs the real assembly** against an adversarial
  reader — the non-negotiable test is a test, not a comment.
- Routes: **no new route files.** The club layer rides the existing card GET (`club` block) and
  list GET (`clubKeys`); the two switches ride the existing team PATCH and org coach-settings
  POST. The scouting write-guard's route-count floor therefore did **not** move.
- Ordering judgement not in the mockup: sibling blocks sort by observation count, then name.

**Original approval:** §8 rulings ratified AND mockups signed off (owner, 2026-08-04; artifact
`def742fe-…` v4 Stage 8, "looks good").
**Tier:** Club plan exclusive (RULED §8 Q3 2026-08-04; logged in the Business Decisions
Log via `/strategy`; gate code + `PLAN_PRICING_FACTS.md` + `lib/plan-config.ts` move
together in the build's same unit of work).
**PM brief:** `COACH_CLUB_SHARED_BOOK_PM_BRIEF.md`
**Parent:** `COACH_OPPONENT_SCOUTING_BOOK_PLAN.md` (P1–P3 shipped to dev at `72034c15` +
`d87fb31b`; its rulings — INSTRUMENT, open contribution, numbers-not-names — all inherit).

---

## 1. What this is

Today every team's opponent book is an island: the 12U A coach's hard-won read on Oakville
Thunder helps nobody when the 12U B team draws Thunder next weekend. For a club running
several teams, the club's *collective* experience against an opponent is one of the most
valuable things the org owns — and it currently lives in one coach's book at a time.

**Club Shared Book: teams inside one club can opt in to share their opponent books with
each other.** On an opted-in team, the opponent card (and the game drawer's Scouting tab)
gains a clearly-labelled "From your club" layer: sibling teams' book lines, observations,
and records against the same opponent — read-only, attributed to the team and author that
wrote them. Nothing merges; nothing is editable across team lines; each head coach still
curates exactly one book — their own.

### What it is NOT (boundaries that keep it trustworthy)

- **Not a club-wide database anyone edits.** Writes stay exactly where they are today:
  your team's book, your team's rules. Sibling content is a labelled, read-only layer.
- **Not automatic.** Sharing is opt-in per team by that team's head coach (§8 Q1 decides
  the exact model). A coach's candid observations never become club-visible by surprise.
- **Not cross-club.** Sharing stops at the org boundary, always. Opposing teams' books
  about *you* are other orgs' data and are never visible; this feature never crosses orgs.
- **Not a new capture surface.** Zero new writing anywhere — this is a read-time layer
  over books that already exist.

## 2. Why the overlay architecture makes this cheap

The book has no opponent entity — it's an overlay keyed on `normalizeOpponentName()` over
each team's own game events, with per-team alias maps (parent plan §3). That design was
chosen for a fraction of an entity system's cost, and it pays off again here:

> **The club layer is the same read, widened:** for an opted-in team viewing opponent key
> K, fetch sibling opted-in teams' minted opponents whose normalized name (or alias)
> resolves to K, plus their observations and their meetings roll-up. Group at read time,
> label by team. No backfill, no entity, no cross-team FK — and no migration to the book's
> three tables.

Age-group relevance mostly self-solves: youth opponent names carry the bracket ("Thunder
12U"), so normalized-name grouping naturally keeps 12U intel with 12U teams. Where a club
names opponents loosely, each team's own alias merges refine their side of the match. A
same-club-different-spelling miss shows nothing — a false negative costs a shared note,
never correctness.

## 3. Existing foundations (verify at build time)

| Piece | Where | Role |
|---|---|---|
| Book rows carry `org_id` already | `rep_team_opponents` / `_observations` / `_aliases` (mig 225) | Org-scoped sibling queries need no schema change to the book tables |
| Sibling teams | `rep_teams` by `org_id` | The share group |
| Alias-aware key resolution | `getRepTeamOpponentByKey` + `buildOpponentBook` aliasKeys | Reuse per team; never a fuzzy cross-team matcher |
| Card + tab surfaces | `history/opponents/[opponentKey]` page, `OpponentScoutingPanel` | Gain the labelled club layer |
| Plan gating | `lib/plan-config.ts` + `hasPlanFeature` + Facts doc | The Club gate (§8 Q3) — Facts doc + config in the same unit of work, `/strategy` logs the decision |
| Capability posture | book reads ride `schedule` | Sibling layer rides the SAME cap on the viewer's own team |

## 4. UX specification

### 4.1 Controls (two switches, both quiet)

- **Club admin enables the feature** for the org (rep-teams admin area): "Teams can share
  their opponent books with each other." Off = nothing anywhere changes.
- **Each head coach opts their team in** (team Settings, `notes`-capability): "Share our
  book with the club." Copy states the deal plainly: *"Your book line and observations
  become readable by your club's other opted-in teams, labelled with your team and each
  writer's name. You can stop sharing any time."* Opting out later hides the team's
  content from siblings immediately (read-time layer — nothing was copied).
- Recommended reciprocity (§8 Q2): you **see** the club layer only while you **share** —
  contribution culture over free-riding, stated right on the switch.

### 4.2 The club layer on the opponent card

Below the team's own timeline, a **"From your club"** section, one block per sibling team
with content on this opponent: team name + their record chip vs the opponent, their book
line (italic, labelled), and their latest few observations (attributed "— Coach Dana ·
12U A"), with "show all". Season-badged like the home timeline. Empty = section absent —
never an empty shell. A small provenance line: *"Shared by your club's teams — each team
curates its own book."*

### 4.3 The glance surfaces

- **Scouting tab (game drawer):** when sibling content exists for this opponent, ONE quiet
  line under the team's own content: "Your club has {n} more observations on {opponent} ›"
  → deep-links to the card's club section. No sibling prose inline — the tab stays a
  glance.
- **Opponents list (Insights):** rows gain a small club badge when the club layer has
  content for that opponent (dot + tooltip-style label, not a second count).
- **Masthead nudge / practice bridge:** UNCHANGED in P1 — they speak for the team's own
  book only. Widening them is P2 polish if coaches ask.

### 4.4 Privacy & tone guardrails (inherited, restated)

- Numbers-not-names microcopy applies club-wide; shared visibility raises the bar for
  tone, and the switch copy says a coach's own name travels with each note.
- Curation stays home: the head coach can remove observations **from their own team's
  book only**. Seeing something objectionable from a sibling team is a phone call (or the
  club admin), not a cross-team eraser — deliberate; a cross-team delete would make every
  coach's book editable by politics.
- Sharing exposes scouting content about OPPONENTS only — never roster, family, money, or
  any team-internal record. The payload is the book, nothing else.

## 5. API surface (all reads; live-season instruments)

- Card GET (`opponents/[opponentKey]`) gains a `club` block when the org+team are opted
  in: `[{ teamId, teamName, record, summary, observations[...], lastMeeting }]` — capped
  per team (latest N, "show all" fetches the rest). Assembled server-side by resolving K
  against each opted-in sibling's book (their aliases included).
- Scouting-tab payload gains `clubObservationCount` (the one-line teaser).
- Opponents list roll-up gains a per-key `clubHasContent` boolean (one batched query).
- Opt-in writes: org toggle (admin route, rep-teams admin caps) + team toggle
  (`notes`-capped coach route).
- ⚠ NONE of this joins the season rail or archive lists — same INSTRUMENT ruling, same
  write-guard posture, and the scouting-book route-count contract will move (the it-block
  scans `/opponents/`): update its floor deliberately in the same commit.

## 6. Data model

One small migration for the two switches (+ DATA_DICTIONARY + snapshot refresh, same unit
of work — the book's three tables are untouched):

```
organizations (or org settings surface — verify at build): club_book_sharing_enabled bool default false
rep_teams: share_club_book bool default false  -- head-coach opt-in, per team
```

(Exact placement decided at build against the live schema — columns vs existing settings
jsonb; whichever it is, the dictionary entry states the opt-in semantics and that the
book tables themselves are unchanged.)

## 7. Phases

- **P1 — the whole loop (one phase, deliberately small):** both switches, the card's
  "From your club" section, the tab teaser line, the list badge, plan gate (once §8 Q3 is
  ruled + logged), unit tests (sibling resolution incl. aliases both sides; opt-in/opt-out
  visibility; reciprocity if ruled in; caps/labels; no cross-org leakage — adversarial
  fixture with two orgs), ledger QA section.
- **P2 (only if coaches pull):** club layer in the staff-chat snapshot + printed sheet;
  masthead/practice-bridge awareness; a club-admin read-only overview ("which teams share").

## 8. Owner rulings — ✅ ALL FIVE RATIFIED as recommended (owner, 2026-08-04)

1. **Opt-in model — RULED:** org admin enables the feature + each head coach opts their
   own team in. (Rejected: admin-only — coaches surprised; coach-only — clubs can't set
   policy.)
2. **Reciprocity — RULED:** see-only-while-sharing, stated plainly on the switch.
3. **Plan gating — RULED: Club plan exclusive.** Packaging decision logged via `/strategy`
   (Business Decisions Log); gate code + `PLAN_PRICING_FACTS.md` + `lib/plan-config.ts`
   move together in the build's unit of work. Non-Club orgs see no switches, no layer, no
   tease — absent, not locked.
4. **What travels — RULED:** book line + observations + per-team record roll-up.
5. **Club-blended auto-insights — RULED: NO.** Sibling records render per-team and
   labelled, never averaged across teams ("the numbers vs them" stays each team's own).

## 9. QA / verification (bar matches the book's phases)

- Unit as §7; the two-org leakage fixture is the non-negotiable one.
- `npm run typecheck`, full `npm test`, `npm run verify:changed`; migration →
  `npm run check:migrations` + dictionary + snapshots.
- Post-build funnel: `/simplify` → `/review` (high-risk: cross-team read paths + a new
  plan gate) → `/docs` (the guide's scouting section gains the club story + the switch
  copy; the Club-plan marketing story goes to `/marketing`, not the help docs).
- Mockup gate before build: extend the scouting artifact (`def742fe-…`) with a "club
  layer" stage; explicit owner OK in-conversation.
- Owner QA ledger section: two-team club shares both ways; opt-out hides immediately;
  non-shared team sees nothing; Team-plan org sees no switches anywhere (gate); archived
  seasons unchanged (no club layer, like all scouting).

---

## 10. Post-build funnel — `/simplify` → `/review` → `/docs` (2026-08-05, all three run)

### `/simplify` — 10 cleanups applied, 2 skipped
Applied: dropped a duplicate `clubRecordChip` in favour of the book's existing `recordChip`;
extracted the alias-grouping block that had been copy-pasted into both match directions; deleted
a `lastMeeting` field (and its date-comparison logic) that nothing rendered; removed an unused
`perTeamLimit` option; replaced five hand-assembled `resolveClubBookAccess({…})` call sites with
`resolveClubBookAccessFor(org, team)`; routed the admin route's plan check through that canonical
resolver instead of a raw `hasPlanFeature`; namespaced the admin response under `club_book`;
bounded the sibling-observations read **at the query**, per opponent (it had been slicing an
unbounded result, contradicting its own comment); started the list route's club lookup alongside
the team's own reads (one round trip saved); and held the list badge's key Set in state so typing
in the search box stops rebuilding it.

Skipped, deliberately: extracting a shared admin-toggle component (the second copy lives in
`assistant-coaches/page.tsx`, which another session had uncommitted — and a one-caller component
is not a simplification).

⚠ **The one deferred item was subsequently CLOSED at the owner's request (2026-08-05, same day)** —
see §10.4 below.

### `/review` — high-risk tier, 5 lenses, 6 confirmed defects fixed
| Severity | Defect | Fix |
|---|---|---|
| High | A failure reading a **sibling's** book 500'd the coach's **own** opponent page (`withObservability` re-throws) | The club layer degrades to absent and captures the error — it is an enrichment read, never a blocker |
| High | A sibling's record read their newest **400** games while their own page reads **1000** — the same team's record could differ on two screens one tap apart | One shared `OPPONENT_BOOK_EVENT_LIMIT`, so the two cannot drift again |
| Medium | When a sibling had two un-merged rows **both** carrying a book line, only the first survived — contradicting the fold's own promise | Distinct lines are kept and joined; `.scoutBookRead` gained `pre-line`, which also repairs the pre-existing P2 merge appendix's display |
| Medium | Both new switch writes threw unhandled where the neighbouring write returns JSON — a blank 500 on any env without mig 227 | Clean JSON errors, so the switch reverts and says why |
| Low | Observation totals were counted from returned rows (page-ceiling risk) and could disagree with the page shown | Exact `head` counts, floored at the rows displayed |
| Advisory | Both toggles reverted to the **assumed** prior value on failure — a lost response could show "Not sharing" while the server had it **on** | Both now re-read the server's answer instead of guessing |

Accepted, not changed: two genuinely different real-world teams sharing a name inside one club
would merge (**inherent to the ratified overlay architecture** — the same property already exists
inside a single team's own book, so this build did not introduce it); and a sibling revoking
sharing mid-request can still have content served for that one in-flight request (window is
milliseconds; "immediately" means the next read, as ruled). Refuted: an expand-state leak across
opponent cards — unreachable, there is no card-to-card link.

⚠ **The security lens could not break any of the three gates.** It attacked cross-org leakage
through every new query, plan-gate bypass on both switches, reciprocity bypass, and fail-open on
an unapplied migration. All held.

### `/docs`
`lib/help-content/coaches.tsx` (§`premium-scouting`) gained the club story in the coach's language
— what travels, the two switches, read-only across team lines, records per team never blended,
see-theirs-while-sharing-yours, instant revocation, never leaves the club — plus two FAQs:
*"what exactly do the other coaches see?"* and *"why don't I have that section?"*.
`lib/help-content/rep-teams.tsx` (§`shared-library`) gained the admin's half and its own FAQ, and
its heading now names opponent books. Search keywords/`searchText` updated on both (search reads
those fields, not the prose). **No pricing copy written** — per the decisions-log handoff the
Club-plan marketing story is `/marketing`'s at ship; the guides say only "part of the Club plan"
where they must explain an absent switch.

### 10.4 The drawer's count-only path — the deferred efficiency item, closed (owner call, 2026-08-05)

`/simplify` flagged it and this plan deferred it to P2; the owner asked for it immediately, so it
shipped in a follow-up commit.

**The waste.** The Scouting tab renders ONE line with ONE number in it — plan §4.3 deliberately
keeps sibling prose off that surface. It nevertheless fetched the full card payload, so the server
assembled the whole club block for it: every matched sibling's entire game history (read purely to
compute records the tab never renders) plus up to 25 observation bodies per sibling, counted and
then discarded. ⚠ The `/review` fix that aligned the sibling history cap with the team's own page
(§10's High finding) had **roughly doubled** this cost — correct, and worth the waste, but it made
closing the item more attractive than the original estimate.

**The shape.** The card GET takes `?club=count`. With it, the route skips block assembly entirely
and calls a new count-only assembly that shares the CHEAP half of the block builder — the same
sibling resolution, the same org scoping, the same reciprocity precondition — then stops: **no game
reads at all**, and `cap: 0` so no observation body is fetched either (the total comes from a
`head` count). `clubObservationCount` is now always served at the top level, derived from the
blocks on the full path and read cheaply on the glance path. The card page omits the parameter and
is byte-identical to before.

**Why the two numbers cannot disagree** (the risk worth stating): the full path sums
`observationCount` over blocks that survived `siblingBlockHasContent`, and the count path sums over
every matched row. A block is filtered out only when it has no summary AND zero observations — so
an excluded team contributes exactly 0 either way. The sums are equal by construction, and a test
asserts it on the fixture.

**A co-dependent pair, worth remembering:** skipping the rows query at `cap === 0` REQUIRES the
companion change that stops dropping entries with no rows — the old skip condition was
`rows.length === 0`, which is always true at cap 0, so the count would silently have been 0 forever.
Ship them together or not at all.

**Verification:** 4 new tests, including one that asserts the heavy reads are **never called** on
the count path (the assertion that keeps the optimisation from quietly regressing). Re-reviewed
through two adversarial lenses (correctness, security/regression) because it changes a shared
endpoint's behaviour — **both clean**: no gate weakened by the new client-supplied parameter, org
scoping identical, and the full card unchanged.
