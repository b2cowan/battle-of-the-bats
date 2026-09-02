# One Tag Idiom — Tagging Across the Coaches Portal — Implementation Plan

> **Status:** ✅ COMPLETE — owner QA §129 PASSED 2026-09-02 (36/36, zero defects); F2 dropdown built same day; awaiting the commit word (mig 272 prod-owed at release)
> **Created:** 2026-09-01
> **Branch:** dev
> **PM brief:** `COACH_TAGGING_PM_BRIEF.md` (same folder)
> **Planning prompt:** `COACH_TAGGING_REVIEW_PLANNING_PROMPT.md` (inventory with file:line, appendix A)
> **Mockups (round 1, decision sheet):** https://claude.ai/code/artifact/8879b68b-5b4d-4f10-8fe9-e7a1e9baac32 — source `COACH_TAGGING_MOCKUP.html`
> **Drawer prototype (THE approved spec for the manager):** https://claude.ai/code/artifact/8e04e12d-ebc3-4e60-adcd-6f234e996e5d — source `COACH_TAGGING_DRAWER_PROTO.html`

## Goal

One tag experience across the coaches portal: **one picker** (search → "+ Create" → the manage
door as its last row), **one manager** (a right-hand drawer with usage counts, rename / merge /
delete, shared tags listed read-only), **one door name** ("Manage tags…"), and **one shelf**
(a Tags section under Team settings listing every library). Close the three shipped gaps: staff
and equipment libraries get their first manage screen, the drill's free-text "kit" joins the
Equipment library, and the scouting filter stops dressing like a mintable picker.

## Owner rulings (2026-09-01 — binding; logged in `memory/design_decisions.md`)

| # | Ruling |
|---|---|
| Q1 | Central home = **a "Tags" section under Team settings** (the shelf; libraries with counts, expand-in-place). |
| Q2 | Every tag **picker** carries one quiet door — "Manage tags…" as the dropdown's **last row**. **A filter carries NO door** (the Ledger's Tags pill stays door-less; the toolbar button goes). |
| Q3 | Delete-in-use = **orphan with the count**, and the confirm offers **"Merge instead" as a live button**. Budget items keep their refusal (a filing key, not a label). |
| Q4 | Budget items + test types adopt the **row shell** (name · count/status · actions) but keep their **own rules and homes** (Budget tab / Skills & Goals). |
| Q5 | Drill kit → **Equipment library**, via the one-time **adopt row** — never a silent import. |
| Q6 | House word **"tag"**; the one door label is **"Manage tags…"**; the manager is titled by the library ("Money tags", "Game tags", "Focus tags", "Staff", "Equipment"). "Your tags" / "Manage money tags" / "Manage game tags" retire. |
| Q7 | Scouting tags stay **fixed**; the filter becomes a **segmented control** (the view-switch idiom — a shape that cannot be added to needs no caption). |
| Q8 | The 50-per-kind cap = **one sentence at the foot of the Tags section**; the route refusal stays as backstop. |
| Q9 | The manager is a **DRAWER** — ratified hands-on from the clickable prototype. Right sheet (420px, the help-drawer width) over the surface the coach is on; the form behind dims and goes inert; closing returns focus to the picker with typing kept; Esc backs out one layer at a time. On ≤640 it is the standard full-screen sheet (already the house overlay default). |
| + | Usage counts show in the **manager only** — the picker's dropdown stays clean. |

Standing rulings this build must honour: one word everywhere a customer reads (2026-08-24);
a modal is for a question (2026-08-26 — the delete/merge **confirms** stay dialogs, the manager
does not); page-level actions (2026-08-13); shared component beats shared class; form selects
are dropdowns; 44px tap floor ≤768 (rendered check); `--text-tertiary` for meta ink;
sport-neutral vocabulary; help + demo swept in the same unit of work.

**Colour law this build establishes portal-wide: olive = your team's, blue = the club's — on
chips, dots, everywhere.** (Today the practice picker draws *selected* chips blue.)

## Code facts the phases build on (verified 2026-09-01)

- Five kinds on one backend: `rep_team_tags` (migs 181/184/221/266), route factory
  `lib/coach-tag-routes.ts` (collection GET/POST, item PATCH/DELETE, merge POST; cap 50/kind;
  org-shared = `team_id NULL`, never writable from team routes; staff/equipment merge/delete
  re-point plan jsonb via `lib/rep-practice-plan-tag-repoint.ts`).
