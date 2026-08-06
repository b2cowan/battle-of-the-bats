# Program — Organizer Experience (dashboard, admin IA, roles, settings)

> **Consolidated 2026-07-28.** Replaces 14 organizer/admin plan-brief files (§5).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §4.
> **Audience:** the org owner/admin running an event — *not* the platform operator console
> (that's `PROGRAM_PLATFORM_ADMIN_CONSOLE.md`).

---

## 0. Ground truth (verified 2026-07-28)

`dev` is 8 commits ahead of `origin/master`. The dashboard game-status sections, completion guidance
and admin role parity Phases 1–2 are **live in production** despite plan headers still reading
"BUILT on dev, unpushed". Three items here are genuinely unstarted.

---

## 1. Outstanding work

### 1.1 Admin IA & Multi-Module Navigation — SCOPED, NOT STARTED
The platform still presents a **tournament-first skew to league and club orgs**. A club owner signs in
and the product acts like they came to run a tournament. Scope:
- Plan-aware dashboards, navigation and public homepage.
- `/home` switcher voice that reflects what the org actually operates.
- Surfacing buried modules in navigation.
- A reserved-slug guard.

Explicitly foldable into the per-tier projects rather than run standalone. **This is the single
biggest structural gap for the League and Club segments** — see `PROGRAM_LEAGUE_AND_CLUB.md`.

### 1.2 User Management UX (Tournament & Tournament Plus) — NOT STARTED
Small, well-defined, and it's the screen new orgs hit early:
- Broken upgrade links.
- Plan context missing from the seat banner.
- Empty state renders "No members yet." with **no CTA and no guidance** — a first-time Tournament user has no idea what to do.
- Role guide doesn't explain the seat model.
- Subtitle copy and manage-modal clarity.

### 1.3 Admin role parity — deferred follow-ups
Phases 1 and 2 shipped (admins can manage a tournament's Public Site; server-side enforcement added
where UI-only hiding had been used). Deferred and still open:
- **Org-level parity items** the build deliberately skipped.
- **`org_settings` and `billing` appear as grantable** in the capability-override editor while policy reserves them owner-only — a control that promises something policy refuses.
- **⚠ J10-001 (High) — an existing multi-org user is 409-blocked from invite with a blame-shaped error.** The platform's own coach-portal funnel creates exactly this state, so the platform generates users it then refuses to invite. Cross-reference `PROGRAM_ACCOUNTS_AND_ACCESS.md`.

### 1.4 Dashboard "Completed" + Post-Event Summary IA — built, needs a close-out call
The duplicated post-event recap across the completed Dashboard and the Plus-gated Summary was killed;
Summary is now the single canonical recap in three ranked zones (Recap → Share the results → What's
next). Built 2026-06-07. Pairs with the Help program's unbuilt **post-event wrap-up "Next steps" row**
(`PROGRAM_HELP_AND_ONBOARDING.md` §1.3) — finish them together.

### 1.5 Dashboard completion guidance — shipped, 3 open questions unresolved
The "you're ready to finalize" card is live, but three design questions were never answered and the
build shipped on recommendations. Worth confirming rather than leaving implicit — see §2.

### 1.6 Event Settings UX cleanup — residual
Main item on file: flip the master coach-email switch to a **positive** label ("Automatic coach emails")
while the persisted value stays `coach_email_pause_all`. UI only, no migration. Confirm whether it landed.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| OE-1 | **Premature "ready to finalize"** — if an organizer finishes pool play but hasn't built the playoff bracket yet, should the dashboard still say "ready to finalize"? | Suppress until the bracket exists. Telling someone they're done when they aren't is worse than staying quiet. |
| OE-2 | **"Mark tournament complete" CTA behaviour** — deep-link to the existing audited confirmation in Settings, or build an inline dashboard confirm? | Deep-link to the existing confirmation. Don't build a second destructive-action path. |
| OE-3 | **"Up Next" when nothing is left today** — hide the panel, or fall back to the next scheduled day's first games (date-labelled)? | Hide it. A mid-tournament lull shouldn't surface next week's games. |
| OE-4 | **"Needs a Score" styling weight** — gentle neutral nudge, or warning accent? | Warning accent — it's an action bucket, not information. |
| OE-5 | **Fix the capability-override editor** so `org_settings` and `billing` stop appearing grantable, or change the policy to actually allow granting them? | Fix the editor. The owner-only reservation is the deliberate decision. |
| OE-6 | **Admin IA multi-module nav — standalone project or folded into League/Club?** | Fold into the League/Club early-access work. It's the same customer problem and shipping it separately means shipping it twice. |
| OE-7 | **User Management UX priority.** Small effort, early-funnel surface, currently has a dead-end empty state. | Do it — it's a cheap fix on a screen every new org sees. |

---

## 3. Verification debt

Dashboard game-status sections (Now Playing / Up Next / Needs a Score) · dashboard completion
guidance · post-event summary IA · admin role parity Phases 1–2. All live in production; close with
one organizer-side pass.

---

## 4. Shipped — reference only

- **Dashboard Game-Status Sections** — the single "Now Playing" board split into three honest, customizable sections: Now Playing (in-window / being scored), Up Next (next scheduled, not started), Needs a Score (past-window unscored, including prior days). Saved layouts migrated cleanly.
- **Dashboard "Ready to Finalize" guidance** — the top card is now completion-driven rather than calendar-driven, with a direct "Mark tournament complete" path. Forfeits count as resolved.
- **Post-Event Summary IA** — one canonical recap in three ranked zones; the duplicate on the completed Dashboard removed.
- **Admin Role Parity P1–P2** — admins can manage a tournament's Public Site (logo, hero, theme, page visibility) exactly like the owner; admins can archive completed tournaments; billing checkout and the Stripe portal are now enforced owner-only on the **server**, not just hidden in the UI. Owner-exclusive powers unchanged.
- **Draft launch checklist guidance** — see `PROGRAM_HELP_AND_ONBOARDING.md`.

---

## 5. Source files consolidated (archive candidates)

`DASHBOARD_SUMMARY_IA_PLAN.md` · `DASHBOARD_SUMMARY_IA_PM_BRIEF.md` ·
`DASHBOARD_COMPLETION_GUIDANCE_PLAN.md` · `DASHBOARD_COMPLETION_GUIDANCE_PM_BRIEF.md` ·
`DASHBOARD_GAME_STATUS_SECTIONS_PLAN.md` · `DASHBOARD_GAME_STATUS_SECTIONS_PM_BRIEF.md` ·
`ADMIN_IA_MULTIMODULE_NAV_PLAN.md` · `ADMIN_IA_MULTIMODULE_NAV_PM_BRIEF.md` ·
`ADMIN_ROLE_PARITY_PLAN.md` · `ADMIN_ROLE_PARITY_PM_BRIEF.md` ·
`USER_MANAGEMENT_TOURNAMENT_UX_PLAN.md` · `USER_MANAGEMENT_TOURNAMENT_PM_BRIEF.md` ·
`EVENT_SETTINGS_UX_CLEANUP_PLAN.md` · `EVENT_SETTINGS_UX_CLEANUP_PM_BRIEF.md`

> **Keep active:** `ADMIN_IA_MULTIMODULE_NAV_PLAN.md` + `USER_MANAGEMENT_TOURNAMENT_UX_PLAN.md` —
> both are unstarted and their plans are build specs, not history.
