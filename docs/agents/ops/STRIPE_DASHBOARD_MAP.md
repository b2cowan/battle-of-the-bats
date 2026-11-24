# Stripe Dashboard map — where things are, and how sure we are

**Why this exists (owner, 2026-11-22):** Stripe reorganizes its Dashboard faster than its own docs catch up, and walk steps
written from memory sent the owner to screens that no longer exist ("Tax › Registrations", "Tax › Settings",
"Settings › Business › Public details"). **Read this before writing any step that tells the owner where to click in Stripe.**

## Rules for writing a Stripe step
1. **Lead with the direct link** (`https://dashboard.stripe.com/...`), then the click path. Links survive menu moves far
   better than click paths; Stripe redirects old URLs. A live-mode link has no `/test/` in it.
2. **Use a click path only if it is marked SEEN below.** A DOCS path may already be stale: the docs do not even describe
   the Settings › Business tab set the owner sees.
3. **When the owner shows a screen that differs, update this file in the same turn** and mark the row SEEN with the date.
4. Say what to look for **by the words on the screen**, not by a setting's API name (e.g. "Include tax in prices", not
   `tax_behavior`).

Confidence: **SEEN** = owner screenshot, dated · **DOCS** = docs.stripe.com as read on the date, not yet seen on screen.

## Tax
| What | Where | Confidence |
|---|---|---|
| Tax home | Left nav **Tax** → tabs **Overview · Locations · Transactions**; buttons **Collect and file**, **Quick actions** | SEEN 2026-11-22 |
| Registrations (old name) | **Tax › Locations** — `https://dashboard.stripe.com/tax/locations`. Row per country, status chip (Needs attention / Collecting tax), *Filing setup* column (Stripe's paid filing; "—" is right for us) | SEEN 2026-11-22 |
| One registration's details | Click the location row → e.g. *Tax › Locations › Canada › Canada (Federal)*: tax type, GST/HST number (masked), type of registration, start/end date; buttons *Set up filing*, *Add registration*, *Export transactions* | SEEN 2026-11-22 |
| Tax settings (head office, preset tax code, **Include tax in prices**: Automatic / Inclusive / Exclusive) | `https://dashboard.stripe.com/settings/tax` | DOCS 2026-11-22 |
| Tax integrations toggle | `https://dashboard.stripe.com/settings/tax/integrations` | DOCS 2026-11-22 |
| Stripe Tax plan (Tax Basic / Tax Complete) | Chosen in the *Start collecting tax* wizard (Tax › Overview › *Continue Tax setup*: 1 plan · 2 where to collect and file · 3 integration). Where to view/change it afterwards: **not found** in docs | SEEN 2026-11-22 (wizard) |
| Setup guide | Top bar **Setup guide** pill (account-wide onboarding; its ring is not a tax warning) | SEEN 2026-11-22 |

## Settings (gear icon, top right)
| What | Where | Confidence |
|---|---|---|
| Business settings | Gear → **Settings › Business** → tabs **Account details · Account status · Business details · Tax details · Branding · Custom domains · Customer emails** | SEEN 2026-11-22 |
| Public business name / support address (prints on invoices, receipts) | Docs: "Public business information", `https://dashboard.stripe.com/settings/public`. Most likely the **Business details** tab above | DOCS 2026-11-22 (tab = guess) |
| Our own GST/HST number on invoices | Docs: Invoice settings `https://dashboard.stripe.com/settings/billing/invoice` → **Tax** tab → ⋯ → *Set as default*. Possibly also the **Tax details** tab above | DOCS 2026-11-22 |
| Invoice template (memo, footer, numbering) | `https://dashboard.stripe.com/settings/billing/invoice` (another docs page says `/settings/billing/invoices/general`) | DOCS 2026-11-22 |
| Branding (logo, colours on emails/PDFs/hosted pages) | `https://dashboard.stripe.com/account/branding`, or the **Branding** tab above | DOCS / SEEN tab 2026-11-22 |
| Customer emails | `https://dashboard.stripe.com/settings/emails`, or the **Customer emails** tab above | DOCS / SEEN tab 2026-11-22 |
| Customer portal (settings) | `https://dashboard.stripe.com/settings/billing/portal` (docs give only the `/test/` form) | DOCS 2026-11-22 |
| Customer portal (what the BUYER sees) | New layout: left nav **Overview · Wallet · History**, Overview shows only "Active plans" cards. Features are one click deep: **Wallet** = cards, **History** = invoices, click the **plan card** (›) = cancel, click the **name at bottom left** = name / email / tax ID. A walk must not say "read what it offers" off one screen | SEEN 2026-11-22 |
| Statement descriptor (5–22 chars, what a card statement shows) + shortened descriptor (2–10 chars, the prefix before `*`) | `https://dashboard.stripe.com/settings/business-details` (docs give the link, no field labels). A **subscription** charge cannot take a suffix: a per-plan descriptor is the Product's own statement descriptor (whole text, replaces the account one), field on the Product edit screen not named in docs. Precedence: Invoice → Product → account default | DOCS 2026-11-22 |
| What descriptor a charge actually carried | **Transactions** → click the payment → right-hand **Details** panel → **Statement descriptor** (our live account sends `FIELDLOGICHQ`) | SEEN 2026-11-22 |
| Connect settings (Live) | `https://dashboard.stripe.com/settings/connect` loads (no `/test/`). Sections seen: **Onboard connected accounts** (Onboarding interface · Onboarding options · Account status), **Payments and payouts** (Payment methods · Adaptive Pricing · Agentic commerce · Disputes · Payouts), **Monetize your platform** (Platform pricing tool). No separate on/off switch on this page; left nav **Products › Connect** has a dropdown. Platform profile and Emails not in the captured part (scroll) | SEEN 2026-11-23 (top of page only) |
| Platform profile (Live) | `https://dashboard.stripe.com/settings/connect/platform-profile`. "This page shows recommended defaults for your Connect integration." Read-only. **2026-11-24 (after the 11-23 activation below): no "Onboarding incomplete" banner.** Rows: **Setup** › Funds flow = "Sellers will collect payments directly" (pencil to edit) · Negative balance liability = Stripe · Negative balance liability acknowledgement = **Unacknowledged** (expected: only needed where the platform covers losses; Stripe covers them here) · **Monetization** › Stripe fee collection = Stripe · **Account management** › Account creation = Onboarding hosted by Stripe · Dashboard experience = Stripe Dashboard · Ongoing seller compliance = Stripe. All match the product. No name/support-email/website fields on this page. (2026-11-23, before activation, it said "Onboarding incomplete" with a View onboarding button that only opened the Setup guide.) | SEEN 2026-11-24 |
| Live Connect activation (Setup guide) | Dashboard **Setup guide** (top right) › **Set up your live account**: Create a live customer · Create a live invoice (both done by the 2026-11-22 live test) · **Verify your identity** · **Confirm your integration choices** (greyed until the business model is saved) · Get your API keys (opening `https://dashboard.stripe.com/apikeys` is enough). Business model choice: **Platform** ("Merchants will collect payments directly"), not Marketplace. Integration choices confirmed: sellers collect directly · onboarding hosted by Stripe · sellers use the Stripe Dashboard · Stripe manages risk and is liable · ongoing seller compliance Stripe. Confirming accepts Stripe's Connect Platform Agreement. **All done by the owner 2026-11-23 evening (identity verified).** The guide's "Test Connect" and "Set up subscriptions" items are not required; do not create test accounts in Live | SEEN 2026-11-23 |
| Webhooks list (Live) | `https://dashboard.stripe.com/webhooks`: columns Type · Destination · Listening to · Events from · Payload style · Activity · Response time · Error rate. 2026-11-23: "FieldLogicHQ production billing webhook" 20 events / Your account / Snapshot; "Connect – payments and refunds (live)" 12 / Connected accounts / Snapshot; "Connect – club accounts (live)" 3 / Your account / Thin | SEEN 2026-11-23 |
| Connect left-nav menu (Live) | Products › **Connect** expands to **Overview · Connected accounts · Compliance · Tax forms · Capital · Issuing (greyed) · Support cases**. This is what an activated Connect account looks like: Connect IS activated on Live | SEEN 2026-11-23 |

## Billing › Revenue recovery
| What | Where | Confidence |
|---|---|---|
| Failed-payment rules | **Revenue recovery** → tabs **Overview · Retries · Emails · Automations** | SEEN 2026-11-22 |
| Retries tab | Rows: **Card payments** (chip + *Manage*), **Local payment methods** (*Manage*), **Subscription status** (active when / first renewal attempt fails / all retries fail → dropdowns), **Invoice status** ("If all retries for a payment fail, *mark the invoice as uncollectible*") | SEEN 2026-11-22 |
| Retry schedule (how many tries, over how long) | **NOT on the Retries tab face**: behind **Card payments → Manage** → **Cards** row (toggle on, "Smart retry", expand ⌄) → radio **Smart Retries** ("Retry up to [N times] within [window]") or **Custom retries**. Live on 2026-11-22: **Smart Retries, 8 times within 2 weeks** | SEEN 2026-11-22 |
| "Mark uncollectible after N days" | Does **not exist** for our invoices. Stripe's day-count rule is only for invoices emailed for manual payment (we send none; every plan charges the card automatically). Ours are written off when the last retry fails, so the retry window IS the day count | SEEN 2026-11-22 (no such field on the Retries tab); the "only manual invoices" reason is from the code, which sends none |

## Developers
| What | Where | Confidence |
|---|---|---|
| Webhooks | **Workbench › Webhooks**, `https://dashboard.stripe.com/webhooks` ("Create an event destination") | DOCS 2026-11-22 |
| API keys | `https://dashboard.stripe.com/apikeys` | DOCS 2026-11-22 |
| Sandboxes / test vs live | Account picker → **Sandboxes**, `https://dashboard.stripe.com/sandboxes`; exact live/test switch label not in docs | DOCS 2026-11-22 |

## Sources (read 2026-11-22)
docs.stripe.com: tax/set-up, tax/registering, tax/monitoring, tax/products-prices-tax-codes-tax-behavior, invoicing/customize,
invoicing/taxes/account-tax-ids, customer-management/configure-portal, webhooks, keys, sandboxes, workbench. Owner screenshots
2026-11-22 (Tax Overview/Locations/Canada page, the setup wizard, Settings › Business).
