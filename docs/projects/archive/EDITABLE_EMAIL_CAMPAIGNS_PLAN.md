# Editable Email Campaigns — Implementation Plan

> **Created:** 2026-06-29 · Surfaced during platform-admin QA 6.2 — owner asked "where do I edit these campaigns?" and the answer is *nowhere in the UI*. Routed to `/plan` to scope; content-editability piece coordinates with `/billing`-adjacent email tooling and the SoT hardening initiative.

## Problem
The **Email Dashboard → Scheduled Sends** lists 10 founding-season marketing emails and lets an operator **Preview** and **manually Send** them — but there is **no way to edit any detail** (subject, send date/timing, audience, or content) from the console. Everything about these campaigns is **hardcoded in code**:
- The campaign list + metadata (subject, send date, audience, transactional flag) is a hardcoded array in the dashboard component.
- The email **content** is hardcoded HTML in the shared email module, and **duplicated again** as a preview mirror in the dashboard component (a single-source-of-truth smell — see SoT register SOT-6/-14).

Meanwhile a **separate, working system** — **Email Templates** (`platform_email_templates`, DB-backed) — lets operators edit subject/heading/body/CTA of **transactional/system** emails (auth, billing, tournament, rep-teams, house-league, system) with per-template override + "reset to default." The founding-season **marketing** campaigns are **not** in that system. So we have an editing tool that doesn't cover the emails the operator is looking at, and a campaign list that can't be edited.

## Goal
Let an operator (not a developer) manage the founding-season campaigns from the console — at minimum their **wording**, ideally their **schedule** — without a code deploy, while keeping the brand envelope and the audience/trigger *logic* safe.

## Approach (recommended: extend the proven template system, don't build a parallel one)

### Phase 1 — Content editability (highest value)
- Bring the founding-season / marketing emails into the **existing DB-backed template system** under a new **"Marketing / Campaign"** category, migrating their content out of hardcoded HTML into template rows (subject + heading + body + CTA), with the same **override + reset-to-default** behavior transactional templates already have.
- **Route both the send path AND the dashboard preview through the one template source**, eliminating the current content duplication (send HTML vs preview mirror). This directly retires an SoT duplication (SOT-6/-14): one place defines each campaign's words.
- Result: from **Email Templates** (or a link off the campaign row), an operator edits a campaign's subject/body, previews it in the brand envelope, and resets to default — no deploy.

### Phase 2 — Schedule / audience (scoped carefully — these encode logic)
- **Send timing** is mixed: some are calendar dates (Nov 1, Dec 15…), some are **triggers** ("At signup", "~Day 60 post-signup"). Expose an **editable planned date** for date-based sends; keep trigger-based ones **system-defined** with clear labeling (they fire on events, not a date).
- **Audience** strings are backed by real queries ("Founding orgs signed up ≥ 60 days ago", "excludes orgs already on Club"). Do **not** turn these into free text. Keep audiences **system-defined + clearly labeled as such** in V1; a future option is a small set of **parameterized, safe audience presets** the operator can pick from.
- Net: content becomes fully editable; schedule/audience become **transparent and partly editable**, never a foot-gun that lets an operator break the send logic.

**P2 BUILT on dev (2026-07-09, owner sign-off: editable dates only — NO auto-send; 30-day upcoming window; edit on the dashboard).** Migration **180** adds an editable `planned_send_date` to the marketing campaigns (calendar campaigns seeded with their dates; the 2 trigger campaigns stay NULL/locked). The Email Dashboard now:
  - shows a **"Needs sending" area** at the top — **Past due** (date arrived/passed, not sent — red, "Send now") and **Upcoming** (due within 30 days — amber); sent + trigger campaigns drop off automatically;
  - lets an operator **edit the planned date inline** on each calendar row (date-picker modal → `POST /api/admin/email/schedule`, which rejects the trigger keys);
  - shows a **meaningful per-row status** — Sent / Past due / Due soon / Planned / Auto — replacing the blanket "Scheduled";
  - is explicit that **sends stay manual** ("this board tells you when"). No scheduler/cron was added — true auto-send was deliberately out of scope.
  Applied to dev; **pending: apply mig 180 to prod + snapshot refresh at release.** A future extension could add active reminders (bell/email) when a campaign comes due.

### Phase 3 — Dashboard clarity (small, can ship with P1)
- On the Scheduled Sends rows, make it obvious what's **editable** (an "Edit content" affordance per row) vs **system-defined** (timing/audience shown as read-only with a short "set by the system" note), so the dashboard stops implying full editability it doesn't have.