- **No usage counts exist anywhere**: `TagSearchCombobox`'s `countById` prop has zero callers;
  the library GET returns names only. Counts are Phase 0.
- Join/link homes for counts: game → `rep_team_event_tags`; money → `rep_team_expense_tags` +
  `rep_team_fundraiser_tags` (mig 239); focus → drill/template tag tables + `rep_team_event_tags`
  (mig 221 stores a practice plan's focus tags there) + the player focus-area single tag;
  staff/equipment → ids inside practice-plan/template jsonb (`staffTagIds`/`equipmentTagIds`,
  `lib/types.ts:1438-1551`) — count by the same traversal the re-point helper uses.
- Drills already model the target pattern: a station carries `equipment: string[]` (legacy,
  read-only) OR `equipmentTagIds` (real ids); the **drill** record still has only free-text
  `equipment` — that is the Phase 3 migration.
- The coach portal has **no working-surface side sheet** (`.slideOver` is a centered modal; the
  help drawer is the only right-hand panel). The drawer is a new, owner-ratified idiom —
  `TagManagerDrawer` is its one implementation; nothing else adopts it without a ruling.
- Org admin's Shared library screen exists (`app/[orgSlug]/admin/rep-teams/shared-library`) —
  the "ask your club admin" sentence points somewhere real.
- `.tagChip` is defined twice in `coaches.module.css` (`:4696` toggle pill vs `:9864` blue
  remove-chip); by cascade order the second likely suppresses `.tagChipActive` — **verify in the
  browser during Phase 2** and delete the first definition with its last consumer.
- Demo: seed `MIDSEASON_MONEY_TAGS` (`lib/demo-coach.ts` ~:710) covers team + org-shared; the
  tour narration nowhere names a tag door (verified) — no narration change expected.
- Help: ~9 answers name the old doors (`lib/help-content/coaches.tsx` ~:2081, :2083, :2360,
  :2481–2484, :3445–3450; `rep-teams.tsx` :211–220).

## Phases

### Phase 0 — Usage counts (the honesty prerequisite)
- [x] Add per-kind usage-count queries and return `count` per tag from the library GET
      (`lib/coach-tag-routes.ts` + `lib/db.ts`): game / money via their link tables; focus
      summed across drills, templates, practice plans and player focus areas; staff/equipment by
      traversing team plan/template jsonb (reuse the re-point helper's walk). Re-assert org+team
      in every WHERE (check-then-act rule).
- [x] Per-library count nouns (money/game/focus live; staff/equipment nouns land with their P3 door) for the manager ("on 5 games", "on 12 records", "on 8 plans",
      "on 3 drills and 2 templates"); "not used yet" for zero.
- [x] Unit tests (`tests/unit/practice-tag-usage-count.test.ts`: the pure walk at every level + de-dup, plus source scans proving the GET dispatch and both plan homes; SQL branches are typecheck-verified — the repo unit-tests no live DB) — execute the counts, don't eyeball them
      (`tests/unit/`); prove the staff/equipment walk counts a tag inside a station AND a block
      AND the plan header.
- [x] Guard: the picker deliberately ignores counts (ruling "+"); only manager surfaces consume.

### Phase 1 — `TagManagerDrawer` (the approved prototype is the spec)
- [x] Build `components/coaches/TagManagerDrawer.tsx` to the prototype: 420px right sheet on
      desktop, standard full-screen sheet ≤640; scrim dims the surface behind (form inert);
      44px rows: dot · name · count · rename / merge / delete; rename inline (Enter/Escape);
      merge via dropdown; delete confirm = count sentence + **Cancel / Merge instead / Delete**
      ("Merge instead" flips that row into merge mode); shared section listed read-only under
      "Shared by your club" with the one sentence ("…ask your club admin to rename or retire
      one"); footer link "All tag libraries → Team settings"; Done/×/scrim/Esc close; closing
      returns focus to the opener with typing kept; Esc peels one layer (confirm → edit → drawer
      → dropdown → form).
- [x] Takes the **full** library (own + shared) — callers stop pre-filtering to own tags; the
      drawer renders the split itself. Cap refusals from the routes surface inline.
- [x] Replace every `TagManagerModal` mount (Ledger, schedule, templates) with the drawer, then
      delete `TagManagerModal.tsx`.
- [x] Empty state kept. ⚠ One flagged deviation from the prototype: the footer "All tag libraries → Team settings" link is HELD until P4 builds the shelf it points at (a door to a screen that does not exist is the 404 bug in politer clothes) — restore it in P4. Done early from P5: the templates toolbar door now reads "Manage tags" (was "Your tags").

### Phase 2 — One picker + doors: money and game surfaces
- [x] `TagSearchCombobox` gains the door (API note: `manage` carries words/paths and `onManageChanged` is a SEPARATE direct prop — the react-hooks refs lint flags a ref-reading refresh callback inside an object member; `MONEY_TAG_MANAGE` const keeps the six money sites one spelling): "Manage tags…" as the dropdown's permanent last row
      (paper ground, support ink — a door, not a tag), opening the drawer for its library.
      Shown even when the library is empty (the drawer's empty state teaches).
- [x] Ledger: toolbar "Manage tags" button removed and its
      gating; **no door in the Tags filter pill** (owner-ruled). Toolbar after = cash · Export ·
      Add a bill.
- [x] Game form: replaced the hand-rolled chip picker + `.tagManageLink`
      with `TagSearchCombobox` + door. This deletes the empty-manager gating defect (link shown
      for org-only teams) by construction. Drawer title "Game tags".
- [x] `.tagChip` cleanup — ⚠ THE PLANNED FIX WAS INVERTED, from what the code showed: the
      toggle-pill definition is NOT orphaned by the game form (GiveAwardModal + the award/budget
      managers consume that whole class family — the planned "delete with its last consumer"
      would have broken five surfaces), so the SECOND definition (remove-X chip, one consumer:
      TagPicker) was renamed `.tagPickChip` instead — which also un-breaks GiveAwardModal's
      applied state, the same cascade defect one screen over. Visual confirmation owed in the walk.
- [x] Sweep the money apply-sites for the door — all six wired (bill/expense form ×2, CommitmentView, DriveBand, SponsorBand ×2, fundraiser form); legend word aligned "Shared by your club" (was "organization" — one thing, one word) via the shared component (CommitmentView,
      DriveBand, SponsorBand, fundraisers panel — they already render `TagSearchCombobox`).

### Phase 3 — Practice surfaces + the drill kit (the shipped gaps close)
- [ ] **Migration first**: drills gain `equipment_tag_ids` beside legacy free-text `equipment`
      (station pattern, mig 266's shape: read-resolve by name, write-whole on first edit, legacy
      field never partially rewritten). Same migration file numbers next in sequence.
- [x] **Same unit of work:** update `docs/agents/db/DATA_DICTIONARY.md` + run
      `npm run refresh:snapshots` (dev+prod); `npm run check:dictionary` green.
- [x] `TagPicker` surfaces adopt the combobox presentation: the always-on suggestion strip folds
      into the on-focus dropdown; selected chips go **olive**; `single` mode kept for the player
      focus area (asymmetry is by design); every instance gets the door — including the
      **first-ever staff and equipment doors** (drawer titled "Staff" / "Equipment").
- [x] `PracticeTagPicker` legacy-name adopt chips become dropdown **adopt rows**
      ("{name} (old plan name) · adopt — 1 press") — same one-press mint, one less row under the
      field.
- [x] Drill form: "Add kit…" free text retired; Equipment library picker with adopt rows for the
      drill's old kit names. Templates page: "Your tags" button removed (the pickers carry the
      door).
- [x] Restart-required session (shared modules + types); `npm run typecheck` (after
      `npx next typegen`).

### Phase 4 — The Tags shelf, the look-alikes, the scouting filter
- [x] Team settings gains a **Tags** `CoachCollapseSection` (`components/coaches/TeamTagShelf.tsx`): closed-header meta "N tags in
      5 libraries · M shared by your club"; one row per library (name · where-used line · counts,
      own/shared split); a row expands in place into the same manager (the drawer's list rendered
      inline — one manager, two frames); the shared sentence once; **the cap sentence at the
      foot** ("Each library holds up to 50 of your own tags. Merge two to make room.").
- [x] Capability gating per library — SERVER-side by construction: the shelf omits any library whose GET refuses, never re-deriving caps client-side: a library renders only if its `canRead` passes (money tags
      ride money caps; game/focus/staff/equipment ride schedule/development) — the section shows
      what the coach can see and writes only what their caps allow.
- [x] `ScoutTagFilter` → segmented control (`viewToggle` idiom, sideways scroll lane at phone widths). ⚠ Scoped to the FILTER as ruled: the observation ENTRY form’s tag chooser (OpponentScoutingPanel + opponent page) still wears pill chips — an INPUT, whose restyle answers the form-selects-are-dropdowns ruling; walk item, not silently swept (the Timeline·Bills·Payment-schedule idiom); sideways
      scroll in its own container at 360; vocabulary untouched (fixed per sport pack, still
      renders nothing when no tag is in use).
- [x] `BudgetItemManagerModal` + `TestTypesManager` adopt the row shell — VERIFIED ALREADY TRUE as built (both consume the `.tagManagerRow` family); no change made, none needed (name · count/status ·
      rightmost actions) — refuse-in-use / fold-into-shared and retire/restore rules untouched,
      homes untouched ("Manage our items" label stays: a different object, owner-ruled Q4).
- [x] Verify the Team settings collapse behaviour — the shelf is `defaultOpen=false`; the P5 layout sweep must open it via `?section=tags` (the CoachCollapseSection deep-link) or it is blind to the rows against the check:layout blinding note
      (collapsed sections hide their content from the sweep — reseed and open programmatically
      where the sweep needs to see rows).

### Phase 5 — Words, help, demo, guards, the walk
- [x] Door-label sweep — repo grep for the retired labels returns zero customer-visible hits; check:spelling green in verify:changed: "Manage tags…" is the only tag door label anywhere a customer reads;
      manager titles = library names; `npm run check:spelling` green; grep for the retired
      labels ("Your tags", "Manage money tags", "Manage game tags") returns only history/docs.
- [x] Help sweep — six answers trued (money tags ×2, game tags how-to + manage FAQ pair, focus merge pair), a NEW "Tags" subtopic in the Team-settings article (ordered to mirror the page), the admin shared-library article notes coaches now SEE shared tags read-only; "org admin"→"club admin" within the tag paragraphs; keywords keep legacy terms for search: the ~9 answers above + the rep-teams shared-library
      article — new door location (inside the picker), the drawer, shared tags now visible
      read-only, drill kit joins Equipment, keywords/searchText updated.
- [x] Demo two-questions check — narration names no tag door (verified against the tour source); seed unchanged; check:demos green in verify:changed; NO new tour stop (decided: management is a rare act, a ninth stop would be ceremony): narration names no tag door (verified — no copy change);
      seed unchanged; decision recorded here: **no new tour stop** (management is a rare act; a
      ninth stop for a config door would be ceremony). `npm run check:demos` green.
- [x] `check:layout`: re-run post-restart — see the sweep record below; `coach-settings-tags` (`?section=tags`) ADDED to the screen registry so the shelf is measurable at all; expect re-keys where a link became a button (game form) and
      rows changed (templates toolbar, Ledger toolbar); re-baseline deliberately, not silently.
- [x] `npm run verify:changed` per phase — green at every stage; full typecheck at P0/P2/P3/P4/P5; full `typecheck` at P3 and P5.
- [x] **Owner QA walk** — §129 appended to the ledger; walkthrough Artifact published (34 steps, 7 parts, paste-back): https://claude.ai/code/artifact/c3cf2186-e35a-44ab-bac5-4f8dbe0ffd42 — OWNER WALK ITSELF PENDING: checkable walkthrough Artifact (real checkboxes + localStorage +
      paste-back — never the artifact capability), new § in the Owner QA Ledger, covering: the
      drawer from a bill form, the game form and a practice station; rename-behind-the-form with
      typing kept; delete sentence + Merge instead; shared read-only; the Tags shelf (desktop +
      phone); drill kit adopt; scouting segmented filter; the Ledger toolbar after.

## Architectural decisions

- **One manager, two frames.** The drawer and the settings shelf render the same manager
  component; the drawer is the contextual frame, the shelf is the home. No third rendering.
- **The drawer is the portal's first working-surface side sheet — and stays its only one**
  without a further owner ruling. It exists because a coach mid-form must not lose typing to fix
  a typo; it is not a general pattern licence.
- **Doors live where minting lives.** Pickers get the door; filters never do. One sentence to
  keep consistent portal-wide.
- **Counts are computed, not cached.** Read-time counts per library GET; no counter columns, no
  migration. If a library GET gets hot the count query joins are still one round trip.
- **Drill kit copies the station pattern exactly** (legacy text + id array, read-resolve,
  write-whole) rather than inventing a second migration idiom for the same problem.
- **No new plan gating.** Tags ship where they ship today; no billing change (nothing for
  `/billing` or the Facts doc).

## Open questions

- [ ] None blocking. Two build-time details flagged: (a) the focus-library count noun when usage
      spans four homes — start with the summed "on N records" and per-home breakdown only if the
      walk asks for it; (b) whether the drawer's footer "All tag libraries → Team settings" link
      closes an open bill form (it should warn via the existing unsaved-changes guard, not
      bypass it).

## Review record (P0+P1, 2026-09-01 — high-risk tier, 4 lenses + main-loop adjudication)

Confirmed and FIXED same day:
- **[High]** Ledger/game-form drawers fed count-less libraries by composite endpoints
  (`/expenses`, `/events` call `getRepTeamTagLibrary` directly) → false "isn't used on anything
  yet". **Fix:** the drawer self-fetches `basePath` on open and after every act (no host can
  starve it); delete sentence claims no count when the count is unknown.
