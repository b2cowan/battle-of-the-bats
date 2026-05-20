# Platform Admin — Comprehensive Review & Recommendations

## What's working well

The foundation is solid: org list with plan/status filtering, inline plan editing, per-org overrides and module unlocks, audit log, retention queue, Plans & Pricing with tabs, Early Access pipeline, and Company Users. The design system is consistent and the audit trail is thorough.

---

## 1 — Organization

### Current state
The nav is a flat list of 9+ items with no grouping. As the platform grows, this becomes harder to scan.

### Recommendation: Group nav items into logical zones

```
ORGS & USERS
  → Organizations
  → All Users (new)

BILLING & PLANS
  → Plans & Pricing
  → Retention Queue
  → Early Access

PLATFORM
  → Overview
  → Audit Log
  → Company Users
  → Dev Tools
```

Collapsible sections or subtle section labels in the nav sidebar would accomplish this without a redesign — just visual separators with uppercase labels between groups. Low effort, meaningful improvement as you add more pages.

---

## 2 — Internal Support Tooling

### 2a. Org Detail page — missing capabilities

**The current org detail page lets you:** view members, apply overrides, toggle module addons, and write internal notes.

**What it's missing:**

| Gap | Impact | Effort |
|---|---|---|
| **Can't rename an org or change its slug** | Common support request — currently requires direct DB edit | Low |
| **No billing summary panel** | Can't see Stripe customer ID, current subscription state, next billing date, or payment method without going to Stripe dashboard | Medium |
| **No activity timeline** | No chronological view of key events for that org (plan changes, overrides applied, members joined, payment events) | Medium |
| **No "email org owner" button** | To contact the owner, you have to look up their email in the members list and manually open your email client | Low |
| **Subscription period end date not shown** | `current_period_end` is in the DB but not surfaced on the detail page | Low |

**Recommended additions to the org detail page:**

- **Rename/re-slug panel** (with a warning about broken links) — writes to `organizations.name` and `organizations.slug`
- **Billing snapshot** — shows `stripe_customer_id`, `subscription_status`, `current_period_end`, `subscription_period` (monthly/annual), and a "View in Stripe" deep link to the customer in the Stripe dashboard
- **Quick-send button** — pre-populates a mailto with the org owner's email, pulls from the members list
- **Event timeline** — queries `platform_audit_log` filtered to this org_id and renders a compact vertical timeline

### 2b. Cross-org User Search (new page)

Right now there's no way to look up a user by email across all orgs. If a customer emails support saying "I can't log in," you have to open Supabase Auth directly.

**Recommended: Add a "Users" page to platform admin**

- Search by email or display name across all `org_members` + Supabase auth users
- Shows: email, display name, orgs they belong to + role in each, last sign-in, account status (active/banned)
- Actions: send password reset email (calls Supabase admin API), view in Supabase (deep link)
- This is a read-only search + one-action tool — relatively low implementation effort

### 2c. Fix native browser dialogs in Retention Queue

The Retention Queue currently uses `window.prompt()` for the extension reason and `window.alert()` for the process-expiry results. These break the design system and are dismissible by accident. Replace with:
- Inline reason text input that expands on "Extend" click (same pattern as org overrides form)
- Result summary rendered inline (small dismissible callout) rather than via `alert()`

---

## 3 — Metrics & Analytics Dashboard

This is the biggest gap. The current Overview page shows 4 total-count cards and 2 health items. There's almost no operational visibility.

### Recommended: Expand Overview into a real metrics dashboard

**Section 1 — Subscription Health**

| Metric | How to get it |
|---|---|
| Orgs by plan (Tournament / Plus / League / Club) | `GROUP BY plan_id` on `organizations` |
| MRR estimate | Plan prices × active org count per plan (approximate, no Stripe query needed) |
| Trialing orgs | `subscription_status = 'trialing'` count |
| Trial conversion rate (30-day) | `subscription_status` changed from `trialing` → `active` in last 30 days vs. total trials started |
| Cancellations (last 30 days) | `subscription_status` changed to `canceled` in last 30 days — queryable from audit log |
| Downgrades (last 30 days) | `plan_id` changed to a lower tier in last 30 days — queryable from audit log |
| Past due orgs | Already on the page — promote it to a more prominent position |

**Section 2 — Growth**

| Metric | How to get it |
|---|---|
| New orgs (7/30/90 days) | Already have 7-day — add 30 and 90 |
| New orgs by plan at signup | `plan_id` at time of org creation (requires storing it, or inferring from early audit log entries) |
| Activation rate | Orgs that completed onboarding vs. created |

**Section 3 — Activity**

