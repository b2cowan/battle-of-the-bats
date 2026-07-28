# Codebase Cleanup — Tranche 1 Build Prompt (dead-code deletion)

> **How to use:** paste this whole prompt into a NEW chat. It executes Tranche 1 of
> `docs/projects/active/CODEBASE_CLEANUP_PLAN.md` (~3,000 LOC of verified-dead code).
> Tranches 0 (security) and 2 (docs/TODO/memory truth-up) are COMPLETE + COMMITTED
> as of 2026-07-24 — trackers are current; trust them.

## Mission

Execute **Tranche 1 (sections 1a–1h)** of `docs/projects/active/CODEBASE_CLEANUP_PLAN.md`:
delete the confirmed-dead components, API routes, lib exports, CSS, scripts, dependency,
env residue, and assets, plus the two tiny additive hygiene fixes (1h). Every item was
adversarially verified on 2026-07-24 with evidence in
`docs/projects/active/CODEBASE_CLEANUP_ANALYSIS.md` (finding IDs A01…, C03…, E04… match the plan).
Read the plan's Tranche 1 section + binding rules FIRST; consult the analysis doc for any
item's evidence before deleting it.

## Coordination rules (binding)

- Other sessions share this working tree. Never `git add -A`; explicit pathspecs only
  (note the bracket-pathspec gotcha: `git add` on `[id]`/`[orgSlug]` route dirs needs
  `:(literal)` pathspecs); `git show --stat HEAD` after every commit; re-check
  `git rev-parse --abbrev-ref HEAD` = `dev` before each commit.
- **DO NOT touch** `.claude/settings.json` or foreign uncommitted edits. At completion you MAY
  update the Codebase Cleanup Execution line in `TODO.md`, append a T1 execution record to the
  plan doc's Tranche 1 section, and add a truth-up note to the auto-memory topic file
  `project_codebase_cleanup_audit.md` — touch nothing else in those files.
- **Known in-flight foreign work — leave alone:** `app/[orgSlug]/[tournamentSlug]/teams/[id]/team-profile.module.css`
  failed the public token ratchet (4 new literals) from ANOTHER session's uncommitted edit as of
  2026-07-24. Re-check at start; your success gate is "no NEW failures beyond whatever
  pre-exists".
- **Per-action owner OK before every commit** (suggested: one commit per plan sub-section,
  1a…1h — propose the batch, wait for OK).

## Execution rules (from the plan — enforced)

1. **Re-verify before deleting, every time.** Immediately before deleting any file/export/selector,
   re-run its zero-reference check (grep the symbol/filename/selector repo-wide; the analysis doc
   records the exact method per finding). The audit ran on 2026-07-24; the tree has moved since.
2. **Prod checks use `origin/master`** after a fresh `git fetch` (local `master` was reset to track
   it on 2026-07-24, but fetch again — prod promoted twice that day).
3. Respect every **verifier caution** baked into plan section 1 (comma-list CSS strips, keep-lists
   like `btnPrimary`/`fl-text`/`readiness*`/`cardThumb_*`, the `.scoreTeamName` vs `.scoringTeamName`
   near-miss, `lib/db.ts` 49-vs-59 export reconciliation via a fresh scan, do-NOT-delete list in 1f).
4. Two items need a quick verify-then-include decision (flagged in plan): the stripe-prices
   platform-admin API route (likely dead with its deleted client) and `components/ui/HudSkeleton.tsx`
   (likely orphaned sibling). One item needs an explicit owner nod before deleting:
   `RegistrationConfirmationCta` (an archived plan deliberately kept it).
5. `.env.local` is untracked — edit lines directly (1d flag residue, 1g env key), never commit it.
6. Removing the `resend` package: update `package.json` + regenerate the npm lockfile
   (`npm install`); commit both. **Never commit `pnpm-workspace.yaml`.**
7. After all deletions: `npm run typecheck` + `npm run verify:changed` (expect ONLY the known
   team-profile ratchet failure) + dev-server clean restart (stop → `rm -rf .next` → `npm run dev`
   → wait for Ready) before handing to the owner.

## Report back (instead of editing trackers)

End with a summary the owner can paste to the Tranche-2 chat: per sub-section — items deleted
(count + LOC), items skipped-with-reason (e.g. re-verify found a new reference; owner declined),
the two verify-then-include outcomes, commit hashes, and verification results. The Tranche-2 chat
will update TODO.md, the plan's execution record, and project memory from that summary.