- **[Med]** Scrim click hard-closed, discarding a half-typed rename → scrim now uses the same
  one-layer dismiss as Escape.
- Focus into panel + Tab trap + restore-on-close (the HelpDrawer/BottomSheet pattern);
  first-call-wins guard on confirm actions; close-timer cleanup on unmount; templates page no
  longer double-registers the overlay unit; stale "Your tags" comment corrected; help answer
  (coaches.tsx merge-tags FAQ) renamed to "Manage tags" — display strings only, legacy keywords
  kept for search.
- **Advisory, no change:** confirm dialog deliberately does not dismiss on outside click — a
  destructive question takes an explicit answer.
- **check:layout was PARTIAL:** shared-file edits widened it to all screens and its memory guard
  aborted mid-run on the shared dev server (coach-schedule@361 ✓; Ledger/templates unmeasured).
  ⚠ Re-run after a dev-server restart before release; an abort is not a pass.

## P3 build notes (2026-09-01)

- **Mig 272 applied to DEV; prod-owed at next release** (with 264/268–271). The two dev-only
  divergences are in the schema-parity accepted baseline (now 45) — remove them when prod applies.
- **Counts + repoints reach the drills home** (`repointTeamDrills`, drills branch in
  `countTeamPlanTagUsage`); source-scan tests pin all THREE homes. Kit ids are PROVEN against the
  team's equipment library at the data layer (`proveDrillEquipmentTagIds`) — org-shared drills
  carry none, invalid ids drop, tighter than `syncDrillTags`' org-wide check.
