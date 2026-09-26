# Admin Design Continuity — Phase 0 baseline + Phase 1 foundation build prompt

> Paste into a fresh session on `dev`: *"execute @docs/projects/active/ADMIN_DESIGN_CONTINUITY_PHASE1_BUILD_PROMPT.md
> — slice N"*. **One slice per session.** If no slice is named, do the first slice in the plan's **slice
> ledger** (`ADMIN_DESIGN_CONTINUITY_PLAN.md` §3a) that is not DONE, and say which one you picked before
> starting. Written 2026-09-25 after the owner ratified the Phase 1 mockups with F1–F4 as recommended.
> Plan: `docs/projects/active/ADMIN_DESIGN_CONTINUITY_PLAN.md` (§1 rulings R0–R5, §3 Phase 0 results and
> Phase 1, §5 risks, §6 gates). Project hub (the visual spec; republish the SAME path):
> `docs/projects/active/ADMIN_DESIGN_CONTINUITY_HUB.html` = https://claude.ai/artifact/R1Zcp2s93gmgaHGHn6SLSZ
> → Mockups tab, specimens 1–7, warm and dark. The club frame (rail, phone bar, More menu) is drawn on the
> **club hub** https://claude.ai/artifact/K4MPu4ni53Ct7yrDcmWJd9, Stage 1 specimens 1, 3 and 4 (build spec =
> club hub v8 or later). Inventory: `ADMIN_DESIGN_CONTINUITY_PHASE0_INVENTORY.md` (per-area counts, the 33
> unmapped tokens, the kit-gap list, the suggested order). Design log: the 2026-09-25 (later) entry at the
> top of `memory/design_decisions.md` (R0–R5 + F1–F4). Memory: `project_admin_design_continuity`.

## What the foundation is (and is not)

Every admin screen (club, tournament, house league), the scorekeeper, official and gate screens, and the
help guide adopt the coaches portal's kit and follow the one account Warm / Dark setting. **A restyle, not a
redesign:** same layout, same words, same actions, same columns. The only content changes allowed are
the ratified ones: page headers lose their subtitle line (F3, facts re-homed, never dropped), the
organization's colour leaves the admin chrome (R1), the organization's public card style stops reaching
the admin (F1), and type follows the kit (F2). Everything else that looks wrong is written down for its
own redesign, not fixed here.

## ⚠ THE SWITCH — binding for every slice (the coaches portal's own precedent)

Every session shares `dev`, and `dev` is promoted to production whenever anyone ships. The foundation takes
several sessions. **Nothing it changes may be visible on production until the single release day.** The
coaches portal's warm look was built exactly this way (`7e5c6bf0`, "dev-gated"; `lib/coach-warm-preview.ts`
records the history): dark stayed byte-identical in production until the one release.

1. **One helper, one attribute.** Slice 1 adds a single helper (model it on `lib/coach-warm-preview.ts`)
   that decides whether the admin kit is on, and a single attribute set on each shell's outermost element
   when it is. That element carries BOTH `data-coach-warm-enabled` (so the existing warm palette block in
   `app/globals.css` applies) and `data-admin-kit` (for admin-only kit rules). Nothing else decides it.
