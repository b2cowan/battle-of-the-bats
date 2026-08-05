# Club Shared Book — Build Prompt ("the club's collective scouting memory")

**Status:** ✅ **APPROVED TO BUILD — both gates cleared 2026-08-04:** all five §8 rulings
ratified as recommended ("let's go with your recommendations") AND mockup sign-off given
in-conversation ("looks good") on artifact `def742fe-1b28-48ae-981a-d8a6a9afe45d` v4
**Stage 8** (three frames: the switch, the card's club layer, the drawer teaser).
**Mockups are the spec** — amber spine for sibling voices, olive stays the team's own;
the switch copy in 8a is the approved wording baseline (tone may be polished, the deal it
states may not change).

⚠ **SEQUENCING GATE:** build AFTER Game-Day Mode P1 has landed on `dev` (it was in flight
in a parallel session 2026-08-04, touching shared scouting surfaces). Before starting:
check `git log`/TODO for Game-Day's commit. If it is still uncommitted/in flight, STOP and
ask the owner rather than colliding in the shared working copy.

**Parent plan:** `COACH_CLUB_SHARED_BOOK_PLAN.md` — read all of it; §1 (boundaries), §2
(read-time layer over the overlay), §4 (UX), §5 (API), §8 (the five RATIFIED rulings)
bind. PM brief beside it. Grandparent: `COACH_OPPONENT_SCOUTING_BOOK_PLAN.md` (its
INSTRUMENT / open-contribution / numbers-not-names rulings all inherit).

---

## Scope: plan §7 P1 — the whole loop, one phase

1. **The two switches.** Org-level enable on the rep-teams admin surface (club admin);
   per-team "Share our book with the club" in team settings (`notes` capability — head
   coach or granted assistant), with the mockup 8a copy: what travels, names attached,
   reciprocity, instant revocation.
2. **The card's club layer.** "From your club" section below the team's own timeline on
   `history/opponents/[opponentKey]`: one amber-spined block per sibling opted-in team
   with content on this opponent — team name, THEIR record chip vs the opponent, their
   book line (labelled), latest few observations attributed "— {author} · {team}", and an
   "All {n} from {team} ›" expander. Absent when empty. Provenance line per mockup 8b.
3. **The drawer teaser.** One quiet line on the Scouting tab when club content exists:
   "Your club has {n} more observations on {opponent} ›" → deep-links to the card's club
   section. Nothing else changes at the glance level; masthead nudge + practice bridge
   stay own-team-only in P1.
4. **The list badge.** Opponents list rows wear a small club-content indicator (one
   batched lookup, no per-row queries).
5. **The plan gate.** Club-plan feature key: non-Club orgs (and standalone Premium teams)
   see NOTHING — no switches, no layer, no locked tease (decisions-log ruling: absent,
   not upsold in-app).

## Constraints that bind (do not re-litigate — rulings are logged)

- **The five ratified rulings** (plan §8): admin-enables + head-coach-opts-in ·
  see-only-while-sharing reciprocity (**server-enforced**, never client-only) · Club-plan
  exclusive · book line + observations + per-team record travel · NO club-blended stats
  (records per team, labelled, never averaged).
- **Read-time layer, never an entity.** Resolve the opponent key against each opted-in
  sibling's book via THEIR normalized names + THEIR aliases (`getRepTeamOpponentByKey`
  per team / a batched equivalent) — never a fuzzy cross-team matcher. A miss shows
  nothing; a false negative costs a note, never correctness.
- **Writes stay home.** No cross-team edit or delete of any kind — curation is each head
  coach's, on their own book only. The club layer is read-only by construction.
- **Never crosses the org.** The two-org leakage fixture is the non-negotiable test: no
  query path may return book content across organization lines. Adversarial fixture, not
  a happy-path assertion.
- **One small migration** for the two opt-in flags ONLY (org-level + per-team; verify
  placement — columns vs existing settings surface — against the live schema snapshots,
  never migration files). Book tables untouched. Dictionary + `npm run refresh:snapshots`
  in the same unit of work; `npm run check:migrations` green. ⚠ Migration is DEV-ONLY
  until a release applies it to prod — flag it like mig 225.
- **The gate ships with its paperwork** (decisions log 2026-08-04): the feature key in
  `lib/plan-config.ts`/`lib/plan-features.ts` AND the `PLAN_PRICING_FACTS.md` update land
  in the SAME unit of work, and the Facts doc's drift checklist runs. Never restate
  prices — the Facts doc is canonical.
- **Live-season INSTRUMENT** (inherited): nothing joins the season rail or the archive
  allow-lists; archived seasons show no club layer anywhere. Route context via
  `resolveLiveCoachTeamContext` (`lib/coach-route-context.ts`) — never a hand-copied auth
  chain (P3 lesson).
- **Route placement:** anything new under `/opponents/` NESTS under `[opponentKey]` — a
  literal sibling shadows the dynamic segment (P2 lesson). The write-guard's
  scouting it-block scans `/opponents/` and its route-count floor will move — update the
  floor deliberately in the same commit, with a comment.
- Viewer-side capability: the club layer rides `schedule` on the VIEWER's own team, same
  as every book read. The org toggle rides the rep-teams admin caps.
- Numbers-not-names microcopy inherits club-wide; tokens only; 900/640 mobile system;
  icon-only mobile buttons with aria-labels; warm + dark theming.

## Verification bar (match the book's phases)

- Unit: sibling resolution incl. aliases on BOTH sides (viewer's spelling → their alias →
  sibling's alias → sibling's book); opt-in/opt-out visibility flips (out = gone
  immediately); reciprocity (non-sharing team sees nothing even when siblings share);
  gate (non-Club org: switches absent, payloads carry no club block); per-team caps and
  labels; the two-org leakage fixture.
- Existing scouting tests + the coach-season-write-guard contract stay green (floor
  update only, if routes move it).
- `npm run typecheck`, full `npm test`, `npm run verify:changed`, `npm run check:migrations`.
  Rendered `check:layout` if a dev server is up; if not, say so in the handoff.
- Post-build: offer `/simplify` then `/review` (high-risk: cross-team read paths + a new
  plan gate + a migration) then `/docs` (scouting guide gains the club story + the switch
  deal in the coach's language; the Club-plan MARKETING story is `/marketing`'s at ship,
  per the decisions-log handoff — do not write pricing copy in the help docs).
- New OWNER_QA_LEDGER section (next free §1.x): two-team club shares both ways; opt-out
  hides immediately; non-sharing team sees nothing; Team-plan/standalone org shows no
  trace; alias-merged spelling still finds the sibling book; archived season unchanged;
  phone (390) layout for the club blocks.
- ⚠ Shared working copy: other projects' uncommitted hunks may live in shared files.
  Commit only with explicit per-action owner OK, explicit `:(literal)` pathspecs for
  bracketed dirs, and hunk-level splitting where a file mixes projects — precedent: the
  `d87fb31b` commit. Dev-server restart rule before owner browser QA (new files +
  migration).
