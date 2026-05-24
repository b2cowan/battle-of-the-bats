'use client';
import { useState } from 'react';
import {
  Sparkles, GitBranch, CreditCard, Database, FileText, FlaskConical,
  Rocket, Bug, ArrowRight, MessageSquare, Zap, ChevronLeft, BookOpen,
  Info, Terminal, Gauge, Megaphone,
} from 'lucide-react';
import styles from './playbook.module.css';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type AgentKey = 'design' | 'ux' | 'billing' | 'db' | 'dba' | 'plan' | 'uat' | 'release' | 'debug' | 'marketing';
type AccentColor = 'green' | 'blue' | 'yellow' | 'purple' | 'orange' | 'red' | 'cyan' | 'pink' | 'teal' | 'lime';

interface AgentDef {
  key: AgentKey;
  cmd: string;
  Icon: React.ElementType;
  accent: AccentColor;
  headline: string;
  tags: string[];
  loadsFrom: string[];
  rules: string[];
  examples: string[];
  notes?: string[];
  extraSections?: { title: string; content: React.ReactNode }[];
}

/* ─── Agent definitions ──────────────────────────────────────────────────────── */

const AGENTS: AgentDef[] = [
  {
    key: 'design',
    cmd: '/design',
    Icon: Sparkles,
    accent: 'green',
    headline: 'Visual design review and token guidance',
    tags: ['Screenshots', 'Colour questions', 'Spacing', 'Component polish'],
    loadsFrom: [
      'memory/design_system.md — full CSS token reference',
      'memory/design_decisions.md — all past decisions (binding)',
      'memory/design_principles.md — platform UX philosophy',
      'memory/project_milton_bats_palette.md — Milton Softball theme rules',
    ],
    rules: [
      'Always include a screenshot for visual questions — descriptions alone are ambiguous.',
      'State which plan tier and user role the screenshot shows.',
      'Say what feels wrong if you know ("feels cluttered", "hierarchy unclear") — the agent will agree or push back with a reason.',
      'The agent returns token names (--surface-2, --radius-sm), never raw hex values.',
      'Every accepted decision gets written to memory/design_decisions.md and is binding in all future sessions — prompt "log any decisions we made" before closing.',
    ],
    examples: [
      '/design [screenshot] — tournament dashboard, free tier; hierarchy feels flat, what needs to change?',
      '/design [screenshot] — teams page empty state; this needs a proper call to action',
      '/design what token should I use for a "payment pending" badge background?',
      '/design review app/[orgSlug]/admin/tournaments/registrations/teams-admin.module.css — does the table styling match our system?',
      '/design [screenshot] — is this modal consistent with the patterns we\'ve established?',
      '/design — tournament review continued; dashboard signed off last session (decisions logged). Today: schedule page. [screenshot]',
      '/design what radius and shadow should a confirmation modal use?',
      '/design the filter chip bar looks inconsistent — [screenshot] — what\'s wrong with it?',
    ],
    notes: [
      'Design decisions are the most persistent output of any agent session. They accumulate in memory/design_decisions.md and are automatically loaded in every future /design conversation — this is how visual consistency is maintained across weeks of development.',
      'Do not mix /design with /ux in the same conversation. Visual review (design) and flow review (ux) need separate clean contexts.',
    ],
  },
  {
    key: 'ux',
    cmd: '/ux',
    Icon: GitBranch,
    accent: 'blue',
    headline: 'User flow and completeness review',
    tags: ['Empty states', 'Error handling', 'Loading states', 'Role access gaps'],
    loadsFrom: [
      'memory/project_ux_review.md — 27 findings from 2026-05-11 review, phase status',
      'memory/design_principles.md — UX conventions (forms, tables, modals, empty states)',
    ],
    rules: [
      'Give the agent a role (org admin, coach, public visitor) and an action (registering a team, viewing the schedule) — generic reviews are less useful.',
      'Pointing at a file path is faster than a screenshot for code-level completeness reviews.',
      'Ask about specific failure scenarios: "what does the user see when the API call fails?"',
      'The agent checks five things for every flow: happy path, edge cases, error path, recovery, and confirmation for destructive actions.',
      '/ux is for flows and completeness — send visual/styling issues to /design instead.',
    ],
    examples: [
      '/ux review app/[orgSlug]/admin/tournaments/registrations/page.tsx — org admin, check all five flow states',
      '/ux what does a free-tier org admin see when they try to access auto-schedule? Is the upgrade path clear?',
      '/ux trace the full flow for a team registering for a tournament — what can go wrong at each step?',
      '/ux what happens when the bulk team approval API call fails halfway through?',
      '/ux — audit all empty states in the tournament admin section. Which pages are missing them entirely?',
      '/ux review app/[orgSlug]/admin/tournaments/schedule/page.tsx — what destructive actions are missing a confirmation step?',
      '/ux [screenshot] — org admin trying to cancel a registration; is the recovery path obvious?',
      '/ux what does a coach see if they navigate to a page they don\'t have permission to view?',
    ],
    extraSections: [
      {
        title: 'User roles the agent knows',
        content: (
          <table className={styles.roleTable}>
            <thead><tr><th>Role</th><th>Access path</th><th>Primary tasks</th></tr></thead>
            <tbody>
              <tr><td><code>Org admin</code></td><td><code>/[orgSlug]/admin/</code></td><td>Full org management, billing, settings</td></tr>
              <tr><td><code>Staff</code></td><td><code>/[orgSlug]/admin/</code></td><td>Scoped to assigned tournaments only</td></tr>
              <tr><td><code>Coach</code></td><td><code>/[orgSlug]/coaches/</code></td><td>Own team: roster, events, expenses</td></tr>
              <tr><td><code>Public / parent</code></td><td><code>/[orgSlug]/</code></td><td>Registration, schedules, scores</td></tr>
              <tr><td><code>Platform admin</code></td><td><code>/platform-admin/</code></td><td>Cross-org oversight, billing, audit</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
  },
  {
    key: 'billing',
    cmd: '/billing',
    Icon: CreditCard,
    accent: 'yellow',
    headline: 'Plan gating and Stripe guidance',
    tags: ['Gate audits', 'Upsell copy', 'New feature flags', 'Downgrade logic'],
    loadsFrom: [
      'lib/plan-features.ts — FEATURE_MIN_PLAN map and hasPlanFeature()',
      'lib/plan-config.ts + lib/plan-config-db.ts — plan configuration helpers',
      'lib/plan-gating-server.ts — server-side gating utilities',
      'lib/billing-retention.ts — downgrade and cancellation handling',
      'components/billing/UpgradeGate.tsx — client-side upsell gate component',
      'memory/project_stripe_plan.md — Stripe integration phase status',
      'memory/project_pricing_strategy.md — tier names, prices, positioning rules',
    ],
    rules: [
      'Always use hasPlanFeature(org.plan_id, \'feature_key\') — never compare plan_id strings directly.',
      'Price IDs are in the stripe_prices DB table (migration 048) — never hardcode them.',
      'When adding a new gated feature: add to PlanFeature union → FEATURE_MIN_PLAN → server guard → UpgradeGate wrapper.',
      'Use plan display names in copy: Tournament, Tournament Plus, League, Club — not Starter/Pro/Elite.',
      'Upsell messaging: "available on Tournament Plus and above" — never "upgrade to unlock".',
      'On downgrade: data is retained, access is gated — never hard-delete on plan change.',
    ],
    examples: [
      '/billing audit all plan gates in the tournament admin section — find missing locks and free-tier exposure',
      '/billing I want to add a "clone tournament" button — which plan, and walk me through the full implementation',
      '/billing is the auto-schedule feature correctly gated? Check the schedule page and its API route.',
      '/billing what upsell message should show when a free-tier admin tries to access sealed archives?',
      '/billing if an org downgrades from Tournament Plus to Tournament, what happens to their sealed archives?',
      '/billing review the upsell messaging on app/[orgSlug]/admin/tournaments/archives/page.tsx — does it match our copy rules?',
      '/billing we need a new "export registrations to PDF" feature — what plan should gate it and how do I implement the gate?',
    ],
    extraSections: [
      {
        title: 'Plan tiers',
        content: (
          <table className={styles.roleTable}>
            <thead><tr><th>Plan ID</th><th>Display name</th><th>Monthly</th><th>Key unlock</th></tr></thead>
            <tbody>
              <tr><td><code>tournament</code></td><td>Tournament</td><td>Free</td><td>1 active tournament, manual scheduling</td></tr>
              <tr><td><code>tournament_plus</code></td><td>Tournament Plus</td><td>$39</td><td>Auto-schedule, brackets, PDF exports</td></tr>
              <tr><td><code>league</code></td><td>League</td><td>$89</td><td>Public org page, House League module</td></tr>
              <tr><td><code>club</code></td><td>Club</td><td>$179</td><td>Accounting, Rep Teams, unlimited seats</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
  },
  {
    key: 'db',
    cmd: '/db',
    Icon: Database,
    accent: 'purple',
    headline: 'Supabase schema, queries, and migrations',
    tags: ['Query writing', 'New tables', 'RLS policies', 'Migration SQL'],
    loadsFrom: [
      'memory/reference_db_schema.md — complete table+column list from dev Supabase 2026-05-11',
      'lib/db.ts — Supabase client helpers and shared query utilities',
      'lib/api-auth.ts — how routes resolve org context and authenticate',
    ],
    rules: [
      'Always verify a column or table exists in memory/reference_db_schema.md before writing a query.',
      'Include route context: "this is a server-side API route, org-scoped" — it affects which client to use.',
      'Ask for the RLS policy alongside any new table migration — never design a table without one.',
      'Use supabaseAdmin (service role) only for platform-admin operations — never expose it to client components.',
      'Every org-scoped query must filter by org_id even when RLS is present — defence in depth.',
      'Never use DROP COLUMN or DROP TABLE without a deprecation plan — prefer nullable columns + soft deletes.',
      'Add an index on every org_id column and every FK used in WHERE clauses.',
    ],
    examples: [
      '/db — I want to query all teams for a tournament grouped by age group and pool. What columns are available and what\'s the best join pattern?',
      '/db — write a server-side query that fetches all active tournaments for an org, including team count per tournament. Org-scoped.',
      '/db — I need a table to store per-tournament notification preferences. Design the table, migration SQL, and RLS policy.',
      '/db — review this migration SQL before I run it: [paste SQL]. Check for missing indexes and RLS gaps.',
      '/db does the pool_id column exist on the teams table? I\'m getting a query error.',
      '/db — write a migration to add a `cloned_from_id` nullable FK column to the tournaments table.',
      '/db what\'s the correct pattern for a bulk update query that marks multiple teams as accepted?',
    ],
    notes: [
      'Tables that do NOT exist (common mistakes): rule_sections. The schema file has a full "does not exist" list — the agent checks this before writing any query.',
    ],
  },
  {
    key: 'dba',
    cmd: '/dba',
    Icon: Gauge,
    accent: 'teal',
    headline: 'Strategic database architecture review',
    tags: ['Schema health', 'Multi-tenant integrity', 'Indexing strategy', 'Migration safety gate'],
    loadsFrom: [
      'memory/reference_db_schema.md — complete table+column list (43 tables across 5 modules)',
      'docs/active/DB_ARCHITECTURE_REVIEW.md — running findings log; 9 open findings on record',
      'AGENCY_RULES.md — platform context (multi-tenant, Canadian sports orgs, modular billing)',
      'memory/project_pricing_strategy.md — four billing tiers; which tables must be plan-aware',
    ],
    rules: [
      '/db writes queries and migrations; /dba reviews schema design before those migrations are written.',
      'Always give context: "before merging Phase X", "reviewing new module Y", or "quarterly check".',
      'Run /dba before any migration that introduces a new table — review first, write SQL second.',
      'Every accepted finding gets written to docs/active/DB_ARCHITECTURE_REVIEW.md with a severity and status.',
      'The agent checks multi-tenant scoping first — every table must reach org_id in ≤1 hop.',
      'FK naming rule: org foreign keys must always be named org_id, not organization_id (see Finding #1).',
      '/dba never writes application code or feature queries — architecture decisions only.',
    ],
    examples: [
      '/dba — I\'m about to add three new tables for the Stripe billing module. Review the proposed schema before I write the migration.',
      '/dba — quarterly schema health check; what are the highest-priority open findings?',
      '/dba — we just shipped slot-first roster Phase 2. Are the new tables consistent with existing patterns?',
      '/dba — what\'s the risk level of the tournaments.organization_id → org_id rename? Can we do it safely now?',
      '/dba — the coaching standalone plan will need new entitlement tables. What should they look like?',
      '/dba — review the current status of all open findings and update statuses.',
      '/dba — is our indexing strategy solid for an org with 500 tournaments and 10,000 teams?',
    ],
    notes: [
      '/dba is strategic (is the schema sound at scale?); /db is tactical (write me a query). Keep them in separate conversations.',
      'The findings log in docs/active/DB_ARCHITECTURE_REVIEW.md persists across sessions — every /dba conversation inherits and updates it.',
      'Finding #1 (tournaments.organization_id vs org_id) is the highest-impact quick win and should be resolved before new tournament-adjacent tables are added.',
    ],
    extraSections: [
      {
        title: 'Open findings (as of 2026-05-23)',
        content: (
          <table className={styles.roleTable}>
            <thead><tr><th>Finding</th><th>Severity</th></tr></thead>
            <tbody>
              <tr><td><code>tournaments</code> uses <code>organization_id</code> not <code>org_id</code></td><td>High</td></tr>
              <tr><td>10 tournament sub-tables have no direct <code>org_id</code> (2-hop RLS chain)</td><td>High</td></tr>
              <tr><td><code>teams.players</code> column — unknown type, likely stale denormalization</td><td>Medium</td></tr>
              <tr><td><code>league_games</code> no direct <code>org_id</code> (2-hop chain via season)</td><td>Medium</td></tr>
              <tr><td><code>rep_player_dues_installments</code> no <code>org_id</code> (3-hop chain)</td><td>Medium</td></tr>
              <tr><td><code>rep_allocation_installments</code> no <code>org_id</code> (2-hop chain)</td><td>Medium</td></tr>
              <tr><td><code>contacts</code> table is tournament-scoped only — no shared contact model</td><td>Low</td></tr>
              <tr><td><code>announcements</code> is tournament-scoped only</td><td>Low</td></tr>
              <tr><td><code>resources</code> is tournament-scoped only</td><td>Low</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
  },
  {
    key: 'plan',
    cmd: '/plan',
    Icon: FileText,
    accent: 'orange',
    headline: 'Implementation plans and PM briefs',
    tags: ['Starting features', 'Tracking docs', 'PM briefs', 'TODO entries'],
    loadsFrom: [
      'AGENCY_RULES.md — binding planning rules (PM brief required, doc structure, no code before plan)',
      'TODO.md — current task list to avoid duplicating existing items',
      'memory/feedback_doc_structure.md — doc structure rules',
      'memory/feedback_docs_folder_convention.md — docs/active/ + docs/archive/ convention',
    ],
    rules: [
      'This agent must be invoked before starting any significant feature — AGENCY_RULES.md requires it.',
      'The PM brief is produced first and is a blocking step — no implementation detail before it.',
      'Plan files go in docs/active/ — never the repo root. Completed plans move to docs/archive/.',
      'TODO.md gets one summary line per feature with a link to the plan file — no detail in TODO.md itself.',
      'Every plan touching the DB lists the migration file as the first task.',
      'Note which billing plan tier gates each feature in the plan.',
    ],
    examples: [
      '/plan — create a tournament section review plan covering all 20 admin pages for both plan tiers',
      '/plan — I want to add email notifications when a team is approved for a tournament. This is a Tournament Plus feature.',
      '/plan — create a plan for adding a "clone tournament" feature with full DB migration, API route, and UI.',
      '/plan — mark phases 1 and 2 of TOURNAMENT_REVIEW_PLAN.md as complete.',
      '/plan — the tournament review is done. Move TOURNAMENT_REVIEW_PLAN.md to docs/archive/ and update TODO.md.',
      '/plan — write a PM brief for adding coach messaging to the coaches portal.',
    ],
    extraSections: [
      {
        title: 'What /plan produces for every request',
        content: (
          <ol className={styles.orderedList}>
            <li><strong>PM Brief</strong> — plain-language outcome summary: what it does, why it matters, who benefits, expected impact, priority, success criteria.</li>
            <li><strong>Plan file</strong> — saved to <code>docs/active/FEATURE_NAME_PLAN.md</code> with phased task checklist, file paths, SQL, and architectural decisions.</li>
            <li><strong>TODO.md entry</strong> — one summary line linking to the plan file. Never more than one line per feature.</li>
          </ol>
        ),
      },
    ],
  },
  {
    key: 'uat',
    cmd: '/uat',
    Icon: FlaskConical,
    accent: 'red',
    headline: 'Playwright browser-based acceptance tests',
    tags: ['Regression tests', 'Both plan tiers', 'Sign-off gate', 'Bug proposals'],
    loadsFrom: [
      'tests/uat/scenarios/*.spec.ts — 58 tests across 5 suites',
      'tests/uat/helpers/fixtures.ts — typed Playwright fixtures per role',
      'UAT_FINDINGS.md — open findings log (checked before every run)',
      '.env.local — UAT_ env vars (org slugs, credentials per role)',
    ],
    rules: [
      'Dev server must be running at localhost:3000 before invoking — the agent checks this first.',
      'Use a named suite to keep runs fast — running the full suite takes significantly longer.',
      'The agent runs tests → analyses failures → proposes numbered fixes → STOPS. Nothing is changed without your approval.',
      'Reply "apply 1, 3" or "apply all" or "explain 2" — the agent applies only what you approve.',
      'Use /uat fix to re-propose fixes from UAT_FINDINGS.md without re-running tests (faster after manual changes).',
      'Auth sessions expire — if tests fail on login, run auth-setup first.',
    ],
    examples: [
      '/uat tournament-admin',
      '/uat plan-gating',
      '/uat auth',
      '/uat coaches',
      '/uat platform-admin',
      '/uat                              ← full suite (all 58 tests)',
      '/uat fix                          ← re-propose from UAT_FINDINGS.md, no re-run',
      '/uat setup                        ← print UAT_SETUP.md onboarding guide',
    ],
    extraSections: [
      {
        title: 'Test suites',
        content: (
          <table className={styles.roleTable}>
            <thead><tr><th>Suite</th><th>What it covers</th></tr></thead>
            <tbody>
              <tr><td><code>auth</code></td><td>Login, session handling, redirect rules per role</td></tr>
              <tr><td><code>plan-gating</code></td><td>Free vs. Plus feature access across all sections</td></tr>
              <tr><td><code>tournament-admin</code></td><td>Tournament creation, teams, schedule, results</td></tr>
              <tr><td><code>platform-admin</code></td><td>Org management, billing overrides, audit log</td></tr>
              <tr><td><code>coaches</code></td><td>Coach portal: roster, events, expenses</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
    notes: [
      'Sign-off contract: the agent NEVER calls Edit, Write, or any file-modifying tool before you explicitly approve. "apply all" applies all proposals; "apply 1, 3" applies only those numbered fixes.',
    ],
  },
  {
    key: 'release',
    cmd: '/release',
    Icon: Rocket,
    accent: 'cyan',
    headline: 'Production release manager — push, monitor, fix',
    tags: ['Pre-flight checks', 'dev → staging push', 'Promote staging → prod', 'Log analysis', 'Fix proposals'],
    loadsFrom: [
      'RELEASE_CONFIG.md — Amplify app ID (d3ld0l2bgmmlga), log group, stream filters',
      'memory/feedback_branch_policy.md — dev is default; master = production',
    ],
    rules: [
      'Preferred production flow: /release dev → verify in browser → /release promote.',
      '/release promote uses origin/dev (remote ref) not your local branch — uncommitted local work cannot reach production.',
      '/release master pushes your local dev branch — use only when you know local is in sync with staging.',
      'The agent shows a full release summary and STOPS — you must type "push" to confirm before anything is sent.',
      'Master and promote releases show a prominent PRODUCTION WARNING in the summary — extra speed bump by design.',
      'Pre-flight checks TypeScript before /release dev and /release master — TS errors block the push. /release promote skips the TS check (Amplify already built it successfully).',
      'On failure: come back with /release fix [paste error] or /release fix logs [dev|master].',
      'The agent never force-pushes — it uses --force-with-lease at most, and only in the undo path.',
    ],
    examples: [
      '/release dev                      ← pre-flight + push local dev to staging; waits for "push"',
      '/release promote                  ← promote origin/dev → master (safe: ignores local branch)',
      '/release master                   ← push local dev directly to production (use promote instead)',
      '/release preflight                ← checks only, no push, no target needed',
      '/release fix logs dev             ← fetch CloudWatch dev stream logs and propose fixes',
      '/release fix logs master          ← fetch CloudWatch master stream logs and propose fixes',
      '/release fix [paste Amplify error output here]',
      '/release setup                    ← diagnose AWS CLI access, print IAM policy',
      '/release undo                     ← print safe revert instructions (never auto-executes)',
    ],
    extraSections: [
      {
        title: 'CloudWatch log config',
        content: (
          <table className={styles.roleTable}>
            <thead><tr><th>Target</th><th>Log group</th><th>Stream filter</th></tr></thead>
            <tbody>
              <tr><td><code>dev</code></td><td><code>/aws/amplify/d3ld0l2bgmmlga</code></td><td><code>dev</code></td></tr>
              <tr><td><code>master</code></td><td><code>/aws/amplify/d3ld0l2bgmmlga</code></td><td><code>master</code></td></tr>
            </tbody>
          </table>
        ),
      },
    ],
    notes: [
      'AWS CLI is optional — /release dev and /release master work without it. You only need AWS CLI configured for /release fix logs (auto log fetching). Run /release setup to check what\'s installed.',
    ],
  },
  {
    key: 'debug',
    cmd: '/debug',
    Icon: Bug,
    accent: 'pink',
    headline: 'Screenshot and error investigation — find the root cause and fix it',
    tags: ['Screenshot errors', 'API failures', 'Runtime crashes', 'Broken UI states'],
    loadsFrom: [
      'memory/reference_db_schema.md — table+column reference for DB error investigation',
      'lib/api-auth.ts — org resolution and auth patterns (for 401/403 debugging)',
      'lib/plan-features.ts — plan gating logic (for unexpected access errors)',
      'lib/db.ts — Supabase client helpers',
    ],
    rules: [
      'Accepts screenshots, pasted errors, file paths, or plain descriptions — any combination works.',
      'The agent reads actual source files before proposing a fix — it never guesses from a description alone.',
      'Root cause is stated in one sentence before any fix is proposed.',
      'Fixes are proposed as numbered diffs with a confidence level — nothing is applied without your approval.',
      'For DB errors: always verifies the column/table exists in memory/reference_db_schema.md before suggesting schema changes.',
      'When a screenshot shows a UI error, the agent reads both the component AND the API route it calls.',
      'Sign-off gate: "apply all", "apply 1, 3", "explain 2", "skip all" — same contract as /uat and /release.',
      'If confidence is medium or lower, it says so prominently and explains why.',
    ],
    examples: [
      '/debug [screenshot] — clicking Save on the teams form returns a 500; nothing shows in the UI',
      '/debug [screenshot] — this badge shows "undefined" instead of the team name',
      '/debug [screenshot] — the schedule page is blank after loading; no error visible',
      '/debug — pasting terminal error:\n  TypeError: Cannot read properties of undefined (reading \'plan_id\')\n  at app/[orgSlug]/admin/page.tsx:42',
      '/debug — app/api/admin/org/route.ts is returning 403 for org admin users; should not be blocked',
      '/debug [screenshot] — modal opens but the Save button does nothing and there\'s no error',
      '/debug — the Stripe webhook is firing but the plan is not updating in the DB',
      '/debug [screenshot of browser console] — these are the errors on the dashboard for a Tournament Plus org',
    ],
    extraSections: [
      {
        title: 'Error types the agent investigates',
        content: (
          <table className={styles.roleTable}>
            <thead><tr><th>Type</th><th>Signals</th></tr></thead>
            <tbody>
              <tr><td><code>RUNTIME_CRASH</code></td><td>500, uncaught exception, TypeError / ReferenceError in stack trace</td></tr>
              <tr><td><code>AUTH_ERROR</code></td><td>401, 403, unexpected redirect to login</td></tr>
              <tr><td><code>DB_ERROR</code></td><td>Query failure, column not found, RLS violation, empty result when data should exist</td></tr>
              <tr><td><code>PLAN_GATE_BUG</code></td><td>Feature wrongly blocked on paid plan, or wrongly accessible on free tier</td></tr>
              <tr><td><code>UI_BUG</code></td><td>Renders but data is wrong, undefined shown, broken layout</td></tr>
              <tr><td><code>MISSING_STATE</code></td><td>Blank page, spinner that never resolves, empty list when data exists</td></tr>
              <tr><td><code>STRIPE_ERROR</code></td><td>Webhook not firing, plan not updating after payment</td></tr>
              <tr><td><code>ENV_MISSING</code></td><td>Undefined environment variable in runtime error</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
    notes: [
      'This agent is reactive — use it when something is broken and you need the cause and a fix fast. For systematic flow review use /ux; for automated regression catching use /uat.',
      'After applying fixes, run /release dev to push to staging, or test locally first with npm run dev.',
    ],
  },
  {
    key: 'marketing',
    cmd: '/marketing',
    Icon: Megaphone,
    accent: 'lime',
    headline: 'Brand voice, public copy, and conversion strategy',
    tags: ['Landing page copy', 'Pricing page', 'Upsell wording', 'Email concepts'],
    loadsFrom: [
      'memory/marketing_brand_voice.md — tone, vocabulary, forbidden phrases, copy patterns',
      'memory/project_pricing_strategy.md — tier names, prices, and positioning narrative',
      'app/page.tsx — live corporate landing page (copy review baseline)',
      'docs/active/PRICING_PAGE_COPY.md — approved pricing page copy canon (if it exists)',
    ],
    rules: [
      '/marketing owns copy wording; /billing owns gate mechanics — keep them in separate conversations.',
      '/design owns visual layout; /marketing owns what the words say — never recommend colours or spacing.',
      'Always use full plan names: Tournament, Tournament Plus, League, Club — never "Pro", "Plus-only", or "paid tier".',
      'Forbidden words: "unlock", "powerful", "robust", "seamless", "supercharge", "game-changing". See memory/marketing_brand_voice.md for the full list.',
      'Upgrade copy rule: "available on Tournament Plus and above" — never "upgrade to unlock".',
      'The free Tournament plan is a real product, not a trial — copy must never imply otherwise.',
      'Accepted copy goes into docs/active/PRICING_PAGE_COPY.md — this is the canonical copy record. Create the file on first accepted section if it doesn\'t exist.',
      'Copy output format: Current → Proposed → Why. Multiple options as Option A / Option B with a recommendation.',
    ],
    examples: [
      '/marketing review the hero section of app/page.tsx — does the headline connect to the core promise?',
      '/marketing write three headline options for the Tournament Plus plan card',
      '/marketing what should the upsell gate say when a free-tier admin tries to access auto-scheduling?',
      '/marketing — our lifecycle email for "first tournament created" needs a subject line and opening paragraph',
      '/marketing — review all the module card taglines in app/page.tsx for brand voice consistency',
      '/marketing write the FAQ section for the pricing page — cover: free tier, cancellation, seat limits, annual vs monthly',
      '/marketing how should we describe FieldLogicHQ to someone currently using spreadsheets to run their league?',
      '/marketing the billing page upgrade CTA feels generic — rewrite it for a League-tier org considering upgrading to Club',
    ],
    extraSections: [
      {
        title: 'What /marketing owns vs. other agents',
        content: (
          <table className={styles.roleTable}>
            <thead><tr><th>Task</th><th>Owner</th></tr></thead>
            <tbody>
              <tr><td>Landing page + pricing page copy</td><td><code>/marketing</code></td></tr>
              <tr><td>In-app upsell message <em>wording</em></td><td><code>/marketing</code></td></tr>
              <tr><td>Brand voice rules and vocabulary</td><td><code>/marketing</code></td></tr>
              <tr><td>Lifecycle email copy concepts</td><td><code>/marketing</code></td></tr>
              <tr><td>Conversion nudge strategy (where, why)</td><td><code>/marketing</code></td></tr>
              <tr><td>Gate mechanics + UpgradeGate implementation</td><td><code>/billing</code></td></tr>
              <tr><td>Visual layout, colours, spacing</td><td><code>/design</code></td></tr>
              <tr><td>Email sending infrastructure</td><td>General agent</td></tr>
            </tbody>
          </table>
        ),
      },
    ],
    notes: [
      '/marketing is a copy and strategy agent — it presents copy for your approval; it never edits source files directly. Apply accepted copy yourself or ask the general agent to apply it.',
      'The canonical copy record lives in docs/active/PRICING_PAGE_COPY.md. Ask /marketing to create it if it doesn\'t exist yet.',
    ],
  },
];

/* ─── Pipeline data ──────────────────────────────────────────────────────────── */

const PIPELINE = [
  { cmd: '/plan',    label: 'Create tracking doc',   detail: 'Always first. Generates the plan file all subsequent agents update.' },
  { cmd: '/billing', label: 'Audit plan gates',       detail: 'Code-only. Fix broken gates before polishing anything above them.' },
  { cmd: '/ux',      label: 'Review flows',           detail: 'Code-only. Empty states, error recovery, loading — no browser needed.' },
  { cmd: '/design',  label: 'Visual pass',            detail: 'Requires screenshots. Batch by area. Decisions carry forward automatically.' },
  { cmd: '/uat',     label: 'Final validation',       detail: 'Playwright across both plan tiers. Proposes fixes — you approve each one.' },
];

const QUICK_REF = [
  { trigger: 'Starting a new feature?',              cmd: '/plan first — always.' },
  { trigger: 'Something looks visually wrong?',      cmd: '/design + screenshot' },
  { trigger: 'Flow or state missing?',               cmd: '/ux + file path or screenshot' },
  { trigger: 'Feature gated correctly?',             cmd: '/billing to audit' },
  { trigger: 'Writing a DB query?',                  cmd: '/db to verify schema and get the query' },
  { trigger: 'New table or migration coming?',       cmd: '/dba before writing the migration SQL' },
  { trigger: 'Schema health check?',                 cmd: '/dba — quarterly review or after new module ships' },
  { trigger: 'Something is broken in the app?',      cmd: '/debug + screenshot or paste the error' },
  { trigger: 'Validating after changes?',            cmd: '/uat [suite-name]' },
  { trigger: 'Push to staging?',                     cmd: '/release dev → verify in browser' },
  { trigger: 'Promote staging → production?',        cmd: '/release promote  (safest — ignores local branch)' },
  { trigger: 'Build failed on Amplify?',             cmd: '/release fix [paste error]' },
  { trigger: 'Landing page or pricing copy?',        cmd: '/marketing — owns all public-facing copy' },
  { trigger: 'In-app upsell message wording?',       cmd: '/marketing (wording) + /billing (mechanics)' },
  { trigger: 'Brand voice question or email copy?',  cmd: '/marketing' },
];

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className={styles.sectionHeader}>
      <Icon size={13} />
      <span>{label}</span>
    </div>
  );
}

function Prompt({ text }: { text: string }) {
  return <pre className={styles.prompt}>{text}</pre>;
}

/* ─── Overview page ──────────────────────────────────────────────────────────── */

function OverviewPage({ onSelect }: { onSelect: (key: AgentKey) => void }) {
  return (
    <div className={styles.playbook}>
      <p className={styles.intro}>
        Ten custom agents live in <code>.claude/commands/</code>. Click any tile to see full
        instructions, sample prompts, and quick reference for that agent. General workflow
        guidance — how to sequence agents and hand off between sessions — is below the tiles.
      </p>

      {/* Agent tiles */}
      <div className={styles.agentGrid}>
        {AGENTS.map(({ key, cmd, Icon, accent, headline, tags }) => (
          <button
            key={key}
            className={`${styles.agentCard} ${styles[`accent-${accent}`]} ${styles.agentCardClickable}`}
            onClick={() => onSelect(key)}
          >
            <div className={styles.agentCardTop}>
              <Icon size={15} className={styles.agentIcon} />
              <code className={styles.agentCmd}>{cmd}</code>
              <ArrowRight size={12} className={styles.agentArrow} />
            </div>
            <div className={styles.agentHeadline}>{headline}</div>
            <div className={styles.agentTags}>
              {tags.map(t => <span key={t} className={styles.agentTag}>{t}</span>)}
            </div>
          </button>
        ))}
      </div>

      {/* How conversations work */}
      <SectionHeader icon={MessageSquare} label="How Conversations Work" />
      <div className={styles.rulesBox}>
        {[
          { bold: 'One agent per conversation', rest: ' — mixing two agents in the same chat bloats context. Use a fresh conversation for each step. Exception: /billing + /ux can share a conversation for short sessions (3–4 pages max).' },
          { bold: 'Start each conversation with a handoff line', rest: ' — tell the agent where you left off and point it at the plan doc. It reads the file and continues without re-explaining the project.' },
          { bold: 'The plan doc is the thread between sessions', rest: ' — agents update it with findings; the next agent reads it. Without a plan doc, findings scatter across conversations.' },
          { bold: 'Never mix /plan or /uat with other agents', rest: ' — /plan needs a clean context; /uat runs tests then waits for sign-off before touching any file.' },
        ].map(({ bold, rest }, i) => (
          <div key={i} className={styles.rule}>
            <span className={styles.ruleDot} />
            <div><strong>{bold}</strong>{rest}</div>
          </div>
        ))}
      </div>

      <div className={styles.handoffExample}>
        <div className={styles.handoffLabel}>Sample handoff line</div>
        <Prompt text="/ux — continuing tournament review; dashboard and teams pages done\n(see docs/active/TOURNAMENT_REVIEW_PLAN.md), working on schedule page today" />
      </div>

      {/* Sequencing */}
      <SectionHeader icon={ArrowRight} label="Recommended Sequencing" />
      <p className={styles.pipelineIntro}>
        For any significant review or feature, work through agents in this order. Each layer filters noise for the next.
      </p>
      <div className={styles.pipeline}>
        {PIPELINE.map(({ cmd, label, detail }, i) => (
          <div key={cmd} className={styles.pipelineStep}>
            <div className={styles.pipelineNum}>{i + 1}</div>
            <div className={styles.pipelineBody}>
              <div className={styles.pipelineTop}>
                <code className={styles.pipelineCmd}>{cmd}</code>
                <span className={styles.pipelineLabel}>{label}</span>
              </div>
              <div className={styles.pipelineDetail}>{detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick reference */}
      <SectionHeader icon={Zap} label="Quick Reference" />
      <div className={styles.quickRef}>
        {QUICK_REF.map(({ trigger, cmd }, i) => (
          <div key={i} className={styles.quickRefRow}>
            <span className={styles.quickRefTrigger}>{trigger}</span>
            <code className={styles.quickRefCmd}>{cmd}</code>
          </div>
        ))}
        <div className={styles.quickRefDivider} />
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Separate conversations (always)</span>
          <code className={styles.quickRefCmd}>/plan · /uat · /release</code>
        </div>
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Can combine (short sessions)</span>
          <code className={styles.quickRefCmd}>/billing + /ux · /marketing + /billing</code>
        </div>
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Requires browser</span>
          <code className={styles.quickRefCmd}>/design (screenshots) · /uat (Playwright)</code>
        </div>
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Code-only, no browser needed</span>
          <code className={styles.quickRefCmd}>/billing · /ux · /db · /dba · /plan · /release · /marketing</code>
        </div>
      </div>

      <div className={styles.footer}>
        Full reference: <code>AGENT_PLAYBOOK.md</code> in the repo root ·
        Design decisions: <code>memory/design_decisions.md</code> ·
        DB architecture: <code>docs/active/DB_ARCHITECTURE_REVIEW.md</code> ·
        Open UAT findings: <code>UAT_FINDINGS.md</code> ·
        Release config: <code>RELEASE_CONFIG.md</code> ·
        Agent commands: <code>.claude/commands/</code>
      </div>
    </div>
  );
}

/* ─── Agent detail page ──────────────────────────────────────────────────────── */

function AgentDetailPage({ agent, onBack }: { agent: AgentDef; onBack: () => void }) {
  const { cmd, Icon, accent, headline, loadsFrom, rules, examples, notes, extraSections } = agent;

  return (
    <div className={styles.playbook}>

      {/* Back button */}
      <button className={styles.backBtn} onClick={onBack}>
        <ChevronLeft size={13} />
        All agents
      </button>

      {/* Agent header */}
      <div className={`${styles.detailHeader} ${styles[`accent-${accent}`]}`}>
        <Icon size={22} className={styles.detailHeaderIcon} />
        <div>
          <code className={styles.detailCmd}>{cmd}</code>
          <div className={styles.detailHeadline}>{headline}</div>
        </div>
      </div>

      {/* Context loaded on activation */}
      <SectionHeader icon={BookOpen} label="Context loaded on activation" />
      <div className={styles.loadsFrom}>
        {loadsFrom.map((f, i) => (
          <div key={i} className={styles.loadsFromRow}>
            <Terminal size={11} className={styles.loadsFromIcon} />
            <code className={styles.loadsFromText}>{f}</code>
          </div>
        ))}
      </div>

      {/* Extra sections (role tables, tier tables, etc.) */}
      {extraSections?.map(({ title, content }) => (
        <div key={title}>
          <SectionHeader icon={Zap} label={title} />
          {content}
        </div>
      ))}

      {/* Rules */}
      <SectionHeader icon={MessageSquare} label="Key rules" />
      <div className={styles.rulesBox}>
        {rules.map((r, i) => (
          <div key={i} className={styles.rule}>
            <span className={styles.ruleDot} />
            <div>{r}</div>
          </div>
        ))}
      </div>

      {/* Important notes */}
      {notes && notes.length > 0 && (
        <>
          <SectionHeader icon={Info} label="Important notes" />
          <div className={styles.notesBox}>
            {notes.map((n, i) => (
              <div key={i} className={styles.noteRow}>
                <Info size={12} className={styles.noteIcon} />
                <div>{n}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Sample prompts */}
      <SectionHeader icon={Terminal} label="Sample prompts" />
      <div className={styles.promptExamples}>
        {examples.map((e, i) => <Prompt key={i} text={e} />)}
      </div>

    </div>
  );
}

/* ─── Root component ─────────────────────────────────────────────────────────── */

export default function AgentPlaybook() {
  const [selected, setSelected] = useState<AgentKey | null>(null);
  const agent = selected ? AGENTS.find(a => a.key === selected) : null;

  if (agent) {
    return <AgentDetailPage agent={agent} onBack={() => setSelected(null)} />;
  }

  return <OverviewPage onSelect={setSelected} />;
}
