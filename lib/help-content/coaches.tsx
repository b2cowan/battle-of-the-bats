import type { HelpPageContent } from './index';

const coachesHelp: HelpPageContent = {
  title: 'Coaches Portal',
  role: 'Coach',
  intro: 'The coaches portal is your day-to-day workspace. Your org sets up the team and handles tryouts — you run everything from here once the season starts.',
  sections: [
    {
      heading: 'Getting started — the franchise model',
      content: (
        <>
          <p>FieldLogicHQ uses a <strong>franchise model</strong> for rep teams. Think of your org as head office and yourself as the operator of your team&apos;s location.</p>
          <ul>
            <li><strong>Org admin does:</strong> create the team, run tryouts, approve players, set cost allocations, and publish document templates.</li>
            <li><strong>You do:</strong> manage the roster day-to-day, build the schedule, track player dues, log expenses, and handle documents.</li>
          </ul>
          <p>If something looks missing — a player who should be on your roster, a document you expected — contact your org admin. They control the setup side.</p>
        </>
      ),
    },
    {
      id: 'recipe-first-login',
      group: 'How-to recipes',
      heading: 'How to get started as a coach',
      summary: 'Sign in, confirm the right team and program year, and check the core setup before the season starts.',
      keywords: ['coach login', 'first login', 'program year', 'team setup', 'coach portal'],
      searchText: 'coach first login sign in coaches portal team program year roster schedule dues documents allocations missing access',
      content: (
        <>
          <p>Use this checklist the first time you open the Coaches Portal for a new season.</p>
          <ol>
            <li>Sign in using the email address your org invited.</li>
            <li>Confirm you are viewing the correct team and program year.</li>
            <li>Open <strong>Roster</strong> and confirm the expected players are present.</li>
            <li>Open <strong>Schedule</strong> and check whether any events have already been added.</li>
            <li>Open <strong>Accounting</strong> and review dues, expenses, and org allocations.</li>
            <li>Open <strong>Documents</strong> and confirm which forms your org expects you to track.</li>
          </ol>
          <p>If your team, program year, roster, or document list looks wrong, contact your org admin. They control the setup side.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-coach-wrong-team',
          question: 'Why do I not see my team?',
          answerText: 'Your invite may not be accepted, or your org admin may not have assigned you to the active team program year yet.',
          keywords: ['missing team', 'coach access', 'program year'],
          popular: true,
          answer: (
            <p>Your invite may not be accepted, or your org admin may not have assigned you to the active program year yet. Ask the admin to confirm your coach assignment.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-link-parent-org',
      group: 'How-to recipes',
      heading: 'How to manage parent organization links',
      summary: 'Request a Basic visibility link or respond when a club or association invites your standalone Team workspace.',
      keywords: ['team workspace', 'link organization', 'parent org', 'club', 'visibility link', 'basic sharing', 'team invitation'],
      searchText: 'standalone team workspace request parent organization link org club association invitation accept decline basic visibility sharing billing ownership roster documents accounting',
      links: [
        { label: 'Link Organization', href: '../link-org' },
      ],
      content: (
        <>
          <p>Use this when your standalone Team workspace belongs to a parent club, league, or association and you want that organization to recognize the connection.</p>
          <ol>
            <li>Open <strong>Link Organization</strong> from the Coaches Portal.</li>
            <li>Enter the parent organization&apos;s URL slug or contact email.</li>
            <li>Review the request details and submit it for the organization to approve.</li>
            <li>Watch the request status from the same page.</li>
          </ol>
          <p>If an organization invites your Team workspace first, open <strong>Link Organization</strong>, review the invitation, then click <strong>Accept Invitation</strong> or <strong>Decline</strong>.</p>
          <p>The first link type is <strong>Basic visibility</strong>. It records the association only. It does not transfer billing, ownership, roster access, player documents, accounting data, or full rep-team admin rights.</p>
          <p>If the parent organization should pay for the team or fully own the team later, that requires a separate approval flow.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-team-link-billing-transfer',
          question: 'Does linking my Team workspace move billing to the organization?',
          answerText: 'No. The Basic visibility link only records that the team is associated with the organization. Billing transfer is a separate approval flow.',
          keywords: ['billing transfer', 'team link', 'organization pays'],
          popular: true,
          answer: (
            <p>No. The Basic visibility link only records that your Team workspace is associated with the organization. Billing transfer is a separate approval flow.</p>
          ),
        },
        {
          id: 'faq-team-link-invitation-decline',
          question: 'What happens if I decline an organization invitation?',
          answerText: 'Declining closes the Basic visibility invitation. It does not affect your Team workspace, billing, roster, documents, accounting, or coach access.',
          keywords: ['decline invitation', 'team link invite', 'organization invitation'],
          answer: (
            <p>Declining closes the Basic visibility invitation. It does not affect your Team workspace, billing, roster, documents, accounting, or coach access.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-add-player',
      group: 'How-to recipes',
      heading: 'How to add or update a player',
      summary: 'Maintain roster records while preserving inactive players for history.',
      keywords: ['add player', 'roster', 'inactive player', 'update player'],
      searchText: 'add player update player roster inactive active manual add walk-on missing player tryout acceptance',
      content: (
        <>
          <p>Players usually arrive from org-managed tryouts, but coaches can add late players when allowed by the organization.</p>
          <ol>
            <li>Open <strong>Roster</strong>.</li>
            <li>Click <strong>Add Player</strong> for a manual addition.</li>
            <li>Enter the player and guardian details your org needs for communications and records.</li>
            <li>Set the player to <strong>Active</strong> if they should count for dues and document tracking.</li>
            <li>Use <strong>Inactive</strong> for players who should remain in history but not count in current workflows.</li>
          </ol>
          <p>If a tryout player is missing, ask your org admin to confirm they accepted the applicant into the same program year.</p>
        </>
      ),
    },
    {
      id: 'recipe-build-coach-schedule',
      group: 'How-to recipes',
      heading: 'How to build your team schedule',
      summary: 'Add practices, games, tournaments, and team events to the coach calendar.',
      keywords: ['coach schedule', 'practice', 'game', 'tournament', 'team event', 'recurring'],
      searchText: 'coach schedule add practice game scrimmage tournament tournament game team event recurrence list week month calendar score',
      content: (
        <>
          <p>Use the schedule to keep your team calendar in one place.</p>
          <ol>
            <li>Open <strong>Schedule</strong>.</li>
            <li>Choose the event type: practice, league game, scrimmage, tournament, tournament game, or team event.</li>
            <li>Enter date, time, location, opponent, and notes where relevant.</li>
            <li>Use recurrence for weekly practices so you do not need to enter each one manually.</li>
            <li>Switch between list, week, and month views to review the full calendar.</li>
            <li>After games, enter scores where the event type supports it.</li>
          </ol>
          <p>Events are visible to you and your org admin. Use clear names and locations so everyone sees the same plan.</p>
        </>
      ),
    },
    {
      id: 'recipe-track-dues',
      group: 'How-to recipes',
      heading: 'How to track player dues and expenses',
      summary: 'Set dues schedules, mark payments, log expenses, and watch team budget status.',
      keywords: ['dues', 'installments', 'payments', 'expenses', 'budget', 'accounting'],
      searchText: 'track dues player dues installments mark paid expenses budget accounting reminders org allocations tournament payables',
      content: (
        <>
          <p>Use Accounting to keep player collections and team spending current.</p>
          <ol>
            <li>Open <strong>Accounting</strong>.</li>
            <li>Use <strong>Set dues for all players</strong> when everyone owes the same amount.</li>
            <li>Adjust individual player dues if a player has a different arrangement.</li>
            <li>Mark installments paid as money comes in.</li>
            <li>Log team expenses and tournament payables as they happen.</li>
            <li>Review org allocations so you know what your team owes the organization.</li>
          </ol>
          <p>The budget card is your quick health check. If numbers look wrong, look for unpaid installments, missing expenses, or allocations that your org admin has not finalized.</p>
        </>
      ),
    },
    {
      id: 'recipe-track-documents',
      group: 'How-to recipes',
      heading: 'How to track player documents',
      summary: 'Use org templates and team templates to monitor which players have completed required forms.',
      keywords: ['documents', 'waiver', 'medical form', 'templates', 'completion'],
      searchText: 'track documents player documents org templates team templates waiver medical consent code of conduct upload complete missing forms',
      content: (
        <>
          <p>Documents help you see which players have completed required forms.</p>
          <ol>
            <li>Open <strong>Documents</strong>.</li>
            <li>Review org-wide templates published by your organization.</li>
            <li>Add team templates for team-specific forms if needed.</li>
            <li>Mark each player complete as forms are received.</li>
            <li>Upload signed copies when your workflow requires attachments.</li>
            <li>Review incomplete players before deadlines, tournaments, or travel events.</li>
          </ol>
          <p>If an expected org form is missing, contact your org admin. Coaches can track published templates, but org admins decide which org-wide templates exist.</p>
        </>
      ),
    },
    {
      heading: 'Your roster — how players get added and managed',
      content: (
        <>
          <p>Players are added to your roster in two ways:</p>
          <ul>
            <li><strong>Via tryout acceptance</strong> — when your org admin accepts a tryout applicant, they appear on your roster automatically.</li>
            <li><strong>Manual add</strong> — you can add players directly from the Roster page using the &quot;Add Player&quot; button. This is useful for late additions or walk-ons.</li>
          </ul>
          <p>Each player has a status of <strong>Active</strong> or <strong>Inactive</strong>. Inactive players remain on the roster for record-keeping but are excluded from dues calculations and document tracking.</p>
          <p>If a player you expected isn&apos;t showing up, confirm with your org admin that the tryout application was accepted in the system.</p>
        </>
      ),
    },
    {
      heading: 'Building your team schedule',
      content: (
        <>
          <p>Use the Schedule page to manage your full team calendar. You can add six event types:</p>
          <ul>
            <li><strong>Practice</strong> — supports weekly recurrence so you only need to enter it once per season.</li>
            <li><strong>League Game</strong> — tracks opponent, home/away, and lets you enter a score after the game.</li>
            <li><strong>Scrimmage</strong> — same as a league game but doesn&apos;t count toward standings.</li>
            <li><strong>Tournament</strong> — an external tournament the team attends. Add individual game slots inside it.</li>
            <li><strong>Tournament Game</strong> — a single game inside a tournament event.</li>
            <li><strong>Team Event</strong> — team meetings, fundraisers, or anything else.</li>
          </ul>
          <p>Events are visible to you and your org admin. Switch between List, Week, and Month views using the toggle at the top right.</p>
        </>
      ),
    },
    {
      heading: 'Team finances — dues, expenses, and your budget',
      content: (
        <>
          <p>The Accounting page has three sections:</p>
          <ul>
            <li><strong>Player Dues</strong> — set a dues schedule per player (total amount + installment dates), then mark installments paid as money comes in. Use &quot;Set dues for all players&quot; to apply one schedule to the whole roster at once.</li>
            <li><strong>Expenses &amp; Tournament Payables</strong> — log team expenses and track deposits/balances owed to tournaments.</li>
            <li><strong>Org Allocations</strong> — costs your org has assigned to your team (e.g. diamond fees, insurance). These are set by the org admin and are read-only here.</li>
          </ul>
          <p>The <strong>Budget</strong> card at the top of the Accounting page is your overall target. Set it to match your org allocation or your team&apos;s fundraising goal for the season.</p>
          <p>If dues and expenses show nothing yet, your org admin may still be configuring the accounting setup — check back after they confirm it&apos;s ready.</p>
        </>
      ),
    },
    {
      heading: 'Player documents — what coaches manage vs. what the org provides',
      content: (
        <>
          <p>The Documents page has two sections:</p>
          <ul>
            <li><strong>Org-Wide Templates</strong> — waivers, medical consent forms, and codes of conduct published by your org admin. These apply to all teams. You cannot edit them, but you can download them to share with players and families.</li>
            <li><strong>Team Templates</strong> — documents you upload yourself that are specific to your team (e.g. team-specific photo permission forms).</li>
          </ul>
          <p>If no org-wide templates appear yet, your org admin hasn&apos;t published any. Contact them to confirm which forms are required for your team this season.</p>
        </>
      ),
    },
    {
      heading: 'Past seasons — accessing team history',
      content: (
        <>
          <p>Each <strong>program year</strong> is a separate season for your team. Your roster, schedule, and finances are all scoped to the current program year.</p>
          <p>Past program years are accessible from the team History page. You can view rosters and events from previous seasons, but cannot edit them once the year is closed.</p>
          <p>At the start of a new season, your org admin will create a new program year. Once you&apos;re assigned to it, it becomes your active context in the portal.</p>
        </>
      ),
    },
  ],
};

export default coachesHelp;
