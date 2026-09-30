# Admin Design Continuity — release prompt (Part A: the flip · Part B: the cleanup)

> Paste into a fresh session on `dev`: *"execute @docs/projects/active/ADMIN_DESIGN_CONTINUITY_RELEASE_PROMPT.md
> — part A"* (release day), or *"— part B, <area>"* (the cleanup, after the settling period). If no part is
> named, do Part A's kickoff and stop at its questions. Written 2026-09-28, after walk **§245 PASSED** (all
> eight walks, 96 ticks, zero flags). Plan: `ADMIN_DESIGN_CONTINUITY_PLAN.md` — §3a "Slice 6 — results", and
> its **"For the release session"** list (items 1–9), which this prompt re-sorts into two parts and does not
> repeat in full, so read it. Hub (republish the SAME path; **parse the hub's scripts before publishing** —
> one bad apostrophe kills every tab): `ADMIN_DESIGN_CONTINUITY_HUB.html` =
> https://claude.ai/artifact/R1Zcp2s93gmgaHGHn6SLSZ. Club Tier: `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6
> Stage 1 (its screens ship the same day; its **"Help drafts"** are published by this release). Memory:
> `project_admin_design_continuity`, `project_club_tier_readiness`, `reference_prod_release_history`.

## What releasing means (what the customer sees)

- Every organization admin screen (club, tournament, house league), the scorekeeper, official and gate
  screens, and the admin help guide wear the coaches portal's look and follow the one Warm / Dark setting.
  **Warm is the default**, so every tournament organizer who never chose a theme sees the admin turn warm on
  the day.
- The organization's colour leaves the admin chrome (R1) and stays on public pages and on the admin's
  previews of them (R2). Scorekeeper and gate are always warm (R3).
- The coaches portal's "?" help drawer starts following the theme too (it is pinned dark today).
- **Club Tier Stage 1's screens go live the same day**: the club Overview and morning brief, Members and the
  audit log, Plan & billing for the Club sizes, Settings, and "Set up your club". Club is still not on sale,
  so only a club the platform has provisioned sees them.
- **What the owner walked is the switch-on render on dev.** The release ships *that*. It does not ship a
  rewrite of it.

## ⚠ The split: recommended, and the owner confirms it at kickoff

The plan's release list mixes two jobs of very different size and risk:

| | Part A: the flip | Part B: the cleanup |
|---|---|---|
| What | the kit becomes unconditional, the door and cookie go, coaches help follows the theme, Appearance copy, help, What's New, new baselines | delete every legacy branch, fold each kit layer into its base rules, the unifications (plan item 8) |
| Size (measured 2026-09-28) | the switch is read in **7 files** | **57** stylesheets with ~**2,900** `[data-admin-kit]` rule mentions, **522** inline `kx()` patches in **57** TSX files, **151** `legacy` props, **45** `useAdminKit()` branches, 34 `:where(:not([data-admin-kit] *))` retirements |
| Customer-visible | yes, the release itself | **no** (it must change zero pixels) |
| Proof | the §245 walk + sweeps in the new look | pixel identity against the new look, area by area |
| Rollback while it stands | **revert one commit**, because the legacy code is still there | none: there is no old look left to go back to |

**Recommendation: Part A is the release (one session, ending in the promote). Part B runs after a settling
period, one area per session, and ships with any later release.** Reasons:
1. Folding ~2,900 rules and 522 inline patches is a rewrite that nobody walked. It should not ride in the same
   promote as the biggest visual change paying organizers have seen.
2. Between A and B, a Saturday problem is fixed by reverting one commit.
3. **The identity tool is exactly what proves Part B**, so it must not retire at the release (plan item 7 says
   it does). Re-point it at the new look and keep it until Part B ends.

If the owner rules "one go", Part B still has to be identity-proven against a new-look capture taken
**before any deletion**, and the promote waits for that proof.

## ⚠ The dev branch IS the release trigger

