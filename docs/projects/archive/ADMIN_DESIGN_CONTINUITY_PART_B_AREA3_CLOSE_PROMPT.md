# Admin Design Continuity · Part B, area 3 and the closing step — then the program closes

> Paste into a fresh session on `dev` **after tournament redesign Stage 1 is committed**:
> *"execute @docs/projects/active/ADMIN_DESIGN_CONTINUITY_PART_B_AREA3_CLOSE_PROMPT.md"*.
> Written 2026-09-29. Step 5 of the joint sequence (plan §3a "PART B RE-SCOPED"). **Invisible work: zero pixels
> change**, except that the program itself ends: the old look left in the code becomes the two redesign programs'
> to retire, guarded by a build check this session adds.
>
> **Read first:**
> - `ADMIN_DESIGN_CONTINUITY_PLAN.md` §3a: "PART B — the cleanup" (area 1's record and lessons), "PART B
>   RE-SCOPED", and area 2's record.
> - `ADMIN_DESIGN_CONTINUITY_PART_B_AREA2_PROMPT.md` — **its "Method" section is this session's method** (fresh
>   reference, warm-up, one pass per group on a restarted server, fold one rule at a time, the audits, the gates,
>   the isolated-tree typecheck). Don't restate it; follow it.
> - `ADMIN_DESIGN_CONTINUITY_RELEASE_PROMPT.md` — "Every session" (private index, explicit pathspecs, one sweep
>   runner at a time).
> - **Tournament Stage 1's commit(s):** what it retired, and what it changed in shared parts (on 2026-09-29 its
>   uncommitted work touched `admin-common.module.css`, `AdminPageHeader`, the event header,
>   `scripts/check-public-tokens.mjs` and `scripts/layout-screens.mjs`). Your baselines are taken after it.
> - Memory `project_admin_design_continuity`.

## Kickoff — one message to the owner

1. **A quiet window** (about three hours of the dev server: warm-up and "before", edits, warm-up and "after", the
   sweep). **Is tournament Stage 1's walk done, or when is it?** Don't overlap it: the walk runs on the same dev
   server and changes the tournament test club's data, which this proof photographs. Nobody walks either test
   club until your after-compare is done.
2. **The picture tool: retire it, or keep it?** The plan says it retires at Part B's end. **Recommended: keep the
   tool, delete its picture sets.** It is the repo's only pixel-level check (the layout sweep measures rules, not
   pixels), and the next invisible change that needs one (a framework upgrade, a design-token rename) would have
   to rebuild it. Kept, its header says what it is for now.
