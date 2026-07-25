# Build Prompt — The Flip, Phase 1: foundation + the admin loop

Paste this into a fresh chat to build Phase 1 of the ratified Role⇄Public navigation project.

---

You are building **Phase 1 of "The Flip"** — the unified role⇄public navigation ratified by the owner on 2026-07-22.

## Read first (in this order)
1. `docs/projects/active/ROLE_FLIP_NAVIGATION_PLAN.md` — the full spec; Phase 1 = §5 P1, items 1–8. The twin mapping (§3), identity rules (§4), and risks (§7) are binding.
2. `memory/design_decisions.md` — the 2026-07-22 entry **"The Flip RATIFIED"** (binding decision + explicit non-amendments) and the 2026-07-22 warm-default entry (context for later phases).
3. The visual spec is the owner-approved artifact `claude.ai/code/artifact/23f4dbce-60dd-42c1-b9ec-7ca6597651e7` (rev 2) — the plan restates everything you need; do not deviate from the plan's labels/copy.
4. `git status` + `git log --oneline -5` before touching anything — `dev` carries concurrent uncommitted work (warm portal, seam WI-2C). You work on `dev` (never another branch), stage **explicit pathspecs only**, and **never commit without an explicit owner OK**.

## Phase 1 scope (admin side only — public pages and coach shells are P2/P3, do NOT touch them)
1. **`lib/flip-twins.ts`** (new) — the bidirectional page-twin resolver from plan §3: pure function over (pathname, direction, hat kind, context), returns `{href,label}` or a two-target set for admin Results; handles gameId passthrough (`?highlightGameId=`), staff-capability fallback (nearest permitted screen), draft→preview mapping, and the `Public · Overview` fallback for unmapped admin screens (pill is NEVER absent in the shell). Unit-test the mapping table both directions.
2. **`components/shared/FlipPill.tsx`** (new, one CSS module) — pill + anchored popover (multi-hat/two-target) + return-memory read (`⇄ Back to {label}` from a sessionStorage snapshot with stateless fallback). Server-fed mode only this phase (admin routes are authenticated; no client identity fetch needed). Neutral system styling per the artifact — never event-brand colored. Same-tab `<Link>`s only.
3. **Admin mobile top bar** (`components/admin/AdminMobileTopBar.tsx`): notification bell moves OUT → the pill takes that slot (`⇄ Public · {page}` / `⇄ Preview · {page}`; from Results it opens the two-target chooser Schedule·Standings). Bell becomes a **"Notifications" row in the More sheet** (`AdminBottomNav.tsx`) with its unread count, and the unread count also badges the More tab (reuse the existing draft-phase chat-unread bubble-up pattern). Keep `NotificationBell`'s feed/see-all/settings behavior intact — it's a relocation, not a rebuild. Desktop sidebar bell unchanged.
4. **Admin desktop**: pill top-right of the content header area; **delete** the sidebar-footer "View Site"/"Preview Site" link (`AdminSidebar.tsx`).
5. **Same-tab everywhere**: remove `target="_blank"` (+ new-tab aria copy) from every admin→public call site. Keep ONE mirror row in mobile More — page-matched via the resolver, same-tab, labeled to match the pill.
6. **`AdminContextStrip.tsx`**: new transient candidate — after a score save/finalize on Results, show `✓ Score saved — See it live ›` deep-linking the public game with the highlight param; highest priority; clears on navigate/dismiss. Existing candidates and dismiss plumbing unchanged.
7. **Dirty-form guard BEFORE item 5 ships**: the admin Schedule editor + Communication composer must warn on in-app navigation with unsaved changes (the old new-tab behavior accidentally protected them). Without this, same-tab flips can silently destroy work — treat as a blocker, not polish.
8. **Preview shell**: small fixed "Exit preview → Dashboard" pill in the draft-tournament preview shell (seam B14). The preview stays otherwise identity-chrome-free (P0-3) — this is navigation, not identity.

## Constraints
- **NO migration.** No public-page or coach-shell changes this phase. No changes to the consumer 4-tab bar, ever.
- Sport-neutral copy; CSS modules only; match surrounding code style.
- `npm run verify:changed` + `npm run typecheck` (shared modules touched). Dev-server restart rule applies (new files + shared modules → stop server, `rm -rf .next`, restart before owner testing).
- After building: offer `/review` (HIGH — navigation + the notification relocation) and `/docs` (admin help describes the bell and View Site today; flag it, but full help re-sync is scheduled for P4 — only update copy that would be actively WRONG after P1).
- Completion summary to the owner in product-owner voice (UX outcomes, not files), ending with the P1 slice of the owner QA script (plan §9, steps 1–2 + 6).

## Definition of done
- On every admin screen (mobile + desktop), the pill is present top-right, page-matched, same-tab; unmapped screens fall back to `Public · Overview`; drafts read `Preview`.
- Finalizing a score surfaces the one-tap "See it live" nudge landing on that game, highlighted, on the public schedule.
- No `target="_blank"` remains on any admin→public path; browser back returns cleanly.
- Mobile notifications: bell gone from the top bar; More shows the row + unread badge; feed/see-all/settings all work.
- Dirty schedule/composer edits prompt before a flip navigates away.
- typecheck + verify:changed green; NOT committed (owner reviews first).
