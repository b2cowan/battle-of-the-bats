# AWS Amplify Dev Environment Strategy

**Status:** Documentation only — no Amplify console changes made yet.
**Date:** 2026-05-11

---

## Architecture Decision

**Chosen pattern: Branch-based deployments within a single Amplify app.**

Connect the existing Amplify app to both the `master` branch (production) and the `dev` branch (staging/dev). Each branch gets its own isolated build, URL, and environment variables within the same Amplify project.

### Options evaluated

| Option | Description | Verdict |
|---|---|---|
| **Branch-based (same app)** | Add `dev` branch to existing Amplify app | **Recommended** |
| PR preview environments | Ephemeral deployments per pull request | Not suitable — ephemeral, not persistent |
| Second Amplify app | New Amplify project pointing at `dev` branch | Unnecessary overhead; doubles management surface |

### Why branch-based wins

- **Cost:** No additional fixed costs. You pay for build minutes and SSR compute per-request — same model as production, proportional to actual dev traffic (which will be low).
- **Isolation:** Each branch has its own environment variables, build output, and CDN distribution. Dev changes cannot affect production.
- **Promotion path:** Promotion is a `git merge dev master && git push origin master`. Amplify detects the push and deploys automatically — no manual Amplify steps.
- **Single management surface:** One Amplify app to monitor, one set of build logs, one place to configure branch variables.

---

## URL Strategy

**Chosen URL:** `https://dev.fieldlogichq.ca`

### Options evaluated

| Option | SSL | DNS complexity | Stakeholder-shareable | Verdict |
|---|---|---|---|---|
| `dev.fieldlogichq.ca` | Auto via ACM (Amplify handles) | 1 CNAME in Route 53 | Yes | **Recommended** |
| Auto Amplify URL (`dev.xxxxxxx.amplifyapp.com`) | Included | None | Technically yes, but ugly | Acceptable fallback only |
| Separate domain (`fieldlogichq.dev` etc.) | Separate cert + DNS zone | High | Yes | Unnecessary cost and complexity |

### Why `dev.fieldlogichq.ca`

- The task requirement is that the URL be publicly shareable for stakeholder review. A branded subdomain is the professional choice.
- Route 53 already manages `fieldlogichq.ca` DNS — adding one CNAME record is trivial.
- Amplify's Custom Domain flow provisions a free ACM SSL certificate for the subdomain automatically. You do **not** need to touch the existing production cert.
- The existing production cert covers `www.fieldlogichq.ca` (and likely `fieldlogichq.ca` apex). Amplify provisions a **separate** ACM cert for `dev.fieldlogichq.ca` — no conflict.

### SSL note

