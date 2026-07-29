# Release Notes, Changelog & Loose Roadmap — Implementation Plan

**Status:** Planned (not started)
**Owner decisions captured:** 2026-06-28
**Migrations required:** None (V1)

## Decisions locked (2026-06-28)
- **Forward-looking surface:** "Shipped + loose horizon" — a changelog of released items plus 3–6 *undated* themes for what's coming. No dated public roadmap.
- **Channels:** (1) In-app "What's New" for logged-in admins & coaches, (2) Public `/changelog` page on the marketing site. **No email channel in V1.**
- **Automation level:** Draft-then-approve. The release flow generates customer-facing notes from commits; a human edits and publishes. No fully-automated publish.

## Architecture (no migration)

Release notes are **content committed to the repo**, published as part of the same production deploy that ships the features — so "the notes" and "the code" can never drift, and there is nothing new to provision.

- **Source of truth:** a versioned content file, e.g. `lib/release-notes/entries.ts` (or `.json`), one entry per release: `{ version/date, title, highlights[], category tags }`. Categories map to commit types (New / Improved / Fixed).
- **Horizon content:** a small static `lib/release-notes/horizon.ts` — 3–6 plain-language themes, no dates. Hand-curated from `docs/projects/active/`.
- **Public page:** `app/changelog/page.tsx` — renders the entries list + a "On the horizon" section. Lives next to existing marketing pages (`/pricing`, `/for-leagues`). SEO-indexable.
- **In-app "What's New":** a panel/page for logged-in admins & coaches reading the same entries file. A small badge appears on the menu/bell when there are entries newer than the user's last-seen marker. **Last-seen marker = localStorage per device (V1)** — no DB, no migration. (V2 could promote to a user preference for cross-device sync.)

### Why a committed file, not the `announcements` table or a new table
- No migration, no admin CRUD UI to build, no cross-org broadcast plumbing.
- Notes are reviewed in the same PR/commit as the release → the draft-then-approve gate *is* the normal code review.
- Public page and in-app panel read one source → guaranteed consistency.

## Phase 3 — Release-flow automation (detailed spec)

**Intent:** at production-promote time, the release flow *drafts* a customer-facing changelog entry from the commits actually being shipped; a human reviews/edits it; it's appended to `lib/release-notes.ts` and ships in the **same deploy** (so notes and features can't drift). Hangs off the existing `/release` agent (`.claude/commands/release.md`). **Fully-automated publish stays out of scope** — commit messages carry internal jargon and premature context; the human gate is the whole point.

### Deterministic part (a script does this — cheap, repeatable)
A helper (e.g. `scripts/draft-release-notes.mjs`) that, given the commit range since the last release tag:
1. Resolves the range: `git log <last-release-tag>..HEAD`. If no tag exists yet, fall back to commits since the newest `RELEASE_ENTRIES[0].date` (or last ~30 commits) and warn.
2. Parses conventional-commit subjects (`type(scope): subject`).
3. Filters to **customer-facing** types — keep `feat`, `fix`, `perf`; drop `chore`, `docs`, `refactor`, `test`, `build`, `ci`. Also drop scopes that are internal-only (`platform-admin`, `db`, `release`, `snapshot`) — these are operator/plumbing, not customer UX.
4. Emits a **grouped draft skeleton**: `feat → New`, `fix → Fixed`, `perf → Improved`, each as raw subject lines for a human to rewrite. Prints the dropped commits too (so nothing is silently hidden — the human can pull one back).

