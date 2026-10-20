# Admin type sweep — Stage 5, the dead old look out (BUILD prompt)

> Paste into a fresh session on `dev`. Written 2026-10-20 by the session that built and closed Stage 4 (committed
> `eb0a2609e`, owner walk ✅ 30 of 30). **Read first, whole:** `ADMIN_TYPE_SWEEP_PLAN.md` §4 "Stage 4 — as built" (its
> lessons and the owner's three rulings of 2026-10-20) and §7 "S5 — dead old look" (the census rows D01–D16 — ⚠ the
> census was WRONG on six of them; this prompt holds the 2026-10-20 re-check, not the census). Hub:
> https://claude.ai/artifact/QcQCe3yy4oqRUnUEf9uMCb. **Write to the owner as a product owner**, never in file names.
> Disagree out loud before the work.

## Why this stage exists

The old console lettering survived the September kit pass because the old rules were left under the new ones, and
"nothing uses it" was believed rather than checked — that is how the sweep began. Stage 5 deletes the old styling that
truly renders nowhere, so the next person cannot build on it by mistake, and lowers both ratchets
(`check:admin-type`, `check:old-look`). About 73 of the 258 lines the admin-type guard still counts sit in dead rules.

**The rule of this stage: "dead" is proved, not assumed.** A class is dead only when a grep of TSX/TS finds no
`styles.x`, `styles['x']`, `className="x"`, template-string or `cx()` use, no CSS `composes:` of it, no test that asserts
it, and — for a global class — no use on ANY surface (admin, coaches, consumer, public, marketing, platform-admin,
volunteer shells). The admin shell always carries `data-admin-kit` + `data-coach-warm-enabled`
(`lib/admin-kit-marker.ts`, `app/[orgSlug]/admin/layout.tsx`); platform-admin, the consumer app, public pages and the
scorekeeper carry neither, so a base rule that a kit layer hides in the admin is still LIVE wherever the class is used
outside it.

## Before anything

