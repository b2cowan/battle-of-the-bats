# Opponent Scouting Book — Phase 2 Build Prompt

**Status:** ✅ **EXECUTED 2026-08-04** — the owner cleared the gate by ordering execution of
this prompt in-conversation. All five slices built on dev (uncommitted); owner QA =
`OWNER_QA_LEDGER.md` §1.13. Kept for the record; the parent plan's Status block is current.

**Parent plan:** `COACH_OPPONENT_SCOUTING_BOOK_PLAN.md` (P1 shipped to dev at `72034c15`;
read its §1 workflow, §3 data model, §4.5–4.8, and the ratified rulings in its Status
block first — they bind P2). **P1 QA (ledger §1.12) should PASS before P2 starts**; if
QA surfaces defects, fix those first.

---

## What Phase 2 delivers (five slices, one phase — build all of it in one pass)

### S1 — Merge & aliases ("Same team as…")
- Card page (head coach / `notes` grant): a quiet "Same team as…" control → picker of
  other book entries → confirm sheet showing the two records unifying. Merge = loser's
  normalized name becomes an alias row of the winner + loser's observations re-pointed +
  loser's summary appended to the winner's (labelled), per plan §3. Unmerge = delete the
  alias (regroups naturally next read); surface un-merge in the same control.
- Aliased spellings resolve everywhere P1 already reads (list, card, chips, tabs — the
  server paths are alias-proofed since the P1 review; the client's chip lookup in the
  schedule page needs the alias map folded into its roll-up matching).
- API: `POST .../opponents/merge` + `DELETE .../opponents/aliases/[aliasId]`, caps
  `notes`; both live-season routes off the season rail (extend the write-guard it-block's
  route count expectation).

### S2 — Auto-insights: "The numbers vs them"
- Card page, between the stat row and the book line (mockup 5a): derived lines, each with
  a "from N games" provenance chip, rendered ONLY above confidence floors (≥3 meetings;
  lineup insight ≥2 lineups saved vs them):
  - home/away split; this-season vs all-time; average score.unit for/against;
    "all N meetings decided by ≤2"; biggest win / worst loss.
  - **"What worked"**: join their meetings to OUR saved lineups —
    "In both wins, {player} started at {pitcherPosition}; in the loss she didn't"
    (pitcher-position sports only) and "N players saw the field in every win".
- Pure computation module + table-driven unit tests (no I/O); server assembles inputs in
  the existing card GET (lineups for those event ids — one batched read, no N+1).
- Honesty rule (Ask-the-Front-Office precedent): every line provable from records shown;
  below-floor lines are ABSENT, never hedged.

### S3 — Staff-chat game-plan share
- "Share to staff chat" on the card + Scouting tab (caps `staffChat`): posts a SNAPSHOT
  message (matchup + book line + tagged observations + numbers block) into the existing
  team staff room (mockup 5c). Snapshot, not live link — later edits never rewrite chat
  history. Absent when the team has no staff room / caller lacks the grant.

### S4 — Drawer tag filters + masthead nudge
- Scouting tab: tag chips filter observations (All + only tags in use), mirroring the
  card page's P1 filter.
- Masthead: ONE quiet line in game week when the next game's opponent has book content —
  "You play {opponent} {day} — {n} observations in the book" → links to the Scouting tab.
  Once per game (dismiss-with-memory, sessionStorage-class), absent in archives, absent
  when the book is empty. Follow the masthead feed's existing server-side assembly.

### S5 — Capture-flow polish (from mockup Stage 1)
- The capture sheet's "add several observations in one sitting" affordance (P1 ships one
  input; the approved 1b mockup shows saved-line + add-another). Keep it the drawer tab,
  not a new modal.

## Constraints that bind (do not re-litigate)
- INSTRUMENT ruling: everything live-season-only; nothing joins the archive allow-lists.
- Open contribution + attribution + head-coach eraser; book line stays `notes`-gated.
- Records/tallies through `WRAPPED_RECORD_EVENT_TYPES` + `lib/coach-season-record` only.
- Numbers-not-names; no photos; game rows never written.
- Warm + dark theming via tokens only; 900/640 mobile system; icon-only mobile buttons
  with aria-labels.
- No new migration expected (P1's three tables carry P2). If one proves necessary,
  dictionary + snapshots in the same unit of work.

## Verification bar (match P1's)
- Unit: merge/unmerge round-trip incl. observation re-pointing; insight floors
  (present/absent at boundary); alias-aware chip lookup; snapshot share formatting.
- `npm run typecheck`, full `npm test`, `npm run verify:changed` all green.
- Post-build: offer `/simplify` then `/review` (high-risk: shared modules again), then
  `/docs` (merge control + numbers-vs-them + share need guide updates in the
  `premium-scouting` section and its duplicate-spelling FAQ, which currently promises
  the merge "in a follow-up phase").
- New ledger section (§1.13) with the owner QA script; commit only with per-action OK,
  explicit pathspecs, foreign-hunk hygiene (see P1's commit `72034c15` message).
