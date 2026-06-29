# Platform-Admin Manual Walkthroughs + Bug Hunt

> **Created:** 2026-06-23 · **Owner-driven QA pass.** You execute these as different support personas; report findings back (template at the bottom); I fix.
> Grounded in a full code map of `platform-admin` (7-area parallel sweep, 2026-06-23). The "Pre-identified issues" below were **confirmed in code by that map** — verify them first, they're the highest-yield.
>
> ### Workflow — FIX-AS-WE-GO (updated 2026-06-26, owner directive)
> We **do not batch fixes to the end.** Each finding runs a tight loop: **discover → fix immediately → owner verifies in-browser → mark ✅ Fixed → next task.** Fixing on the spot keeps verification cheap (the owner is already on the screen) and avoids a full re-walk later.
> **Two exceptions are routed/parked, not auto-fixed:**
> - **[DECISION]** items — need an owner product call first (surface the trade-off, don't decide).
> - **Dependency-blocked** items — e.g. billing-path copy owned by `/billing`, visual rules owned by `/design`. Routed via a paste-able prompt; the ratified result lands in a follow-up.
> Clear fixes (copy, CSS/layout, self-contained logic) are done on the spot. `/review` is offered at **logical chunk boundaries** for substantive changes — not per trivial fix. Restart-required changes (shared modules / `proxy.ts` / config) are flagged and the dev server restarted before the owner re-tests.

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
| H6 | Org detail → Add Override → "Comp Period" | **Comp Period grants nothing to access** (it only tags the Founding cohort) but the form reads like it grants access. | **[FIXED]** 2026-06-28 — selecting Comp Period now shows an amber note that it's a billing/founding tag only and grants no module/plan access, pointing operators to Module Trial / Subscription Status to actually unlock. |
| H7 | All overrides | **The whole timed-grant system is off by default** (a safety flag), so module/status overrides currently have **no real effect** — with no on-screen note saying so. | **[DECISION → ENABLE]** 2026-06-28 — owner chose **(B) turn grants on**. Engine is built + wired into all org-build paths + backed by the matching partial index. **Already ON locally** (`.env.local` flag set since 2026-06-12) so module/status grants enforce + auto-revert on localhost today. **Prod remains OFF** — gated `/release` step (Amplify env flag + deploy), deferred by owner to verify locally first. Paired with H6 signpost. |
| H8 | Plan gating vs. customer billing page | **Flipping a plan "Live" in platform-admin does NOT flip the customer's upgrade page** — it still says "Coming soon" until a code deploy. Directly relevant to launching Club. | **[DECISION]** make billing page read the live toggle |
| H9 | Early-access leads | Club · Association leads showed a raw code; "Team" instead of "Coaches Portal." | **[FIXED]** 2026-06-23 |
| H10 | Marketing email audience | A Club · Association org would have wrongly received the "upgrade to Club" email. | **[FIXED]** 2026-06-23 |
| H11 | Dev-tools seeder + Agent Playbook | Stale $179 Club price + Club · Association absent (couldn't seed it). | **[FIXED]** 2026-06-23 (one internal badge label still cosmetic) |
| H13 | Org feature gates (org venue library, league/club settings) | **A Club · Association org was being denied org-venue + league/club settings features** — those gates hardcoded only league+club. | **[FIXED]** 2026-06-23 |
| H14 | Org detail → Plan & Limit ("plan change billing clarity") | **Operators assumed changing the plan changes what the customer is billed** — but the action writes access only and never calls Stripe (charge/proration/cancel). Worse, setting an org to free unlinks the sub from our record while the real Stripe sub keeps charging. | **[FIXED]** 2026-06-26 — added an always-on "this changes access only, not billing" banner, target-aware billing-path warnings (free-comp / re-price desync / stop-billing-via-Cancel), a rewritten confirm modal + success state, and a corrected tooltip. Also logged the in-app paid→paid upgrade-proration gap to BUSINESS_DECISIONS.md (2026-06-26). Upstream peers M2/M5/M6 still open. |

### Medium severity
| # | Where | Issue | Disposition |
|---|---|---|---|
| M1 | Customer Users screen | Org plan shown as a raw code ("club_large") instead of the label. | **[FIXED]** 2026-06-23 |
| M2 | Bulk operations → Plan Change | Silently **resets a custom tournament limit** and **leaves a stale Stripe link** on paid→paid moves, with no preview warning. | **[FIXED]** 2026-06-26 — Plan Change now shows a billing-clarity note (changes access only / resets the tournament limit to the plan default / never calls Stripe / re-price per-org or in Stripe), plus a red stop-billing warning when the target is free. Behavior unchanged; the operator is now warned. |
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

---

## Findings — live capture (owner walkthrough, in progress)

> **Status legend (fix-as-we-go):** ✅ Fixed + owner-verified · 🔧 Fixed, verify pending · 🟡 [DECISION] routed (awaiting owner call) · ⏳ Routed to `/billing` or `/design` (copy/visual pending) · ◻ Open (clear fix, not yet done).

### Phase A — Internal Tooling & Setup (Persona 5 + Dev-Tools) — COMPLETE 2026-06-26

- **A.1 — H11 CONFIRMED FIXED ✅.** Dev-tools seeder shows both new bands at correct prices: **Club $219/mo** and **Club · Association $379/mo** (stale $179 gone; tile present). Operators can seed/test the new band.
- **A.1 — NEW (cosmetic).** Seeding a Club · Association org shows the **raw key "club_large"** in the green success banner ("…(plan: club_large)") and as the org-list **badge text "CLUB LARGE"** instead of the friendly **"Club · Association."** Badge **colour is correct** (Club-family purple) — text only. *Severity: cosmetic (operator-only).* **✅ FIXED 2026-06-28** — org-list badge now uses the proper label helper ("Club · Association"); seed success banner shows the plan's friendly name. (Bonus: removed a latent non-breaking-space bug hiding in the old badge expression.)
- **A.1 — NEW (nice-to-have).** Seed success banner names the org but not its **slug/link** — operator can't click through to the new org. *Severity: cosmetic. Optional.*
- **A.2 — FIXED LIVE 2026-06-26 ✅.** Platform Users table overflowed horizontally ("Invited By" clipped, sideways scroll). Fixed: fixed column widths + truncate-with-tooltip on long values + wrapping action buttons → fits the panel, no horizontal scroll. *(Cosmetic CSS/layout; applied with owner go-ahead.)*
- **A.2 — NEW (annoying / footgun).** **Cannot remove the only stored staff user.** Removing a lone Support teammate is blocked with *"Cannot remove the last active platform admin"* — the guard counts only **database-stored** staff and **ignores the built-in (env) bootstrap super-admin**, and it **mislabels a Support account as "admin."** Real impact: bootstrap-admin + one stored teammate → can't remove that teammate without first adding a second. **Workaround: Deactivate** (no such guard) cuts off access. *Severity: annoying. Not in pre-identified list.* **✅ FIXED 2026-06-28** — the removal guard now counts the configured bootstrap admin as the fallback, so a lone Support teammate can be removed; the message is corrected (no longer mislabels a Support user as "the last admin").
- **A.2 — minor (low).** Create flow: button says **"Create"** while the heading says **"Invite Company User"** (wording mismatch). Setup link **is** shown with a "share with the new user" label + Copy, so the silent-no-email risk is *partly* signposted — could be more explicit ("no email was sent"). *Severity: cosmetic/low.* **✅ FIXED 2026-06-28** — card heading is now **"Add Company User"** (consistent with the "Create" button) with a persistent note: *"No email is sent. After creating, copy the one-time setup link and share it securely."*

### Cross-cutting — checkbox-label font (cosmetic) — FIXED 🔧 2026-06-28 (verify pending)

- **Checkbox/radio labels rendered in the wrong (browser-default) font + size** on the org-detail screen — spotted first on the Cancel modal's notify checkbox, then on the **Add Override → "Modules to grant"** options (Public Site / House League / Accounting / Rep Teams) and the two **Delete-Org** modal checkboxes. Root cause: the console sets its monospace font per-element, so an unstyled `<label>` falls back to the proportional system font at a larger size. **Swept all four platform-admin client screens:** only **org-detail** was affected; **Orgs filters, Plans & Pricing campaign options, and the Bulk-Ops selector already carry the font via their CSS classes** (no issue). Fixed by routing every org-detail checkbox label through one shared style (monospace, matched size) so it can't drift again. *Severity: cosmetic (operator-only).*

### Cross-cutting — "Open Admin" link removed (impersonation-looking footgun) — FIXED 🔧 2026-06-28 (verify pending)

- **Surfaced during 2.1.** The org-detail header carried an **"Open Admin"** link that opened the org's own admin URL (`/{slug}/admin`) in a new tab. It was **not** impersonation — it just reused the operator's own browser session — but the label *read* like impersonation, and since staff accounts are **org-less** (and the shared single-login system won't let one email be both a staff and a customer account), the link **dead-ends at a login wall for essentially every platform staffer**. Owner decision: **remove it** — the "staff member also happens to be a member of this exact org" case is vanishingly rare and counter to the operator's job function on this screen, so the link was pure confusion with an impersonation smell. **Removed from the org-detail header AND the per-row "Admin" button on the Orgs list** (same dead-link, found on follow-up). Swept platform-admin — **no other "open org admin" deep-links remain** (the Dev Tools credentials panel shows the `/slug/admin` URL as plain text only, which is fine — it's paired with seeded login creds). *(No impersonation capability existed or was added; this only deletes misleading shortcuts.)* ⚠ Note for `/uat`/docs: confirms the "no staff impersonation" posture holds — staff cannot view an org's admin from the console.

### Phase C — Entitlements & Comps (Persona 2) — in progress

- **2.1 / H7 — DECISION RESOLVED → ENABLE (B) 🔧 2026-06-28 (verify pending).** Owner chose to turn the timed-grant system **on** rather than just signpost it off. Key finding during investigation: the grant engine (`lib/entitlement-grants.ts`) is **fully built and already wired into every authenticated org-build** (api-auth / db / server-organizations) and the per-request lookup is backed by the exact partial index it needs (`org_overrides(org_id) WHERE revoked_at IS NULL`) — so enforcement is cheap and inert *only* because of the env flag. **The flag is already `true` in local `.env.local` (since 2026-06-12), so module/status grants already enforce + auto-revert on localhost.** Production is still OFF (committed default) → **deferred to a gated `/release` step** (confirm prod index, set Amplify env flag, deploy) so we verify locally first. No code change needed to "enable" locally. ⚠ Only `module_addon` + `subscription_status` grants carry access effect; `comp_period` = billing/founding tag only (see H6), `plan_tier` deferred. No automated tests exist (no test runner) → relying on a manual localhost verification matrix (no grant / active / expired / revoked).
- **2.1 / H6 — Comp Period signpost FIXED 🔧 2026-06-28 (verify pending).** Selecting **Comp Period** in Add Override now shows an amber note: it's a billing/founding-season tag that **grants no module or plan access**, and points the operator to **Module Trial (timed)** or **Subscription Status** to actually unlock. Closes the trap where an operator thought a comp unlocked something.
- **2.1 verification creds:** seeded org members all use dev password **`devpass123`**; member emails are listed per-org in Dev Tools → Test Login Credentials. Use these to log in as a free-test-org member and confirm a granted section actually appears.
- **`/review` (high-risk tier) PASSED 2026-06-28 over the whole session's org-screen diff** (3 parallel finder lenses + main-loop adjudication). Caught + fixed **one real bug**: the **"(custom)" team-cap tag** was showing for *any* stored cap, including operator-typo values below the band default that the system ignores — now it shows only when the cap genuinely raises the band. Also tidied a tooltip wording drift from the relabel. Everything else (cancel-gate union, team-count query org-scoping, props contract, dead-link removals) verified clean. Gate: typecheck ✓ / lint ✓.
- **Still owner-to-verify (carry forward):** Part B unlock test (grant a section to free-test-org → log in as a member → confirm it appears + auto-reverts), the comp-period signpost, the "Feature Access" relabel, the team-usage readouts, and the two dead-link removals (Orgs list + org-detail header now show only **View**).
- **2.1 / "Module Trial" vocabulary — DECISION → RELABEL 🔧 2026-06-28 (verify pending).** Owner: the platform is viewed through **plans**, not "modules." Clarified the model — plans are *bundles of sections*; this grant surgically unlocks **one section** on top of the org's plan (it is NOT a whole-plan trial; a true timed plan/tier trial was designed as `plan_tier` but never built). Renaming it "Plan Trial" would mislead, so owner chose **relabel for clarity, keep the surgical grant**. Operator-facing copy on the org-detail screen updated: override type **"Module Trial (timed)" → "Feature Access Trial (timed)"**, picker **"Modules to grant" → "Sections to grant"**, active-list tag **"Module Add-on" → "Feature Access"**, Entitlements tab **"Module Overrides" → "Section Access Overrides"** (+ helper/validation copy). Internal keys (`module_*`, `module_addon`) unchanged. A real **Plan/Tier Trial** remains an unbuilt option if wanted later.

- **2.2 — PASS ✅ (owner-verified 2026-06-29).** Applied a **Comp Period** override to `dev-tplus-org` with expiry `2026-12-31`. The H6 amber "grants no access" note showed on selecting Comp Period; the override saved and landed in Active Overrides as "reverts Dec 31, 2026 (186d left)"; the **Founding** badge lit up on the Orgs list (Cohort column) + the Founding-Season tile/filter cohort. Attribution showed the real operator email ("by fieldlogichq@gmail.com"), not "superuser." Founding date-cutoff (expiry ≥ 2026-12-31) behaving as designed.
- **2.2 — NEW (annoying) Expiry field — FIXED ✅ (owner-verified 2026-06-29).** The Add Override **Expires** field was a single combined date-**and**-time control: typing a date but leaving the time as `--:--` tripped a browser *"Please enter a valid value"* error, so a date-only comp could not be applied — and the control unhelpfully tried to seed the current clock time. Fixed: split into a **date** field (primary) + a small **optional time** field (disabled until a date is picked), with a helper line — *"Pick a date. Time is optional — leave it blank to expire at the end of that day (23:59)."* Blank time now defaults to **end-of-day (23:59)** per owner call, so "expires Dec 31" keeps access on through all of Dec 31 rather than cutting off a day early. Precise time still settable for short Feature-Access trials. Lint clean; client-only (no restart). *Severity: annoying. Not in pre-identified list.*

- **2.3 / H5 — Revoke silent no-op + no-error + wrong attribution — FIXED 🔧 2026-06-29 (verify pending).** Confirmed all three in code/browser: (1) the revoke action never checked that a row actually changed, so a wrong/already-revoked id returned **false success** and even wrote a misleading audit entry; (2) a failed revoke **silently did nothing** — no operator-visible error; (3) the just-revoked row credited the **"superuser"** placeholder until a refresh (seen in the owner screenshot). Fix: the server now revokes **only a still-live row** and returns the affected row, so a no-op becomes a real **"not found or already revoked"** error (no audit entry written); the screen now shows a **red inline error** by the button on any failure, and reflects the **real revoker email + timestamp** immediately. Lint + typecheck clean.
- **2.3 / H4 — DECISION RESOLVED → AUTO-DROP + WARN-AHEAD 🔧 2026-06-29 (verify pending).** Owner chose: expired overrides should **auto-drop** out of "Active" (no manual revoke needed), **plus** a proactive "expiring soon" warning so comps can be extended *before* they lapse. Built across three screens (14-day warn window, matching the existing "trials ending soon" lead time): **(a)** Org-detail Billing & Access — an override past its expiry now leaves the **Active** list and appears under **"Show N past overrides"** labeled **"expired [date]"**; a live override lapsing within 14 days shows an **amber "Expires [date] (Nd left) — extend or let it lapse"** note (replaces the old red "expired — revoke or extend"); the Billing tab count now reflects only genuinely-active overrides. **(b)** Morning **Overview → Action Queue** tile relabeled **"Expired overrides" → "Overrides expiring soon"** (counts the next-14-day set, not already-moot ones). **(c)** **Orgs list** attention filter likewise **"Overrides expiring soon."** Rationale: with the grant engine now on, an expired access grant already stops granting on its own, so "expired" is no longer the actionable state — *upcoming lapse* is. ⚠ Touches shared metrics module → dev server should be restarted before verifying the **Overview** tile (org-detail screen hot-reloads fine). Typecheck + lint clean.

- **2.3 — NEW (footgun) Past expiry accepted — FIXED 🔧 2026-06-29 (verify pending).** The Add Override expiry field had no minimum and no save-time validation, so a **past** expiry was accepted — creating an override that's expired on arrival (grants nothing; now auto-drops to history). Handy for QA, but a real footgun. Fix: the date picker's **minimum is now today**, and Save is **blocked with "Expiry must be in the future"** if a past date/time still gets through (today + blank time = end-of-day, still valid). Console-side guard only (sole creation path; a backdated row is harmless anyway). Lint clean. *Severity: annoying. Not in pre-identified list.*

- **2.2/2.3 — `/review` (high-risk tier) PASSED 🔧 2026-06-29 (verify pending).** 4 finder lenses (correctness · security/multi-tenant · data-contract/blast-radius · state/UX-regression) over the whole override-screen diff + the revoke API + shared metrics module. **Security clean** (revoke auth gate enforced pre-mutation; org-scoping + `revoked_at IS NULL` guard prevent cross-org/double revoke; 404 doesn't leak cross-tenant existence; audit only on real change). **All field/URL/CSS renames verified fully propagated** (no dangling `expiredOverride`/`expired_overrides`/`expiredWarning`). Caught + fixed **1 Medium I'd introduced**: the org-detail **"Active Overrides" snapshot count still counted expired** ones while the new Active list/tab badge excluded them → now consistent. Plus 2 Low (stale orphaned expiry-time could be silently submitted; stale dictionary blob-key name) and 1 advisory tidy (expiry Date built once). 3 boundary/advisory items dropped as negligible. Gate green pre + post fix (typecheck ✓ / lint ✓).

### Phase E — Access & Lifecycle Support (Persona 4) — in progress

- **4.1 — PASS ✅ (owner-verified 2026-06-29).** Banned + unbanned `free-owner@dev.local`; the **banned** state persisted across leaving and returning. Org plan rendered the friendly label **"Tournament"** (no raw code — consistent with M1 already FIXED 2026-06-23). Search + the "customer directory only / platform staff excluded" signpost both clean. M7 (1000-row cap) not reproducible with seed data; not re-tested. *(Minor cosmetic, not pursued: the USER name column shows "-" when a member has no display name.)*

### Phase B — Billing & Plan Support (Persona 1) — in progress

- **B.1 — PASS ✅.** Upgrading `free-test-org` → Tournament Plus correctly corrected the cap to **Unlimited** (confirm modal showed "Limit: 1 to Unlimited"; Current Limit → Unlimited after apply). The upgrade path clears the limit; the *stale-cap* case (H1) is audited head-on in Persona 3.3.
- **B.1 — H14 billing clarity FIXED ✅** (routed → `/billing`, landed 2026-06-26; owner-verified on screen). Confirm modal now leads with "this does not change billing" + target-aware warnings (free-comp / re-price desync / stop-billing-via-Cancel).
- **B.1 — red "Apply" button [DECISION] resolved ✅.** Button is no longer danger-red; rule routed to `/design`.
- **B.2 — H3 team-cap widget RESOLVED ✅ (input).** Org-detail → Billing & Access now shows a **"Custom Team Limit"** field with helper text ("blank = band default 30; raise only for a custom >30 deal; raises, never lowers"). Header badge reads **"Club · Association"** cleanly (no raw `club_large` on the org-detail header). ⏳ *Still to verify:* the team-usage readout ("X of N teams" / over-cap attention) on the Account Snapshot.
- **B.2 — NEW (cosmetic) FIXED 🔧 2026-06-28 (verify pending).** Confirm Plan Change modal: the **summary box** and the **yellow billing warning** sat flush with no gap. Added spacing so a warning/clarity box separates from the preview box it follows.
- **B.2 — team-usage readout BUILT 🔧 2026-06-28 (verify pending), closes the deferred H3 readout.** Added a read-only **"Teams: X / N"** in **both** the top snapshot strip and the Plan & Limits card (Club bands only), with a **(custom)** tag when a per-org cap is set, plus an **over-cap attention item**. Also (owner-approved in the same pass): renamed **"Current Limit" → "Current Tournament Limit"**, section **"Plan And Tournament Limit" → "Plan And Limits"**, and added an **"Active Overrides" tooltip** (top strip + section) clarifying that plan/limit changes — incl. a custom team cap — are **not** counted as overrides. Typecheck clean.
- **B.2 — layout polish 🔧 2026-06-28 (verify pending):** Plan & Limits metrics now sit on **one row** (content-driven flex; was locked to 3 columns so the 4th wrapped). **HelpTooltip now auto-flips *below* the icon when it's near the top of the viewport** — a shared-component fix that stops top-edge clipping **everywhere** tooltips are used (default placement unchanged; no caller changes). Typecheck clean.
- **Note:** the org-detail header label is correct, but the **dev-tools seeder banner + org-LIST badge** still show raw `club_large` (separate finding **A.1**, still ◻ Open).

- **B.3 — M5 CONFIRMED + FIXED ✅ (owner-verified 2026-06-28).** The **Cancel Subscription** section was hidden entirely whenever an org had no stored Stripe link — so an active **paid** org that lost its Stripe link (the state of every seeded dev paid org: "Stripe Subscription: Not set") had **no in-console way to process a cancellation** at all. Fix: the Cancel section now appears for **any active paid org OR any org that still has a stored Stripe link** (union — a lingering link on a free/desynced plan stays cancellable, no regression). The underlying action was already safe without a link (it sets the account to canceled, archives tournaments, and starts the 90-day retention window; it only *skips* the Stripe call when there's nothing to cancel). When **no Stripe link** is on file, the section + confirm modal show a clear amber warning — *"this will NOT cancel anything in Stripe; if the customer may still have a live subscription, cancel it directly in the Stripe Dashboard."* Owner-verified on a seeded paid org. **Three cosmetic polish items on the cancel modal also fixed** (notify-owner checkbox label was the wrong font, then the wrong size, then squished against the reason box — now matches the console's data font/size with breathing room). `/review` run (standard tier): caught + fixed the union-gate regression; auth confirmed server-enforced; no other findings.

### Phase D — Catalog & Pricing Ops (Persona 3) — in progress

- **3.1 / H8 — CONFIRMED + DECISION RESOLVED → WIRE TOGGLE INTO IN-APP CARD + PRICE GUARD (owner 2026-06-29); routed to `/billing` to implement.** Owner ran the toggle: flipping **League Plus → Live** (via the approval queue) correctly updated the **public /pricing** page (League Plus now shows $89/available) but the **in-app upgrade card** (customer admin → subscription) still showed **"Coming soon / Early access only — self-serve checkout is not open yet"** for all three (Coaches Portal / League Plus / Club). **Root cause:** two sources of truth — the public /pricing page reads the **live DB toggle** (`plan_gating` table via `getPlanGatingMap`), but the in-app card reads a **code-baked** `PLAN_CONFIG[].gatingStatus` (`isEffectivelyGated`), only changeable by a deploy. **Decision (A):** make the in-app card honor the live toggle like /pricing, **+ a guard so the Upgrade button stays closed for any plan with no Stripe price wired** (the in-app button starts a real Stripe checkout). **Sequencing:** do 3.2 (wire Club·Association price) + 3.3 first, then `/billing` implements H8 with the price guard. Money-touching gating change → owned by `/billing`, must reconcile with `PLAN_PRICING_FACTS.md`. ⚠ Durable launch-mechanics change — consider `/strategy` log.
- **3.1 — NEW (annoying / launch footgun) Pending approvals hidden — FIXED 🔧 2026-06-29 (verify pending).** Owner: the **Live** change request fired **no notification** and was **buried at the bottom** of the plan panel with only a tiny "pending" marker. Root cause: the prominent top-of-screen **"Pricing Approval Queue"** banner only counted **Stripe price** requests, so a **plan-availability ("Live") request never surfaced there**. Fix: broadened the banner to count **every** actionable change request and relabeled it **"Approval Queue"** — so any pending launch/price approval shows at the top with a **Review Requests** button. Lint clean; client-only. *Severity: annoying. Adjacent to H8.*
- **3.1 — NEW (count bug, self-caught) Banner over-counted (said 2, queue showed 1) — FIXED 🔧 2026-06-29 (verify pending).** The broadened banner initially counted **draft + needs_review + approved**, but the Approval Queue's canonical **"Action Needed"** headline is **needs_review + approved** (drafts are the submitter's WIP, excluded). Aligned the banner to that same definition so banner = queue stat. Now reads **1** for the single needs-review item.
- **3.1 — NEW (owner ask) Overview discoverability — FIXED 🔧 2026-06-29 (verify pending).** Owner: a teammate **logging in fresh** had no way to see pending approval-queue items. The Overview Action-Queue already had a **"Price approvals"** tile — but it **only counted Stripe-price requests**, so a pending **availability ("Live")** approval was invisible there too (same blind spot as the banner). Fix: broadened that tile to **"Approval queue"** counting **all** action-needed requests (availability/gating + plan config + price), using the same **needs_review + approved** definition as the banner and the queue. All three surfaces now agree. *(A truly proactive push — bell/email on filing — remains a larger, separate item.)* Typecheck + lint clean. ⚠ Overview tile reads the shared metrics path → dev server **restarted** 2026-06-29 (login route 200, no Supabase EACCES) so it's verifiable now.
- **3.1 / H8 — DECISION LOGGED to BUSINESS_DECISIONS.md 2026-06-29 via `/strategy`** (Decided): in-app upgrade card → live availability toggle + "no Stripe price ⇒ checkout stays closed" guard; routed to `/billing`; linked to the 2026-06-26 paid→paid upgrade-proration gap.
- **3.2 — Price validation BUILT + panel owner-verified 2026-06-29 ✅ (server enforcement verify-pending).** `/billing` built Phase 1 (shared validator + server hard-block on both apply paths + H8 readiness helper) and Phase 2 (brought forward at owner request: a **"Stripe price check" panel** in the approval modal — per-line ✓/⚠/✗, Approve disabled on hard-block, ⚠ warnings require a confirm checkbox). Owner confirmed the panel surfaces reuse + amount-mismatch warnings and gates Approve. Phase 3 (in-app card price-guard) lands with the H8 build. Plan: STRIPE_PRICE_VALIDATION_PLAN.md.
- **3.2 — NEW (HIGH, owner-found) Stripe price config has almost no validation → routed to `/billing` 2026-06-29.** Wiring a Stripe price ID to a plan slot through the approval flow does **not** validate the price against Stripe beyond an "is it active?" check (and that only runs when the slot environment matches the running server's key). Owner reproduced by putting the **Tournament Plus monthly** price on a different slot with no warning. The approval modal shows raw proposal JSON but **nothing from Stripe**. The system already *retrieves* the Stripe price on approval — it just ignores amount/interval/currency/product. **Owner-approved validation set (block vs warn):** HARD BLOCK = price doesn't exist · inactive (have) · not recurring · frequency mismatch (monthly slot ↔ Stripe interval) · wrong environment (test ID in Production slot — today silently skipped, make explicit) · wrong currency (≠CAD). WARN + typed confirm = amount mismatch (catalog $ ≠ Stripe $, shown side-by-side) · price already assigned to another slot · price's Stripe product ≠ this plan's product. **UX:** replace the raw-JSON approval modal with a **"Catalog vs Stripe" side-by-side truth panel** (per-line ✓/⚠/✗), disable Approve & Apply on hard-block. Nuance: amount/interval checks only run where the matching Stripe key lives (a Production-slot price can't be fully validated from local dev/sandbox — validates in prod at approval). **Build paired with the H8 price-guard (shared Stripe-retrieve plumbing); fits the SoT theme (Stripe = authority for the real charge, reconcile catalog against it).** Routed to `/billing`.
- **3.3 / H1 — CONFIRMED + cleared by owner 2026-06-29.** Plans & Pricing showed stale finite caps for **Tournament Plus (3 slots / 5 seats)** and **League Plus (10 seats)** — both canonically **unlimited** (verified vs `PLAN_PRICING_FACTS.md` + plan config). Root cause: a **display-only plan-limits override table** the operator console reads but enforcement ignores (customers were NOT capped — enforcement reads code config). Owner cleared the stale rows via the edit→approve flow → both now read defaults/unlimited.
- **3.3 → SPIN-OUT: Single Source of Truth (SoT) Hardening.** The stale-limit finding prompted a 4-domain codebase audit (4 parallel scouts): the "same fact in multiple places, hand-synced" problem is **systemic** (~17 instances; several **LIVE on customer surfaces**). Captured as its own initiative — plan + PM brief in `docs/projects/active/SOURCE_OF_TRUTH_HARDENING_PLAN.md`, governance principle logged in `BUSINESS_DECISIONS.md` (2026-06-29). **P0 live fix done this session:** Venue Library nav was hidden for **Club · Association** (sidebar gate missed `club_large` — an H13-class regression survivor) → FIXED 🔧 (verify pending). Other live drifts (stale Club "3 accounts" copy on `/pricing` + `/for-leagues`; "Tournament Coach Portal" email naming) routed to `/marketing`; subscription-state reconciler to `/billing`.

