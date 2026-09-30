# Admin Design Continuity · Part B, area 2 — the club's own screens no redesign is coming for

> Paste into a fresh session on `dev`: *"execute @docs/projects/active/ADMIN_DESIGN_CONTINUITY_PART_B_AREA2_PROMPT.md"*.
> Written 2026-09-29, after area 1 (`f6d36059`) and the owner's re-scope ("sure"). **Invisible work: zero pixels
> change.** Step 3 of the joint sequence (plan §3a "PART B RE-SCOPED").
>
> **Read first:**
> - `ADMIN_DESIGN_CONTINUITY_PLAN.md` §3a — "PART B — the cleanup" (area 1's record: its method, its three recipe
>   corrections, its lessons) and "PART B RE-SCOPED" (why this area is what it is).
> - `ADMIN_DESIGN_CONTINUITY_RELEASE_PROMPT.md` — **"Every session"** (still binding: private index, explicit
>   pathspecs, typecheck the commit's own tree, one sweep runner at a time) and Part B's CSS/TSX recipe as corrected
>   by the "Updated 2026-09-29" block at its head.
> - Memory `project_admin_design_continuity` (lessons 1–4 of area 1 especially).

## ⚠ Running beside the tournament redesign's Stage 1 build

The owner may run this at the same time as `TOURNAMENT_ADMIN_REDESIGN_STAGE1_BUILD_PROMPT.md`. The code does not
overlap: this area touches Organization, Families and Rep Teams; Stage 1 touches tournament game day. Three rules
keep it that way:

1. **You own the dev server during your three windows** — (a) warm-up + "before" capture, (b) warm-up + "after"
   capture, (c) the layout sweep. Tell the owner, in one line, when each window **opens and closes**, so Stage 1
   stays off the server meanwhile (no browsing, no restart, no auth-setup, no probe, no sweep — any of them
   rotates the UAT sessions, compiles routes into your memory budget, or kills your server). Between windows
   the server is free for Stage 1.
2. **Stage 1 holds G1 until your "after" capture is in.** G1 changes the event header and the page header's phone
   actions, which are on every screen you photograph. Everything else Stage 1 edits is tournament-only and
   outside your picture set. When your after-compare is done, tell the owner **"Part B area 2's pictures are in —
   Stage 1 may take G1."**
3. **Neither session fixes the other's files.** Whole-tree gates (typecheck, `verify:changed`, unit) may fail on
   the other session's half-done edits: typecheck **your commit's own tree** in an isolated copy (`git archive`
   of the staged tree, `node_modules` junctioned in — the release prompt's rule), run your own tests by file, and
   report a whole-tree failure in someone else's files rather than touching them.

**A third session may be open too** (on 2026-09-29, fixes from the owner's Club Tier Stage 2 walk: the Rep Teams
board, a team page, Documents, Tryouts, `RepKit`, the tryout and league forms, emails, help). Run `git status` at the
start; **never edit a file another session has modified**, and any screen whose files change under you between
"before" and "after" is attributed to that session, not called a leak.

## Scope (exact)

**IN — clean these:**
- **Organization**
  - The old pages Club Stage 1's screens replaced, dead since the release: Members' `MembersPageLegacy`, the audit
    log's `AuditLogPageLegacy`, Settings' `OrgSettingsPageLegacy` — delete them; each page renders its kit
    component alone. **Keep the kit components' `dynamic()` imports** (a static import moves their sheets in the
    bundle — area 1's rule).
  - `AdminHub`: only the `!kit ||` part of its condition is dead. `AdminHubClient` stays: it still serves a
    tournament-only workspace and the no-org moment.
  - **Plan & billing:** `BillingPageLegacy` is **LIVE** — it is the page every non-Club plan sees (slice 6
    restyled it). Do not delete it; fold its `kx()` patches and kit layer, and drop the dead `kit &&` in the
    chooser. Rename it only if the name now misleads (e.g. `BillingPagePlans`) — optional.
  - The org overview, Coaches-portal links, PDF settings, and the admin Notifications page (the shared
    `NotificationsPageContent`'s `legacy` prop and branches).
- **Families:** the list, a family, possible duplicates.
- **Rep Teams outside money:** assistant coaches, shared library, past seasons, a team's history (+ a year), rename
  URLs — and `rep-teams.module.css`'s kit layer for them. ⚠ That sheet also dresses Accounting's allocate page and
  the allocations / payment-requests pages (Club Stage 3's). Folding a shared rule is still pixel-identical, so
  fold it, and **put those screens in your picture set**. Its `.th` sentence-case override (S2-06) is folded as it
  stands: dropping it would change pixels, so that stays a report for Stage 3.

**OUT — never touch here:**
- Club Tier Stage 2's screens (the board, a team page, its Coaches · Tryouts · Roster · Schedule, Documents, Bring in
  a team) — built without legacy.
- Accounting, allocations, payment requests (Club Stage 3); the Public site editor (Club Stage 4); the venue library
  (Club Stage 6); House league (Club Stage 9); the org Tournaments list (tournament Stage 4); onboarding / the setup
  welcome (area 3, unless tournament Stage 5 claims it); every tournament and volunteer screen.
- **Shared parts:** `globals.css`, `admin-common.module.css`, the export menu, collapsible card, bottom sheet, the
  kit frame, `AdminPageHeader`'s `legacy` prop itself (only your pages stop passing it), and the kit helpers
  (`useKitStyle` / `kitStyler` / `useKitButtons` / `useKitAsterisk`) — other areas still call them.

## Method (area 1's, which worked)

1. **Quiet window.** Ask the owner; say the tournament Stage 1 session must stay off the server during your
   windows; ask that nobody walks the test club until your after-compare is done.
2. **Fresh reference, before any edit.** Picture set = areas `frame, hub, org, families, rep-teams, accounting`
   plus ids `admin-t-settings-subscription, admin-t-settings-subscription-panel` (non-Club Plan & billing lives
   there), both themes, both widths.
   - **Warm every route first:** `node .probe/partb/warm.mjs --only=<same list>`, then restart. (The frame changed
     under every route in area 1; this area's pages compiled cold will abort a capture on memory.)
   - One pass per group on a freshly restarted server: `bash .probe/partb/fresh-pass.sh before <theme> <group>`
     — edit its `AREAS` map (in `.probe/partb/id-pass.sh`) to your groups first. It waits for the old server's
     port and probes the team sub-routes before capturing.
   - ⚠ `check-layout-invariants.mjs` has **no `--help`** — any unknown flag starts a full sweep.
   - Record in the plan that the reference was re-taken, and on which HEAD.
3. **Edits, one file at a time:**
   - **TSX:** delete each `useAdminKit()` false branch and each page's `legacy` header markup (and the imports
     and CSS classes only it used); turn every `kx(legacy, kit)` into the merged object it already returns
     (`{ ...legacy, ...kit }` — keep the order); `useKitButtons` → the three merged styles; `useKitAsterisk` →
     the kit asterisk.
   - **CSS:** fold each `[data-admin-kit] .x` into `.x` one rule at a time, never by regex. A fold drops (0,1,0):
     check each against the legacy state rules it outranked (`node .probe/kit-shadow-audit.mjs <sheets>`) and for
     a `background:` shorthand that would wipe an image (`node .probe/kit-bg-shorthand.mjs <sheets>`). Delete the
     `:where(:not([data-admin-kit] *))` retirements. Keep every `:where(:not([data-public-preview] *))` guard.
   - A sheet **nothing outside the admin reads** joins `KIT_FILES` in `scripts/check-public-tokens.mjs`.
   - Guard tests that pin the old shapes (`club-stage1-screens-guard` pins the three legacy pages and the hub's
     condition) are re-pinned to the new truth, as area 1 did.
4. **Gates:** `npx next typegen` → typecheck (the isolated tree), eslint on changed files, `verify:changed`
   (attribute any failure in another session's files), `check:css-selectors` (remove dead classes your deletions
   leave; baseline entries of deleted sheets go).
5. **After:** restart, warm, `after` per group, then `node scripts/admin-identity.mjs compare --theme=warm` and
   `--theme=dark` over the set. **Zero pixel difference**; attribute any diff before calling it a leak. Known:
   the club setup checklist's two board names can swap order (an `accepted_at` tie in the test club — area 1).
6. **Layout sweep** over the same entries at 361/390/768/1440, default theme, against the baseline, one runner.
   Known from area 1: Families duplicates ×10 and the allocate page's team picker ×3 are baseline findings re-keyed
   by the test-club rebuild.
7. **`/review`** (standard) — offer `/simplify` first. **Commit only on the owner's word**, from a private index.

## Close-out

- **Record** (docs commit, this program's hunks only):
  - the plan: area 2's record, plus the previous session's uncommitted "PART B RE-SCOPED" section and header
    edits — they are this program's, commit them;
  - `ADMIN_DESIGN_CONTINUITY_RELEASE_PROMPT.md`: only the "Updated 2026-09-29" block (the Club Tier Stage 2 skip
    note in the same file is another session's);
  - `CLUB_TIER_PRODUCTION_READINESS_PLAN.md`: only §7's "Joint sequence" bullet (its other uncommitted hunks
    are the Club Tier Stage 2 session's);
  - `TODO.md`: only the Admin Design Continuity line;
  - the hub v31 (read the live version in full first, parse its three scripts);
  - memory.
- **Handoff to the owner (product-owner voice):** what went, the pixel result, anything attributed, and the one
  line that frees Stage 1's G1.
- **Next:** area 3 (tournament data tools, the help guide's sheets, the setup welcome unless tournament Stage 5
  claims it) and the closing step — after tournament Stage 1 lands (sequence step 5).