- `npm test` at the START and record it. On 2026-10-20 the reds outside the sweep were: club-stage4a-guard (Club Tier
  Stage 4a, in flight), warm-palette-contrast (First look 1d's page base), club-stage6c rail scrollbar,
  coach-semantic-ink, two registrable-teams join-page tests. Expect some to have moved.
- Re-read every path:line below against the code — other sessions commit in between.

## Part 5a — the owner's two rulings of 2026-10-20 (VISIBLE: its own walk part)

1. **Account → Notification settings: its page title goes plain** (owner "yes" to the Stage 4 hand-off's call 1). The
   title is `app/(consumer)/account/notifications/AccountNotifications.module.css` `.title` (display face, 700 since
   Stage 4). Body face, size and weight unchanged. Check the account shell's own `h1` "Account"
   (`account.module.css`, 800) — it is the same page's top; say whether it goes with it (rec: yes, 700, the same
   reason) and ask if unsure. ⚠ This is the consumer shell: `--text-secondary` does not resolve warm there (Stage 4
   lesson) — no new token use beyond `--home-*`.
2. **`KIT_INK.head` becomes the standard column heading** (owner "yes", call 2). `components/admin/kit/kit-inline.ts`
   (~:68) is body 650, no capitals, `--text-tertiary`; the standard (§3.2, global `th`) is display face,
   `--type-support`, 700, 0.05em, capitals, `--text-secondary`. Two callers, both house league tables:
   notifications `page.tsx` (~:386, the sent-history `<th>`) and registrations `page.tsx` (~:626 `headCellStyle`,
   used ~:794). Read both tables' header strings: capitals publish them as written, so a heading is a short noun.
   Mark the kit-inline line `type-ok: column heading`. Update the comment on `head` ("the standard's quiet head").
3. **Not changing (owner, call 3):** the Send email sample kicker stays as drawn — the sample is drawn in the kit's
   colours; the real family email is a navy card with a blue kicker. The email's own old look belongs to
   `PUBLIC_FACE_WARM_PLAN.md` ("the other emails") — check it is listed there; add one line if not.

## Part 5b — truly dead (re-checked 2026-10-20 — re-confirm each, then delete)

| Row | What | Where (2026-10-20) | Note |
|---|---|---|---|
| D02 | `.score`, `.data-mono`, `.tab-btn`, `.segmented-control`, `.segment` | `app/globals.css` ~:1508, :1520, :2365-2415 | 0 uses anywhere |
| D07 | the old tournament header branch (eyebrow, title, subtitle, locked banner) | `components/admin/tournament/TournamentAdminUI.tsx:91-114`; module `.header`, `.lockedBanner`, `.eyebrow`, `.title`, `.subtitle` | the kit is always on where `TournamentAdminHeader` renders (results, schedule, check-in, communication, registrations); only `.kitLockedBanner` is live — keep it |
| D08 | unused toolbar parts: ToolbarSelect, ToolbarSegmentedControl, ToolbarMenu (+ MenuItem / Separator), SelectionActionBar, StatusLegendPopover, ToolbarCheckItem, TournamentAdminToolbar, ToolbarGroup | `TournamentAdminUI.tsx:117-437` + module rules; re-exported by `components/admin/tournament/index.ts` | 0 importers. Update `tests/unit/admin-overlay-guard.test.ts` (~:96) and `coach-page-actions-guard.test.ts` (~:556). ⚠ memory: a kit barrel re-export trap — grep the barrel's importers |
| D09 | Title Case words in the nav config + the map that hides them | `components/admin/admin-nav-config.ts:39,49,50,52,62`; `lib/admin-kit-nav.ts` `KIT_TOURNAMENT_LABELS` (~:311-321) | put the sentence-case words in the config, delete the map and `kitTournamentLabel` (callers `AdminKitRail.tsx` ~:501, `AdminKitBottomNav.tsx` ~:108); update `admin-kit-nav.test.ts` (~:207) and `notification-open-in-place-guard.test.ts` (~:177). A label may be a KEY: grep compares/lookups on the old words first |
| D11 | admin-common `.pageKicker`, `.pageTitle`, `.pageSub`, `.controlLabel`, `.controlSelect`, `.searchInput`, `.groupHeader` (+ their kit copies) | `app/[orgSlug]/admin/admin-common.module.css` ~:47-198, :315, :355-403 | 0 uses across its 5 importers |
| D12 | schedule `.sheetSectionLabel`, `.sheetDone`, `.formLabel`, `.saveError`, `.noShowTag`, `.liveChip` (+ kit copies) | `schedule-admin.module.css` ~:877-1112, :1436-1549 | 0 across 6 importers |
| D13 | `.roundTitleText` | `BracketBuilder.module.css` ~:309 | |
| D14 | `.segmentButton` (+ its later variants) and BOTH `.sectionTitle` rules | `branding.module.css` ~:20, :34, :497-677, :517 | the census named only the second `.sectionTitle`; both are dead |
| D15 | the page header's `legacy` prop and its classes | house league 8 props in 7 files (`page.tsx` ~:231, ledger ~:104, notifications ~:162/:254, registrations ~:693, schedule ~:1309, standings ~:162, teams ~:839); public site `page.tsx` ~:134; the prop in `AdminPageHeader.tsx` (~:17/:44, "READ BY NOTHING"); classes house-league `.pageTitle`, `.pageSub`, `.pageHeader`, `.pageHeaderLeft`, `.headerIcon`, public-site `.pageTitle`, `.pageSub`, `.pageHeader`, `.headerIcon`, rep-teams `.pageTitle`, `.pageSub` | `check:old-look`'s 9 `legacy` count goes to 0 |
| — | billing `.priceUnit` | `billing.module.css` ~:480 | `PermitWindows`' `own.priceUnit` is another module — leave it |
| — | rep-teams `.summaryCardLabel`, `.summaryCardValue`, `.sectionTitle` | `rep-teams.module.css` ~:229-248 | the coaches `SetupOverview` uses `coaches.module.css`'s classes of the same names |
| — | house league's BASE old-look declarations under a full kit layer | `house-league.module.css` `.seasonHeaderName` ~:211, `.modalTitle` ~:570, `.draftTitle` ~:881 (kit ~:1240, :1395, :1454) | house league renders only under the admin marker. Fold: delete the base's face / weight / case / tracking / colour, **keep `margin`** (the kit rule does not restate it) — or fold the kit rule into the base and drop the layer (prefer this; Stage 3 lesson) |
| — | coaches `.lineupAnalyticsSummary` | `coaches.module.css` ~:2028-2034 | 0 across 188 importers. ⚠ coaches.module.css carries other sessions' lines — commit HEAD + your hunks only |
| — | What's new: every class but `.navDot` and `.helpLink` | `components/whats-new/whats-new.module.css` (20 classes: `.wrap .btn .hasNew .dot .panel .panelHeader .panelTitle .closeBtn .list .entry .entryDate .entryTitle .highlight .tag .tagNew .tagImproved .tagFixed .highlightText .footer .seeAll`) | re-confirm no dynamic lookup (`styles[tag]` for the tag kinds!) |

Onboarding was re-checked: none of its 58 classes is dead — nothing to do there.

## Part 5c — `.btn-data` on ~96 admin buttons (optional; only if it is provably invisible)

The base `.btn-data` rule (`globals.css` ~:1841) is NOT dead: the Send feedback widget (coaches bars, the consumer
account), the old message window (FeedbackModal), the shared Export button on 7 platform-admin screens and the plan
drawer wear it outside the kit. Keep the base rule. Stripping the class from ADMIN buttons is worth it only if each
button's computed look is unchanged — the kit's `.btn-data` rule (~:2014) also sets size/spacing, so removing the class
can resize a button. Rec: measure a sample (one toolbar, one row action, Export) with the class and without; if any
differs, leave 5c for the One Window / FeedbackModal retirement and say so.

## NOT dead — leave, and correct the plan's §7 rows

- D02 `.public-page-header .eyebrow`, `.section-header .eyebrow` — the public site (5 pages + the club home).
- D04 `.form-label` base — public registration (`RegisterContent.tsx`, 10 labels, no override).
- D05 `.modal-header h3`, `.modal p`, `.modal-footer` — the Send feedback widget renders them outside any marker.
- D06 `.table-cards td[data-label]::before` — three platform-admin screens.
- D10 CollapsibleCard `.title` / `.meta`, ExportMenu `.menuItemLabel` — platform-admin renders both without the kit.
- D16 FeedbackModal's message base — parked for One Window Stage 3 (22 files, 27 call sites).

## ⚖ ONE OWNER CALL before deleting D01 (ask at the start; rec below)

**E1 — the old tile hub is reachable.** `AdminHubClient.tsx` (~:186-398) is not dead: `AdminHub.tsx` (~:19) renders the
client with no current org or for a tournament-only org, and the tile branch runs whenever
`hasOnlyTournamentWorkspace` (~:80) is false — so a member of a tournament-only organization who cannot see
tournaments (and the no-org edge) gets the pre-redesign tile page, in the old lettering. *Rec: replace the tiles with the
admin's one "no access here yet" state (the existing Access restricted card the other screens use, with "Ask your
organization's owner for access"), then delete the tile page and its rules.* Visible → its own walk step. Find a test
account for it or say it was drawn from the code.

## Verify, records, walk, commit

- Each deletion: grep proof as above, in the session's notes (`.probe/ats5/`), one line per class.
- typecheck (`npx next typegen` first), `npm test`, `check:admin-type` + `check:old-look` (report, then `--init` —
  both may only go down; record the new counts: Stage 4 left type 69 files · face 112 · caps 103 · track 3 · heavy 40;
  old-look 20 files · useAdminKit 7 · kx 75 · helpers 25 · legacy 9 · kitScope 414), `check:css-selectors`, css purity,
  public tokens, spelling, eslint on changed files.
- `check:layout --changed` for 5a's two screens (account notification settings; a house league season's notifications
  and registrations). Deleting dead rules renders nothing new, but `globals.css` changes: the whole-product sweep runs
  at the next staging release (owner 2026-10-13) — say which you ran.
