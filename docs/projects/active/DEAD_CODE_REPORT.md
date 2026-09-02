# Dead-code report — first run, 2026-09-01

**Status:** §3.1 (files) and §3.2 (types) **ACTIONED 2026-09-01 on owner instruction** — see §5.
§3.3–§3.5 remain report-only. Regenerate with `npm run check:dead:report`.

Owner decision 2026-09-01 (codebase cleanup tranche 6, §6e): adopt a dead-code detector in
report-only mode first, and decide on promoting it to a gate after seeing whether the output is
more signal than noise. **This document is that output**, plus the honest accounting of what it got
wrong on the way to producing it.

The tool is `knip`. It is **not a dependency of this project** — `npm run check:dead:report` fetches
it on demand, so trying it changed no lockfile, added nothing to the Amplify install, and can be
abandoned by deleting two files. Config and its reasoning: `knip.jsonc`.

---

## 1 · Is it signal or noise? — the number that decides it

| | first run | after config fixes |
|---|---|---|
| Findings that were **wrong** | 71 | **1** |
| Findings that were **real** | 68 | 68 |

**The noise was all configuration, and all of it was ours, not the tool's.** Two causes, both worth
recording because they are the exact failure mode that makes a tool like this get switched off:

1. **68 × `server-only`** reported as an unlisted dependency. It is a Next-provided marker module
   imported for its side effect and correctly absent from `package.json`. Ignored by name.
2. **`opentype.js` and `pdfjs-dist`** reported as unused devDependencies. **Both were false, and
   acting on either would have broken something.** `opentype.js` is required by a CommonJS script
   that the scan wasn't looking at (`.js` was missing from the file globs — now fixed). `pdfjs-dist`
   is loaded by absolute path out of `node_modules`, which no static analysis can follow — ignored
   by name, with the reason recorded beside it.

⚠ **This is the argument for keeping it in report mode a while longer, not against the tool.** A
gate that had been switched on before those fixes would have been red on day one for reasons that
had nothing to do with dead code.

## 2 · What it cannot see

Stated so that a green run is never mistaken for proof:

- **CSS.** That is `npm run check:css-selectors` (dead classes + clashing selectors), which is a
  gate as of today.
- **A prop, branch or condition that can no longer be true.** The headline defect of tranche 6 —
  six Money page headers rendering nothing at all, behind a flag with one possible value — was
  *called on every visit*. Nothing in this class of tool would ever have flagged it. What caught it
  was the page-header inventory in the unit tests: an enumeration of what each screen actually
  holds, which turns a silent drift into a failing assertion.

---

## 3 · Findings

### 3.1 Unused files (3) — the highest-value category

Each verified by hand: no importer anywhere in `app/`, `components/`, `lib/`, `tests/`, `scripts/`.

| File | Note |
|---|---|
| `app/[orgSlug]/admin/tournaments/schedule/components/ScopePicker.tsx` | |
| `lib/teamBadge.ts` | |
| `components/notifications/PushPermissionPrompt.tsx` | Two files mention it **in prose comments only** — the same shape as `SeasonRecordWidget`, deleted in tranche 6 for exactly this reason. Deleting it means rewording those two comments. |

### 3.2 Unused types (8)

`lib/types.ts` — `BracketConfig`, `Player`, `RosterPlayer`, `TournamentNotificationPreference` ·
`lib/platform-metrics.ts` — `CommandCenterStats` · `lib/help-content/index.ts` —
`HelpCalloutContent` · `lib/schedule-conflict.ts` — `GameConflictStatus` ·
`lib/tournament-plus-analytics.ts` — `TournamentPlusLockedFeature`

⚠ **This settles the open question from the tranche-6 prompt**, which listed *"~70 exported types
across ~55 files with no textual match outside their declaration"* and deliberately left them to
tooling rather than a hand pass. **The real number is 8.** The other ~60 are referenced somewhere a
plain text search could not see. That gap — 70 suspected, 8 actual — is the clearest evidence in
this document for why the hand pass was correctly refused.