## Out of scope / guardrails
- No free-text audience targeting (PIPEDA/CASL + accidental mis-send risk).
- The brand envelope (header/footer) stays automatic, as it is for transactional templates.
- No change to *which* campaigns exist or their send mechanics in P1 — just make their content editable and the dashboard honest.

## Dependencies / relationships
- **SoT Hardening** (`SOURCE_OF_TRUTH_HARDENING_PLAN.md`): P1 collapses the campaign-content duplication (SOT-6/-14) — do them together.
- Reuses the existing `platform_email_templates` editor + override/reset infrastructure (no parallel editor).

## Success criteria
- An operator can edit a founding-campaign's subject + body, preview it, and reset to default — no deploy.
- Campaign content lives in **one** place (send == preview).
- The dashboard clearly distinguishes editable content from system-defined timing/audience.

---

## Decisions locked & build architecture (2026-07-08, owner sign-off)

Two forks resolved before building P1:

1. **Content fidelity → PRESERVE THE DESIGN.** The campaigns keep their current look (callout boxes, bullet lists, buttons, live per-org numbers). Rather than flatten them into the transactional editor's plain subject/heading/body/CTA shape, we introduce a small, safe **block-markup** the operator edits (paragraphs, `**bold**`, `- bullets`, `::callout … ::end`, `::button`, `::link`, `{{tokens}}`, and one `::if` conditional for the check-in's per-org block). **No raw HTML** in the editor. A single shared renderer turns that markup into the branded email for **both send and preview**.

2. **Discovered gap → FIX TRANSACTIONAL TOO.** Investigation found the *existing* transactional template editor is **write-only**: `platform_email_templates` is read only by the editor's own API routes; **no send path consumes the override**, and the `resolveEmailTemplate()` helper referenced in migration 083's comment was never built. So "reuse the working system" is really "finish wiring it." P1 builds the resolver and applies it at the transactional send sites too — **safety property: when a template is NOT customised, the send path is byte-for-byte unchanged** (still the hardcoded builder), so we only ever change what an operator has explicitly customised.

### Build batches (P1 + P3)
- **A — Shared core (new files, no wiring):** `lib/email-markup.ts` (markup → HTML, + text) and `lib/platform-email-templates.ts` (`resolvePlatformTemplate(key)` + `renderResolvedEmail(key, vars, { defaultSubject, defaultHtml })`). Unit tests for the markup renderer.
- **B — Marketing content migration (mig 179):** seed the 10 campaigns into `platform_email_templates` under a new `marketing` category, each as heading + body-markup reproducing today's design, with its variable list. Data-only insert into an existing table (no schema change).
- **C — Marketing send + preview through the resolver:** send route renders each campaign via `renderResolvedEmail`; server preview endpoint returns the *same* rendered HTML; delete the dashboard's client-side preview mirror (retires **SOT-6/-14**). Retire the now-unused `founding*Html`/`spotlight*Html` builders.
- **D — Transactional wiring:** wrap each transactional send site with `renderResolvedEmail` (default unchanged unless customised). Reuse the resolver; upgrade the editor's preview to the shared rich renderer.

**BATCH D BUILT on dev (2026-07-09, owner sign-off: simpler layout on customise, all 24).** All ~24 transactional/system templates are now applied at send time via a drop-in `sendTransactionalEmail()` wrapper across ~40 send sites — auth (signup/team-signup/forgot-password), billing (Stripe webhook, cancel, downgrade, checkout, platform-admin cancel, retention sweep), tournament (registration confirm/accept/waitlist/reject, payment, schedule-published, results-finalized), tryouts (application/offer/accept/decline), house-league (pending/approved/waitlisted/declined/promoted). **Safety property verified in /review across every site: an un-customised template sends byte-for-byte as before.** Also fixed: `password_reset` (its editable template was previously wired to nothing) now drives the live reset flow. Code-only (no new migration). typecheck + lint clean; /review = 0 defects. **Uncommitted on dev** (owner to fold into a combined commit with other in-flight work). Marketing P1/P2 already committed (3 commits on dev, 2026-07-08→09).
- **P3 — Dashboard honesty:** per-row "Edit content" link into the editor; timing/audience shown read-only + "set by the system."

### Coordination note
The Email Dashboard files (`EmailDashboardClient.tsx`, `email.module.css`) have in-flight uncommitted edits from a platform-admin QA chat (a `tableScroll` wrapper). Backend/new-file batches are committed first; the shared dashboard file (P3) is edited last, coordinating before commit.
