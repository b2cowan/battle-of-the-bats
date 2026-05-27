# Founding Season — Email Infrastructure Plan

**Status:** Planning  
**Depends on:** Founding Season GTM Plan (`FOUNDING_SEASON_PLAN.md`)  
**PM Brief:** See [FOUNDING_SEASON_PM_BRIEF.md](FOUNDING_SEASON_PM_BRIEF.md)

---

## Goal

Before any founding season email goes out, build the infrastructure that lets you:
1. **Preview** every email template in platform admin before it sends
2. **See recipient lists** (who qualifies, who has opted out, estimated count)
3. **Trigger sends manually** from platform admin rather than relying on blind cron timing
4. **Track sends** — when it went, how many recipients, how many suppressed
5. **Comply with CASL** — unsubscribe link in every email, opt-out honoured within 10 business days

---

## What's Being Built

### A. Opt-out / unsubscribe infrastructure

**Why first:** Every email must include a working unsubscribe link before it goes out. CASL requires it for commercial electronic messages; the feature spotlight series (5A–5E) and renewal nudge (Email 3/4) are clearly promotional.

#### `email_opt_out` column on `organizations`
```sql
ALTER TABLE organizations
  ADD COLUMN email_marketing_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN email_opt_out_at timestamptz;
```

Migration number: **099** (next available).

#### Signed unsubscribe token
- Format: `HMAC-SHA256(org_id + ':' + secret_key)` — truncated to 32 hex chars
- No auth required to unsubscribe — the token IS the authorization
- `lib/unsubscribe-token.ts` — `generateToken(orgId)` + `verifyToken(orgId, token)`
- Uses `UNSUBSCRIBE_SECRET` env var (add to Amplify + `.env.local`)

#### Unsubscribe route
`app/unsubscribe/route.ts` — `GET /unsubscribe?org=<orgId>&token=<token>`
- Verifies token
- Sets `email_marketing_opt_out = true`, `email_opt_out_at = now()`
- Redirects to `/unsubscribe/confirmed` — simple page: "You've been unsubscribed from FieldLogicHQ marketing emails."

#### Footer block (all outgoing emails)
```
You're receiving this because you signed up for FieldLogicHQ.
Unsubscribe: https://fieldlogichq.ca/unsubscribe?org={{orgId}}&token={{token}}
FieldLogicHQ · Canada
```

---

### B. Email send log table

Tracks every send attempt — both scheduled batches and individual transactional emails.

```sql
CREATE TABLE email_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key text NOT NULL,           -- 'founding_welcome', 'founding_checkin', 'founding_renewal', etc.
  subject text NOT NULL,
  recipient_org_id uuid REFERENCES organizations(id),
  recipient_email text NOT NULL,
  recipient_name text,
  status text NOT NULL DEFAULT 'queued', -- queued | sent | failed | suppressed
  suppression_reason text,               -- 'opt_out' | 'no_email' | 'send_error'
  resend_message_id text,                -- returned by Resend API
  batch_id uuid,                         -- groups a mass send together
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON email_sends (email_key, created_at DESC);
CREATE INDEX ON email_sends (batch_id);
CREATE INDEX ON email_sends (recipient_org_id);
```

Migration number: **100**.

#### Email batch table

```sql
CREATE TABLE email_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_key text NOT NULL,
  subject text NOT NULL,
  triggered_by text NOT NULL,  -- 'cron' | 'platform_admin:<user_email>'
  recipient_count int NOT NULL DEFAULT 0,
  suppressed_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending | running | complete | failed
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

### C. Email send helper (`lib/email-sender.ts`)

Wraps Resend with:
- Opt-out check before every send
- Writes a row to `email_sends` before and after each send
- Generates the unsubscribe token and injects it into the template footer
- Updates batch counters on completion

```typescript
interface SendEmailOptions {
  emailKey: string;
  orgId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  html: string;
  batchId?: string;
}