### 3.3 Unused exports (55 across 28 files)

Not dead files — live modules with an export nobody imports. The same category as the five deleted
by hand in tranche 6.

```
components/admin/AdminSkeleton.tsx           SkeletonRow, DashboardSkeleton
components/admin/tournament/TournamentAdminUI.tsx  ToolbarMenuSeparator, ToolbarCheckItem
components/coaches/useCoachNudgeDismiss.ts   COACH_SETUP_NUDGE
components/sandbox/SandboxProvider.tsx       useSandbox
lib/admin-density.tsx                        useAdminDensity
lib/chat-service.ts                          ensureCoachMembership, countOpenReportsForRoom
lib/coach-fundraising.ts                     FUNDRAISING_KINDS, SPONSOR_STATUSES, KIND_HINT, SPONSOR_STATUS_HINT
lib/coach-money-in.ts                        MONEY_IN_KIND_LABEL, MONEY_IN_KIND_HINT, MONEY_IN_KIND_ROW, MONEY_IN_SOURCE_LABEL
lib/coaches-portal-routes.ts                 teamWorkspaceDisplayName
lib/db.ts                                    getTournaments, saveTournament, initializeDivisions,
                                             getVenueFacilities, getOrgVenues, saveDivision, deleteTeam,
                                             saveGame, removeRepTeamCoach,
                                             cleanupOrphanedCoachMembership,
                                             markRepPlayerDuesInstallmentPaid
lib/demo-coach.ts                            demoPaidStampIso
lib/demo-org-server.ts                       primeDemoOrgIds, resetDemoOrgIdCacheForTests
lib/email-sender.ts                          recipientCountForEmailKey
lib/export/catalog.ts                        getCatalogEntry, getLiveExports, getExportsByModule
lib/export/resolve-pdf-settings.ts           resolveTeamPdfSettings
lib/family-access.ts                         ensureTeamCalendarToken, getVerifiedLinksForUser
lib/fan-follows.ts                           countFollowersForEntity
lib/follow-feed.ts                           FOLLOW_FEED_GROUP_ORDER
lib/insight-findings.ts                      summarizeDuesForFindings
lib/registration-attention.ts                getRegistrationAttentionBucketDefinition
lib/rep-drills.ts                            MAX_TAG_NAME_LEN
lib/schedule-metrics.ts                      asScheduleMetricGames
lib/sports.ts                                TOURNAMENT_SPORT_OPTIONS
lib/stripe-prices.ts                         isPlanCheckoutPriceConfigured
lib/team-org-billing.ts                      requestOrgTeamAddonBilling, inviteOrgTeamAddonBilling,
                                             respondToOrgTeamAddonBillingInvite,
                                             declineOrgTeamAddonBillingRequest, startOrgTeamAddonCheckout
lib/tournament-venue.ts                      resolveTournamentVenueSelection
lib/user-contexts.ts                         findInvitedMembershipSlug
lib/walkthrough-content.ts                   deckSlides
```

⚠ **`lib/db.ts` (11) and `lib/team-org-billing.ts` (5) deserve a read before a delete, not after.**
Tranche 1 removed 49 zero-caller exports from `lib/db.ts` in July and the count is back to 11, which
says the file accretes them faster than sweeps remove them. The billing five are a whole flow —
request, invite, respond, decline, checkout — and a flow that is entirely unreferenced is either
genuinely abandoned or **wired up somewhere the analysis cannot see**. That is a product question,
not a cleanup one.

### 3.4 Duplicate exports (2)

`lib/sports.ts` — `OFFERED_SPORT_OPTIONS` and `TOURNAMENT_SPORT_OPTIONS` are the same value exported
twice · `lib/dues-credits.ts` — `amountsTotal` and `creditsTotal` likewise. Low stakes; two names for
one thing is how the two names drift apart later.

### 3.5 Unlisted dependency (1)

