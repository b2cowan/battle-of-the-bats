import HelpHubClient, { type HelpHubCard, type HelpHubRolePath } from '@/components/help/HelpHubClient';

export default function PlatformAdminHelpPage() {
  const customerCards: HelpHubCard[] = [
    {
      title: 'Tournaments',
      desc: 'Customer-facing guide for tournament setup, schedules, results, registrations, and day-of operations.',
      href: '/platform-admin/help/tournaments',
      topicCount: 25,
      keywords: ['customer', 'tournament', 'schedule', 'scores', 'results', 'registrations'],
    },
    {
      title: 'House League',
      desc: 'Customer-facing guide for seasons, divisions, teams, drafts, schedules, standings, and league operations.',
      href: '/platform-admin/help/house-league',
      topicCount: 9,
      keywords: ['customer', 'house league', 'season', 'division', 'standings', 'draft'],
    },
    {
      title: 'House League Registrations',
      desc: 'Customer-facing guide for reviewing player submissions, payment status, registration exports, and follow-up.',
      href: '/platform-admin/help/registrations',
      topicCount: 6,
      keywords: ['customer', 'registration', 'payment', 'player', 'guardian', 'waitlist'],
    },
    {
      title: 'Rep Teams',
      desc: 'Customer-facing guide for rep programs, tryouts, rosters, coaches, documents, and dues workflows.',
      href: '/platform-admin/help/rep-teams',
      topicCount: 8,
      keywords: ['customer', 'rep teams', 'tryouts', 'roster', 'coach', 'dues'],
    },
    {
      title: 'Coaches Portal',
      desc: 'Customer-facing guide coaches can use for rosters, schedules, dues, expenses, and player documents.',
      href: '/platform-admin/help/coaches',
      topicCount: 7,
      keywords: ['customer', 'coach', 'coaches portal', 'roster', 'schedule', 'dues', 'documents'],
    },
    {
      title: 'Accounting',
      desc: 'Customer-facing guide for ledgers, budget planning, budget vs. actual reporting, and team allocations.',
      href: '/platform-admin/help/accounting',
      topicCount: 7,
      keywords: ['customer', 'accounting', 'ledger', 'budget', 'expense', 'allocation'],
    },
    {
      title: 'Org Admin & Setup',
      desc: 'Customer-facing guide for members, roles, subscription management, settings, modules, and org setup.',
      href: '/platform-admin/help/org',
      topicCount: 6,
      keywords: ['customer', 'members', 'roles', 'subscription', 'settings', 'billing'],
    },
    {
      title: 'Exports & Downloads',
      desc: 'Customer-facing guide for Excel, CSV, PDF, and calendar exports, including privacy and plan rules.',
      href: '/platform-admin/help/exports',
      topicCount: 6,
      keywords: ['customer', 'export', 'xlsx', 'csv', 'pdf', 'ics', 'calendar'],
    },
  ];

  const internalCards: HelpHubCard[] = [
    {
      title: 'Platform Admin Operations',
      desc: 'Employee SOPs for password resets, module overrides, comp periods, plan changes, audit review, retention, feedback triage, observability, the approval queue, email templates, batch email, and the early-access pipeline.',
      href: '/platform-admin/help/platform-admin',
      topicCount: 14,
      keywords: ['password reset', 'override', 'billing', 'module access', 'comp period', 'audit', 'bulk operation', 'feedback triage', 'observability', 'change requests', 'email templates', 'early-access pipeline'],
    },
  ];

  const rolePaths: HelpHubRolePath[] = [
    {
      title: 'Platform Support',
      steps: [
        { label: 'Reset a customer password', href: '/platform-admin/help/platform-admin#reset-password' },
        { label: 'Help a customer manage members and roles', href: '/platform-admin/help/org#recipe-fix-member-access' },
        { label: 'Document support work', href: '/platform-admin/help/platform-admin#support-notes' },
        { label: 'Investigate account changes', href: '/platform-admin/help/platform-admin#audit-investigation' },
      ],
    },
    {
      title: 'Product Operator',
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
      steps: [
        { label: 'Manage the early-access lead pipeline', href: '/platform-admin/help/platform-admin#early-access-pipeline' },
        { label: 'Send a batch marketing email', href: '/platform-admin/help/platform-admin#email-batch-send' },
        { label: 'Review growth signals on the Overview', href: '/platform-admin' },
      ],
    },
    {
      title: 'Billing Specialist',
      steps: [
        { label: 'Temporarily override billing access', href: '/platform-admin/help/platform-admin#billing-overrides' },
        { label: 'Cancel a customer subscription', href: '/platform-admin/help/platform-admin#cancel-subscription' },
        { label: 'Handle retained or at-risk accounts', href: '/platform-admin/help/platform-admin#retention' },
        { label: 'Run guarded bulk operations', href: '/platform-admin/help/platform-admin#bulk-operations' },
      ],
    },
    {
      title: 'Customer Owner or Admin',
      steps: [
        { label: 'Invite members and choose roles', href: '/platform-admin/help/org#recipe-invite-member' },
        { label: 'Fix member access problems', href: '/platform-admin/help/org#recipe-fix-member-access' },
        { label: 'Turn on modules included in a plan', href: '/platform-admin/help/org#recipe-enable-modules' },
        { label: 'Explain exports and downloads', href: '/platform-admin/help/exports' },
      ],
    },
    {
      title: 'Tournament Operator',
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
      steps: [
        { label: 'Create a team and program year', href: '/platform-admin/help/rep-teams#recipe-create-team-program-year' },
        { label: 'Open tryouts and review applicants', href: '/platform-admin/help/rep-teams#recipe-open-tryouts-review-applicants' },
        { label: 'Give a coach access to their team', href: '/platform-admin/help/rep-teams#recipe-assign-coach-access' },
        { label: 'Help a coach get started', href: '/platform-admin/help/coaches#recipe-first-login' },
        { label: 'Track team fees', href: '/platform-admin/help/coaches#recipe-track-dues' },
      ],
    },
    {
      title: 'Treasurer',
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
      rolePaths={rolePaths}
    />
  );
}