3. **The production build's unread line.** `amplify.yml` still writes `APP_BUILD_BRANCH` into the production
   environment; nothing has read it since the release. **Recommended: remove it**, in a commit of its own whose
   message says the behaviour change: none. (It is the production build's config, so it gets the owner's explicit
   yes in this conversation even though it isn't on the watched list.)

## Preconditions

- Tournament Stage 1 committed. `git status`: never edit a file another session has modified.
- Measure the old look left, per file, on HEAD after Stage 1 (`useAdminKit()` calls outside `AdminKitProvider`,
  `kx(` calls, `legacy={` props, `[data-admin-kit]` mentions in stylesheets). On 2026-09-29, after area 2 and before
  Stage 1: **103 files · 26 · 466 · 30 · 2,548.** This is the ratchet's starting point (C2 below).

## A · Area 3 — tournament data tools (the last screens no redesign is coming for)

- **In:** the Data tools page (`tournaments/data-tools/page.tsx` + `data-tools.module.css`) and the two import
  windows it opens (`components/admin/import/TournamentTeamsImportDialog` and
  `TournamentScheduleImportDialog`, which share `TournamentTeamsImportDialog.module.css`) — both used by Data tools
  alone.
- ⚠ **The proof can't see the import windows yet:** the identity tool and the sweep picture only the page
  (`admin-t-data-tools`). **Before the "before" capture**, add an entry per window to `scripts/layout-screens.mjs`
  (opened by its own button, nothing imported, a stateful entry states its view first — slice 4c's lesson), and
  run the identity tool twice on the unchanged tree to confirm the new entries are quiet.
- **Never fold** (another surface wears their base rules): `CollapsibleCard` (the platform console), `ExportMenu`,
  `globals.css`.
- **Found out of area 3 on 2026-09-29 — record, don't clean:** the setup welcome (onboarding) is tournament Stage
  5's (its "one set of creation questions" covers the first-run setup, F25); the help guide's `help.module.css` is
  worn by the coaches portal and the platform console, so its kit layer stays scoped (nothing to fold).

## B · The switch's leftovers (plumbing, zero pixels)

1. **`lib/admin-kit-preview.ts`** holds only the two marker pairs now. Rename it to what it is (for example
   `lib/admin-kit-marker.ts`), exports unchanged; move its importers (the admin layout, `AdminKitProvider`, the
   switch guard test, `globals.css`'s comments).
2. **The volunteer shells:** `GuestKitRoot`'s `on` prop, and both layouts' `const guestKit = true` and
   `kitStyler(guestKit)` — drop them; fold the layouts' own `kx()` calls into merged objects (`{ ...legacy, ...kit }`).
   The volunteer screens' own components and `DAYOF_KIT` patches stay: tournament Stage 6 owns them.
3. **The layout sweep:** replace the `--admin-kit` refusal with a **general refusal of any unknown flag, and a real
   `--help`**. Today an unknown flag silently starts a full sweep (area 1 lost ~2 minutes of a quiet window to
   `--help`). Tidy the `kitOnly` remnants in `layout-screens.mjs`.
4. **`amplify.yml`** — only if the owner said yes (kickoff 3), in its own commit.
5. **The guard tests:** rewrite `admin-kit-switch-guard`'s header (the legacy branches are no longer this program's
   dead code; they are the redesigns' debt, counted by C2) and point it at the renamed marker module. Keep every
   assertion that pins a live truth (the marker on all three shells, no switch cookie/door/reader, one place spreads
   each marker, public layouts never carry it). Retire only an assertion that pins switch mechanics nothing can
   reintroduce.

## C · The gates this program leaves behind

1. **The strict colour gate over the whole admin, with a shrinking exception list.** Every stylesheet under the
   admin (`app/[orgSlug]/admin/**`, `components/admin/**`, the volunteer shells) holds **no colour literal at
   all**, unless it is on an explicit debt list — the files still carrying the old look, each tagged with the
   stage that owns it (tournament Stages 2–6, Club Stages 3, 4, 6, 9). The list may only shrink. The shared-surface
   sheets (`globals.css`, `BottomSheet`, `ExportMenu`, `CollapsibleCard`, `help.module.css`, the chat panels) keep
   today's rule: their kit rules strict, their base rules the other surface's.
2. **The legacy-count ratchet.** Per file, the four counts above; a baseline file; a count may only go down; a
   file at zero leaves the baseline; a new file with any count fails. A **KEEP list** names the files whose scoped
   kit layer is by design and is not counted (the shared-surface sheets above, and `AdminKitProvider` itself).
   Its failure message names the owning stage. Wire it into `verify:changed`; say in the commit message what it
   refuses.
3. **Finalize the restyled ratchet** (`node scripts/check-public-tokens.mjs --init-restyled`) to lock in areas 1–3's
   drops; restore the committed key order if the re-init reorders it.
4. `check:css-selectors`: remove the dead classes your deletions leave, and baseline entries of deleted sheets.

## Proof

- **Fresh reference, before any edit, after the new entries are in:** Data tools and its two windows, the volunteer
  area, `frame` and `hub` (the admin layout's import changes — a sample is enough for a moved import), both themes,
  both widths. Warm first; one pass per group on a restarted server.
- **After:** the same set; `compare --theme=warm` and `--theme=dark`. **Zero pixel difference**; attribute any diff
  (known: the club setup checklist's board names can swap — an `accepted_at` tie in the test club).
- **Layout sweep** over the same entries, default theme, against the baseline, one runner.
- Gates as area 2's method; the new ratchet and the widened colour gate green on the tree **and failing when you
  deliberately add a `kx(` or a hex to an admin file** (prove each refuses what it exists for, then revert).
- **`/review`** (standard; the new gates are what it must attack), `/simplify` offered first. **Commit only on the
  owner's word:** (1) area 3 + the leftovers + the gates, (2) `amplify.yml` alone if approved, (3) the docs and the
  archive move.

## Close the program

- **The plan's final record:** area 3, the leftovers, the gates, and **the hand-off** — the ratchet's starting
  counts per owning stage; the kit helpers (`useKitStyle`, `kitStyler`, `useKitButtons`, `useKitAsterisk`,
  `kit-inline.ts`) and `AdminPageHeader`'s `legacy` prop go with their last caller; `admin-common.module.css` and
  the shared tournament header/toolbar parts fold when their last user is rebuilt. **The success criteria, honestly:**
  (1) every admin screen renders in both themes, contrast 0/0 — met at release; (2) no raw colour in admin code —
  met for every clean file, the rest on the shrinking debt list and owned by the two programs; (3) one product —
  walked (§245); (4) public pages unchanged — held (R2 guards).
- **Tell the owning programs:** a line in `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` and `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`
  §7 saying the program closed and the ratchet and debt list are theirs — **only if no other session has that file
  open**; otherwise list it in the handoff.
- **The hub's last version** (read the live one in full first; parse its three scripts): the Progress tab says the
  program is complete and where its debt went.
- **Archive:** move the plan, PM brief, hub, Phase 0 inventory, Phase 1 build prompt, release prompt, the area 2
  prompt and this prompt to `docs/projects/archive/`. The TODO line moves to ✅ Completed with the archive link.
  Grep the active docs and both memory stores for the old paths; fix the ones no other session has open (the
  in-repo `memory/` needs its index updated in the same change) and list the rest.
- **Memory:** `project_admin_design_continuity` → CLOSED, with the hand-off; the MEMORY.md line shortened to
  match.
- **Restart the dev server before handing off** (a shared layout's import changed).
- **To the owner, product-owner voice:** what went, the pixel result, what the build now refuses, where the
  remaining old look lives and who retires it, and that the program is closed.