| Metric | How to get it |
|---|---|
| Total tournaments (active vs. archived) | Already tracked |
| Tournaments created (last 30 days) | `tournaments.created_at` range query |
| Active rep teams (Club plan) | Count from `rep_teams` where org is on Club |
| DAU/WAU (approximate) | Count distinct users from Supabase auth last seen — rough signal |

**Presentation options:**
- Simple stats grid with trend indicators (▲▼ vs. last period) — low effort
- Sparkline charts for weekly new orgs and MRR over the last 12 weeks — requires charting library but good ROI once the data exists

---

## 4 — Plans & Pricing Improvements

### 4a. Plan-aware subscriber count

The Plans & Pricing page shows plan configuration but has no connection to how many orgs are actually on each plan. Add a `subscribers` column to the Availability tab showing active org count per plan. This makes it immediately clear before making any gating change.

### 4b. Price change impact preview

Before changing a trial length or limit, show a callout: _"Changing Tournament Plus trial from 14 to 30 days will affect all new checkouts. X orgs are currently trialing — their existing trials are unaffected."_ This is a simple read query + static display.

### 4c. Planned changes / effective date

Right now any change to trial days or limits takes effect immediately on the next checkout. Add an optional "effective date" field to the config upsert. Store planned future overrides as a separate row in `plan_config_overrides` with a `effective_at` timestamp, and have the checkout route pick the most recent row where `effective_at <= now()`. This enables announcing "pricing changes effective July 1" without having to make the change exactly at midnight.

### 4d. Changelog / change notes in Limits tab

The Limits & Trials save currently just calls the API silently. Add an optional "note" field to explain why the change is being made — stored alongside `updated_by_email`/`updated_at` and surfaced as a tooltip in the table. This gives auditors context when they see a change in the audit log.

---

## 5 — Additional Recommendations

### 5a. Audit Log — Export & Deep Link improvements

- **CSV export button** — filters the current query to a download. Useful for compliance review. Can be a simple server-side route that streams CSV.
- **Full value viewer** — values are currently truncated at 80 chars. A "view full" expandable row or modal for complex JSON values (e.g., `enabled_addons` arrays) would make the log actually useful for debugging.
- **Org deep link in filter** — clicking an org name in the log already links to the org detail page. Add a "Filter to this org" link that scopes the log to only that org's changes.
- **Action descriptions** — the raw action names (`plan_change`, `override_applied`) are not always obvious. Add a lookup table of action → human-readable description shown as a tooltip.

### 5b. Early Access Pipeline — Outcome tracking

The current early access client tracks requests in a pipeline, but there's no outcome tracking. Add a `converted_at` field and a "Mark as converted" action that links to the org they became. This lets you track the early access → paid conversion funnel.

### 5c. Org list — Bulk operations

Currently every plan/limit change must be done one org at a time. If you have 50 orgs on Tournament Plus that all need a trial extension, this is 50 saves. Add a multi-select mode to the orgs table with bulk actions:
- Bulk override status
- Bulk plan change
- Bulk comp period grant

### 5d. Notification / Alert system

There's no alerting for important events. Recommend a simple in-app banner system for the platform admin home page:
- New past-due orgs since last visit
- New early access signups in queue
- Retention records approaching their purge deadline
- Any manually-triggered process-expiry results

These would render at the top of the Overview page as dismissible callouts, queried on load from the same DB sources already used elsewhere.

### 5e. Help page improvements

The current help page exists but is presumably static. Consider moving it to a searchable FAQ structure where each entry links to the relevant platform admin page. As new features ship, keeping the help page current becomes more important.

### 5f. Dev Tools — Local flag management

The dev tools page is currently mostly a testing utility. Consider adding:
- Env var presence checker (confirms required Stripe, Resend keys are set — shows ✓/✗ without revealing values)
- Test email sender (sends a template preview to a specified address)
- Stripe webhook replay launcher (calls Stripe test event trigger for common events like `checkout.session.completed`)

---

## Priority ordering

| Priority | Item | Effort |
|---|---|---|
| **High** | Metrics dashboard (subscription health + growth) | Medium |
| **High** | Fix Retention Queue native dialogs | Low |
| **High** | Billing snapshot on org detail | Medium |
| **High** | Cross-org user search page | Medium |
| **Medium** | Plan subscriber counts on Plans & Pricing | Low |
| **Medium** | Audit log CSV export + full value viewer | Low–Medium |
| **Medium** | Org rename/re-slug on detail page | Low |
| **Medium** | Activity timeline on org detail | Medium |
| **Low** | Planned effective-date config changes | High |
| **Low** | Bulk org operations | Medium |
| **Low** | In-app alert/notification system | Medium |
| **Low** | Early access conversion tracking | Low |