- **`drillToStation` carries BOTH kit forms** (legacy names + ids); `DrillFacts` resolves ids →
  names for display. Doors landed on every practice picker: stations (staff+equipment), blocks,
  plan header, drill form (focus+equipment), both template dialogs, save-as-template,
  save-to-drills, the player focus-area card. Templates toolbar door retired.
- **Ordering unified to A-Z** (the picker's shared-tags-first sort retired with the strip that
  needed it; the dot carries the distinction). Drills page moved onto the shared library hooks
  (it hand-rolled the exact fetch the hook's header complains about).
- ⚠ **Known edge, for the walk:** a plan OPEN in the editor while one of its tags is merged keeps
  the loser id in UNSAVED state (the DB copy is already re-pointed; render drops unresolved ids;
  a save writes the stale id back, harmless-but-lossy). Pre-existing exposure — the door just
  moved nearer. Consider a client-side repoint on drawer close if the walk trips on it.
- Two more orphaned classes deleted under the NEW dead-class gate (`.ppChipX` + the four
  tagPick-era blocks flagged by the cleanup session); `.tagRead` and `ppChip` remain live.

## P4 build notes (2026-09-01)

- **One manager, two frames, made literal:** `TagManagerList` extracted from the drawer (rows,
  flows, confirm dialogs, self-fetch, Escape layering with `dismissOneLayer()` on a ref); the
  drawer is now chrome (scrim/panel/focus trap) around it, and the shelf renders it inline. The
  drawer's "All tag libraries → Team settings" foot link RESTORED (P1's flagged hold honoured),
  href derived from `basePath`'s route shape → `…/settings?section=tags` (the
  CoachCollapseSection deep-link contract) rather than a new prop through ten sites.
