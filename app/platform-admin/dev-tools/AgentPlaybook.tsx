import {
  Sparkles, GitBranch, CreditCard, Database, FileText, FlaskConical,
  ArrowRight, MessageSquare, Layers, Zap, Rocket,
} from 'lucide-react';
import styles from './playbook.module.css';

/* ─── Data ──────────────────────────────────────────────────────────────────── */

const AGENTS = [
  {
    cmd: '/design',
    Icon: Sparkles,
    headline: 'Visual design review and token guidance',
    tags: ['Screenshots', 'Colour questions', 'Spacing', 'Component polish'],
    accent: 'green' as const,
  },
  {
    cmd: '/ux',
    Icon: GitBranch,
    headline: 'User flow and completeness review',
    tags: ['Empty states', 'Error handling', 'Loading states', 'Role access gaps'],
    accent: 'blue' as const,
  },
  {
    cmd: '/billing',
    Icon: CreditCard,
    headline: 'Plan gating and Stripe guidance',
    tags: ['Gate audits', 'Upsell copy', 'New feature flags', 'Downgrade logic'],
    accent: 'yellow' as const,
  },
  {
    cmd: '/db',
    Icon: Database,
    headline: 'Supabase schema, queries, and migrations',
    tags: ['Query writing', 'New tables', 'RLS policies', 'Migration SQL'],
    accent: 'purple' as const,
  },
  {
    cmd: '/plan',
    Icon: FileText,
    headline: 'Implementation plans and PM briefs',
    tags: ['Starting features', 'Tracking docs', 'PM briefs', 'TODO entries'],
    accent: 'orange' as const,
  },
  {
    cmd: '/uat',
    Icon: FlaskConical,
    headline: 'Playwright browser-based acceptance tests',
    tags: ['Regression tests', 'Both plan tiers', 'Sign-off gate', 'Bug proposals'],
    accent: 'red' as const,
  },
  {
    cmd: '/release',
    Icon: Rocket,
    headline: 'Production release manager — push, monitor, fix',
    tags: ['Pre-flight checks', 'dev → master push', 'Log analysis', 'Fix proposals'],
    accent: 'cyan' as const,
  },
];

const PIPELINE = [
  {
    cmd: '/plan',
    label: 'Create tracking doc',
    detail: 'Always first. Generates the plan file all subsequent agents update.',
  },
  {
    cmd: '/billing',
    label: 'Audit plan gates',
    detail: 'Code-only. Fix broken gates before polishing anything above them.',
  },
  {
    cmd: '/ux',
    label: 'Review flows',
    detail: 'Code-only. Empty states, error recovery, loading states — no browser needed.',
  },
  {
    cmd: '/design',
    label: 'Visual pass',
    detail: 'Requires screenshots. Batch by area. Decisions carry forward automatically.',
  },
  {
    cmd: '/uat',
    label: 'Final validation',
    detail: 'Runs Playwright across both plan tiers. Proposes fixes — you approve each one.',
  },
];

