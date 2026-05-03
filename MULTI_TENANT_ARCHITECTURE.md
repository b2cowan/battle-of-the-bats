# Multi-Tenancy Architecture Plan

**Project:** Battle of the Bats — Tournament Management Platform  
**Date:** 2026-05-02  
**Author:** Architecture review via Claude Code  
**Status:** Approved for implementation

---

## 1. Executive Summary

The application is **database-ready but application-not-ready** for multi-tenancy. Every child table already has `tournament_id` as a foreign key — that data scoping is sound. The blockers are entirely in the application layer: hardcoded single-admin credentials, no real authentication, no Supabase row-level security, and no concept of an organization that owns tournaments.

The migration path is additive — no existing data is destroyed. The existing Milton Softball tournaments become **Organization #1** and continue working throughout every phase.

---

## 2. Current State Audit

### 2.1 Database Tables

| Table | Key Columns | Tournament Scoping |
|---|---|---|
| `tournaments` | id, year, name, is_active, start_date, end_date | Primary tenant table |
| `age_groups` | id, tournament_id, name, min_age, max_age, playoff_config | FK: tournament_id |
| `pools` | id, age_group_id, name, display_order | FK: age_group_id (indirect) |
| `teams` | id, tournament_id, age_group_id, name, coach, email, status, payment_status, pool_id | FK: tournament_id |
| `games` | id, tournament_id, age_group_id, home_team_id, away_team_id, date, time, location, diamond_id, is_playoff, bracket_id, bracket_code | FK: tournament_id |
| `diamonds` | id, tournament_id, name, address, notes | FK: tournament_id |
| `contacts` | id, tournament_id, name, email, phone, role | FK: tournament_id |
| `announcements` | id, tournament_id, title, body, pinned | FK: tournament_id |
| `rules` | id, tournament_id, title, icon, display_order | FK: tournament_id |
| `rule_items` | id, rule_id, content, display_order | FK: rule_id (indirect) |
| `resources` | id, tournament_id, label, url, display_order | FK: tournament_id |

### 2.2 Current Authentication

- **Method:** Hardcoded credentials — `username: admin`, `password: miltonbats2025`
- **Session:** `localStorage` key `botb_admin_session`, 8-hour expiry
- **Location:** `lib/auth.ts`
- **Vulnerabilities:** No cryptographic verification, trivial to forge, credentials in source control

### 2.3 Current Authorization Gaps

- No user-to-tournament permission mapping
- All `/api/admin/*` routes have zero auth checks
- `getTournaments()` and other functions return **all data** when called without `tournamentId`
- No Supabase Row Level Security (RLS) policies exist
- `SUPABASE_SERVICE_ROLE_KEY` accessible in environment files

### 2.4 What Is Already Good

- Consistent `tournament_id` FK on all 10 child tables
- Stateless API design — easy to parameterize per organization
- `TournamentContext` pattern is a clean base for an `OrgContext`
- No cross-tournament game logic dependencies

---

## 3. Proposed Data Model

### 3.1 New Tables

```sql
-- One record per paying organization (softball association, league, etc.)
CREATE TABLE organizations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text NOT NULL,
  slug                    text UNIQUE NOT NULL,       -- URL segment: "milton-softball"
  logo_url                text,
  plan_id                 text NOT NULL DEFAULT 'starter',  -- 'starter' | 'pro' | 'elite'
  stripe_customer_id      text,
  stripe_subscription_id  text,
  subscription_status     text DEFAULT 'active',     -- 'active' | 'trialing' | 'past_due' | 'canceled'
  tournament_limit        int NOT NULL DEFAULT 1,    -- denormalized from plan for fast enforcement
  is_public               boolean NOT NULL DEFAULT true,  -- false = unlisted from /discover
  created_at              timestamptz DEFAULT now()
);

-- Maps Supabase Auth users to organizations with a role
CREATE TABLE organization_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             text NOT NULL DEFAULT 'admin',    -- 'owner' | 'admin' | 'staff'
  invited_at       timestamptz DEFAULT now(),
  accepted_at      timestamptz,
  UNIQUE(organization_id, user_id)
);
```

### 3.2 Modified Tables