- `GAME_TAG_MANAGE` joined the word-consts; the schedule mount spreads it (one spelling, shelf +
  form).
- The list's Escape handler stops propagation ONLY when it peels a layer or a host gave
  `onFullyDismiss` — inline on the settings page it leaves the page's own Escape alone.

## P5 rendered-sweep record (2026-09-01, post-restart, post-reseed)

- **My surfaces: GREEN at every width.** `coach-settings-tags` (NEW registry entry,
  `?section=tags`) ✓ @361/390/768/1440; `coach-schedule`, `coach-development-drills`,
  `coach-development-templates` ✓ after the fixture reseed (the pre-reseed "NEW" findings were
  count-label re-keys — "All 16" — plus a leftover "Probe plan template" probe row: fixture
  drift, the exact trap the sweep memory records, cured by `seed-uat-coach-fixture`); the
  scouting trio (`coach-opponent`, `coach-history-scouting`, `coach-sponsor`) ✓ with the
  segmented filter. Full `--changed` covered 34 screens @361 with ZERO new findings before the
  system-memory guard aborted (peer sessions' agents held the RAM, not the server).
- **Money screens: PARTIAL, findings pending attribution.** One batch reported 45 NEW findings
  across coach-accounting/payables/dues/budget/sponsors-list; the breakdown was lost to a
  second memory-guard abort and the machine would not give another clean run. Two peer sessions
  had DECLARED in-flight structural money reworks in the shared tree (the Club tab
  cards→banded-table; the Set-dues preview reshape) — my only money-screen layout change was
  REMOVING a toolbar button. Attribution handed to the money session's own narrow run
  (messages on record); any residue neither theirs nor fixture is MINE to own before release.
- ⚠ Pipe lesson: `check:layout … | tail` masks the exit code — capture to a file.
- **Attribution update (same evening):** -32 sent a full manifest — their share of the money
  findings is ALL on Money → Club (structural rework: sections→one banded table, cards→rows,
  count-bearing group labels that re-key on any reseed BY DESIGN), and they fixed a real
  flex-on-td defect mid-window, so the "45 NEW" capture PRE-DATES that fix and is stale — not
  worth triage. -95's fresh post-fix run owns the final attribution; anything keying to a tag
  pill / Tags box / Ledger toolbar comes back to this stream. No cross-session re-baselining:
  each session baselines its own entries with reasons at its own commit.
- **Money-screen attribution CLOSED (same night, -95's fresh run + three A/B probes):** zero of
  the money findings are tagging's. The one candidate — `coach-transactions@361 page-overflow
  22px` — reproduces with HEAD versions of the hub page AND the shared header, and the baseline
  contains ZERO entries naming the Club tab link while its own date-stamped keys show it was
  captured ~Aug 26, pre-Club-tab. ⚠⚠ **Real cross-stream defect, owner-flagged: the Money hub's
  tab row overflows at 361 with SEVEN tabs (a club-linked team's normal state since the Club tab
  shipped).** Belongs to the club-money stream, not tagging; surfaced by the UAT reseed giving
  the fixture club money. ⚠ Second cross-stream flag (-95's, confirmed by the same keys): the
  layout baseline KEYS labels containing dates/counts ("Around today Jul 27 – Sep 25",
  "Remind all 1") — it rots with the calendar and every reseed; the key should strip volatile
  fragments. Neither is scheduled here — they are named so they cannot be lost.

## Post-walk follow-ups built 2026-09-02 (owner-directed)

- **Ledger toolbar → Option B, two decks** (owner-ruled from the "Ledger Toolbar Rows" mockup
  Artifact 48146887; logged in the design log): `panelDeck` (View + cash + Export + Add) over
  `panelFilterStrip` (per-view pills, hairline). Deviation flagged: strip keeps today's pill
  sizing, not the mockup's 28px. `.registerControls` deleted (its consumer became
  display:contents).
- **Owner-found defect FIXED — a tag minted on one money surface was invisible to the others'
  pickers** until their next full load (six panels each hold a library copy; the hub keeps
  panels mounted). Fix closes the class: `TagSearchCombobox` re-reads `manage.basePath` on every
  dropdown open and UNIONs with the host copy (host-only additions survive a pre-create fetch;
  fresh-only rows cover stale hosts; a tag deleted elsewhere may linger from the stale host copy
  until that host reloads — offering is harmless, writes refuse dead ids).
- ⚠ Cross-stream (CORRECTED 09-02): the `move*` classes belong to **§130** — live, owner-ruled
  2026-09-02, built on dev, walk 78ab40cb owed. The gate stays red until §130's consequence
  chips get their render half; NOT a cleanup decision. (First recorded as "orphaned" off three
  truthful peer disclaimers — the code's own dated ruling-comment was the evidence nobody read.)