const PROMPT_TIPS = [
  {
    cmd: '/design',
    Icon: Sparkles,
    accent: 'green' as const,
    rules: [
      'Always include a screenshot for visual questions — descriptions alone are ambiguous.',
      'State which plan tier and user role the screenshot shows.',
      'Say what feels wrong if you know ("feels cluttered", "hierarchy is unclear").',
    ],
    examples: [
      '/design [screenshot] — tournament dashboard, free tier; hierarchy feels flat, what needs to change?',
      '/design what token should I use for a "payment pending" badge background?',
      '/design — tournament review continued; dashboard signed off last session. Today: schedule page. [screenshot]',
    ],
  },
  {
    cmd: '/ux',
    Icon: GitBranch,
    accent: 'blue' as const,
    rules: [
      'Give a role (org admin, coach, public visitor) and an action (registering a team, viewing the schedule).',
      'Pointing at a file path is faster than a screenshot for code-level reviews.',
      'Ask about specific failure scenarios: "what does the user see when the API call fails?"',
    ],
    examples: [
      '/ux review app/[orgSlug]/admin/tournaments/teams/page.tsx — org admin, check empty states and error recovery',
      '/ux what does a free-tier org admin see when they try to access auto-schedule? Is the upgrade path clear?',
      '/ux trace the full flow for a team registering for a tournament. What can go wrong at each step?',
    ],
  },
  {
    cmd: '/billing',
    Icon: CreditCard,
    accent: 'yellow' as const,
    rules: [
      'Specify which features or pages you\'re auditing.',
      'Ask in terms of plan tiers: "should this be locked on the free tier?"',
      'When adding a new feature, ask for the full gate implementation: type union → FEATURE_MIN_PLAN → server guard → UpgradeGate.',
    ],
    examples: [
      '/billing audit all plan gates in the tournament admin section — find missing locks and free-tier exposure',
      '/billing I want to add a "clone tournament" button — which plan, and walk me through the full implementation',
      '/billing if an org downgrades from Tournament Plus to Tournament, what happens to their sealed archives?',
    ],
  },
  {
    cmd: '/db',
    Icon: Database,
    accent: 'purple' as const,
    rules: [
      'Always ask the agent to verify a column or table exists before writing a query.',
      'Include the route context: "this is a server-side API route, org-scoped".',
      'Ask for the RLS policy alongside any new table migration.',
    ],
    examples: [
      '/db — write a server-side query that fetches all active tournaments for an org including team counts. Org-scoped.',
      '/db I need a table to store per-tournament notification preferences. Design the table, migration SQL, and RLS policy.',
      '/db — review this migration SQL before I run it: [paste SQL]. Check for missing indexes and RLS gaps.',
    ],
  },
  {
    cmd: '/plan',
    Icon: FileText,
    accent: 'orange' as const,
    rules: [
      'Describe the feature in plain English — the agent handles the technical structuring.',
      'Mention the plan tier if the feature is gated.',
      'The agent writes the PM brief first and waits before starting the implementation plan.',
    ],
    examples: [
      '/plan — create a tournament section review plan covering all 20 admin pages for both plan tiers',
      '/plan — I want to add email notifications when a team is approved. This is a Tournament Plus feature.',
      '/plan — tournament review complete. Mark TOURNAMENT_REVIEW_PLAN.md done and move it to docs/archive/',
    ],
  },
  {
    cmd: '/uat',
    Icon: FlaskConical,
    accent: 'red' as const,
    rules: [
      'Dev server must be running at localhost:3000 before invoking.',
      'Use a named suite to keep runs fast: tournament-admin, plan-gating, auth, coaches, platform-admin.',
      'After the run, the agent proposes fixes — reply "apply 1, 3" or "apply all" or "explain 2" before anything changes.',
    ],
    examples: [
      '/uat tournament-admin',
      '/uat plan-gating',
      '/uat fix   ← re-propose fixes from UAT_FINDINGS.md without re-running tests',
    ],
  },
  {
    cmd: '/release',
    Icon: Rocket,
    accent: 'cyan' as const,
    rules: [
      'Fill in memory/project_release_config.md with your Amplify app ID before first use.',
      'The agent shows a full release summary and waits — you must type "push" to confirm before anything is sent to master.',
      'On build failure: come back and run /release fix [paste error] or /release fix logs (requires AWS CLI).',
    ],
    examples: [
      '/release                   ← pre-flight checks + summary, then waits for "push"',
      '/release preflight         ← checks only, no push',
      '/release fix [paste Amplify build error output here]',
      '/release setup             ← diagnose AWS CLI access, print IAM setup instructions',
    ],
  },
];