- Restart the dev server before the walk only if a shared module changed (stop the inner `next dev`; `scripts/dev.mjs`
  brings it back; check `/platform-admin/login?next=%2Fplatform-admin` is 200).
- `/review` on Stage 5's files only — a "dead" claim that was wrong is this stage's one real risk; give the review a
  lens that tries to find a live use of each deleted class.
- **Owner walk** `ADMIN_TYPE_SWEEP_STAGE5_WALK.html` (Stage 4 walk's shape), one purpose, short: Part A the two rulings
  (account title; the two house league tables' headings in Warm and Dark); Part B E1's new state if ruled; Part C a
  look that a handful of screens are unchanged (house league season, tournament schedule + bracket editor, branding,
  the tournament rail's words, What's new link, a club Plan & billing page). Linked from the hub.
- **Commit** only with the owner's OK, explicit pathspecs, shared files (TODO.md, the design log, coaches.module.css,
  globals.css) as HEAD + your exact hunks in a temporary index (`.probe/ats4b/commit.cjs` does this hunk by hunk —
  copy it), CAS `update-ref`, then `git show --stat HEAD`. Consider 5a as its own commit.
- **Records:** plan "Stage 5 — as built" + correct §7's six NOT-DEAD rows; TODO line; hub (read the live copy first,
  `JSON.parse` both `application/json` blocks, same file path); auto-memory `project_admin_type_sweep.md` + its
  `MEMORY.md` line.

## Then the sweep closes (after the Stage 5 walk)

- Run `check:admin-type --report` and group what is left by owner: chat (paused), the Send feedback window (its own
  project), FeedbackModal (One Window Stage 3), house league (Club Tier Stage 9), the public-site editor and
  `TournamentCreationPreview` (Club Tier Stage 4 / the public face), platform-admin. Every remaining line should have
  an owner; anything without one is a finding for the owner, not a silent leftover.
- The ratchet stays as the guard against regression. Still-open owner asks to put at the close: teach
  `check:admin-type` the display face on mixed-case titles (offered at Stage 4); `/docs` for help screenshots that show
  the old titles; `/demos` at the next release.
- Close: plan + PM brief → `docs/projects/archive/`, the TODO line → ✅ Completed Tasks, hub stage strip QA → Shipped
  when on prod (release-history record is the home of prod state), memory line → CLOSED.

## Not this stage

The parked rows (§5: chat, the Send feedback window, the old message window, the billing mock portal); the public
pages' own styling; the Excel headings (A7); Club Tier Stage 9's house league rebuild; the bracket editor's Field box
vs the club's Venue field (Stage 2's open call).