```sql
-- Add organization ownership to tournaments
ALTER TABLE tournaments
  ADD COLUMN organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill existing Milton Softball data (run once during migration)
-- UPDATE tournaments SET organization_id = '[milton-org-uuid]';

-- Make non-nullable after backfill
ALTER TABLE tournaments
  ALTER COLUMN organization_id SET NOT NULL;
```

### 3.3 Supabase Auth

Replace `lib/auth.ts` entirely with **Supabase Auth** (`supabase.auth.signInWithPassword()`). Auth is already built into the existing `@supabase/supabase-js` package — no new service required. JWTs are cryptographically signed by Supabase and validated on every request.

---

## 4. URL Structure

### 4.1 Route Map

| Route | Visibility | Description |
|---|---|---|
| `/` | Public | Marketing landing page |
| `/discover` | Public | Search tournaments and teams across all organizations |
| `/auth/login` | Public | Sign in |
| `/auth/signup` | Public | Create organization account |
| `/auth/invite/[token]` | Public | Accept team member invitation |
| `/[orgSlug]` | Public | Organization home (active tournament overview) |
| `/[orgSlug]/schedule` | Public | Schedule for active tournament |
| `/[orgSlug]/results` | Public | Results for active tournament |
| `/[orgSlug]/teams` | Public | Teams for active tournament |
| `/[orgSlug]/register` | Public | Team registration form |
| `/[orgSlug]/rules` | Public | Tournament rules |
| `/[orgSlug]/news` | Public | Announcements |
| `/[orgSlug]/admin` | Org members | Admin dashboard |
| `/[orgSlug]/admin/tournaments` | Org members | Create and manage tournaments |
| `/[orgSlug]/admin/schedule` | Org members | Schedule builder, playoff wizard |
| `/[orgSlug]/admin/teams` | Org members | Team registrations |
| `/[orgSlug]/admin/results` | Org members | Score entry |
| `/[orgSlug]/admin/age-groups` | Org members | Age group management |
| `/[orgSlug]/admin/diamonds` | Org members | Venue/diamond management |
| `/[orgSlug]/admin/announcements` | Org members | Publish announcements |
| `/[orgSlug]/admin/rules` | Org members | Rules management |
| `/[orgSlug]/admin/contacts` | Org members | Staff contacts |
| `/[orgSlug]/admin/settings` | Owner only | Org profile, logo, slug |
| `/[orgSlug]/admin/members` | Owner only | Invite/remove admin seats |
| `/[orgSlug]/admin/billing` | Owner only | Plan, invoices, upgrade |

### 4.2 Backward Compatibility

Existing Milton Softball public URLs (`/schedule`, `/results`, `/register`, etc.) redirect 301 to `/milton-softball/[path]` to preserve any bookmarks or external links.

---

## 5. Pay Plans

### Starter — Free forever

**Target:** Community organizers, small rec leagues, first-time users.

| Feature | Value |
|---|---|
| Active tournaments | 1 |
| Teams per tournament | 16 |
| Age groups | 2 |
| Diamonds / venues | 3 |
| Admin seats | 1 (owner only) |
| Public tournament page | ✅ |
| Schedule management | ✅ |
| Results tracking | ✅ |
| Playoff wizard | ✅ |
| Team registration form | ✅ |
| Announcement publishing | ✅ |
| CSV export | ❌ |
| Email notifications | ❌ |
| Custom org logo | ❌ |
| Public bracket view | ❌ |
| Historical archive | ❌ |

---

### Pro — $29/month or $249/year

**Target:** Established clubs, multi-division tournaments, recurring annual events.

| Feature | Value |
|---|---|
| Active tournaments | 5 |
| Teams per tournament | 64 |
| Age groups | Unlimited |
| Diamonds / venues | Unlimited |
| Admin seats | 5 |
| Everything in Starter | ✅ |
| CSV export | ✅ |
| Email notifications | ✅ |
| Custom org logo | ✅ |
| Public bracket view | ✅ |
| Historical tournament archive | ✅ |
| Waitlist management | ✅ |
| Payment status tracking | ✅ |
| Priority support | ✅ |
| 14-day free trial | ✅ |

---

### Elite — $79/month or $699/year

**Target:** Provincial / state associations, multi-organization federations, high-volume operators.