Every session shares `dev`, and `dev` is promoted whenever anyone ships. **Once the flip is committed, the next
promote (anyone's) is the release.** So commit the flip only after the owner has said "promote today", and run
`/release promote` in this same session straight after. If the promote slips, do not commit the flip. Leave
it uncommitted and name its files in the handoff; other sessions commit by explicit pathspec, so they will not
sweep it in.

## Part A — kickoff: one message to the owner, four questions

1. **Split A/B as recommended, or one go?**
2. **Release date.** It must fall outside a busy tournament weekend (plan §5). Offer an owner-approved,
   read-only production query that counts tournaments with games in the next 7 days, so the date is chosen on
   data.
3. **A quiet window** on the dev server for the sweeps and the identity capture: no other session on it.
4. **A short look at staging before master** (recommended, about 10 minutes: walk R below), or straight to
   master?

## Part A — preconditions (check each one; do not assume)

- **The §245 truth-up is uncommitted** (plan W1–W8 lines, ledger §245 ✅, TODO). Commit it first, as docs.
- **The walk-4 billing-shelf fix is uncommitted** (the org billing page, the plan panel, the new client
  plan-gating hook). This program found it (on production since 2026-07-24, every Tournament / Tournament Plus
  organizer is told the Coaches Portal is "Coming soon · Early access only"). **Its re-check is owed.** Do it
  with a probe, or give the owner one step, then commit it as its own commit. It rides this promote whatever
  happens to the flip. The 2026-09-28 decisions-log entry beside it (League Plus with no imminence, no "early
  access" anywhere) is /strategy's. Commit it in its own docs commit and do not rewrite it; the copy change
  itself is /marketing's and is not a release gate.
- **The test club.** The owner cancels walk 8's Club · Association **sandbox** subscription in the Stripe
  dashboard (the reset never touches Stripe) and drops the `dev_plan_gates=live` cookie. Then rebuild:
  `node --env-file=.env.local scripts/seed-club-fixture.mjs --reset`. This comes before the re-baseline,
  because baseline keys embed fixture text. Confirm the club wears the platform colours (walk 8 reverted
  Battle Purple).
- **Anything that changed the admin after the walk.** `git log c72afdeb..HEAD` plus the working tree, over
  admin, volunteer and help files. Any screen touched since then ships unwalked unless it is swept switch-on in
  both themes with contrast holding at 0/0. Sweep those; do not re-walk them.
- **The tournament demo (`riverdale-minor-ball`) has never been swept or walked on the kit.** It is public on
  production and changes the moment the flip ships. `check-demo-sandbox.mjs` checks data only and cannot see
  a visual break. With the switch on, open it on dev at phone and desktop width in both themes. Check that
  the sandbox banner and tour rail sit correctly over the kit's top strip and event header (the kit header
  already offsets by `--sandbox-chrome-h`) and that every tour destination renders. Screenshot it for the
  owner, and fix anything under the switch before the flip.

## Part A — the flip (in order)

1. **The switch becomes unconditional, with the smallest diff possible.** The marker (`data-coach-warm-enabled`
   + `data-admin-kit`) goes on the admin shell and on both volunteer shells (scorekeeper and check-in, through
   the one guest root) in every build. The door route, the cookie and the staging-branch logic go. The readers
   keep compiling (`useAdminKit()` answers true), so every legacy branch becomes dead code **until Part B**.
   Rewrite `admin-kit-switch-guard.test.ts` to pin the new truth: the marker is on all three shells in every
   build, nothing reads the cookie, the door is gone. Leave `amplify.yml`'s `APP_BUILD_BRANCH` alone (Part B
   removes it if nothing reads it).
2. **Coaches help follows the theme.** Remove the `[data-help-surface]` dark pin in `app/globals.css`, and give
   the coaches "?" drawer a portal root **inside** the coach marker. Slice 5 found that without the root it
   stays dark. This is a LIVE coaches-portal change, so sweep the coach help entries in both themes with
   contrast at 0.
3. **The account Appearance page** names the admin (who the setting now governs).
4. **Help (`/docs`), in one unit:**
   - (a) The **"Plan & billing" rename**, exactly as listed in the plan's release item 6:
     - three help mentions;
     - tournament Settings & access's "Plan & subscription" card;
     - each section's `keywords` / `searchText`, keeping "subscription" as a search term.
     - A team workspace keeps "Coaches Portal billing".
   - (b) **Club Stage 1's seven help drafts** (Club plan §6 Stage 1, "Help drafts"), merged onto whatever the
     help files hold now.
   - (c) Any help that describes the old look (the dark console, the org-coloured sidebar, a help guide that
     is "always dark").

   `check:spelling` and the one-spelling rule apply.
