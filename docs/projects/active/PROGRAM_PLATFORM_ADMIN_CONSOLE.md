# Program — Platform Admin Console (operator surface)

> **Consolidated 2026-07-28.** Replaces `PLATFORM_ADMIN_WALKTHROUGHS.md` (53 KB working document).
> **Scope:** outstanding work only. Shipped work appears as one-line reference in §3.
> **Audience:** you, operating the platform — not org admins.

---

## 0. Ground truth (verified 2026-07-28)

This was an owner-driven manual QA of the operator console by support persona: ~25 issues
pre-identified by a 7-area code map, then walked area by area with a fix-as-we-go loop. Most fixes are
built and — since `dev` is only 8 commits ahead of `origin/master` — **live in production**. The
document carries a long tail of `🔧 fixed, verify pending` markers from late June that were never
struck through.

The walkthroughs themselves are **not exhausted**: several areas were never walked.

---

## 1. Outstanding work

### 1.1 Unbuilt gaps

- **Per-org team cap has no operator control (H3).** For a Club or Association negotiating a ">30 teams"
  deal, there is **no field to view or set the per-org team cap** — the operator is blind and cannot
  honour the deal without direct DB access. The widget was deferred; it is still deferred.
- **Cannot remove the only stored staff user (A.2).** Removing a lone Support teammate is blocked with
  "Cannot remove the last active platform admin" even when that person isn't the last admin. Footgun.
- **Founding-season campaigns aren't editable in the UI (6.2).** The 10 Scheduled-Sends campaigns
  (subject, timing, audience) are code-only. Scoped to `/plan` 2026-06-29; never built. This matters
  because the founding-season email calendar needs re-anchoring — see
  `PROGRAM_BILLING_AND_ENTITLEMENTS.md` §BL-6.
- **Audit text search (M4)** — noted as remaining after the audit walkthrough completed.

### 1.2 Verification tail
A long list of fixes carries `🔧 verify pending` from 2026-06-28 / 06-29 / 07-08 and has been live in
production since: timed-grant system enabled (H7), Comp Period signpost, "Module Trial" → plan-shaped
vocabulary relabel, revoke silent no-op + attribution fix (H5), expired-override auto-drop + warn-ahead
(H4), past-expiry rejection, operator reset-password link dead-end fix, single "Export ▾" dropdown on
Observability/Issues and Audit, observability filter no longer full-page-reloads, audit action names
rendered friendly in the dropdown, checkbox-label font, "Open Admin" impersonation-looking link removed.

**Close these as one pass, not fourteen.**

### 1.3 Walkthroughs not yet run
The document is structured as area-by-area walkthroughs; areas 1–6 have activity recorded but the
project was never formally closed. Decide whether to finish the remaining walks or accept current
coverage — see **PA-3**.

---

## 2. Decisions required from you

| # | Decision | Recommendation |
|---|----------|----------------|
| PA-1 | **Build the per-org team-cap operator control?** Today a ">30 teams" Club deal can't be honoured without direct database access. | Build it. It's small, and the alternative is you hand-editing production. |
| PA-2 | **Founding-season campaign editing in the UI** — build it, or keep campaigns code-only and edit by deploy? | Keep code-only. You're the only operator and a deploy is cheap; a campaign editor is a lot of surface for one user. |
| PA-3 | **Finish the remaining operator walkthroughs, or close the project at current coverage?** | Close it. The high-value findings are fixed; further walking has diminishing returns until the customer base grows. |
| PA-4 | **Fix the "cannot remove the last staff user" block?** | Yes — small, and it's the kind of thing that bites at the worst moment. |

---

## 3. Shipped — reference only

Timed-grant system enabled by default (was silently off, making all module/status overrides no-ops) ·
Comp Period selection now explains itself · "Module Trial" vocabulary reframed around plans, not
modules · override revoke actually revokes, errors surface, attribution correct · expired overrides
auto-drop out of Active with a warn-ahead · past expiry dates rejected at save · operator
reset-password link no longer dead-ends at Sign In · single "Export ▾" dropdown (Excel + CSV) on
Observability/Issues and Audit · observability filter no longer reloads the page and scrolls to top ·
audit action dropdown shows friendly names · stale tournament-slot cap override per org ·
team_limit silent-wipe fixed · `/review` high-risk tier passed on the override write paths.

---

## 4. Source file consolidated (archive candidate)

`PLATFORM_ADMIN_WALKTHROUGHS.md`

> **Keep active** only if you choose PA-3 = "finish the walkthroughs". If you close the project,
> archive it — the shipped record above is sufficient.