2. **Never on the production branch, fail-closed** (amended by the owner 2026-09-25, slice 1): the
   `master` build can never turn it on until the release slice deletes the switch, and neither can any
   production build that cannot prove it is staging. It MAY be turned on on the local dev server and on
   the **staging deploy** (the `dev` branch's build — a deploy with no customers, and the place to test
   with real test accounts on a phone). The first version keyed this to "any production build", which
   locked staging out too. **Off by default everywhere it may be on.** Other sessions walk admin screens
   on the same server and the same staging site, and they must not meet a half-restyled admin. It turns
   on per browser through the door `/api/dev/admin-kit?on=1&next=/<org>/admin` (`on=0` turns it off).
   The server reads it in the admin layout (and, from slice 5, the guest shells' layouts), so there is no
   flash.
3. **Everything visible hangs off it.** Kit CSS is scoped under `[data-admin-kit]`. The new frame and the
   new page header render only when it is on, and the legacy ones render when it is off; both live until
   the release. **A colour converted to a token must resolve to exactly today's value when the switch is
   off.** Where no dark token equals the literal, keep the literal and add a marker-scoped override.
4. **Proof, every slice:** with the switch OFF, every admin screen looks the same after the slice as it
   did before it (the identity check below). A slice that changes a switch-off pixel is not done.
   ⚠ **Other sessions change admin screens too.** Club Stage 1's server half changes what an admin's
   sidebar and hub show (D8), and other projects edit admin pages. So each slice takes **its own
   "before" capture at its start**, from the tree as it stands, rather than trusting slice 0's pictures.
   It attributes every difference to a change (git history plus the working tree) before calling it a
   leak. A difference that another session caused is re-captured and named in the handoff, never "fixed"
   by this slice.

## Parallel work the foundation must respect

- **Club Stage 1 runs beside this program.** Its server session (`CLUB_TIER_STAGE1_SERVER_PROMPT.md`) touches
  roles, members, invites and billing logic. Its screens session (`CLUB_TIER_STAGE1_SCREENS_PROMPT.md`)
  starts after slice 1. It **redesigns** the club hub, Members (with the audit log), Plan & billing, Org
  Settings and the setup checklist, **behind this same switch**. **The foundation does not restyle those
  screens.** Their redesign is their kit version, and restyling them first would be thrown away. Slice 6
  checks that each of them has its kit version before the release.
- **Other sessions edit admin files** (for example, house-league schedule work). Before editing any file,
  check it for uncommitted changes that are not yours. **Never overwrite, restore or check out** another
  session's work. If a file you need is mid-edit elsewhere, do the rest of the slice and list that file in
  the handoff.
- ⚠ **One dev server, shared.** Every session in this working copy (Club Stage 1, and the owner's other
  projects) runs on the same dev server, and a code edit anywhere recompiles pages under you. **Before any
  full sweep, identity capture or dev-server restart, ask the owner for a quiet window**: say what you are
  about to run and wait for the go. Everything else in a slice can run beside other sessions.
- **Commit only when the owner says**, on `dev`, with explicit pathspecs in a **private index**
  (memory `reference_shared_worktree_stage_race`); `git show --stat HEAD` after every commit.

## The slices (order from the Phase 0 inventory; each slice = one session; `/review` before DONE)

**Slice 0 — The baseline (Phase 0's second half). No product code.** ⚠ **Runs ALONE**: no other session
editing code or using the dev server, including Club Stage 1 and the owner's other projects. It sweeps
every admin screen, and a page recompiling mid-capture makes the first pictures worthless. Confirm with the
owner before starting, and stop if anything else is running.
- Add every admin screen, and the scorekeeper, official and check-in screens, to `scripts/layout-screens.mjs`
  with the right sessions. The runner's `SESSION_FILES` lacks the Stage 0 rep-club sessions
  (`tests/uat/.auth/rep-club-*.json`); add them. Use the rep club fixture (`uat-rep-club`) for club screens,
  and a tournament org for tournament screens. `--init` the invariant baseline in **today's dark**, with a
  `reason` on anything you accept.
- **The identity check** (new): a small Playwright capture of every admin screen at phone and desktop
  width, switch off, stored **outside git** (local only; it exists only for the life of Phase 1), plus a
  compare command that reports every screen that differs. Each later slice runs it twice: "before" at
  its start and "after" at its end (see the switch contract, point 4). A `--only=` filter lets a slice
  capture just the areas it touched. Freeze the clock and mask live figures so the
  check is quiet on an unchanged screen. Run it twice on an unchanged tree and confirm it is quiet: a noisy
  check is worse than none. This is a machine diff, not eyeballing, so the layout sweep's
  "never eyeball a screenshot" rule stands.
- Extend `scripts/check-contrast.mjs`'s grounds to the admin's grounds (dark now; warm joins in slice 1).
- Write the counts into the plan's slice ledger and the hub's Full Plan tab. Republish the hub.

**Slice 1 — The switch, the theme and the frame.**
- The switch (above). **Fill the theme's gaps first** (inventory §2): the `--white-4/-15/-25` steps, the
  whole `--black-20/-30/-40` ramp, and the `.card` recipe's `--highlight-top` / `--shadow` / `--shadow-sm`.
  ⚠ The warm block also serves the coaches portal. Run the coach screens' layout sweep in both themes
  before and after, and report any coach screen that changed. A change should be a fix. Anything else
  means stop.
- **R1:** under the switch, the admin shell re-declares the organization's `--primary*`, `--border` and
  `--glow*` (set by `app/[orgSlug]/layout.tsx`) to kit values. **R2:** the admin's previews of public pages
  (tournament public-site editor preview, public-site preview) re-establish the organization's own
  colours. **F1:** under the switch, `data-card-style` no longer reaches admin cards.
- **The frame, on the kit:** top strip, desktop rail, phone bar + More menu, page header, tournament
  event header. Club rail and phone bar as drawn in club Stage 1 specimens 3–4 (program order from today's
  data; Stage 1 feeds the plan-aware order). The tournament bar as drawn in ADC specimen 4 (same tabs, same
  order, same live strip). The More menu is a **menu**: it sits on top of the bar
  (`decision_drawer_layers_form_vs_menu`). The files involved are `app/[orgSlug]/admin/AdminChrome.tsx`,
  `components/admin/AdminSidebar`, `AdminBottomNav`, `AdminTopStrip` and `AdminEventHeader`.
- **The page header (F3):** one shared admin page-header component matching `CoachPageHeader`, with no
  subtitle slot and legacy markup when the switch is off (about 63 admin files print a subtitle today).
  Convert pages as their area is restyled, not all here. Where a subtitle carries a live fact, **re-home
  it** (eyebrow or the body it describes) and list every re-homing in the handoff. Never drop a fact
  silently.
- Restyle **Families** and the **Public site editor** (the two nearly-free areas) to prove the frame end to
  end.

**Slice 2 — Buttons, chips, type, and the lighter areas.**
- Buttons (warm overrides already ship in `app/globals.css`); the `.badge-*` family, including the
  `.badge-primary` pairing (inventory §3: an org-tinted wash with olive text under the marker). Settle it on
  the kit's chip and say how in the handoff.
- **F2 type** across admin: `--font-data` on eyebrows, chips and readouts only (561 uses in 47 sheets today).
- Restyle the rest of **Hub + onboarding and Organization** that Stage 1 does not replace (org overview,
  venues, team links, coaches-portal links, org tournaments, notifications, PDF settings, the billing mock
  portal). Then **House league**.

**Slice 3 — Rep Teams and Accounting** (the heaviest hand-set colour debt). **F4:** ledgers and
budget-vs-actual are restyled in place as drawn in ADC specimen 5, with the same columns, the kit table and
chips, and amounts right-aligned with tabular digits. No redesign (Club Stage 3 owns that). Also convert the
inline styles that name a colour.

**Slice 4 — Tournaments** (27 screens, the largest area on every measure; the most org-colour reads; the
styled-jsx outlier; `--border-1` in `tournaments-admin.module.css` is an undefined token, so fix it while
there). If it will not fit one session, split it **by job** (setup / operations / records) and write the
split into the slice ledger before starting.

**Slice 5 — Scorekeeper, official and gate, and the help guide.**
- **R3:** a warm palette from the kit replaces the `--sk-*` set, **fixed** for these guest screens (no
  account to hold a choice). Build to ADC specimen 7: same cards, same four filters at the thumb, and a score
  sheet that is a **form** (covers, with a scrim and a way out).
- **R4:** the admin's help guide follows the theme under the switch. The coaches portal's focused help pins
  dark today (`[data-help-surface]` in `app/globals.css`; `components/coaches/CoachesChrome.tsx`). That pin
  is removed **in the release slice**, because it is outside the admin switch.

**Slice 6 — Prove it, walk it, release it.** Two sessions if needed: prove + walk, then release.
- **Prove:** the invariant sweep over every admin screen in **both themes** with the switch on (new
  findings fixed or argued with a reason); contrast over the admin grounds in both palettes; the identity
  check with the switch off (quiet). Confirm Club Stage 1's replaced screens have their kit versions. If
  they don't, the release waits or those screens get a restyle; ask the owner which.
- **Walk:** a § walk on this hub's QA tab (next free § on `OWNER_QA_LEDGER.md`; never re-sort). The owner
  walks a sample of every area in both themes: the frame at desktop and phone width, a dense table, a
  tournament on game day, the scorekeeper sheet, the help guide. Pin identities, not figures.
- **Release (on the owner's word, outside a tournament weekend):**
  - **Delete the switch.** The marker becomes unconditional on the admin and guest shells.
  - Delete the legacy frame, legacy header markup and the marker-scoped duplicates.
  - Remove the coaches help-guide dark pin (R4). The account Appearance setting's copy names the admin.
  - A What's New note (`/marketing` writes it): where the Dark choice lives, and that "your colours stay on
    your public pages".
  - `/docs` for any help article that describes the old look.
  - `/release` records the promote. Club Stage 1's screens ship the same day.

## Every slice

- Build to the hub's specimens. Anything deliberately not matched is flagged to the owner at build time
  (`feedback_build_to_approved_mockups`).
- **The identity check (built in slice 0):** at the START, before touching anything, and after asking
  the owner for a quiet window, `npm run identity:admin -- before`; at the END, `npm run identity:admin --
  after` (it compares by itself). Narrow either with `--only=<area,…>` (frame, hub, org, rep-teams,
  accounting, families, public-site, house-league, tournaments, help, volunteer) or a screen id, and
  `--width=phone|desktop`. A frame change reaches every screen, so capture all of them then. Two masks
  are live (the Members list, which has no defined order until Club Stage 1 fixes it, and the dashboard's
  server-bucketed trend line). Add a mask only from evidence and with its reason, and remove the Members
  one when Stage 1 orders the list. The layout sweep for admin screens is `node
  scripts/check-layout-invariants.mjs --only=<ids>` (or `--changed`, which now sweeps by side). Its dark
  baseline holds 6,946 unargued findings, and a new finding fails it.
- Gates: `npm run verify:changed` (it runs `check-public-tokens.mjs --scope=all`). The admin raw-colour gate
  is an **extension** of that script's `operator` scope. Widen what it counts (the fixed alpha steps, inline
  colours) as each area comes clean, so a restyled area cannot regress. The identity check, switch off, every
  slice.
- Update the slice ledger (status, commit, date, what was re-homed, what was left for a redesign) and the
  plan's status line. Republish the hub if its tabs changed. Memory `project_admin_design_continuity`.
- Handoff in product-owner voice. Offer `/review` (and `/simplify` where a shared component was added).

## Do not

- Change a layout, a word, an action or a column beyond R1/F1/F2/F3. A restyle that needs a redesign is a
  finding, not a fix.
- Make anything visible with the switch off, on dev or production.
- Restyle the club hub, Members, audit log, Plan & billing, Org Settings or the setup checklist (Club Stage 1
  owns them).
- Touch public pages (R2), emails, PDFs or the marketing site, or put the organization's colour back into
  admin chrome.
- Run a sweep while another session is using the dev server, or restart it without saying so.
- `git add -A`, `git checkout --` / `restore` on a shared file, or commit without the owner's word.