`scripts/measure-dev-memory.mjs` imports `ws`, which is not in `package.json`. It works today
because something else pulls `ws` in transitively. **That is exactly the shape that produces a red
Amplify build when the transitive parent changes** — the same failure `check-lockfile-sync.mjs`
exists for. Worth listing properly.

---

## 4 · Recommendation

**Do not gate this yet.** Two things should happen first, in order:

1. **Act on §3.1 and §3.2** — the three files and eight types. They are unambiguous, verified, and
   between them make the next run's output shorter and more trustworthy.
2. **Read §3.3 in two piles**, because they are not one decision: the ~35 straightforwardly dead
   helpers, and the `lib/db.ts` / `lib/team-org-billing.ts` clusters that want a product answer.

Once the report is short enough that a run produces no argument, baseline it and ratchet it exactly
as `check-public-tokens.mjs` and `check-css-selectors.mjs` do — red only on something NEW. Gating it
at today's 68 findings would mean baselining 68 things nobody has read, which is the same mistake as
re-baselining a layout sweep to make it green.

---

## 5 · What was actioned, 2026-09-01

Owner instruction: remove §3.1 and §3.2. Every deletion re-verified by hand first (the programme
rule: a report is a lead, not a verdict). Typecheck clean; 2739/2739 unit tests pass.

**Files (3 → 0).** The schedule `ScopePicker`, `lib/teamBadge.ts`, and the push permission prompt.
The last one's two remaining mentions were prose in other files' docblocks — reworded, not deleted,
because both explain something still true about how push subscription works.

**Types (8 → 0).** Deleted where they stood, each with a one-line tombstone.

### ⚠⚠ The finding that outranks the deletions: a dead cluster hides itself

Removing `BracketConfig` immediately exposed `BracketMatchup` as dead. Removing THAT exposed
`BracketSlot`. All three were one abandoned design — a bracket as a single config object — and
**the report's first run found exactly one of them.**

The reason is structural, not a tool defect: `BracketConfig` was the only reference to
`BracketMatchup`, which was the only reference to `BracketSlot`. To the honest question *"is this
export used anywhere?"* the answer for two of the three was **yes**. The cluster kept itself alive
from the inside.

Two rules follow, and they are the durable output of this exercise:

1. **Re-run the report after deleting, before believing it is finished.** One pass is one layer.
2. **Distrust "its neighbour is still live" when the neighbour's only caller just died.** An earlier
   draft of the `BracketConfig` tombstone asserted in writing that `BracketMatchup` was live. It
   was not. That sentence was written, committed to the file, and wrong within the same hour.

This also sharpens §4's recommendation: **a ratchet on unused exports would have to be re-run to
convergence after each cleanup pass**, or it will report a shrinking number that never reaches the
truth.

### ⚠ A component's STYLESHEET is not deleted with it, and the new CSS gate proved it

Deleting `ScopePicker.tsx` and `PushPermissionPrompt.tsx` left `ScopePicker.module.css` and
`PushPermissionPrompt.module.css` on disk, imported by nothing. **The dead-code report cannot see
this** — it does not read CSS — and the deletion looked complete from its output alone.

`npm run check:css-selectors`, built earlier the same day, went red on the next run: the orphaned
classes had become dead the moment their component left. Both stylesheets are now deleted. Two
follow-ons went with them: a stale entry in the colour-token checker's `shared` scope list that
named one of the dead sheets, and a stale key in the CSS gate's own baseline.

**This is the clearest evidence for the two gates being complementary rather than overlapping** —
one found what the other structurally cannot, on the first change after both existed.

### Re-run after the deletions

`unused files: 0 · unused types: 0 · unused exports: 56 · duplicates: 2 · unlisted: 1`

⚠ Exports went **55 → 56**, not down. Nothing here caused that — the count moved because a
concurrent session's work landed in the tree during this pass. It is a fair warning about reading a
single number from a shared working copy as if it were a trend.
