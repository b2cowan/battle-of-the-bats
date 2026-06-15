import HelpHubClient, { type HelpHubCard, type HelpHubQuickLink, type HelpHubRolePath } from '@/components/help/HelpHubClient';

export default function PlatformAdminHelpPage() {
  const customerCards: HelpHubCard[] = [
    {
      title: 'Tournaments',
      desc: 'Customer-facing guide for tournament setup, schedules, results, registrations, and day-of operations.',
      href: '/platform-admin/help/tournaments',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'tournament', 'schedule', 'scores', 'results', 'registrations'],
      featured: true,
    },
    {
      title: 'House League',
      desc: 'Customer-facing guide for seasons, divisions, teams, drafts, schedules, standings, and league operations.',
      href: '/platform-admin/help/house-league',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'house league', 'season', 'division', 'standings', 'draft'],
    },
    {
      title: 'House League Registrations',
      desc: 'Customer-facing guide for reviewing player submissions, payment status, registration exports, and follow-up.',
      href: '/platform-admin/help/registrations',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'registration', 'payment', 'player', 'guardian', 'waitlist'],
    },
    {
      title: 'Rep Teams',
      desc: 'Customer-facing guide for rep programs, tryouts, rosters, coaches, documents, and dues workflows.',
      href: '/platform-admin/help/rep-teams',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'rep teams', 'tryouts', 'roster', 'coach', 'dues'],
    },
    {
      title: 'Coaches Portal',
      desc: 'Customer-facing guide coaches can use for rosters, schedules, dues, expenses, and player documents.',
      href: '/platform-admin/help/coaches',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'coach', 'coaches portal', 'roster', 'schedule', 'dues', 'documents'],
    },
    {
      title: 'Accounting',
      desc: 'Customer-facing guide for ledgers, budget planning, budget vs. actual reporting, and team allocations.',
      href: '/platform-admin/help/accounting',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'accounting', 'ledger', 'budget', 'expense', 'allocation'],
    },
    {
      title: 'Org Admin & Setup',
      desc: 'Customer-facing guide for members, roles, subscription management, settings, modules, and org setup.',
      href: '/platform-admin/help/org',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'members', 'roles', 'subscription', 'settings', 'billing'],
      featured: true,
    },
    {
      title: 'Exports & Downloads',
      desc: 'Customer-facing guide for Excel, CSV, PDF, and calendar exports, including privacy and plan rules.',
      href: '/platform-admin/help/exports',
      category: 'Customer-Facing Guides',
      audience: 'Support reference',
      keywords: ['customer', 'export', 'xlsx', 'csv', 'pdf', 'ics', 'calendar'],
    },
  ];

  const internalCards: HelpHubCard[] = [
    {
      title: 'Platform Admin Operations',
      desc: 'Employee-only SOPs for password resets, module overrides, comp periods, plan changes, audit review, retention, feedback triage, observability, the approval queue, email templates, batch email, and the early-access pipeline.',
      href: '/platform-admin/help/platform-admin',
      category: 'Employee-Only Guides',
      audience: 'Platform admins',
      badge: 'Protected',
      keywords: ['password reset', 'override', 'billing', 'module access', 'comp period', 'audit', 'bulk operation', 'feedback triage', 'observability', 'change requests', 'email templates', 'early-access pipeline'],
      featured: true,
    },
  ];

  const quickLinks: HelpHubQuickLink[] = [
    { label: 'Reset a customer password', href: '/platform-admin/help/platform-admin#reset-password', category: 'Support', keywords: ['password', 'reset', 'customer users'] },
    { label: 'Temporarily override billing access', href: '/platform-admin/help/platform-admin#billing-overrides', category: 'Billing', keywords: ['override', 'billing', 'subscription status', 'active'] },
    { label: 'Provide access to an unsubscribed module', href: '/platform-admin/help/platform-admin#module-access', category: 'Product', keywords: ['module', 'addon', 'unsubscribed', 'entitlement'] },
    { label: 'Run a bulk comp period or module update', href: '/platform-admin/help/platform-admin#bulk-operations', category: 'Bulk Operations', keywords: ['bulk', 'comp period', 'module addon', 'plan change'] },
    { label: 'Investigate account changes in the audit log', href: '/platform-admin/help/platform-admin#audit-investigation', category: 'Audit', keywords: ['audit', 'logs', 'actor', 'before after'] },
    { label: 'Triage customer feedback and find error groups', href: '/platform-admin/help/platform-admin#feedback-triage', category: 'Support', keywords: ['feedback', 'triage', 'bug report', 'escalate', 'error group'] },
    { label: 'Review and approve a request in the Approval Queue', href: '/platform-admin/help/platform-admin#change-requests', category: 'Product', keywords: ['approval queue', 'change request', 'approve', 'pricing', 'apply'] },
    { label: 'Edit an email template safely', href: '/platform-admin/help/platform-admin#email-templates', category: 'Product', keywords: ['email template', 'variable token', 'test send', 'transactional'] },
    { label: 'Send a batch marketing email', href: '/platform-admin/help/platform-admin#email-batch-send', category: 'Growth', keywords: ['email', 'batch send', 'marketing', 'founding season'] },
    { label: 'Manage the early-access lead pipeline', href: '/platform-admin/help/platform-admin#early-access-pipeline', category: 'Growth', keywords: ['early access', 'leads', 'pipeline', 'convert', 'outreach'] },
    { label: 'Explain customer exports and downloads', href: '/platform-admin/help/exports', category: 'Customer Help', keywords: ['export', 'xlsx', 'csv', 'pdf', 'calendar'] },
    { label: 'Help a customer manage members and roles', href: '/platform-admin/help/org#recipe-fix-member-access', category: 'Customer Help', keywords: ['member', 'role', 'invite', 'capability'] },
    { label: 'Help a coach find their team', href: '/platform-admin/help/coaches#recipe-first-login', category: 'Customer Help', keywords: ['coach', 'team', 'program year', 'portal'] },
  ];

  const rolePaths: HelpHubRolePath[] = [
    {
      title: 'Platform Support',
      audience: 'Support team',
      badge: 'Employee',
      desc: 'Use this path for the most common account support jobs: password resets, member access, notes, and audit investigation.',
      keywords: ['support', 'password reset', 'member access', 'notes', 'audit', 'customer user'],
      steps: [
        { label: 'Reset a customer password', href: '/platform-admin/help/platform-admin#reset-password' },
        { label: 'Help a customer manage members and roles', href: '/platform-admin/help/org#recipe-fix-member-access' },
        { label: 'Document support work', href: '/platform-admin/help/platform-admin#support-notes' },
        { label: 'Investigate account changes', href: '/platform-admin/help/platform-admin#audit-investigation' },
      ],
    },
    {
      title: 'Product Operator',
      audience: 'Product team',
      badge: 'Employee',
      desc: 'Start here for the product write surfaces: feedback triage, the approval queue, email templates, batch email, and plans & pricing.',
      keywords: ['product', 'feedback', 'approval queue', 'change requests', 'email templates', 'plans pricing', 'observability', 'pricing'],
      steps: [
        { label: 'Triage feedback and find related error groups', href: '/platform-admin/help/platform-admin#feedback-triage' },
        { label: 'Review and action the Approval Queue', href: '/platform-admin/help/platform-admin#change-requests' },
        { label: 'Edit an email template safely', href: '/platform-admin/help/platform-admin#email-templates' },
        { label: 'Send a batch marketing email', href: '/platform-admin/help/platform-admin#email-batch-send' },
        { label: 'Work with plans, pricing, and the feature matrix', href: '/platform-admin/help/platform-admin#plans-pricing' },
      ],
    },
    {
      title: 'Growth Operator',
      audience: 'Growth team',
      badge: 'Employee',
      desc: 'Start here for the growth surfaces: the early-access lead pipeline and founding-season batch email.',
      keywords: ['growth', 'early access', 'leads', 'pipeline', 'email', 'batch send', 'marketing'],
      steps: [
        { label: 'Manage the early-access lead pipeline', href: '/platform-admin/help/platform-admin#early-access-pipeline' },
        { label: 'Send a batch marketing email', href: '/platform-admin/help/platform-admin#email-batch-send' },
        { label: 'Review growth signals on the Overview', href: '/platform-admin' },
      ],
    },
    {
      title: 'Billing Specialist',
      audience: 'Billing team',
      badge: 'Employee',
      desc: 'Start here for the core billing jobs: overrides, cancellations, retention deadlines, and multi-account billing changes.',
      keywords: ['billing', 'override', 'comp period', 'cancel subscription', 'retention', 'bulk operations'],
      steps: [
        { label: 'Temporarily override billing access', href: '/platform-admin/help/platform-admin#billing-overrides' },
        { label: 'Cancel a customer subscription', href: '/platform-admin/help/platform-admin#cancel-subscription' },
        { label: 'Handle retained or at-risk accounts', href: '/platform-admin/help/platform-admin#retention' },
        { label: 'Run guarded bulk operations', href: '/platform-admin/help/platform-admin#bulk-operations' },
      ],
    },
    {
      title: 'Billing and Product Admin',
      audience: 'Billing/product team',
      badge: 'Employee',
      desc: 'Start here when work touches billing status, comp periods, module overrides, plan changes, or feature matrix governance.',
      keywords: ['billing', 'product', 'override', 'comp period', 'module access', 'plans pricing', 'feature matrix'],
      steps: [
        { label: 'Temporarily override billing access', href: '/platform-admin/help/platform-admin#billing-overrides' },
        { label: 'Provide unsubscribed module access', href: '/platform-admin/help/platform-admin#module-access' },
        { label: 'Run guarded bulk operations', href: '/platform-admin/help/platform-admin#bulk-operations' },
        { label: 'Work with plans, pricing, and feature matrix changes', href: '/platform-admin/help/platform-admin#plans-pricing' },
      ],
    },
    {
      title: 'Customer Owner or Admin',
      audience: 'Customer support reference',
      desc: 'Use this path when helping an org owner with setup, member access, modules, billing, and exports.',
      keywords: ['customer owner', 'org admin', 'members', 'modules', 'billing', 'exports'],
      steps: [
        { label: 'Invite members and choose roles', href: '/platform-admin/help/org#recipe-invite-member' },
        { label: 'Fix member access problems', href: '/platform-admin/help/org#recipe-fix-member-access' },
        { label: 'Turn on modules included in a plan', href: '/platform-admin/help/org#recipe-enable-modules' },
        { label: 'Handle billing or upgrade issues', href: '/platform-admin/help/org#recipe-handle-subscription-issue' },
        { label: 'Explain exports and downloads', href: '/platform-admin/help/exports' },
      ],
    },
    {
      title: 'Tournament Operator',
      audience: 'Customer support reference',
      desc: 'Use this path when supporting tournament setup, registration, scheduling, scoring, and closeout questions.',
      keywords: ['tournament operator', 'registration', 'schedule', 'scores', 'closeout'],
      steps: [
        { label: 'Open team registration', href: '/platform-admin/help/tournaments#recipe-open-tournament-registration' },
        { label: 'Review team registrations', href: '/platform-admin/help/tournaments#recipe-review-tournament-teams' },
        { label: 'Build and adjust the schedule', href: '/platform-admin/help/tournaments#recipe-build-tournament-schedule' },
        { label: 'Enter and finalize scores', href: '/platform-admin/help/tournaments#recipe-finalize-tournament-scores' },
        { label: 'Close out the tournament', href: '/platform-admin/help/tournaments#recipe-closeout-tournament' },
      ],
    },
    {
      title: 'Registrar or League Admin',
      audience: 'Customer support reference',
      desc: 'Use this path for house league season setup, player registration review, waitlists, team building, and schedule questions.',
      keywords: ['registrar', 'league admin', 'house league', 'waitlist', 'season', 'teams'],
      steps: [
        { label: 'Launch a house league season', href: '/platform-admin/help/house-league#recipe-launch-season' },
        { label: 'Work the daily registration queue', href: '/platform-admin/help/registrations#recipe-daily-review-queue' },
        { label: 'Promote a waitlisted player', href: '/platform-admin/help/registrations#recipe-promote-waitlisted-player' },
        { label: 'Build teams from approved players', href: '/platform-admin/help/house-league#recipe-build-teams' },
        { label: 'Generate a house league schedule', href: '/platform-admin/help/house-league#recipe-generate-house-league-schedule' },
      ],
    },
    {
      title: 'Coach or Rep Program Admin',
      audience: 'Customer support reference',
      desc: 'Use this path when supporting rep tryouts, coach access, roster visibility, dues, schedules, or documents.',
      keywords: ['coach', 'rep team', 'tryouts', 'roster', 'dues', 'documents', 'coach access'],
      steps: [
        { label: 'Create a team and program year', href: '/platform-admin/help/rep-teams#recipe-create-team-program-year' },
        { label: 'Open tryouts and review applicants', href: '/platform-admin/help/rep-teams#recipe-open-tryouts-review-applicants' },
        { label: 'Give a coach access to their team', href: '/platform-admin/help/rep-teams#recipe-assign-coach-access' },
        { label: 'Help a coach get started', href: '/platform-admin/help/coaches#recipe-first-login' },
        { label: 'Track player dues and expenses', href: '/platform-admin/help/coaches#recipe-track-dues' },
      ],
    },
    {
      title: 'Treasurer',
      audience: 'Customer support reference',
      desc: 'Use this path for ledger setup, entries, transfers, and board-ready accounting reports.',
      keywords: ['treasurer', 'accounting', 'ledger', 'expense', 'transfer', 'board report'],
      steps: [
        { label: 'Create the right ledger', href: '/platform-admin/help/accounting#recipe-create-ledger' },
        { label: 'Add income or expenses', href: '/platform-admin/help/accounting#recipe-add-income-expense' },
        { label: 'Transfer money between ledgers', href: '/platform-admin/help/accounting#recipe-transfer-between-ledgers' },
        { label: 'Prepare a board-ready financial report', href: '/platform-admin/help/accounting#recipe-board-report' },
      ],
    },
  ];

  return (
    <HelpHubClient
      title="Help Center"
      subtitle="Customer-facing documentation and employee-only platform operations in one searchable place."
      searchPlaceholder="Search customer guides or platform admin SOPs..."
      cards={[...internalCards, ...customerCards]}
      quickLinks={quickLinks}
      rolePaths={rolePaths}
    />
  );
}