### Human/agent part (judgment — the draft-then-approve gate)
5. The owner (or `/release`, with the owner approving) rewrites the skeleton into plain customer language, re-categorizing as needed (the script's New/Fixed/Improved is a *suggestion*). `/marketing` tone-check available on demand, not mandatory.
6. Append the finished entry to the top of `RELEASE_ENTRIES` (`LATEST_RELEASE_DATE` derives automatically → in-app dot fires for everyone).
7. Commit the entry **with** the release; push `dev:master`; **tag the release** so the next run's range is well-defined.

### Decisions to confirm (owner)
- **Tag scheme:** recommend date-based `release/YYYY-MM-DD` (matches the date-keyed entries, human-readable, no version bookkeeping). Alternative: running `vN`. *Owner call.*
- **Category mapping:** `feat→New`, `fix→Fixed`, `perf→Improved` as the *draft default*; human re-tags freely. Confirm OK.
- **Empty/internal-only release:** if a promotion has **no** customer-facing commits, **skip the entry** (don't publish "internal fixes"). The flow must allow "no note this release." Confirm.
- **Same-day promotions:** if multiple prod pushes land the same day, **merge into one dated entry** rather than two same-date entries. Confirm.
- **Cadence/ownership:** notes are written at promote time by whoever runs `/release`, owner approves before the push. Confirm this stays a release-time task (not a separate weekly digest).

### Guardrails
- Never auto-publish; the entry is only ever committed after human review.
- Internal/platform-admin/db commits are filtered out *and* the human gate catches leakage — two layers so operator-only changes never reach customers.
- "Dropped commits" are always printed (no silent truncation), so a mis-filtered customer-facing item can be pulled back.
- Notes ship in the same commit as the code → zero drift risk by construction.

### Verification
- Script is dev-tooling only (no app/runtime/DB change) → no migration, no dictionary, no token impact. Lint/typecheck the script; dry-run against a recent range and eyeball the grouping.
- First real use is itself the acceptance test: run it during the next prod promotion, confirm the draft is sensible and the published entry renders on `/changelog` + fires the in-app dot.

## Phases
- **P1 — Public changelog + content model. ✅ BUILT (dev, unpushed) 2026-06-28.** Content model + seed (`lib/release-notes.ts`), `app/changelog/page.tsx` (+ module CSS) with "Recently shipped" timeline + "On the horizon" themes, marketing-site footer link, marketing chrome wired (`Navbar`/`Footer`). Copy tone-passed by `/marketing`; reviewed (no findings). Footer restructured to two labelled columns by `/design`.
- **P2 — In-app "What's New." ✅ BUILT (dev, unpushed) 2026-06-28.** Reusable `WhatsNewButton` (sparkle icon + lime "new" dot) + in-context portaled `WhatsNewPanel` (recent entries, "See all updates →" to `/changelog`), reading the same `lib/release-notes.ts`. "Seen" tracked per device in localStorage (`fl_whats_new_seen`) — no DB/migration. Mounted beside the notification bell in: admin desktop sidebar, admin mobile top bar, org Coaches Portal sidebar. *Deferred: standalone Coaches Hub (`/coaches/*`) shell — different chrome, no bell; fast-follow.* typecheck ✓ · focused lint ✓.
- **P3 — Release-flow automation. ✅ BUILT (dev, unpushed) 2026-06-28.** `scripts/draft-release-notes.mjs` (+ `npm run draft:notes`) generates a grouped, paste-ready draft from conventional commits in range (resolves range via newest `release/*` tag → `--since` → last-30 fallback), filters internal types/scopes, prints dropped commits + the suggested tag, and never writes/publishes. `/release` runbook updated: new pre-flight step **1d-3** (draft → rewrite → commit on dev, or skip if internal-only), a "Release notes" line in the summary, and **release tagging** (`release/YYYY-MM-DD`) after the master/promote push. Defaults locked per owner: date-based tags · `feat→New`/`fix→Fixed`/`perf→Improved` (re-taggable) · skip internal-only · merge same-day. Dry-run verified against recent history.

## Verification
- P1/P2 are copy + presentational (CSS/public-token guardrails apply); typecheck on shared-module touches.
- No DB/auth/contract changes in V1 → no migration drift, no dictionary update.
- Browser verification (user): public `/changelog` renders + indexes; in-app badge appears for new entries and clears on view; horizon section reads cleanly.

## Open items / future
- V2: email digest on major releases to the existing consented list (early-access `release_notifications_consent`).
- V2: promote last-seen marker from localStorage to a user preference for cross-device.
- "Tell us what to build next" link from the horizon section into the existing feedback widget.
