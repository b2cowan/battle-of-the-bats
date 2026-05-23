# UAT Agent Setup Guide

This guide sets up the `/uat` slash command for FieldLogicHQ browser-based
acceptance testing. The agent uses Playwright to drive a real Chromium browser
against your local dev server and proposes code fixes for every failure.

---

## 1. Prerequisites

- `pnpm` installed and `node_modules` up to date (`pnpm install`)
- Dev server running: `npm run dev` → `http://localhost:3000`
- At least one test org in your dev Supabase database

---

## 2. Run the SQL setup script

Open **`tests/uat/create-uat-accounts.sql`** in the Supabase SQL Editor (dev project).

1. Edit the **CONFIGURATION block** at the top of the file:
   - Set `v_password` to a strong password
   - Optionally change email addresses (defaults shown below work fine)
2. Run the whole script — it creates everything from scratch:

| What | Details |
|------|---------|
| `uat-test-org` | Tournament plan (free tier) — used for most tests |
| `uat-plus-org` | Tournament Plus plan — used for plan-gating tests |
| 4 auth accounts | Platform admin, org owner, org admin, coach |
| App rows | `platform_users`, `organization_members`, `rep_team_coaches` |

**Wipe-safe:** Both orgs are tagged `[UAT_PROTECTED]` in `internal_notes` and the
UAT emails are excluded from the auth-user delete. The dev-tools "Wipe Everything"
button will never touch UAT data.

The script is safe to re-run — all inserts use `ON CONFLICT` or existence checks.

---

## 3. Add env vars to `.env.local`

Add the following block to `.env.local` (never commit this file).
Use the **same emails and password** you set in the SQL script:

```bash
# ── UAT Agent configuration ───────────────────────────────────────────────────
UAT_BASE_URL=http://localhost:3000

# Must match v_org_slug in the SQL script (default: uat-test-org)
UAT_ORG_SLUG=uat-test-org

# Must match v_plus_org_slug in the SQL script (default: uat-plus-org)
UAT_PLUS_ORG_SLUG=uat-plus-org

# Must match v_platform_admin_email + v_password in the SQL script
UAT_PLATFORM_ADMIN_EMAIL=uat-platform@fieldlogichq.ca
UAT_PLATFORM_ADMIN_PASSWORD=UATPassword2026!

# Must match v_org_owner_email + v_password in the SQL script
UAT_ORG_OWNER_EMAIL=uat-owner@uat-test-org.local
UAT_ORG_OWNER_PASSWORD=UATPassword2026!

# Must match v_org_admin_email + v_password in the SQL script
UAT_ORG_ADMIN_EMAIL=uat-admin@uat-test-org.local
UAT_ORG_ADMIN_PASSWORD=UATPassword2026!

# Must match v_coach_email + v_password in the SQL script
UAT_COACH_EMAIL=uat-coach@uat-test-org.local
UAT_COACH_PASSWORD=UATPassword2026!
```

> **Wipe protection:** The `UAT_*_EMAIL` vars are also read by the dev-tools
> wipe route (`app/api/dev/seed/wipe/route.ts`) to exclude those accounts from
> auth-user deletion. The org-level protection comes from the `[UAT_PROTECTED]`
> marker written directly into the database by the SQL script, so it works even
> if these env vars are temporarily absent.

---

## 4. Install Playwright browsers (one-time)

```powershell
npx playwright install chromium
```

This downloads the Chromium binary used by the test runner. Takes ~200 MB.

---

## 5. Run the UAT agent

In Claude Code, type:

```
/uat                    # full suite
/uat auth               # auth scenarios only
/uat tournament-admin   # tournament admin scenarios only
/uat plan-gating        # plan gating checks
/uat platform-admin     # platform admin checks
/uat coaches            # coaches portal checks
```

The agent will:
1. Verify the dev server is reachable
2. Log in as each test role and cache the session
3. Run the target Playwright scenarios
4. Analyse failures and propose numbered fixes
5. **Wait for your sign-off** before modifying any file

---

## 6. Running tests directly (without the agent)

```powershell
# Auth setup (log in as each role, save sessions)
npx playwright test --config playwright.config.ts --project=auth-setup

# Full suite
npx playwright test --config playwright.config.ts --project=uat

# Single file
npx playwright test --config playwright.config.ts --project=uat tests/uat/scenarios/auth.spec.ts

# With browser visible (headed mode — great for debugging)
npx playwright test --config playwright.config.ts --project=uat --headed

# Open the HTML report after a run
npx playwright show-report tests/uat/results/html
```

---

## 7. Adding new test scenarios

1. Create a new file in `tests/uat/scenarios/<area>.spec.ts`
2. Import from `../helpers/fixtures` (not raw `@playwright/test`)
3. Use the provided fixtures: `ownerPage`, `adminPage`, `coachPage`, `platformAdminPage`, `anonPage`, `orgSlug`
4. Group tests with `test.describe('Area / sub-area', () => { ... })`
5. The `/uat` command discovers `*.spec.ts` files automatically

---

## 8. Gitignore entries

The following are already added to `.gitignore`:

```
tests/uat/.auth/
tests/uat/results/
playwright-report/
test-results/
```

Auth session files contain Supabase tokens — **never commit them**.

---

## 9. Findings log

Every UAT run appends to `UAT_FINDINGS.md` in the repo root. The agent marks
findings as `[FIXED]` after applying an approved fix. You can review the history
of all issues across sessions there.
