# Platform-Admin Manual Walkthroughs + Bug Hunt

> **Created:** 2026-06-23 · **Owner-driven QA pass.** You execute these as different support personas; report findings back (template at the bottom); I fix.
> Grounded in a full code map of `platform-admin` (7-area parallel sweep, 2026-06-23). The "Pre-identified issues" below were **confirmed in code by that map** — verify them first, they're the highest-yield.

## How to use this
- Each walkthrough is a **task a real support person would do**, with the click-path, what a **correct** result looks like, and a **⚠ Watch for** list (the specific ways it can break).
- You don't have to do them all or in order. The **Pre-identified issues** section is the fast path — those are already-confirmed suspects; the walkthroughs are how you reproduce/feel them and catch what the code map couldn't (real UX friction, confusing copy, cross-screen feel).
- Spin up a couple of throwaway test orgs at different plans (Tournament, Tournament Plus, Club, Club · Association) before you start — most flows need one.

---

## Pre-identified issues (already confirmed in the code map — triage)

Disposition key: **[FIXED]** done this pass · **[SWEEP]** trivial club_large/label cleanup, I can batch on your go · **[DECISION]** real issue but needs a product call before I fix · **[FIX]** clear fix, queued for after you confirm.

### High severity
| # | Where | Issue | Disposition |
|---|---|---|---|
| H1 | Org detail → Plan & Limit; Plans & Pricing → Limits panel | **Stale limit shows a finite cap on an "unlimited" plan** (e.g. Tournament Plus showing "1") when an org carries a leftover stored limit. *(The one you found.)* Fix per-org by setting the field to 9999; I can also harden the rule so an upgrade clears it. | **[DECISION]** per-org now vs. global hardening |
| H2 | Org detail → plan save | **A custom team cap was silently wiped on any plan/limit save** (the form never re-sent it). | **[FIXED]** |
| H3 | Org detail | **No field to view/set the per-org team cap** for a Club · Association ">30" deal — operator is blind. | **[FIX]** build the input + readout (the deferred widget) |
| H4 | Org detail → Active Overrides | **Expired comps/overrides stay in the "active" list forever** — no auto-revert; a customer who stopped paying can keep comp access until someone manually revokes. | **[DECISION]** auto-revert vs. keep warn-only |
| H5 | Org detail → Revoke override | **Revoke can silently do nothing** (no check that a row actually changed) **and shows no error if it fails** — operator sees "done" when it wasn't. | **[FIX]** |
| H6 | Org detail → Add Override → "Comp Period" | **Comp Period grants nothing to access** (it only tags the Founding cohort) but the form reads like it grants access. | **[FIX]** signpost the form |
| H7 | All overrides | **The whole timed-grant system is off by default** (a safety flag), so module/status overrides currently have **no real effect** — with no on-screen note saying so. | **[DECISION]** add a signpost / confirm intended |
| H8 | Plan gating vs. customer billing page | **Flipping a plan "Live" in platform-admin does NOT flip the customer's upgrade page** — it still says "Coming soon" until a code deploy. Directly relevant to launching Club. | **[DECISION]** make billing page read the live toggle |
| H9 | Early-access leads | Club · Association leads showed a raw code; "Team" instead of "Coaches Portal." | **[FIXED]** 2026-06-23 |
| H10 | Marketing email audience | A Club · Association org would have wrongly received the "upgrade to Club" email. | **[FIXED]** 2026-06-23 |
| H11 | Dev-tools seeder + Agent Playbook | Stale $179 Club price + Club · Association absent (couldn't seed it). | **[FIXED]** 2026-06-23 (one internal badge label still cosmetic) |
| H13 | Org feature gates (org venue library, league/club settings) | **A Club · Association org was being denied org-venue + league/club settings features** — those gates hardcoded only league+club. | **[FIXED]** 2026-06-23 |

### Medium severity
| # | Where | Issue | Disposition |
|---|---|---|---|
| M1 | Customer Users screen | Org plan shown as a raw code ("club_large") instead of the label. | **[FIXED]** 2026-06-23 |
| M2 | Bulk operations → Plan Change | Silently **resets a custom tournament limit** and **leaves a stale Stripe link** on paid→paid moves, with no preview warning. | **[FIX]** add warning + Stripe note |
| M3 | Platform roles | The **Billing role can also ban/reset/edit customers** (it carries support powers) — may be wider than intended. | **[DECISION]** scope the role |
| M4 | Audit log | **Text search only searches the current page** (100 rows) — a real action can look like it never happened. | **[FIX]** |
| M5 | Org detail → Cancel | **Cancel button hidden** when an active paid org has lost its Stripe link — no in-UI path to cancel. | **[FIX]** |
| M6 | Org detail → plan change | Setting a plan to **"Coaches Portal" doesn't clear the old Stripe link** (only the free Tournament downgrade does) — could leave a paid sub attached to a near-free plan. | **[DECISION]** |
| M7 | Customer Users / Approval queue | **Silent caps**: customer-user list cut at 1000, approval queue at 20 — older items invisible with no warning. | **[FIX]** |

*(A handful of low-severity items — page-scoped "in view" counts, a snapshot button that doesn't reset, a couple of internal label nits — are logged in the full map and not worth your manual time; I'll fold them into the sweep.)*

---

## Walkthroughs by support persona

### Persona 1 — Billing & Plan Support
*Day-to-day: plan changes, limits, cancellations, "why can't this customer do X."*

**1.1 — Upgrade a free org to Tournament Plus and confirm the limit corrects**
- **Goal:** a paying customer can create more than one tournament after upgrade.
- **Steps:** Orgs → search the org → View → note **Current Plan** + **Current Limit** → pick **Tournament Plus** in the Plan dropdown → confirm the Limit field pre-fills to **9999** → enter a reason → Review Change → Apply.
- **Correct:** Current Limit reads **Unlimited**; the snapshot "Tournaments" shows no finite cap; the Activity tab logs the old→new limit.
- **⚠ Watch for:** Current Limit still shows a small number (e.g. "1") on Tournament Plus **[H1]**; plan dropdown still shows the old plan after save; confirmation modal shows the wrong "from" plan if the page sat open a while.

**1.2 — Move a Club org up to Club · Association and set a custom team cap**
- **Goal:** verify the band moves and a ">30 team" custom deal can be honored.
- **Steps:** open a `Club` org → Billing & Access → set Plan to **Club · Association** → reason → Apply → confirm the header reads **Club · Association** (not a raw code) → then look for any **Team Limit** field to set a custom cap (e.g. 40).
- **Correct:** header shows "Club · Association"; you can see and set the team cap.
- **⚠ Watch for:** **no Team Limit field exists anywhere [H3]** — note this as the gap; the header shows "club_large" raw **[label]**; (the old silent-wipe of a custom cap on re-save is now **[H2 FIXED]** — but please confirm: set a cap via a test, then do an unrelated limit save, and check the cap survives).

**1.3 — Cancel a paid subscription and confirm retention**
- **Goal:** process a churn: cancel, archive tournaments, set the retention window.
- **Steps:** open an active paid org with a Stripe link visible → Billing & Access → **Cancel Subscription…** → review the preflight (plan label, tournaments to archive, retention days) → reason → optionally email the owner → Confirm → refresh.
- **Correct:** status badge → "canceled"; the Cancel section disappears; the org's tournaments show "archived"; Stripe shows the sub canceled; a stripe-warning banner only appears if Stripe failed.
- **⚠ Watch for:** Cancel button **missing** for an active org (lost Stripe link) **[M5]**; the preflight plan label disagrees with the header; tournaments still show un-archived after refresh.

---

### Persona 2 — Entitlements & Comps
*Grants, trials, founding-season comps, overrides.*

**2.1 — Grant a timed module trial and observe whether it actually unlocks**
- **Goal:** give an org temporary House League access for evaluation.
- **Steps:** open a Tournament-plan org → Billing & Access → **+ Add Override** → "Module Trial (timed)" → check **House League** → expiry 1 hour out → reason → Apply → then open that org's admin in a new tab and look for House League.
- **Correct (today):** the override is listed — but the org likely does **not** actually get House League, because the grant system is off by default **[H7]**.
- **⚠ Watch for:** the form copy says "access turns on now" with **no note that grants are currently disabled [H7]**; House League unexpectedly appears (means the flag got turned on).

**2.2 — Apply a Founding-Season comp and check the cohort badge**
- **Steps:** open an org → + Add Override → **Comp Period** → expiry 2026-12-31 or later → reason → Apply → go back to the Orgs list → look for the **Founding** badge.
- **Correct:** override listed; Founding badge appears on the list.
- **⚠ Watch for:** comp added but **no Founding badge** (date-cutoff mismatch); **no note that Comp Period grants no access [H6]** — operators may think they comped something they didn't.

**2.3 — Revoke an expired override and stress the failure path**
- **Steps:** find an org with an **expired** override (Orgs → "Expired overrides" filter, or add one with a past expiry) → Billing & Access → confirm it's still in the **Active** list with an "Expired — revoke or extend" warning → Revoke → confirm.
- **Correct:** it moves to revoked history; the count drops.
- **⚠ Watch for:** it **stays in "Active" after expiry [H4]**; Revoke shows success but the item reappears on reload **[H5 silent no-op]**; "revoked by" shows "superuser" instead of your email until refresh; if the revoke errors, **no error message appears [H5]**.

---

### Persona 3 — Catalog & Pricing Ops
*Plan gating, Stripe prices, change-requests, feature matrix, campaigns.*

**3.1 — Toggle a plan from Early Access to Live and verify it opens checkout *everywhere***
- **Goal:** confirm "Live" actually reaches customers (this is the Club-launch flow).
- **Steps:** Plans & Pricing → open a plan (e.g. League Plus) → request "Live" → approve it in the Change-requests queue → reload, confirm it shows **Live** → then check **three** customer surfaces: the public `/pricing` page, a checkout attempt, and a test org's **billing upgrade card**.
- **Correct:** all three reflect "live."
- **⚠ Watch for:** the **billing upgrade card still says "Coming soon"** even after the toggle **[H8]** — this is the big one for Club launch; the approval request sits unreviewed with no notification.

**3.2 — Assign a Stripe price ID to Club · Association through the approval trail**
- **Steps:** Plans & Pricing → **Club · Association** → Pricing → Production tab → the monthly slot ("Not set") → enter a `price_…` ID → submit for review → approve in the queue → confirm it shows "Configured."
- **Correct:** request flows needs-review → approved → implemented; the slot shows the price ID; audit logs it.
- **⚠ Watch for:** a live key validates the price against Stripe (wrong-environment ID errors); the catalog price ($379) and a mismatched Stripe price aren't flagged side-by-side; the queue only shows 20 requests **[M7]**.

**3.3 — Audit unlimited plans for a stale finite limit**
- **Steps:** Plans & Pricing → scan the Limits column for Tournament Plus / League Plus / Club / Club · Association → open any showing a finite number → if it shows e.g. "1 slot," that's a leftover override → clear it (blank the field → submit → approve).
- **Correct:** unlimited plans read "9999 / unlimited"; an "override" tag only where you deliberately set one.
- **⚠ Watch for:** any unlimited plan showing a small cap **[H1/H12]**.

---

### Persona 4 — Access & Lifecycle Support
*Customer accounts: logins, bans, password resets, notes, ownership.*

**4.1 — Ban a customer after an abuse report, then verify**
- **Steps:** Customer Users → search by email → confirm "active" badge → Actions → Ban User → confirm → refresh → confirm "banned" + a support note with the ticket #.
- **Correct:** badge → "banned"; Actions now offers "Unban"; audit logs `ban_user`.
- **⚠ Watch for:** the user **doesn't appear in search at all** (list silently capped at 1000) **[M7]**; the customer's org plan shows as a **raw code** like "club_large" **[M1]**; Actions disabled because the email is "(unknown)."

**4.2 — Unblock a locked-out customer (reset + confirm email)**
- **Steps:** Customer Users → find the user → Actions → **Reset password** (copy the one-time link, share securely) → and/or **Confirm email** if they can't receive the verification.
- **Correct:** a setup/reset link is generated; after confirm, the "email confirmed" state updates.
- **⚠ Watch for:** the link is shown once and not stored — if you navigate away you must re-issue; any action that says success but the badge doesn't change on refresh.

---

### Persona 5 — Platform Users & Roles
*Internal staff accounts, dev tooling.*

**5.1 — Invite a new internal teammate and hand off their setup link**
- **Steps:** Users (super-admin only) → Add User → name, work email, Role → Create → **copy the setup link** (shown once) → share it securely.
- **Correct:** new row with the right role; the link is a one-time password-setup link (no email is auto-sent).
- **⚠ Watch for:** the button says **"Create" not "Invite"** and **no email is sent** — easy to assume otherwise; if the email already exists as a customer, you'll get an error.

**5.2 — Seed a Club · Association test org (dev-tools)**
- **Steps:** Dev Tools → Seed "Org + Owner" → look for a **Club · Association** tile.
- **Correct:** a Club · Association tile at $379/mo exists; a seeded org shows the right badge/colour.
- **⚠ Watch for:** **no Club · Association tile [H11]**; Club shows **$179** (stale) **[H11]**; a seeded club_large org badges as "club large" in the wrong colour **[M-low]**.

---

### Persona 6 — Reliability, Triage & Daily Health
*Errors, feedback, leads, audit, the morning health check.*

**6.1 — Triage a critical error end-to-end**
- **Steps:** Observability → check the freshness chip (amber = stale data) → open the top-severity issue → read route/affected-orgs/stack → check related feedback → Resolve / Snooze / Ignore.
- **Correct:** the badge updates immediately; resolved issues leave the default view.
- **⚠ Watch for:** an **expired snooze** that's counted as "open" but hidden under the default filter; a Resolve button that isn't disabled for a view-only role.

**6.2 — Send a marketing email and verify the audience**
- **Steps:** Email → find `spotlight_club_last` → check its Recipients count → it should be **lower** than the full founding count (it excludes orgs already on Club) → preview (confirm "from $219/month," no $379) → Send.
- **Correct:** recipient count is materially lower than the full founding list.
- **⚠ Watch for:** the count equals the full founding count — meaning **Club · Association orgs aren't excluded and would get an "upgrade to Club" email [H10]**.

**6.3 — Audit-log investigation: trace a plan change**
- **Steps:** Audit → paste the org ID → pick the plan-change action → set a date range → Filter → expand Old/New values → Export if needed.
- **Correct:** the row shows actor, timestamp, and before/after plan.
- **⚠ Watch for:** the action dropdown shows a **raw key** not a friendly name; a **text search returns nothing** even though a row is right there (search only covers the loaded page) **[M4]**.

**6.4 — Morning health check (Overview)**
- **Steps:** Overview → read the Action Queue tiles (past-due, expired overrides, trials ending, missing owners) → click an amber tile to jump to the filtered list → check the Plan Mix includes Club · Association → take today's metric snapshot.
- **Correct:** tiles reflect live counts; Club · Association appears if any exist.
- **⚠ Watch for:** an expired-override count > 0 that isn't amber; Estimated MRR that looks high (legacy Club orgs counted at the new $219 even if still on old pricing — a known heuristic limitation).

---

## How to report findings (so I can fix fast)

For each thing you hit, jot:

```
[Walkthrough # or screen] — short title
What I did: <the step>
What happened: <what you saw>
What I expected: <correct behaviour>
Severity (your gut): blocker / annoying / cosmetic
Screenshot: <if handy>
```

Batch them however you like (per persona, per session). Anything matching a **[H#]/[M#]** above is already confirmed — just note "confirmed H4" and I'll prioritize. New ones I'll reproduce, classify, and fix.
