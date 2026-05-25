'use client';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import HelpHubClient, { type HelpHubCard, type HelpHubQuickLink, type HelpHubRolePath } from '@/components/help/HelpHubClient';
import styles from '@/components/help/help.module.css';

export default function AdminHelpHubPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();

  if (loading) {
    return <div className={styles.loadingState}>Loading help...</div>;
  }

  if (!userRole) return null;

  const helpBase = currentOrg?.slug ? `/${currentOrg.slug}/admin/help` : './help';
  const canHouseLeague  = hasCapability(userRole, userCapabilities, 'module_house_league');
  const canRepTeams     = hasCapability(userRole, userCapabilities, 'module_rep_teams');
  const canAccounting   = hasCapability(userRole, userCapabilities, 'module_accounting');
  const canOrgAdmin     = userRole === 'owner' || userRole === 'admin';

  const cards: HelpHubCard[] = [
    {
      title: 'Tournaments',
      desc:  'Create tournaments, manage the lifecycle, build schedules, run scorekeepers, enter scores, and seal final results.',
      href:  `${helpBase}/tournaments`,
      category: 'Customer Guides',
      audience: 'Tournament admins',
      keywords: ['create tournament', 'schedule', 'scorekeeper', 'scores', 'results', 'archive', 'teams'],
      featured: true,
    },
    ...(canHouseLeague ? [
      {
        title: 'House League',
        desc:  'Set up seasons, manage teams and the draft, run schedules and standings.',
        href:  `${helpBase}/house-league`,
        category: 'Customer Guides',
        audience: 'League admins',
        keywords: ['season', 'division', 'draft', 'teams', 'standings', 'schedule'],
        featured: true,
      },
      {
        title: 'House League Registrations',
        desc:  'Handle player registrations, review submissions, and manage payment status.',
        href:  `${helpBase}/registrations`,
        category: 'Customer Guides',
        audience: 'Registrars',
        keywords: ['registration', 'payment', 'player', 'waitlist', 'guardian', 'status'],
      },
    ] : []),
    ...(canRepTeams ? [{
      title: 'Rep Teams',
      desc:  'Manage rep team programs, tryouts, rosters, cost allocation, and coaches.',
      href:  `${helpBase}/rep-teams`,
      category: 'Customer Guides',
      audience: 'Club admins',
      keywords: ['rep team', 'tryout', 'roster', 'coach', 'dues', 'program'],
    },
    {
      title: 'Coaches Portal',
      desc:  'Help coaches manage rosters, schedules, dues, expenses, and player documents.',
      href:  `${helpBase}/coaches`,
      category: 'Customer Guides',
      audience: 'Coaches and club admins',
      keywords: ['coach', 'coaches portal', 'roster', 'dues', 'documents', 'schedule'],
    }] : []),
    ...(canAccounting ? [{
      title: 'Accounting',
      desc:  'Track revenue, expenses, and ledger entries across tournaments and programs.',
      href:  `${helpBase}/accounting`,
      category: 'Customer Guides',
      audience: 'Treasurers',
      keywords: ['ledger', 'budget', 'expense', 'revenue', 'allocation', 'actual'],
    }] : []),
    ...(canOrgAdmin ? [{
      title: 'Org Admin & Setup',
      desc:  'Configure your organization settings, manage members, subscription, and venues.',
      href:  `${helpBase}/org`,
      category: 'Account Setup',
      audience: 'Owners and admins',
      keywords: ['members', 'roles', 'invite', 'subscription', 'billing', 'settings', 'venues'],
      featured: true,
    }] : []),
    {
      title: 'Exports & Downloads',
      desc:  'Export registrations, schedules, rosters, and reports to Excel, CSV, iCal, or PDF. Covers all formats, plan requirements, calendar import, and privacy defaults.',
      href:  `${helpBase}/exports`,
      category: 'Account Setup',
      audience: 'All admins',
      keywords: ['export', 'xlsx', 'csv', 'excel', 'pdf', 'calendar', 'ics', 'download'],
    },
  ];

  const quickLinks: HelpHubQuickLink[] = [
    { label: 'Create or run a tournament', href: `${helpBase}/tournaments#recipe-open-tournament-registration`, category: 'Tournaments', keywords: ['new tournament', 'schedule', 'score', 'results'] },
    { label: 'Set up scorekeepers and finalize scores', href: `${helpBase}/tournaments#recipe-finalize-tournament-scores`, category: 'Tournaments', keywords: ['scorekeeper', 'pending review', 'finalize', 'results'] },
    { label: 'Invite a member or change roles', href: `${helpBase}/org#recipe-invite-member`, category: 'Org Admin', keywords: ['invite', 'member', 'role', 'access', 'capability'] },
    ...(canOrgAdmin ? [
      { label: 'Invite, review, or bill a Team workspace', href: `${helpBase}/org#recipe-review-team-link-request`, category: 'Org Admin', keywords: ['team workspace', 'team links', 'invite', 'approve', 'basic visibility', 'org billing', 'team add-on'] },
    ] : []),
    { label: 'Understand plan limits and upgrades', href: `${helpBase}/org#recipe-handle-subscription-issue`, category: 'Subscription', keywords: ['billing', 'plan', 'upgrade', 'subscription', 'past due'] },
    { label: 'Export a spreadsheet, PDF, or calendar', href: `${helpBase}/exports`, category: 'Exports', keywords: ['excel', 'csv', 'pdf', 'ics', 'calendar'] },
    ...(canHouseLeague ? [
      { label: 'Set up a house league season', href: `${helpBase}/house-league#recipe-launch-season`, category: 'House League', keywords: ['season', 'division', 'draft'] },
      { label: 'Review player registrations', href: `${helpBase}/registrations#recipe-daily-review-queue`, category: 'Registrations', keywords: ['player', 'payment', 'status', 'waitlist'] },
    ] : []),
    ...(canRepTeams ? [
      { label: 'Manage tryouts, rosters, and coaches', href: `${helpBase}/rep-teams#recipe-open-tryouts-review-applicants`, category: 'Rep Teams', keywords: ['tryout', 'roster', 'coach', 'dues'] },
      { label: 'Help a coach get started', href: `${helpBase}/coaches#recipe-first-login`, category: 'Coaches Portal', keywords: ['coach', 'portal', 'roster', 'schedule'] },
    ] : []),
    ...(canAccounting ? [
      { label: 'Track revenue, expenses, and budgets', href: `${helpBase}/accounting#recipe-board-report`, category: 'Accounting', keywords: ['ledger', 'budget', 'actual', 'expense'] },
    ] : []),
  ];

  const rolePaths: HelpHubRolePath[] = [
    ...(canOrgAdmin ? [{
      title: 'Owner or Org Admin',
      audience: 'Owners and admins',
      desc: 'Start here when you are responsible for setup, access, billing, modules, and keeping the whole organization running.',
      keywords: ['owner', 'admin', 'setup', 'members', 'billing', 'modules', 'access'],
      steps: [
        { label: 'Invite members and choose roles', href: `${helpBase}/org#recipe-invite-member` },
        { label: 'Fix a member access issue', href: `${helpBase}/org#recipe-fix-member-access` },
        { label: 'Invite, review, or bill Team workspace links', href: `${helpBase}/org#recipe-review-team-link-request` },
        { label: 'Turn on included modules', href: `${helpBase}/org#recipe-enable-modules` },
        { label: 'Handle billing or upgrade questions', href: `${helpBase}/org#recipe-handle-subscription-issue` },
      ],
    }] : []),
    {
      title: 'Tournament Admin',
      audience: 'Tournament operators',
      desc: 'Follow this path to open registration, prepare teams, build the schedule, run scorekeepers, review scores, and close out the event.',
      keywords: ['tournament admin', 'operator', 'registration', 'schedule', 'scorekeepers', 'scores', 'closeout'],
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
        audience: 'House league leads',
        desc: 'Use this path to launch a season, manage registration timing, build teams, and keep schedules and standings current.',
        keywords: ['league admin', 'house league', 'season', 'teams', 'schedule', 'standings'],
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
        audience: 'Registrars',
        desc: 'Start here when your day-to-day work is reviewing player submissions, waitlists, messages, and exports.',
        keywords: ['registrar', 'registration review', 'waitlist', 'message registrants', 'export'],
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
        audience: 'Club admins',
        desc: 'Use this path to set up competitive teams, process tryouts, manage coach access, and publish required documents.',
        keywords: ['rep admin', 'club admin', 'tryouts', 'coach access', 'documents', 'roster'],
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
        audience: 'Team operators',
        desc: 'Start here when you manage one team day-to-day from the Coaches Portal.',
        keywords: ['coach', 'coach portal', 'roster', 'team schedule', 'dues', 'documents'],
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
      audience: 'Finance leads',
      desc: 'Use this path to choose the right ledger, record money clearly, and prepare board-ready reporting.',
      keywords: ['treasurer', 'accounting', 'ledger', 'income', 'expense', 'board report'],
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
      subtitle="Search by task, browse the guides available to your role, or jump into the common workflows people ask about most."
      searchPlaceholder="Search help by task, module, role, or export..."
      cards={cards}
      quickLinks={quickLinks}
      rolePaths={rolePaths}
    />
  );
}
