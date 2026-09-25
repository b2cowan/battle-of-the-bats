# FieldLogicHQ

**Multi-tenant sports club and league management platform for Canadian sports organizations.**

FieldLogicHQ gives sports clubs and associations a single place to run their entire operation — tournaments, house leagues, rep programs, coaching staff, financials, and public-facing org pages — under one platform with per-org multi-tenancy and a SaaS billing model.

---

## What it does

Each organization gets its own isolated space at `/{orgSlug}/`. Within that space, the platform is modular: orgs pay for the capabilities they need, and the admin shell adapts to show only what's enabled.

### Core modules (all plans)
- **Tournaments** — bracket management, scheduling, score entry, public results
- **Communications** — announcements, email dispatch
- **Members** — roles, capabilities, invitations, suspension

### Add-on modules (by plan tier)
- **Public Org Site** (`module_public_site`) — branded org home page, social links, hero banner
- **House League** (`module_house_league`) — seasons, divisions, registration, draft, schedule, standings, notifications
- **Accounting** (`module_accounting`) — ledgers, entries, transfers, CSV export, treasurer role
- **Rep Teams** (`module_rep_teams`) — program years, tryout registration, roster, coaches portal, player docs, team accounting

### Platform
- `/platform-admin` — superuser shell for FieldLogicHQ staff: org management, audit log, billing overrides, platform users

---

## Intended audience

**Operators:** Canadian youth sports clubs and associations — typically volunteer-run orgs managing 50–500 players across recreational and competitive streams.

**Roles within an org:** Owner, Admin, League Admin, Registrar, Treasurer, Coach (head/assistant), Official/Scorekeeper, Staff.

**End users:** Parents registering children for house league or rep tryouts; coaches managing team schedules and accounting; officials submitting game scores from the field.

---

## Pricing

Bundled SaaS tiers — no à la carte modules. **Plan names, prices, capacity bands, trials and gating
live in exactly one place: [docs/agents/strategy/PLAN_PRICING_FACTS.md](docs/agents/strategy/PLAN_PRICING_FACTS.md)**
(kept matched to `lib/plan-config.ts`). This README deliberately does not restate them — the table
that used to sit here drifted to a Club price and a League module list the facts doc had already
replaced (found 2026-09-25, Club Tier Readiness evaluation).

**Free floors layer over the paid tiers.** Each operator type can start free in their natural unit — a Free Tournament (org on the `tournament` plan), a Free League Starter (capped house-league entitlement profile), and a Free Basic Coaches Portal (`basic_coach_teams`, no org, no subscription). Free is delivered as scoped per-operator floors unified under one login via `/home`, not as one mega-subscription. See `docs/projects/active/FREE_TIER_COACHES_UNIFIED_PLAN.md`.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (PKCE flow) |
| Storage | Supabase Storage (player documents) |
| Email | Resend via fieldlogichq.ca |
| Hosting | AWS Amplify (branch-based) |
| Styling | CSS Modules + global design tokens |

---

## Branch and deployment policy

| Branch | Environment | Notes |
|---|---|---|
| `dev` | dev.fieldlogichq.ca | All AI and in-progress work goes here |
| `master` | fieldlogichq.ca (production) | Only push when explicitly releasing |

Never push `master` without an explicit deployment instruction. Amplify CI/CD triggers automatically on push.

---

## Running locally

```bash
pnpm dev
```

Requires `.env.local` with:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`

---

## AI agent context

See `CLAUDE.md` → `AGENTS.md` → `AGENCY_RULES.md` for workflow rules that apply to all AI coding assistants working in this repo. Key rules: plan-first, PM UX review before code, `dev` branch only, browser testing is the human's responsibility.
