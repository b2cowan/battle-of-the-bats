# Next-chat prompt — FP-3 Volunteer Day-of Experience

> Copy everything below the line into a new chat. It starts with a product-owner-facing UX summary (read this first), then the engineering brief.

---

Take on **FP-3 — Volunteer Day-of Experience**, the next fix-project from the Platform-Wide User Journey Audit. FP-1 (Trust & Integrity) is complete; the audit's Wave 2 fix-projects now open in parallel and FP-3 is the chosen next track. **Before writing any code, present the Product-Owner UX summary below to confirm scope, then produce an implementation plan + a PM brief** (AGENCY_RULES requires both for a feature project).

## 1. What this is, for a Product Owner (read first)

**Who it's for:** the two least-trained people on the most stressful day — a parent handed a phone at the scoring table (the *scorekeeper*) and a parent handed a phone at the gate (the *gate volunteer*). They were invited yesterday, got one email, and have never seen the product. The field surfaces work fine on the happy path; FP-3 fixes every place the day deviates from "one trained volunteer, one job, never logs out" and the person is left stranded with no exit, no signpost, and copy written for an admin.

**What changes for these users (plain language):**

- **They can actually sign out.** Today the "Sign Out" button on both volunteer screens is a dead link that 404s — so a volunteer handed a *borrowed or shared phone* cannot end their session, leaving their access live for the next person. This is the headline fix (a privacy/security hole, not just an annoyance). *(Blocker — J8-001.)*
- **A session that expires mid-shift recovers gracefully.** If the phone sits idle between innings and the login lapses, the screen currently dead-ends on "Sign in required" with no button. After: a clear way back in. *(J8-002.)*
- **The gate roster stops silently destroying data.** "Edit roster at the gate" currently wipes the team's whole roster and re-saves it as gate-entered — overwriting what the coach submitted. After: editing is non-destructive and the destructive action looks like one (it's currently a faint text link). *(J8-010, J8-011.)*
- **Score entry becomes usable under pressure.** The two score boxes are nearly invisible, tiny, and have no +/− steppers; a never-trained volunteer can't tell where to tap. The "needs admin review" note is grey body text that's easy to miss. After: high-contrast inputs with thumb steppers and a visible policy note. *(J8-006/007/008.)*
- **The screen tells you which game is "now."** Five identical game cards with no "now" signal — the volunteer can't tell at a glance which one to score. After: a clear current-game indicator. *(J8-006.)*
- **"Mark paid" at the gate is undoable** like every other gate action, so a fast-queue misclick is recoverable. *(J8-016 — reconciles with the mark-paid fix already shipped in FP-1/J5-026.)*
- **Volunteers land on the right screen.** Copy promises an "assigned games" model that doesn't exist; an `official` who opens the admin URL hits a blank dead-end hub, while a `staff` gate volunteer wrongly sees the full admin dashboard. After: honest copy and right-door wayfinding for each role. *(J8-003, J8-019/020/021.)*
- **Completed/draft events read clearly** (read-only banner; the picker shows status so a volunteer isn't dropped onto a draft). *(J8-014/015/017.)*
- **Polish:** PWA install opens the field screen (not the generic hub); the "list self-updates" promise actually works. *(J8-004/005.)*

**Access/role differences:** affects the `official` (scorekeeper + gate) and `staff` (gate) roles. No change for owners/admins. Role→surface mapping is explicitly corrected so each volunteer role lands on the surface it's entitled to.

**Success criteria:** a volunteer on a borrowed phone can sign out; a lapsed session recovers; the gate roster edit preserves coach data; score entry is usable without training; each volunteer role reaches the right screen with honest copy. Most of this is "a trust-breaking dead-end stops happening," not new features.

**Scope / size:** 23 findings — **1 Blocker · 10 High · 9 Med · 3 Low**. Smallest of the Wave-2 projects. Surfaces: `app/[orgSlug]/scorekeeper/**` and `app/[orgSlug]/check-in/**` (owned by no existing plan).

## 2. Engineering brief

**Source of truth (read these first):**
- The findings: `docs/projects/active/journeys/JOURNEY_J8_SCOREKEEPER_GATE.md` (each row has file refs, repro, and a suggested direction).
- Cross-cutting context + FP-3 charter: `docs/projects/active/USER_JOURNEY_AUDIT_SYNTHESIS.md` (§ "FP-3 — Volunteer Day-of Experience", and the Wave-2 / coordination-seam notes).
- FP-3 is a NEW project — create its plan + brief: `docs/projects/active/FP3_VOLUNTEER_DAYOF_PLAN.md` + `_PM_BRIEF.md`, and add a one-line link in `TODO.md`.

**The full FP-3 finding set:** J8-001 (Blocker, Sign-Out 404), J8-002 (session-expiry dead end), J8-010/011 (destructive gate-roster + faint affordance), J8-006/007/008 (score-entry ergonomics + "now" signal + policy note), J8-003 (false "assigned" model copy), J8-014/015/016/017 (gate honesty: read-only banner, picker status, undoable mark-paid, empty-state agency), J8-019/020/021 (wrong-door / role→surface mapping), J8-004/005 (PWA start_url, realtime publication).

**Already done — do NOT redo (continuity from FP-1):**
- **J8-018** (cross-org login loop) — DONE in FP-1 (`getAuthDestination` + login already-auth guard + `/auth/suspended`). The volunteer-shell `redirect('/auth/login?next=…')` now resolves safely; verify it holds for these two shells, but the loop fix itself is shipped.
- **J8-016** mark-paid reconcile builds on FP-1's `lib/mark-paid.ts` (`markPaidInFullPatch`) — reuse it; the gate's `mark_paid` already routes through the shared helper. FP-3's job is the *undo* affordance.

**The Blocker (start here) — J8-001:** both volunteer shell headers render `<Link href="/auth/logout">`, but **no `/auth/logout` route exists** (confirmed). Every other shell signs out via the `signOut()` client call (`lib/auth.ts:40-43`). Fix both shells in one pass — either switch the headers to the `signOut()` pattern (preferred — matches the rest of the app) or add a real `/auth/logout` route. Files: `app/[orgSlug]/scorekeeper/layout.tsx:110-123`, `app/[orgSlug]/check-in/layout.tsx:85-90`.

**Suggested phasing** (one reviewable commit per coherent group; lead with the Blocker):
1. **Exits & recovery** — J8-001 (Sign-Out, Blocker) + J8-002 (session-expiry) — the "stranded with no exit" cluster.
2. **Gate roster safety** — J8-010 (non-destructive edit, preserve coach provenance) + J8-011 (make the destructive action look like one).
3. **Score-entry ergonomics** — J8-006/007/008 (now-signal, contrast + steppers, policy note).
4. **Gate honesty** — J8-014/015/016/017 (read-only banner, picker status, undoable mark-paid, empty-state copy).
5. **Right-door wayfinding** — J8-003 (drop the false "assigned" copy) + J8-019/020/021 (role→surface mapping; coordinate with FP-7, which owns the org-level routing decision — FP-3 owns the shell half).
6. **Polish** — J8-004 (PWA start_url) + J8-005 (add `games` to the `supabase_realtime` publication — needs a migration; follow the schema-dictionary + snapshot rules).

**Coordination seam (from synthesis):** volunteer wrong-door — FP-3 owns the shell half (J8-019/020/021); FP-7 owns the org-level routing. Don't build FP-7's routing decision here.

## 3. Operational rules (important)

- **Branch:** start FP-3 on its OWN branch off `master` — `git checkout master && git pull && git checkout -b fix/fp3-volunteer-dayof`. Do **NOT** continue on `feat/free-tier-coaches` (it became a 101-commit catch-all integration branch holding ~5 unrelated initiatives + concurrent agents; owner decision 2026-06-15 is one-branch-per-initiative going forward). See memory `feedback_branch_per_initiative`.
- **Plan-first + PM brief** before code (AGENCY_RULES, blocking). Present the §1 UX summary in-conversation first.
- **Next 16 conventions** — read `node_modules/next/dist/docs` before touching route/params/proxy behavior (`params` is a Promise; `proxy.ts` not `middleware.ts`).
- **Schema changes** (J8-005 realtime publication) MUST update `DATA_DICTIONARY.md` + `npm run refresh:snapshots`; apply migrations dev-first via `scripts/apply-migration-api.mjs` (prod only on explicit request); `check:migrations` gates release.
- **Verify per tranche:** `npm run typecheck` (shared-module touches), `npm run lint:focused -- <files>`. Restart the dev server after shared-module/new-file/proxy changes (stop → `rm -rf .next` → `npm run dev`; verify `/platform-admin/login?next=%2Fplatform-admin` → 200, no Supabase EACCES).
- **Browser testing is the user's responsibility** unless asked — these are field-ergonomics fixes that need real-device verification.
- **Offer `/review`** after substantive tranches.
- Commit per tranche; end every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Tick each J8 item in the FP-3 plan with its commit ref as it lands.

This is FP-3 of the audit's 7 fix-projects. FP-1 (the serial gate) is done; FP-2/FP-4/FP-5/FP-6/FP-7 remain available to run in parallel afterward.