const QUICK_REF = [
  { trigger: 'Starting a new feature?', cmd: '/plan first — always.' },
  { trigger: 'Something looks visually wrong?', cmd: '/design + screenshot' },
  { trigger: 'Flow or state missing?', cmd: '/ux + file path or screenshot' },
  { trigger: 'Feature gated correctly?', cmd: '/billing to audit' },
  { trigger: 'Writing a DB query?', cmd: '/db to verify schema and get the query' },
  { trigger: 'Validating after changes?', cmd: '/uat [suite-name]' },
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

/* ─── Main component ─────────────────────────────────────────────────────────── */

export default function AgentPlaybook() {
  return (
    <div className={styles.playbook}>

      {/* Intro */}
      <p className={styles.intro}>
        Six custom agents live in <code>.claude/commands/</code>. Each one loads project-specific context —
        your design tokens, DB schema, plan pricing, UX findings, and past decisions — so you never
        re-explain the project from scratch. The memory files in <code>memory/</code> are the thread
        that carries state between sessions.
      </p>

      {/* ── Agent Cards ─────────────────────────────────────────────────────── */}
      <SectionHeader icon={Layers} label="The Six Agents" />
      <div className={styles.agentGrid}>
        {AGENTS.map(({ cmd, Icon, headline, tags, accent }) => (
          <div key={cmd} className={`${styles.agentCard} ${styles[`accent-${accent}`]}`}>
            <div className={styles.agentCardTop}>
              <Icon size={15} className={styles.agentIcon} />
              <code className={styles.agentCmd}>{cmd}</code>
            </div>
            <div className={styles.agentHeadline}>{headline}</div>
            <div className={styles.agentTags}>
              {tags.map(t => <span key={t} className={styles.agentTag}>{t}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Conversation Rules ───────────────────────────────────────────────── */}
      <SectionHeader icon={MessageSquare} label="How Conversations Work" />
      <div className={styles.rulesBox}>
        <div className={styles.rule}>
          <span className={styles.ruleDot} />
          <div>
            <strong>One agent per conversation</strong> — mixing two agents in the same chat bloats context.
            Use a fresh conversation for each step. Exception: <code>/billing</code> + <code>/ux</code> can share
            a conversation for short sessions (3–4 pages max).
          </div>
        </div>
        <div className={styles.rule}>
          <span className={styles.ruleDot} />
          <div>
            <strong>Start each conversation with a handoff line</strong> — tell the agent where you left off
            and point it at the plan doc. It reads the file and continues without re-explaining the project.
          </div>
        </div>
        <div className={styles.rule}>
          <span className={styles.ruleDot} />
          <div>
            <strong>The plan doc is the thread</strong> — agents update it with findings; the next agent
            reads it. Without a plan doc, findings scatter across conversations.
          </div>
        </div>
        <div className={styles.rule}>
          <span className={styles.ruleDot} />
          <div>
            <strong>Never combine <code>/plan</code> or <code>/uat</code></strong> with other agents —
            <code>/plan</code> needs a clean context; <code>/uat</code> runs tests then waits for your
            approval before any file is touched.
          </div>
        </div>
      </div>
      <div className={styles.handoffExample}>
        <div className={styles.handoffLabel}>Sample handoff line</div>
        <Prompt text="/ux — continuing tournament review; dashboard and teams pages done\n(see docs/active/TOURNAMENT_REVIEW_PLAN.md), working on schedule page today" />
      </div>

      {/* ── Pipeline ────────────────────────────────────────────────────────── */}
      <SectionHeader icon={ArrowRight} label="Recommended Sequencing" />
      <p className={styles.pipelineIntro}>
        For any significant review or feature, work through agents in this order.
        Each layer filters noise for the next.
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

      {/* ── Prompt Tips ─────────────────────────────────────────────────────── */}
      <SectionHeader icon={Zap} label="Prompt Tips & Sample Prompts" />
      <div className={styles.promptSections}>
        {PROMPT_TIPS.map(({ cmd, Icon, accent, rules, examples }) => (
          <div key={cmd} className={`${styles.promptSection} ${styles[`accent-${accent}`]}`}>
            <div className={styles.promptSectionHeader}>
              <Icon size={13} />
              <code>{cmd}</code>
            </div>
            <ul className={styles.promptRules}>
              {rules.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <div className={styles.promptExamples}>
              {examples.map((e, i) => <Prompt key={i} text={e} />)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Tournament Pipeline Example ──────────────────────────────────────── */}
      <SectionHeader icon={Layers} label="Full Example — Tournament Section Review" />
      <p className={styles.pipelineIntro}>
        Reviewing all 20 tournament admin pages for both the free and Tournament Plus tiers,
        covering design, UX, billing gates, and bugs.
      </p>
      <div className={styles.exampleSteps}>
        <div className={styles.exampleStep}>
          <div className={styles.exampleStepCmd}>/plan</div>
          <div className={styles.exampleStepBody}>
            <div className={styles.exampleStepTitle}>Create the master tracking doc</div>
            <Prompt text="/plan — create a tournament section review plan covering all 20 admin pages.\nI want to audit design, UX flows, plan gating, and bugs for both the\nfree Tournament tier and Tournament Plus. Include a checklist matrix:\none row per page, columns for billing check, UX review, design review, UAT status." />
          </div>
        </div>
        <div className={styles.exampleStep}>
          <div className={styles.exampleStepCmd}>/billing</div>
          <div className={styles.exampleStepBody}>
            <div className={styles.exampleStepTitle}>Audit all plan gates (no browser needed)</div>
            <Prompt text="/billing — audit all plan gating in app/[orgSlug]/admin/tournaments/**\nFind: incorrectly locked free-tier features, Plus features without upsell\nmessaging, and any free-tier pages exposing Plus content.\nLog findings to docs/active/TOURNAMENT_REVIEW_PLAN.md." />
          </div>
        </div>
        <div className={styles.exampleStep}>
          <div className={styles.exampleStepCmd}>/ux</div>
          <div className={styles.exampleStepBody}>
            <div className={styles.exampleStepTitle}>UX code review — batch 4–6 pages per conversation</div>
            <Prompt text="/ux — tournament review, billing audit complete (see TOURNAMENT_REVIEW_PLAN.md).\nReview these pages for both plan tiers:\n- app/[orgSlug]/admin/tournaments/page.tsx\n- app/[orgSlug]/admin/tournaments/dashboard/page.tsx\n- app/[orgSlug]/admin/tournaments/teams/page.tsx\nCheck: empty states, loading states, error recovery, destructive confirms.\nUpdate TOURNAMENT_REVIEW_PLAN.md with findings." />
          </div>
        </div>
        <div className={styles.exampleStep}>
          <div className={styles.exampleStepCmd}>/design</div>
          <div className={styles.exampleStepBody}>
            <div className={styles.exampleStepTitle}>Visual pass — batch by area, screenshots required</div>
            <Prompt text="/design — tournament review, UX pass complete for dashboard and teams pages.\n[paste screenshot — tournament dashboard, free-tier org admin]\nThe page loads correctly but the layout feels unbalanced —\nhierarchy isn't guiding the eye anywhere useful. What needs to change?" />
          </div>
        </div>
        <div className={styles.exampleStep}>
          <div className={styles.exampleStepCmd}>/uat</div>
          <div className={styles.exampleStepBody}>
            <div className={styles.exampleStepTitle}>Final validation — dev server must be running</div>
            <Prompt text="/uat tournament-admin" />
            <p className={styles.exampleNote}>
              Runs Playwright against both your free-tier org and Plus org. Reports failures, proposes
              numbered fixes, waits for your approval. Reply: <code>apply 1, 3</code> or <code>apply all</code> or <code>explain 2</code>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Quick Reference ──────────────────────────────────────────────────── */}
      <SectionHeader icon={Zap} label="Quick Reference" />
      <div className={styles.quickRef}>
        {QUICK_REF.map(({ trigger, cmd }) => (
          <div key={trigger} className={styles.quickRefRow}>
            <span className={styles.quickRefTrigger}>{trigger}</span>
            <code className={styles.quickRefCmd}>{cmd}</code>
          </div>
        ))}
        <div className={styles.quickRefDivider} />
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Separate conversations (always)</span>
          <code className={styles.quickRefCmd}>/plan · /uat</code>
        </div>
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Can combine (short sessions)</span>
          <code className={styles.quickRefCmd}>/billing + /ux</code>
        </div>
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Requires browser</span>
          <code className={styles.quickRefCmd}>/design (screenshots) · /uat (Playwright)</code>
        </div>
        <div className={styles.quickRefRow}>
          <span className={styles.quickRefTrigger}>Code-only, no browser needed</span>
          <code className={styles.quickRefCmd}>/billing · /ux · /db · /plan</code>
        </div>
      </div>

      <div className={styles.footer}>
        Full reference: <code>AGENT_PLAYBOOK.md</code> in the repo root ·
        Design decisions: <code>memory/design_decisions.md</code> ·
        Open UAT findings: <code>UAT_FINDINGS.md</code>
      </div>

    </div>
  );
}