5. **What's New** (`lib/release-notes.ts`). /marketing writes it and the owner approves it:
   - the admin's new look, and where Dark lives;
   - "your colours stay on your public pages";
   - the coaches' help following the theme.
   - **Leave out:** the Club screens and the Club trial wording (Club is not on sale). Follow the same-day
     entry rule.
6. **Re-baseline in the new look.**
   - The layout sweep's admin and guest entries render the kit by default now. `--admin-kit` becomes a no-op
     (delete it, or leave it inert and say which), and the `kitOnly` entries become ordinary entries.
   - Re-seed both themes. **`--init` reorders the whole baseline:** restore the committed key order before
     committing (slice 5's `.probe/5/baseline-reorder.cjs`).
   - The contrast test's `ADMIN_DARK_DEBT` is re-measured on the kit's grounds and ratcheted down.
   - These gates are not on the watched-automation list, but say what each change does in its commit
     message.
7. **Re-point the identity tool at the new look, and capture Part B's reference.**
   - Extend it: `kitOnly` screens become ordinary, and it gains `--theme=warm|dark` (the sweep runner already
     has one).
   - Capture the full set in both themes on the flipped tree. The pictures are local only
     (`.admin-identity/`), so Part B must run on this machine.
8. **Prove it:**
   - `npx next typegen` → typecheck, lint, `verify:changed`, unit (targeted while peers work, the full run in
     the quiet window);
   - `check:layout` both themes over every admin, guest and coach-help entry;
   - public and marketing entries unchanged (R2);
   - the platform-admin console untouched;
   - the tournament demo renders.
9. **`/review`** on the flip at the standard tier: small, but it touches three layouts and a live coaches
   surface. No `/simplify`, because there is no new abstraction.
10. **Commits, all in one push:**
    - (1) the walk-4 fix;
    - (2) the §245 docs;
    - (3) the flip, with help, What's New and the baselines. Split it if that reads better, but everything
      goes out together.
11. **Walk R, only if the owner chose the staging look.** Push `dev`; when staging has built, the owner walks
    it. It goes on the hub's QA tab. **One purpose: the new look reaches someone who never touched the
    switch.**
    - a fresh private window shows the admin in Warm;
    - Appearance → Dark turns the admin Dark;
    - a tournament organizer's dashboard on a phone;
    - a coach's "?" help, in Warm and in Dark;
    - help search "subscription" finds Plan & billing;
    - the tournament demo.
12. **`/release promote`.** The pre-flight lists everything else riding along (other sessions' commits since
    the last promote), migrations, demos and the release note. The owner gives the go. Phase 2b records it:
    the admin redesign is live, and Club Stage 1's screens are live but Club is not on sale.
13. **Truth-ups** (positive facts with anchors: "released `<hash>` <date>, job N"):
    - the ADC plan: §3a row 6 → RELEASED; Part B next; **the rollback runbook**, which is "revert the flip
      commit (never the walk-4 commit) and promote; valid until Part B starts";
    - the PM brief, and the TODO lines for both projects;
    - the Club plan §6 Stage 1 (screens shipped, help published);
    - the ledger, and the hub's Progress tab;
    - the in-repo `memory/design_decisions.md`: the TH-1 "admin deferred" clause is closed;
    - memory: both project files and the release history.

    Restart the dev server before handing off (shared layouts changed).

## Part B — the cleanup (after the settling period; one area per session; invisible)

> **⚠ Updated 2026-09-29 — read plan §3a "PART B — the cleanup" and "PART B RE-SCOPED" first.** The owner
> WAIVED the settling period (Part B started that day), and after area 1 Part B was RE-SCOPED: it keeps only
> the screens no redesign is coming for (two areas, then the closing step); every screen the tournament
> redesign or a Club Tier stage rebuilds retires its old look in that build. The area list below is
> superseded. Area 1 also ruled three corrections to the recipe below: a shared part whose base rules another surface wears (the
> platform console, public pages, the coaches portal) keeps its scoped kit layer — and `globals.css`'s kit
> layer is never folded; the foot-rule re-anchor is moot and the `:is()` twins are dropped; the crumb tap floor
> is a visible change, not a cleanup. Each area takes its own fresh reference (the plan says how).

**Start only after the owner confirms the settling period:** at least one full tournament weekend on the new
look with no rollback call, because Part B removes the rollback. Work area by area, in slice order:
- the frame and shared parts (`globals`, `components/admin`);
- House league and Organization;
- Rep Teams and Accounting;
- Tournaments: setup and records, then game day, then the schedule;
- volunteer;
- help.

- **TSX:** delete the `useAdminKit()` false paths and the `legacy` props (AdminPageHeader and friends). Turn
  every `kx(legacy, kitPatch)` into the merged kit object, and retire `useKitStyle` when its last caller goes.
  The legacy frame (AdminSidebar, AdminTopStrip, the legacy event header) goes when its last reader goes.
- **CSS: fold each `[data-admin-kit] .x` rule into `.x` one rule at a time, never by bulk regex.** A fold drops
  (0,1,0) of weight, so check each one against the legacy state rules it used to outrank. The slices learned
  that a kit base rule shadows an equal-weight legacy state rule, and that a kit `background:` shorthand wipes
  an image. Delete the retired legacy overrides (`:where(:not([data-admin-kit] *))`).
  **⚠ Keep the public-preview island:** every folded rule that reaches a preview still needs its
  `:where(:not([data-public-preview] *))` guard, because R2 still stands and the previews still sit inside
  the admin.
- **The unifications (plan item 8):**
  - the guest twins go into `:is()`;
  - slice 3's crumb links (a sub-floor tap target on a phone) and House league's eyebrow;
  - one `.kitLede` recipe;
  - the volunteer foot rule re-anchored on the shell.
- **Proof, per area:** `identity:admin -- after --only=<area>` in both themes and both widths against Part A's
  capture. **Zero pixel difference.** Attribute any diff before calling it a leak (other sessions change
  screens). The layout sweep shows no new findings.
- **At the end:**
  - the strict kit colour gate widens to the whole admin (a raw colour anywhere in admin code fails);
  - the restyled ratchet is finalized;
  - the switch-era guards are rewritten or retired;
  - `lib/admin-kit-preview.ts` and an unread `APP_BUILD_BRANCH` are removed;
  - **then** the identity tool and `.admin-identity/` retire.
- Each area is its own commit with its own `/review`; `/simplify` is worth offering there. Each ships with
  any release.
- **Club Tier Stage 2 redraws the rep-teams screens** (mockup prompt `CLUB_TIER_STAGE2_MOCKUP_PROMPT.md`). A
  rep-teams screen that Stage 2's build has replaced, or is replacing, is **skipped** by Part B, the same way
  the foundation skipped Stage 1's six screens. Check the Stage 2 build's file list before starting the Rep
  Teams area, and never clean up a file that session has open.

## Every session

- **The shared worktree:**
  - stage explicit pathspecs through a private index;
  - re-check `HEAD` right before committing, and run `git show --stat HEAD` after;
  - when other sessions' untracked files are present, typecheck the commit's own tree (a `git archive` copy
    with `node_modules` junctioned in);
  - never overwrite, restore or check out another session's hunks.
- **The dev server:**
  - start it with `npm run dev` only;
  - to restart, kill the whole `npm run dev` tree and start fresh;
  - "Jest worker … child process exceptions" means every `[id]` route 500s, so restart;
  - warm `/` after a restart;
  - **one sweep runner at a time**: two runners share the UAT accounts, token rotation revokes the sessions,
    and every later screen "did not render". Run `auth-setup` before every pass;
  - a full capture needs 3–4 `--only` passes with a full restart between them.
- **To the owner, write in product-owner voice.** The plan, commits and code stay technical.

## Do not

- Change layouts, words or actions beyond the rename unit and the release copy. The release ships what was
  walked.
- Commit the flip unless the promote follows in the same session.
- Retire the identity tool or the new-look capture before Part B ends.
- Start Part B before the owner confirms the settling period.
- Touch public pages, emails, PDFs, the platform-admin console or the marketing site.
- Mention Club in What's New.
- Remove a public-preview guard.
