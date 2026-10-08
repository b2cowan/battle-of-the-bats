'use client';
import { useOrg } from '@/lib/org-context';
import { hasModuleEntitlement, isClubPlan } from '@/lib/module-entitlements';
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
  const canFamilies     = !!currentOrg && hasModuleEntitlement(currentOrg, 'module_families');
  const canOrgAdmin     = userRole === 'owner' || userRole === 'admin';
  const isClub          = !!currentOrg && isClubPlan(currentOrg.planId);

  const cards: HelpHubCard[] = [
    {
      title: 'Tournaments',
      desc:  'Create tournaments, manage the lifecycle, build schedules, hand scoring and check-in to volunteers, enter scores, chat with coaches, and seal final results.',
      href:  `${helpBase}/tournaments`,
      topicCount: 26,
      keywords: ['create tournament', 'schedule', 'scorekeeper', 'volunteer', 'staff kit', 'check-in', 'scores', 'results', 'archive', 'teams', 'chat', 'coach chat'],
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
        desc:  'Help coaches manage rosters, schedules, dues, expenses, player documents, and chat.',
        href:  `${helpBase}/coaches`,
        topicCount: 9,
        keywords: ['coach', 'coaches portal', 'roster', 'dues', 'documents', 'schedule', 'chat', 'tournament chat', 'staff room', 'staff chat'],
      },
    ] : []),
    ...(canAccounting ? [{
      title: 'Accounting',
      desc:  'The club’s books, what it bills its teams, and what they ask of it — one page with tabs.',
      href:  `${helpBase}/accounting`,
      topicCount: 7,
      keywords: ['ledger', 'budget', 'expense', 'revenue', 'allocation', 'actual', 'payment request', 'payee', 'reminders'],
    }] : []),
    ...(canFamilies ? [{
      title: 'Families',
      desc:  'Look up any household across rep and house league: who owes, who is missing forms, duplicates, messaging, and data export.',
      href:  `${helpBase}/families`,
      topicCount: 5,
      keywords: ['family', 'families', 'household', 'guardian', 'parent', 'duplicates', 'merge', 'opt out', 'export', 'privacy'],
    }] : []),
    ...(canOrgAdmin ? [{
      title: 'Org Admin & Setup',
      desc:  'Configure your organization settings, manage members, plan & billing, and venues.',
      href:  `${helpBase}/org`,
      topicCount: 8,
      keywords: ['members', 'roles', 'invite', 'plan & billing', 'subscription', 'billing', 'settings', 'venues', 'set up your club'],
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
        ...(isClub ? [{ label: 'Set up your club', href: `${helpBase}/org#recipe-set-up-your-club` }] : []),
        { label: 'Invite members and choose roles', href: `${helpBase}/org#recipe-invite-member` },
        { label: 'Fix a member access issue', href: `${helpBase}/org#recipe-fix-member-access` },
        { label: 'Turn on included modules', href: `${helpBase}/org#recipe-enable-modules` },
        ...(isClub ? [{ label: 'Club plan & billing', href: `${helpBase}/org#club-plan-and-billing` }] : []),
        { label: 'If your subscription ends', href: `${helpBase}/org#subscription-ends` },
      ],
    }] : []),
    {
      title: 'Tournament Admin',
      steps: [
        { label: 'Open team registration', href: `${helpBase}/tournaments#recipe-open-tournament-registration` },
        { label: 'Review team registrations', href: `${helpBase}/tournaments#recipe-review-tournament-teams` },
        { label: 'Build and adjust the schedule', href: `${helpBase}/tournaments#recipe-build-tournament-schedule` },
        { label: 'Hand scoring and check-in to volunteers', href: `${helpBase}/tournaments#scores-and-results` },
        { label: 'Review and finalize scores', href: `${helpBase}/tournaments#recipe-finalize-tournament-scores` },
        { label: 'Help fans follow a team and get score alerts', href: `${helpBase}/tournaments#public-site-preview` },
        { label: 'Chat with your coaches', href: `${helpBase}/tournaments#tournament-chat` },
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
          { label: 'Add a team and start its first season', href: `${helpBase}/rep-teams#recipe-create-team-program-year` },
          { label: 'Open tryouts and review applicants', href: `${helpBase}/rep-teams#recipe-open-tryouts-review-applicants` },
          { label: 'Accept a player onto the roster', href: `${helpBase}/rep-teams#recipe-accept-player-to-roster` },
          { label: 'Invite a coach', href: `${helpBase}/rep-teams#recipe-assign-coach-access` },
          { label: 'Publish document templates', href: `${helpBase}/rep-teams#recipe-publish-document-templates` },
        ],
      },
      {
        title: 'Coach',
        steps: [
          { label: 'Get started as a coach', href: `${helpBase}/coaches#recipe-first-login` },
          { label: 'Add or update a player', href: `${helpBase}/coaches#recipe-add-player` },
          { label: 'Build your team schedule', href: `${helpBase}/coaches#recipe-build-coach-schedule` },
          { label: 'Track team fees', href: `${helpBase}/coaches#recipe-track-dues` },
          { label: 'Track player documents', href: `${helpBase}/coaches#recipe-track-documents` },
          { label: 'Chat with the tournament organizer', href: `${helpBase}/coaches#recipe-tournament-chat` },
          { label: 'Families and the season recap', href: `${helpBase}/coaches#premium-family-access` },
        ],
      },
    ] : []),
    ...(canAccounting ? [{
      title: 'Treasurer',
      steps: [
        { label: 'Add an entry', href: `${helpBase}/accounting#recipe-add-income-expense` },
        { label: 'Transfer money between the club’s books', href: `${helpBase}/accounting#recipe-transfer-between-ledgers` },
        { label: 'Bill the teams for a shared cost', href: `${helpBase}/accounting#allocations` },
        { label: 'Answer a payment request', href: `${helpBase}/accounting#payment-requests` },
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
