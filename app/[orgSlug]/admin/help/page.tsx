'use client';
import { useOrg } from '@/lib/org-context';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import HelpHubClient, { type HelpHubCard, type HelpHubRolePath } from '@/components/help/HelpHubClient';
import styles from '@/components/help/help.module.css';

export default function AdminHelpHubPage() {
  const { currentOrg, userRole, loading } = useOrg();

  if (loading) {
    return <div className={styles.loadingState}>Loading help...</div>;
  }

  if (!userRole) return null;

  const helpBase = currentOrg?.slug ? `/${currentOrg.slug}/admin/help` : './help';
  // Show a module's guide only when the org actually has that module — by plan,
  // free-tier floor, or add-on (hasModuleEntitlement), NOT by role. (Owners are
  // granted every capability, so the old hasCapability gate showed all guides to
  // every owner regardless of their plan.) Help itself stays free; this is relevance.
  const canHouseLeague  = !!currentOrg && hasModuleEntitlement(currentOrg, 'module_house_league');
  const canRepTeams     = !!currentOrg && hasModuleEntitlement(currentOrg, 'module_rep_teams');
  const canAccounting   = !!currentOrg && hasModuleEntitlement(currentOrg, 'module_accounting');
  const canOrgAdmin     = userRole === 'owner' || userRole === 'admin';

  const cards: HelpHubCard[] = [
    {
      title: 'Tournaments',
      desc:  'Create tournaments, manage the lifecycle, build schedules, run scorekeepers, enter scores, and seal final results.',
      href:  `${helpBase}/tournaments`,
      topicCount: 25,
      keywords: ['create tournament', 'schedule', 'scorekeeper', 'scores', 'results', 'archive', 'teams'],
    },
    ...(canHouseLeague ? [
      {
        title: 'House League',
        desc:  'Set up seasons, manage teams and the draft, run schedules and standings.',
        href:  `${helpBase}/house-league`,
        topicCount: 9,
        keywords: ['season', 'division', 'draft', 'teams', 'standings', 'schedule'],
      },
      {
        title: 'House League Registrations',
        desc:  'Handle player registrations, review submissions, and manage payment status.',
        href:  `${helpBase}/registrations`,
        topicCount: 6,
        keywords: ['registration', 'payment', 'player', 'waitlist', 'guardian', 'status'],
      },
    ] : []),
    ...(canRepTeams ? [
      {
        title: 'Rep Teams',
        desc:  'Manage rep team programs, tryouts, rosters, cost allocation, and coaches.',
        href:  `${helpBase}/rep-teams`,
        topicCount: 8,
        keywords: ['rep team', 'tryout', 'roster', 'coach', 'dues', 'program'],
      },
      {
        title: 'Coaches Portal',
        desc:  'Help coaches manage rosters, schedules, dues, expenses, and player documents.',
        href:  `${helpBase}/coaches`,
        topicCount: 7,
        keywords: ['coach', 'coaches portal', 'roster', 'dues', 'documents', 'schedule'],
      },
    ] : []),
    ...(canAccounting ? [{
      title: 'Accounting',
      desc:  'Track revenue, expenses, and ledger entries across tournaments and programs.',
      href:  `${helpBase}/accounting`,
      topicCount: 7,
      keywords: ['ledger', 'budget', 'expense', 'revenue', 'allocation', 'actual'],
    }] : []),
    ...(canOrgAdmin ? [{
      title: 'Org Admin & Setup',
      desc:  'Configure your organization settings, manage members, subscription, and venues.',
      href:  `${helpBase}/org`,
      topicCount: 6,
      keywords: ['members', 'roles', 'invite', 'subscription', 'billing', 'settings', 'venues'],
    }] : []),
    {
      title: 'Exports & Downloads',
      desc:  'Export registrations, schedules, rosters, and reports to Excel, CSV, iCal, or PDF.',
      href:  `${helpBase}/exports`,
      topicCount: 6,
      keywords: ['export', 'xlsx', 'csv', 'excel', 'pdf', 'calendar', 'ics', 'download'],
    },
  ];

  const rolePaths: HelpHubRolePath[] = [
    ...(canOrgAdmin ? [{
      title: 'Owner / Org Admin',
      steps: [
        { label: 'Invite members and choose roles', href: `${helpBase}/org#recipe-invite-member` },
        { label: 'Fix a member access issue', href: `${helpBase}/org#recipe-fix-member-access` },
        { label: 'Turn on included modules', href: `${helpBase}/org#recipe-enable-modules` },
        { label: 'Handle billing or upgrade questions', href: `${helpBase}/org#recipe-handle-subscription-issue` },
      ],
    }] : []),
    {
      title: 'Tournament Admin',
      steps: [
        { label: 'Open team registration', href: `${helpBase}/tournaments#recipe-open-tournament-registration` },
        { label: 'Review team registrations', href: `${helpBase}/tournaments#recipe-review-tournament-teams` },
        { label: 'Build and adjust the schedule', href: `${helpBase}/tournaments#recipe-build-tournament-schedule` },
        { label: 'Set up scorekeepers and finalize scores', href: `${helpBase}/tournaments#recipe-finalize-tournament-scores` },
        { label: 'Close out the tournament', href: `${helpBase}/tournaments#recipe-closeout-tournament` },
      ],
    },
    ...(canHouseLeague ? [
      {
        title: 'League Admin',
        steps: [
          { label: 'Launch a house league season', href: `${helpBase}/house-league#recipe-launch-season` },
          { label: 'Open, pause, or close registration', href: `${helpBase}/house-league#recipe-open-close-registration` },
          { label: 'Build teams from approved players', href: `${helpBase}/house-league#recipe-build-teams` },
          { label: 'Generate a house league schedule', href: `${helpBase}/house-league#recipe-generate-house-league-schedule` },
          { label: 'Record scores and update standings', href: `${helpBase}/house-league#recipe-record-house-league-scores` },
        ],
      },
      {
        title: 'League Registrar',
        steps: [
          { label: 'Work the daily review queue', href: `${helpBase}/registrations#recipe-daily-review-queue` },
          { label: 'Promote a waitlisted player', href: `${helpBase}/registrations#recipe-promote-waitlisted-player` },
          { label: 'Add a manual registration', href: `${helpBase}/registrations#recipe-add-manual-registration` },
          { label: 'Message or export a targeted group', href: `${helpBase}/registrations#recipe-message-and-export-registrants` },
        ],
      },
    ] : []),
    ...(canRepTeams ? [
      {
        title: 'Rep Program Admin',
        steps: [
          { label: 'Create a team and program year', href: `${helpBase}/rep-teams#recipe-create-team-program-year` },
          { label: 'Open tryouts and review applicants', href: `${helpBase}/rep-teams#recipe-open-tryouts-review-applicants` },
          { label: 'Accept a player onto the roster', href: `${helpBase}/rep-teams#recipe-accept-player-to-roster` },
          { label: 'Give a coach access to their team', href: `${helpBase}/rep-teams#recipe-assign-coach-access` },
          { label: 'Publish document templates', href: `${helpBase}/rep-teams#recipe-publish-document-templates` },
        ],
      },
      {
        title: 'Coach',
        steps: [
          { label: 'Get started as a coach', href: `${helpBase}/coaches#recipe-first-login` },
          { label: 'Add or update a player', href: `${helpBase}/coaches#recipe-add-player` },
          { label: 'Build your team schedule', href: `${helpBase}/coaches#recipe-build-coach-schedule` },
          { label: 'Track player dues and expenses', href: `${helpBase}/coaches#recipe-track-dues` },
          { label: 'Track player documents', href: `${helpBase}/coaches#recipe-track-documents` },
        ],
      },
    ] : []),
    ...(canAccounting ? [{
      title: 'Treasurer',
      steps: [
        { label: 'Create the right ledger', href: `${helpBase}/accounting#recipe-create-ledger` },
        { label: 'Add income or expenses', href: `${helpBase}/accounting#recipe-add-income-expense` },
        { label: 'Transfer money between ledgers', href: `${helpBase}/accounting#recipe-transfer-between-ledgers` },
        { label: 'Prepare a board-ready financial report', href: `${helpBase}/accounting#recipe-board-report` },
      ],
    }] : []),
  ];

  return (
    <HelpHubClient
      title="Help & Guides"
      subtitle="Search for what you need, or browse the guides for your organization."
      cards={cards}
      rolePaths={rolePaths}
    />
  );
}