Amplify provisions certs via ACM in `us-east-1` (required for Amplify's CloudFront-backed hosting). The domain verification is automatic when the Route 53 hosted zone is in the same AWS account as the Amplify app. If they differ, you will be given a CNAME record to add manually for cert validation.

---

## Environment Variable Strategy

### How Amplify branch-scoping works

In Amplify Console → **App settings → Environment variables**, each variable can be scoped to:
- **All branches** (default) — applies everywhere
- **Specific branches** — branch-level override takes precedence

Set the default value to the production value, then add a branch-level override for `dev` with the test/dev value. Both branches share the same `amplify.yml` build script.

### Variable configuration table

| Variable | Scope | `master` (Production) value | `dev` value |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Per-branch | `https://www.fieldlogichq.ca` | `https://dev.fieldlogichq.ca` |
| `NEXT_PUBLIC_SUPABASE_URL` | Per-branch | Production Supabase project URL | Dev Supabase project URL *(see Supabase note)* |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Per-branch | Production anon key | Dev anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Per-branch | Production service role key | Dev service role key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Per-branch | Live publishable key (`pk_live_...`) | Test publishable key (`pk_test_...`) |
| `STRIPE_SECRET_KEY` | Per-branch | Live secret key (`sk_live_...`) | Test secret key (`sk_test_...`) |
| `RESEND_API_KEY` | Per-branch | Production Resend key | Dev Resend key *(see Resend note)* |
| `RESEND_FROM` | All branches | `FieldLogicHQ <noreply@fieldlogichq.ca>` | Same (or dev-specific sender) |
| `PLATFORM_ADMIN_EMAILS` | All branches | `fieldlogichq@gmail.com` | Same |

### `amplify.yml` impact

The existing `amplify.yml` echoes server-side vars into `.env.production` during the build phase:

```yaml
- echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> .env.production
- echo "RESEND_API_KEY=$RESEND_API_KEY" >> .env.production
- echo "RESEND_FROM=$RESEND_FROM" >> .env.production
- echo "PLATFORM_ADMIN_EMAILS=$PLATFORM_ADMIN_EMAILS" >> .env.production
- echo "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" >> .env.production
```

**No changes to `amplify.yml` are needed.** The same echo commands run for both branches. Amplify injects the branch-scoped variable values at build time, so the echo commands automatically write the correct values for whichever branch is building.

When Stripe keys are added, add corresponding echo lines:
```yaml
- echo "STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY" >> .env.production
```

`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` does **not** need to be echoed — it is a `NEXT_PUBLIC_` var and is baked into the client bundle by `next build` automatically.

---

## Gotchas and Constraints

### 1. `NEXT_PUBLIC_*` vars are compile-time constants
Variables prefixed `NEXT_PUBLIC_` are inlined into the JavaScript bundle at build time. They cannot be changed without a rebuild. This means:
- `NEXT_PUBLIC_APP_URL` must be set correctly in the Amplify console **before** the dev branch's first build.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test vs live) is likewise baked in — a dev build will embed the test key permanently until rebuilt.

### 2. Server-side vars require the `amplify.yml` echo pattern
Amplify does not inject environment variables into the Next.js server runtime directly in standalone output mode. Any server-side variable must be explicitly echoed into `.env.production` during the build phase. If you add a new server-side env var (e.g. `STRIPE_SECRET_KEY`, a future `OPENAI_API_KEY`), you must add a corresponding echo line to `amplify.yml` or the var will be `undefined` at runtime.

### 3. Supabase — strongly recommended: separate dev project
The current setup uses one Supabase project for both local dev and production. For a live dev environment, a dedicated Supabase project (free tier is sufficient) is strongly recommended:
- Prevents test data (fake registrations, tryout submissions, etc.) from appearing in the production database
- Allows running destructive migrations or schema experiments in dev without risk to production data
- Dev Supabase project would need migrations re-applied (or a pg_dump from prod with data scrubbed)

Until a separate Supabase project is created, the dev Amplify deployment can point at the production Supabase project, but this carries data contamination risk and should be treated as a temporary state.

### 4. Resend — use a separate API key for dev
Resend API keys can be scoped or created per project. For the dev environment, create a second API key in the same Resend account (or a separate workspace) and scope it to the `dev` branch. This ensures:
- Dev emails (confirmations, invite links, etc.) do not use production email quota
- Dev email sends are separately identifiable in Resend logs
- A misconfigured dev template cannot spam real users

The `RESEND_FROM` sender address can remain the same (`noreply@fieldlogichq.ca`) since the domain is already verified in Resend, or a distinct sender like `noreply+dev@fieldlogichq.ca` can be used for clarity (requires no additional DNS changes if the domain is already verified).

### 5. Stripe webhooks
If Stripe webhooks are implemented (for subscription lifecycle events), each environment needs its own webhook endpoint registered in the Stripe dashboard:
- Production: `https://www.fieldlogichq.ca/api/webhooks/stripe`
- Dev: `https://dev.fieldlogichq.ca/api/webhooks/stripe`

Each endpoint gets its own `STRIPE_WEBHOOK_SECRET` from the Stripe dashboard. This must also be echoed into `.env.production` in `amplify.yml` and scoped per-branch in Amplify Console.

---

## Setup Checklist

### Step 1 — Connect `dev` branch in Amplify Console
- [ ] Amplify Console → App → Hosting → Branch deployments → Connect branch → select `dev`
- [ ] Verify build settings inherit from the existing `amplify.yml`
- [ ] Trigger a first build and confirm it succeeds (expect it to fail on missing env vars — that's fine, fix in Step 2)

### Step 2 — Configure environment variables
- [ ] Amplify Console → App settings → Environment variables
- [ ] For each existing variable currently set to production values, add a branch-specific override for `dev`:
  - `NEXT_PUBLIC_APP_URL` → `dev` branch → `https://dev.fieldlogichq.ca`
  - `NEXT_PUBLIC_SUPABASE_URL` → `dev` branch → *(dev Supabase URL when available)*
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `dev` branch → *(dev anon key)*
  - `SUPABASE_SERVICE_ROLE_KEY` → `dev` branch → *(dev service role key)*
  - `RESEND_API_KEY` → `dev` branch → *(new dev Resend API key)*
- [ ] When Stripe is configured, add per-branch `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`
- [ ] Trigger a new `dev` branch build and confirm all vars resolve correctly

### Step 3 — Add `dev.fieldlogichq.ca` custom domain
- [ ] Amplify Console → App → Hosting → Custom domains → Add domain → `fieldlogichq.ca`
- [ ] Under domain management, add subdomain prefix `dev` → map to `dev` branch
- [ ] Amplify generates an ACM certificate validation CNAME record — add it to Route 53
- [ ] Amplify generates a routing CNAME record pointing `dev.fieldlogichq.ca` → Amplify CDN — add it to Route 53
- [ ] Wait for cert validation (typically 5–30 minutes) and verify `https://dev.fieldlogichq.ca` loads

### Step 4 — Create dev Supabase project (recommended)
- [ ] Create a new Supabase project (free tier) for dev
- [ ] Apply all migrations from `supabase/migrations/` to the new project
- [ ] Update dev branch env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) with new project credentials
- [ ] Trigger a `dev` branch rebuild

### Step 5 — Verify the live dev environment
- [ ] Confirm `https://dev.fieldlogichq.ca` loads and shows the app
- [ ] Log in with a test account; confirm org context works
- [ ] Test Stripe checkout in test mode (card `4242 4242 4242 4242`) if billing is active
- [ ] Confirm dev emails send from the dev Resend key (check Resend dashboard logs)
- [ ] Confirm production (`https://www.fieldlogichq.ca`) is unaffected

### Step 6 — Establish the dev → prod promotion workflow
- [ ] Confirm: `git checkout master && git merge dev && git push origin master` triggers a production Amplify build
- [ ] Confirm production build picks up master-branch env vars (live Stripe keys, production Supabase)
- [ ] Document in team workflow: dev is always the commit target; master is production; never force-push master

---

## Cost Estimate

| Item | Cost |
|---|---|
| Amplify build minutes (dev branch) | ~$0.01/min; low-traffic dev branch costs cents per build |
| Amplify SSR compute (dev) | Per-request; dev traffic is near zero — negligible |
| ACM certificate for `dev.fieldlogichq.ca` | Free (ACM certs are always free in AWS) |
| Route 53 DNS records | Free (within existing hosted zone) |
| Supabase dev project (free tier) | Free (500 MB DB, 1 GB storage) |
| Resend dev API key (same account) | No additional cost; shares account sending quota |

**Total estimated additional monthly cost: < $5 CAD**, driven almost entirely by any SSR compute requests to the dev URL.
