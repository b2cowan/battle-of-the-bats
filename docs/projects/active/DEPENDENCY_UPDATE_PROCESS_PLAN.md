# Dependency Update Process — keeping the stack current on purpose

**Status:** PROPOSED 2026-08-12 — awaiting owner approval; nothing built.
**Companion:** [DEPENDENCY_UPDATE_PROCESS_PM_BRIEF.md](DEPENDENCY_UPDATE_PROCESS_PM_BRIEF.md)
**Origin:** the Next 16.3 upgrade investigation ([NEXT_16_3_UPGRADE_PLAN.md](NEXT_16_3_UPGRADE_PLAN.md) §2)
found 21 published security advisories (11 High) sitting on `next@16.2.4` **unnoticed for ~3 months,
across at least four production promotes** (2026-07-23, 08-06, 08-10 ×2). Nothing in the workflow was
ever going to surface them: this repo pins exact versions (deliberately — updates only happen by
decision), but no mechanism existed to *prompt the decision*.

## Design principles

1. **Security and currency run on different clocks.** A High CVE on a production-serving dependency
   is a days-scale problem; being a minor version behind is a months-scale one. One process that
   treats them the same will be tuned wrong for both.
2. **Fail loud at moments we already act.** The release preflight runs before every promote — a check
   there needs no new habit and cannot be forgotten. New standalone rituals rot.
3. **Quiet when nothing changed.** A weekly report that usually says "all clear" trains people to
   stop reading. Pulses speak only when there is something to decide.
4. **The exact-pin strategy stays.** Pins are why prod is reproducible; this process keeps pins from
   silently aging, it does not replace them with ranges.

## Pillar 1 — Release-gate security check *(build first; highest leverage)*

A new script, `scripts/check-advisories.mjs`:
- Queries the GitHub Security Advisory API for each **direct production dependency** (`next`,
  `react`/`react-dom`, `@supabase/ssr`, `@supabase/supabase-js`, `stripe`, `sharp`, `web-push`,
  `qrcode`, `exceljs`, `jspdf*`, …) against the installed version, using `vulnerable_version_range`
  math (the method that proved reliable in the 16.3 investigation).
- Runs `npm audit --omit=dev --audit-level=high` as a second, lockfile-based net.
- Output: a short table — advisory, severity, dep, installed vs patched-in, and whether the
  advisory's preconditions apply to this app's config where determinable.

Wiring:
- **`/release` preflight: hard-fail on High/Critical affecting a production-serving dependency**
  (D1). Dev-only tooling: report, never block. A deliberate override flag exists for an
  owner-acknowledged promote (e.g. "patched version breaks us worse; shipping anyway, ticket open").
- Runnable standalone as `npm run check:advisories`.
- Deliberately **not** in `verify:changed` (network-dependent + would nag every routine edit; the
  promote is the moment that matters, plus the Pillar 2 pulse).

Why first: this alone, existing in May, would have flagged the 16.2.4 exposure on the very next
promote instead of three months later.

## Pillar 2 — Scheduled pulses

Two scheduled routines (Claude Code scheduled agents; a local cron or a manual `npm run
check:updates` are acceptable fallbacks — decide at build time, D2):

- **Weekly security pulse.** Runs the Pillar 1 check headlessly. Clean → silence (noop). Findings →
  a short report naming the advisory, whether our config is in the blast radius, and the recommended
  rung (patch-line bump vs minor jump), plus a proposed TODO entry.
- **Monthly currency report.** One screen: every direct dependency — installed vs `latest`, semver
  distance, publish date of the gap, and flags for: framework >1 minor behind; any dep ≥2 majors
  behind; **lockstep partners out of sync** (`next`/`eslint-config-next`/`sharp` must move together —
  a 16.3 lesson); any dep whose current major is EOL. Five minutes of owner reading, decisions land
  in TODO.

## Pillar 3 — The update playbook *(living ops doc)*

`docs/agents/ops/DEPENDENCY_UPDATE_PLAYBOOK.md` — extracted from what the 16.3 plan proved, so the
next upgrade starts from a template instead of a blank page. The ladder, scaled by bump size:

| Bump | Verification | Ships | Target latency |
|---|---|---|---|
| **Patch** (x.y.Z) | static gates (typecheck/lint/tests) + dev smoke | may ride a normal release | ≤1 month after publish; ≤1 week if security-motivated |
| **Minor** (x.Y.0) | the 16.3 template, light: verify version facts from the registry (not memory) · read actual release notes · field-report scan of the issue tracker · map changes onto THIS repo (grep, not assumption) · lockstep set · both lockfiles · sweeps + local prod build | **its own solo promote**, ≥2-day dev soak | ≤1 quarter; never >1 minor behind |
| **Major** (X.0.0) | full plan + PM brief + owner gates + measured claims (measurement scripts where release notes make performance claims) | solo promote after extended soak | scheduled deliberately |

Standing rules the playbook codifies:
- **Upgrades never share a promote with feature work** — single-suspect releases.
- **Cool-down:** non-security bumps wait ≥2 weeks post-publish for field reports (16.3.0's first
  9 days surfaced 16 issue reports; the two most relevant fixes were still unshipped).
- **Security floor overrides cadence** — and the **emergency rung** principle: the newest
  fully-patched release on the *current* line (e.g. 16.2.12) is always identified before an upgrade
  starts, so "broken new version" never forces "insecure old version."
- **Both lockfiles, always** (pnpm = Amplify's truth, npm = local); lockstep sets move together.
- **API-contract deps** (`stripe`, `@supabase/*`): changelog read is mandatory, plus a
  webhook/session smoke — their failures are quiet by nature.
- Rollback ladder named in advance: console redeploy → revert commit → emergency rung.

## Pillar 4 — Policy defaults (owner ratifies, D3)

- High/Critical advisory on a production-serving dep: **evaluated within 7 days, resolved within
  14** (upgrade or documented emergency rung).
- Framework: never more than **1 minor** behind `latest`.
- Everything else: quarterly batch review off the monthly report.
- New majors: never adopted inside the first month absent a forcing reason.

## Build order & cost

| Step | What | Effort |
|---|---|---|
| 1 | `check-advisories` script + `/release` preflight wiring + `npm run check:advisories` | ~half a day |
| 2 | Playbook doc (mostly extraction from the 16.3 plan) + AGENTS/ops cross-links | ~1 hour |
| 3 | `check:updates` currency-report script | ~half a day |
| 4 | The two scheduled routines (thin wrappers over steps 1+3) | ~1 hour |

~2 days total, independent of the 16.3 upgrade execution (can interleave; step 1 is worth having
**before** the 16.3 promote so the new gate’s first real run is that release).

## Decisions for the owner

- **D1** — Release gate behavior: hard-fail High/Critical on production deps (recommended) vs
  warn-only.
- **D2** — Pulse delivery: scheduled Claude routines (recommended: weekly security / monthly
  currency) vs manual scripts run by hand vs release-time-only.
- **D3** — Ratify the Pillar 4 policy numbers (7/14-day security clock, ≤1 minor behind, quarterly
  batch, 2-week cool-down).

## What this does NOT do

- No automatic dependency bumping (no Dependabot-style auto-PRs — incompatible with the
  single-shared-dev-branch policy and the dual-lockfile reality; and auto-bumps without the playbook
  ladder are how regressions ship).
- No new blocking checks on routine dev work — `verify:changed` is untouched.
- No change to the exact-pin strategy.