async function sendEmail(opts: SendEmailOptions): Promise<'sent' | 'suppressed' | 'failed'>
```

---

### D. Platform admin email dashboard — `/platform-admin/email`

New section in platform admin sidebar (under a "Comms" group, or added to the existing nav).

#### Page sections

**Scheduled sends**
A table of upcoming founding season emails with:
- Email name + subject line
- Scheduled send date
- Audience description ("All founding season org owners")
- Estimated recipient count (live query — counts qualifying orgs minus opt-outs)
- Status: `Scheduled` / `Sent` / `Overdue`
- Actions: `Preview`, `Send now`, `Skip`

**Sent history**
A table of past batches:
- Date sent, email name, sent count, suppressed count, failed count
- Expandable row → shows individual recipient log (org name, email, status, Resend message ID)

**Opt-outs**
- Count of opted-out orgs
- List with: org name, owner email, opted-out date
- Re-subscribe action (for cases where an org owner asks to be re-added)

#### Email preview modal
Clicking `Preview` on any scheduled email renders the full HTML template with:
- A sample org substituted in (the platform admin's own org, or first founding season org)
- The unsubscribe footer rendered with a placeholder token
- Toggle to see plain-text version

---

### E. Cron triggers

Each email in the founding season sequence needs a scheduled trigger. Two options:

**Option A — Next.js API route + AWS EventBridge Scheduler**
- Route: `POST /api/cron/founding-season-emails` — protected by `CRON_SECRET` header
- EventBridge rule per email, fires at the target date/time
- Platform admin "Send now" button also hits this route with a `force=true` param

**Option B — Platform admin manual only (no cron)**
- No automated scheduling in the first pass
- Platform admin manually triggers each send from the dashboard
- Simpler, less infrastructure, appropriate for a founding cohort of 30–50 orgs

**Recommendation: Option B first.** The cohort is small enough that manual triggering is fine and removes the EventBridge dependency that's currently blocking F4 (trial emails). If the cohort grows to hundreds of orgs before November, revisit.

---

## Build Order

| Phase | Item | Migration | Notes |
|---|---|---|---|
| A | `email_marketing_opt_out` on organizations | 099 | Required before any email goes out |
| A | `lib/unsubscribe-token.ts` + `UNSUBSCRIBE_SECRET` env var | — | |
| A | `GET /unsubscribe` route + `/unsubscribe/confirmed` page | — | |
| B | `email_sends` + `email_batches` tables | 100 | |
| C | `lib/email-sender.ts` wrapper | — | |
| D | Platform admin `/platform-admin/email` page | — | Scheduled sends + sent history + opt-out list |
| D | Email preview modal | — | |
| E | Manual send trigger from platform admin | — | "Send now" button → fires the batch |

**Email templates (Phases 1–5 in FOUNDING_SEASON_PLAN.md) are built after infrastructure is in place.**

---

## Email Key Registry

| Key | Phase | Description | Send timing |
|---|---|---|---|
| `founding_welcome` | 3, Email 1 | Welcome + founding season confirmation | At signup (transactional) |
| `founding_checkin` | 3, Email 2 | Activity check-in | ~Day 60, or after first tournament |
| `founding_renewal` | 3, Email 3 | Renewal nudge | November 1, 2026 |
| `founding_final` | 3, Email 4 | Final reminder | December 15, 2026 |
| `spotlight_club` | 5A | Club founding promotion | August 1, 2026 |
| `spotlight_league` | 5B | House League spotlight | September 1, 2026 |
| `spotlight_coaches_org` | 5C | Coaches Portal (org owner version) | October 1, 2026 |
| `spotlight_coaches_coach` | 5C | Coaches Portal (coach account version) | October 1, 2026 |
| `spotlight_club_last` | 5D | Club last chance | October 15, 2026 |
| `spotlight_full_picture` | 5E | Full picture + referral | November 15, 2026 |

---

## Audience Queries

Each email key maps to a query that defines its recipient set. These power both the preview recipient count and the actual send.

| Key | Audience query |
|---|---|
| `founding_welcome` | Triggered per-org at signup — no batch query |
| `founding_checkin` | Founding season orgs, `created_at` ≥ 60 days ago, not yet received this email |
| `founding_renewal` | All founding season orgs — `email_marketing_opt_out = false` |
| `founding_final` | All founding season orgs — suppress if payment method added (future Stripe check) |
| `spotlight_*` | All founding season org owners — `email_marketing_opt_out = false` |
| `spotlight_coaches_*` | Coach accounts (from `org_members` with role = coach, linked to founding season orgs) |
| `spotlight_club_last` | Founding season org owners NOT on League or Club plan |

---

## CASL Compliance Checklist

- [ ] Express consent basis documented: signup implies consent for transactional + account messages; founding season promotional emails are covered by implied consent (existing business relationship within 2 years of signup)
- [ ] Every email includes sender identification: "FieldLogicHQ · Canada"
- [ ] Every email includes functional unsubscribe link (verified before first send)
- [ ] Opt-out honoured within 10 business days (automated — immediate flag on `organizations`)
- [ ] Opt-out applies to future sends only (past sends are logged and immutable)
- [ ] Transactional emails (Email 1 — welcome, billing alerts) excluded from opt-out suppression

---

## Open Decisions

1. **`founding_welcome` (Email 1) timing** — Should it fire at the end of the signup route (synchronously, risk of slow response) or via a queue/background job? Recommendation: fire it at the end of `POST /api/auth/signup/route.ts` after the comp_period insert, same pattern as the existing welcome email — but log the send attempt regardless of Resend success.

2. **`founding_checkin` (Email 2) trigger** — "~60 days post-signup" vs. "after first tournament." If both are true the email becomes redundant. Recommendation: send at 60 days regardless of tournament activity, with personalized copy based on whether they have a tournament (already specified in the plan body framework).

3. **Resend template vs. inline HTML** — The existing email stack uses inline HTML strings. Keep this pattern for consistency, or move to Resend's template system? Recommendation: keep inline HTML in TypeScript (easier to preview and version-control than Resend dashboard templates).