| Feature | Value |
|---|---|
| Active tournaments | Unlimited |
| Teams per tournament | Unlimited |
| Admin seats | Unlimited |
| Everything in Pro | ✅ |
| Multiple simultaneous tournaments | ✅ |
| Custom domain support | ✅ (e.g. `register.yourassociation.ca`) |
| White-label (remove platform branding) | ✅ |
| REST API access | ✅ |
| Tournament duplication / template cloning | ✅ |
| Dedicated onboarding call | ✅ |
| SLA-backed support | ✅ |

---

## 6. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        SUPABASE                          │
│                                                          │
│  auth.users          organizations                       │
│  organization_members  tournaments                       │
│  age_groups  pools   teams  games  diamonds              │
│  announcements  rules  contacts  resources               │
│                                                          │
│  Row Level Security enforced on every table              │
└──────────────────────┬───────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │   Next.js App   │
              │                 │
              │  middleware.ts   │  ← validates Supabase JWT
              │  /api/admin/*   │  ← org-scoped + auth-checked
              │  /api/public/*  │  ← read-only, RLS-enforced
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌───▼─────┐
   │  Public  │   │  Org Pages │  │  Admin  │
   │  /       │   │ /[slug]/   │  │ /[slug] │
   │ /discover│   │ schedule   │  │ /admin/ │
   └──────────┘   │ results    │  └─────────┘
                  │ register   │
                  └────────────┘
```

---

## 7. Row Level Security Policies

```sql
-- organizations: members can manage their own org
CREATE POLICY "org_members_select_own"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- tournaments: org members manage their tournaments; public reads active ones
CREATE POLICY "org_members_manage_tournaments"
  ON tournaments FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "public_read_active_tournaments"
  ON tournaments FOR SELECT
  USING (is_active = true);

-- Child tables (age_groups, games, teams, etc.) chain through tournament
-- Example for games:
CREATE POLICY "org_members_manage_games"
  ON games FOR ALL
  USING (
    tournament_id IN (
      SELECT t.id FROM tournaments t
      JOIN organization_members om ON om.organization_id = t.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "public_read_games"
  ON games FOR SELECT
  USING (
    tournament_id IN (
      SELECT id FROM tournaments WHERE is_active = true
    )
  );

-- Same pattern applies to: age_groups, pools, teams, diamonds,
-- contacts, announcements, rules, rule_items, resources
```

---

## 8. Implementation Phases

### Phase 1 — Authentication Foundation
**Estimated effort:** 1–2 weeks  
**Prerequisite for:** Everything else

#### Tasks
- [ ] Enable Supabase Auth in Supabase dashboard (email/password provider)
- [ ] Install `@supabase/ssr` for Next.js App Router session cookie support
- [ ] Create `organizations` and `organization_members` tables (SQL above)
- [ ] Add `organization_id` column to `tournaments`; backfill existing data
- [ ] Build `/auth/login` — `supabase.auth.signInWithPassword()`
- [ ] Build `/auth/signup` — creates auth user + organization record atomically
- [ ] Build `/auth/invite/[token]` — recipient creates account and joins org
- [ ] Replace `lib/auth.ts` (hardcoded check) with Supabase session validation
- [ ] Replace `localStorage` session with Supabase session cookies
- [ ] Update `app/admin/layout.tsx` to check Supabase session
- [ ] Create `middleware.ts` — validates JWT, protects `/[orgSlug]/admin/*`
- [ ] Create `OrgContext` — exposes `currentOrg`, `currentTournament`, `userRole`
- [ ] Update `lib/tournament-context.tsx` to scope tournament list to user's org
- [ ] Migrate Milton Softball: create org record + Supabase Auth user for Robert, link existing tournaments

#### Key files to create / modify
```
lib/supabase-browser.ts     (client-side Supabase with session)
lib/supabase-server.ts      (server-side Supabase for middleware + API)
lib/org-context.tsx         (new, replaces tournament-context for org scoping)
middleware.ts               (new — JWT validation + route protection)
lib/auth.ts                 (gutted and replaced)
app/auth/login/page.tsx     (new)
app/auth/signup/page.tsx    (new)
app/auth/invite/[token]/page.tsx  (new)
```

---

### Phase 2 — API Security and Row Level Security
**Estimated effort:** 1 week  
**Prerequisite for:** Phase 3+

#### Tasks
- [ ] Write RLS policies for all 11 tables (pattern shown in Section 7)
- [ ] Add auth middleware to all `/api/admin/*` routes — extract user from Bearer token, verify org membership
- [ ] Remove SERVICE_ROLE_KEY from any client-accessible code path
- [ ] Enforce `tournamentId` as required (not optional) in all `lib/db.ts` functions
- [ ] Add plan limit enforcement on tournament creation: `SELECT COUNT(*) FROM tournaments WHERE organization_id = $1` vs `organization.tournament_limit`
- [ ] Add org-scoping to `getTournaments()` — only return tournaments the current user's org owns
- [ ] Audit `/api/registrations` — currently returns all registrations with no auth; restrict to tournament owner

---

### Phase 3 — Multi-Org Routing and Page Migration
**Estimated effort:** 1–2 weeks

#### Tasks
- [x] Restructure `app/` to support `[orgSlug]` dynamic segment:
  ```
  app/
    (marketing)/
      page.tsx              ← new marketing landing
    (public)/
      discover/page.tsx     ← new search page
    [orgSlug]/
      layout.tsx            ← resolves slug → org, provides OrgContext
      page.tsx              ← org home
      schedule/page.tsx     ← moved from /schedule
      results/page.tsx      ← moved from /results
      teams/page.tsx        ← moved from /teams
      register/page.tsx     ← moved from /register
      rules/page.tsx        ← moved from /rules
      news/page.tsx         ← moved from /news
      admin/
        layout.tsx          ← protected by session + org membership
        page.tsx
        tournaments/page.tsx
        schedule/page.tsx
        ... (all existing admin pages)
        settings/page.tsx   ← new
        members/page.tsx    ← new
        billing/page.tsx    ← new
  ```
- [x] Add org slug resolution in middleware — attach `x-org-id` header for downstream use
- [x] Update all `db.ts` calls to pass `orgId` where needed
- [x] Add 301 redirects: `/schedule` → `/milton-softball/schedule` (and all other public routes)
- [x] Update `YearSelector` component to show only the current org's tournaments

---

### Phase 4 — Marketing Landing Page and Discovery
**Estimated effort:** 1 week

#### Tasks
- [x] Build `app/(marketing)/page.tsx` — replaces current home page:
  - Hero with platform value prop and "Start your tournament" CTA
  - Feature highlights: playoff wizard, bracket view, registration management
  - Pricing table (Starter / Pro / Elite) with feature comparison
  - Showcase section linking to Milton Softball as a live example
- [x] Build `app/(public)/discover/page.tsx`:
  - Search tournaments by name, sport, location, date range
  - Filter by status: upcoming / active / completed
  - Tournament cards: org name, logo, age groups, team count, dates, link to org page
  - "Browse teams" for parents/players searching across organizations
- [x] Create `GET /api/public/tournaments` endpoint — RLS-protected, returns only `is_public = true` orgs with `is_active = true` tournaments
- [x] Add `is_public` toggle to org settings (default: true)

---

### Phase 5 — Stripe Billing
**Estimated effort:** 1–2 weeks

#### Tasks
- [x] Install `stripe` and `@stripe/stripe-js`
- [ ] Create Stripe products and prices: (Pending Stripe account setup)
  - Starter: free (no Stripe product needed)
  - Pro Monthly: $29/month, Pro Annual: $249/year
  - Elite Monthly: $79/month, Elite Annual: $699/year
- [x] Build `/[orgSlug]/admin/billing/page.tsx`:
  - Current plan and usage (tournaments used / limit)
  - Upgrade/downgrade plan buttons
  - Link to Stripe Customer Portal for invoice history and payment method
- [x] Create `POST /api/billing/create-checkout` — creates Stripe Checkout session, redirects to Stripe-hosted payment page
- [x] Create `POST /api/billing/webhook` — Stripe webhook handler:
  - `customer.subscription.created` → set `plan_id`, `tournament_limit`, `subscription_status`
  - `customer.subscription.updated` → handle plan changes, update limits
  - `customer.subscription.deleted` → downgrade to Starter, enforce new limits
  - `invoice.payment_failed` → set `subscription_status = 'past_due'`, email owner
- [ ] Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to environment (Setup remaining)
- [x] Enforce plan limits server-side on every tournament create (never trust client)
- [x] Configure 14-day free trial on Pro plan at signup (Stripe handles natively)
- [x] Show plan-gate warnings in UI inline (e.g. "You've reached your 1 tournament limit — upgrade to Pro")

---

### Phase 6 — Org Admin UX and Seat Management
**Estimated effort:** 1 week

#### Tasks
- [x] Build `/[orgSlug]/admin/settings/page.tsx`:
  - Update org name, slug (with URL change warning), logo upload
  - Toggle `is_public` (listed in /discover or not)
- [x] Build `/[orgSlug]/admin/members/page.tsx`:
  - List current members with role and last login
  - Invite by email (sends magic link via Resend/Postmark)
- [x] Remove member / change role
- [x] Show seat usage vs plan limit
- [x] Enforce seat limits server-side on invite creation
- [x] Plan-gate features in admin UI with consistent "upgrade" tooltip pattern
- [x] Add `role`-based UI restrictions:
  - `staff` — can edit schedule and results only
  - `admin` — full tournament management, no billing/settings
  - `owner` — everything including billing, settings, member management

---

## 9. Migration Plan for Existing Data

The existing Milton Softball data requires no structural changes beyond one new column. Steps to run once at Phase 1 completion:

```sql
-- 1. Create the organization record
INSERT INTO organizations (id, name, slug, plan_id, tournament_limit)
VALUES (
  gen_random_uuid(),           -- save this UUID as $MILTON_ORG_ID
  'Milton Softball Association',
  'milton-softball',
  'pro',
  5
);

-- 2. Link all existing tournaments to this org
UPDATE tournaments
SET organization_id = '$MILTON_ORG_ID'
WHERE organization_id IS NULL;

-- 3. Create the owner member record (after Robert's Supabase Auth user is created)
INSERT INTO organization_members (organization_id, user_id, role, accepted_at)
VALUES ('$MILTON_ORG_ID', '$ROBERT_USER_ID', 'owner', now());
```

Existing public URLs redirect to the new org-scoped paths. No data is deleted. No public-facing downtime.

---

## 10. Tech Stack Additions

| Package | Purpose | Install |
|---|---|---|
| `@supabase/ssr` | Supabase session cookies in Next.js App Router | `pnpm add @supabase/ssr` |
| `stripe` | Stripe server-side API | `pnpm add stripe` |
| `@stripe/stripe-js` | Stripe client-side Elements | `pnpm add @stripe/stripe-js` |
| `resend` | Transactional email (invites, confirmations) | `pnpm add resend` |

No additional auth provider (Auth0, Clerk, Firebase) is needed. Supabase Auth covers all requirements and integrates natively with RLS policies.

---

## 11. New Environment Variables

```bash
# Existing (keep)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-side only, never exposed to client

# New — Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# New — Email
RESEND_API_KEY=

# New — App
NEXT_PUBLIC_APP_URL=https://www.yourdomain.com   # used for invite links, redirects
```

---

## 12. Effort Estimate

| Phase | Description | Estimated Effort |
|---|---|---|
| 1 | Auth Foundation | 1–2 weeks |
| 2 | API Security + RLS | 1 week |
| 3 | Multi-Org Routing + Page Migration | 1–2 weeks |
| 4 | Discovery and Marketing Landing | 1 week |
| 5 | Stripe Billing | 1–2 weeks |
| 6 | Org Admin UX + Seat Management | 1 week |
| **Total** | | **6–9 weeks solo / 3–4 weeks with 2 devs** |

Phases 1 and 2 are sequential prerequisites. Phases 4, 5, and 6 can be parallelized once Phase 3 routing is stable.

---

## 13. Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth provider | Supabase Auth | Already in stack, integrates natively with RLS, no additional service |
| Multi-tenancy boundary | Organization (not tournament) | Tournaments are time-scoped events; org is the persistent paying entity |
| URL scheme | `/{orgSlug}/` path prefix | Simpler than subdomains, native to Next.js App Router dynamic routes |
| RLS enforcement | Supabase RLS (database-level) | Defense in depth; protects data even if application layer has a bug |
| Billing | Stripe | Industry standard, handles trials, upgrades, downgrades, and invoicing natively |
| Email | Resend | Simple API, generous free tier, good Next.js integration |
| Plan limits | Enforced server-side in API routes AND via Stripe webhooks | Never trust client; Stripe is the source of truth for entitlements |
