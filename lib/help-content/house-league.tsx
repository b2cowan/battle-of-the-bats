/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

const houseLeagueHelp: HelpPageContent = {
  title: 'House League',
  role: 'League Admin, Admin',
  intro: 'House League manages the full seasonal workflow for recreational leagues — from opening registration to recording final scores. Each season runs independently with its own registrations, teams, schedule, and standings. The free League plan runs one capped season; League Plus and Club remove the caps and add exports.',
  searchPlaceholder: 'Search House League help — seasons, registration, teams, schedule…',
  sections: [
    {
      id: 'lifecycle',
      group: 'Getting started',
      heading: 'Understanding the season lifecycle',
      summary: 'A season moves through Draft → Registration Open → Closed → Active → Completed → Archived, by hand.',
      keywords: ['season lifecycle', 'status', 'draft', 'registration open', 'active', 'archived'],
      searchText: 'season lifecycle status draft registration open registration closed active completed archived transition advance manually activate season',
      content: (
        <>
          <p>Every season moves through these statuses in order:</p>
          <ul>
            <li><strong>Draft</strong> — setup mode. Create divisions, set capacity limits, and configure automation before going public. Nothing is visible to families yet, and the season has no public page.</li>
            <li><strong>Registration Open</strong> — the public registration form is live. Families can submit registrations for any division in this season.</li>
            <li><strong>Registration Closed</strong> — the public form no longer accepts new submissions. Use this phase to build teams and prepare the schedule while reviewing any pending registrations.</li>
            <li><strong>Active</strong> — games are underway. Scores can be submitted and standings update automatically.</li>
            <li><strong>Completed</strong> — the season is over. It stays visible but no longer takes changes.</li>
            <li><strong>Archived</strong> — the season is retired from active views. Historical data is preserved.</li>
          </ul>
          <p>You advance the status manually with the transition button on the season detail page (for example, <strong>Activate Season</strong> moves a closed season to Active). Each step is intentional — there is no auto-advance — and you can move back where the product allows it.</p>
        </>
      ),
    },
    {
      id: 'plans-limits',
      group: 'Getting started',
      heading: 'Plans and limits — free League vs. League Plus',
      summary: 'The free League plan runs one capped season; League Plus and Club lift the caps and add exports.',
      keywords: ['free league', 'league plus', 'club', 'limits', 'caps', 'upgrade', 'team limit'],
      searchText: 'free league plan league plus club limits caps one season one division eight teams 8 teams upgrade unlimited exports league exports plan gating',
      content: (
        <>
          <p>House League is available on the free <strong>League</strong> plan, on <strong>League Plus</strong>, and on <strong>Club</strong>. The free League plan is a real product, not a trial — it just has caps so it fits a small house league:</p>
          <ul>
            <li><strong>One active season</strong> at a time.</li>
            <li><strong>One division</strong> per season.</li>
            <li><strong>Up to eight teams</strong> per season.</li>
            <li><strong>Limited exports</strong> — schedule and registration exports are part of League Plus.</li>
          </ul>
          <p>When you hit a cap, the product tells you which one and points to <strong>League Plus</strong>, which removes all three caps and turns on exports. Club includes everything in League Plus plus the rest of the platform.</p>
        </>
      ),
    },
    {
      id: 'create-season',
      group: 'Getting started',
      heading: 'Creating and configuring a season',
      summary: 'Set the season basics, registration window, fee, and automation, then add divisions.',
      keywords: ['create season', 'season setup', 'divisions', 'capacity', 'automation', 'registration fee', 'waiver'],
      searchText: 'create season setup name slug sport division registration opens closes fee waiver automation auto approve waitlist accounting divisions capacity public url',
      content: (
        <>
          <p>From the House League page, click <strong>Create Season</strong>. The create form collects the season basics (name, URL slug, sport, an age/division label) and lets you set the <strong>registration open and close dates</strong>, a <strong>registration fee</strong>, <strong>waiver text</strong>, and the <strong>automation</strong> toggles right away. The slug appears in public URLs — choose it carefully.</p>
          <p>After creating the season, open it and add <strong>divisions</strong>. Each division is a sub-group within the season (e.g., "Division A", "Girls U11") with its own registration list, teams, schedule, and standings. Set a capacity per division to automatically cap registrations and start a waitlist. (On the free League plan, a season includes one division.)</p>
          <p>The <strong>Automation</strong> settings control whether registrations are auto-approved when a division has open spots, whether the waitlist auto-promotes when a spot opens, and whether accounting entries are auto-generated on approval. Auto-generating fee entries needs the Accounting module.</p>
        </>
      ),
    },
    {
      id: 'recipe-launch-season',
      group: 'How-to recipes',
      heading: 'How to launch a house league season',
      summary: 'Create the season, prepare divisions, confirm registration settings, and open the public form.',
      keywords: ['launch season', 'season setup', 'registration open', 'divisions', 'capacity'],
      searchText: 'launch season create season setup divisions capacity registration open public form automation auto approve waitlist schedule teams',
      links: [
        { label: 'House League', href: '../house-league' },
      ],
      content: (
        <>
          <p>Use this checklist when starting a new recreational season.</p>
          <ol>
            <li>Create the season from <strong>House League</strong> and keep it in <strong>Draft</strong> while you configure it.</li>
            <li>Add the divisions families should be able to register for (the free League plan includes one).</li>
            <li>Set capacity for each division so the system knows when to start a waitlist.</li>
            <li>Review automation: auto-approve, waitlist promotion, and accounting entry creation.</li>
            <li>Move the season to <strong>Registration Open</strong>. A public season page becomes available once it leaves Draft.</li>
            <li>Share the registration link from your website, email list, or social media after confirming the form is live.</li>
          </ol>
          <p>Do not open registration until divisions and capacities are ready. Changing those after families start registering can make the review queue harder to manage.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-house-league-before-opening',
          question: 'What should be done before I open house league registration?',
          answerText: 'Create the season, add divisions, set capacities, review automation, and confirm the public form before changing the season to Registration Open.',
          keywords: ['open registration', 'launch checklist', 'division capacity'],
          popular: true,
          answer: (
            <p>Create the season, add divisions, set capacities, review automation, and confirm the registration form. Then change the season status to <strong>Registration Open</strong>.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-open-close-registration',
      group: 'How-to recipes',
      heading: 'How to open, pause, or close registration',
      summary: 'Control whether families can submit new house league registrations.',
      keywords: ['open registration', 'close registration', 'pause registration', 'public form', 'season status'],
      searchText: 'open registration close registration pause public form season status registration open closed draft active waitlist capacity reopen',
      links: [
        { label: 'House League', href: '../house-league' },
      ],
      content: (
        <>
          <p>Registration availability is controlled by the season status.</p>
          <ol>
            <li>Open the season detail page.</li>
            <li>Use the status transition control to move from <strong>Draft</strong> to <strong>Registration Open</strong> when the form should go live.</li>
            <li>To stop new submissions, move the season to <strong>Registration Closed</strong>.</li>
            <li>After registration closes, continue reviewing pending players, promoting waitlisted players, and building teams.</li>
            <li>Move to <strong>Active</strong> only when teams and the schedule are ready for game operations.</li>
          </ol>
          <p>If you need a short pause, closing registration is safer than deleting divisions or lowering capacities. You can reopen if needed by moving the status back where the product allows it.</p>
        </>
      ),
    },
    {
      id: 'recipe-build-teams',
      group: 'How-to recipes',
      heading: 'How to build teams and run a draft',
      summary: 'Create team slots in bulk, assign players manually or by draft, and finalize once everyone is picked.',
      keywords: ['build teams', 'create teams', 'draft', 'assign players', 'randomize', 'finalize'],
      searchText: 'build teams create teams bulk count names team colour coach edit team player pool approved active draft randomize confirm finalize resume draft clear all assignments unassigned',
      content: (
        <>
          <p>Build teams after most registrations are reviewed and the division player pool is clean. Only <strong>Active</strong> registrations appear in the pool — pending, declined, waitlisted, and withdrawn players are excluded.</p>
          <ol>
            <li>Open the season, go to <strong>Teams</strong>, and select a division.</li>
            <li>Click <strong>Create Teams</strong>. You choose how many teams to create and type their names in one step (on the free League plan you can create up to eight). Set each team&apos;s <strong>colour</strong> and <strong>coach name</strong> afterward with <strong>Edit Team</strong>.</li>
            <li>Assign players from the pool by dragging them onto a team — or use <strong>Randomize</strong> to spread all unassigned players evenly (it asks you to confirm first, and won&apos;t move already-assigned players).</li>
            <li>For a structured draft, click <strong>Start Draft</strong>. Teams take turns picking from the pool; picks can be undone one at a time. If you leave mid-draft, a <strong>Resume Draft</strong> button picks it back up.</li>
            <li>Click <strong>Finalize Draft</strong> to apply the assignments. Finalize stays disabled until every player has been picked.</li>
          </ol>
          <p>You can re-assign players any time by dragging them to a different team or back to the pool, and <strong>Clear All Assignments</strong> wipes assignments (and any in-progress draft) to start over.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-player-missing-from-house-league-team-pool',
          question: 'Why is a player missing from the team builder?',
          answerText: 'Only Active registrations appear in the team assignment pool. Pending, waitlisted, declined, and withdrawn players are excluded — move the player to Active first.',
          keywords: ['missing player', 'team builder', 'active registration'],
          popular: true,
          answer: (
            <p>Check the player&apos;s registration status. Only <strong>Active</strong> registrations appear in the team assignment pool — move the player to Active first.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-generate-house-league-schedule',
      group: 'How-to recipes',
      heading: 'How to generate a schedule and add practices',
      summary: 'Generate a round-robin after teams exist, preview before saving, and track practices separately.',
      keywords: ['generate schedule', 'round robin', 'games', 'preview', 'practices', 'recurring'],
      searchText: 'generate schedule house league round robin games preview teams divisions location time rounds per week add game practices recurring practice start end time cancel series',
      content: (
        <>
          <p>Generate a schedule only after the division&apos;s teams are created.</p>
          <ol>
            <li>Open the season, go to <strong>Schedule</strong>, and select the division.</li>
            <li>Click <strong>Generate Schedule</strong> to build a round-robin (every team plays every other team once).</li>
            <li>Enter the first game date, default time, <strong>rounds per week</strong>, and location.</li>
            <li>Preview the generated games and look for date, field, or matchup problems.</li>
            <li>Save the schedule. Edit individual games afterward for exceptions, or use <strong>Add Game</strong> for one-off games.</li>
          </ol>
          <p><strong>Practices</strong> are tracked separately. Add a single or recurring practice per team with a start and end time. When you cancel a recurring practice, you choose whether to cancel just that one, this and the rest of the series, or the whole series.</p>
          <p>Exporting the schedule (Excel, CSV, or calendar file) is part of League Plus.</p>
        </>
      ),
    },
    {
      id: 'recipe-record-house-league-scores',
      group: 'How-to recipes',
      heading: 'How to record scores and read standings',
      summary: 'Complete games, enter results, and understand the points-based standings.',
      keywords: ['scores', 'standings', 'completed games', 'points', 'tiebreaker'],
      searchText: 'record scores update standings completed games home score away score points win two tie one loss zero differential GF GA standings page tiebreaker',
      content: (
        <>
          <p>Standings are based on completed games, so score entry and game status matter.</p>
          <ol>
            <li>Open the season schedule and click the game that has been played.</li>
            <li>Set its status to <strong>Completed</strong> — the score fields appear.</li>
            <li>Enter the home and away scores and save.</li>
            <li>Open <strong>Standings</strong> (its own page, reached from the division) to see the updated table.</li>
          </ol>
          <p>Standings rank teams by <strong>points</strong> — a win is worth 2, a tie 1, and a loss 0. Ties in points are broken by score differential, then by total scored (the GF/GA columns). If standings look wrong, check for games still scheduled, postponed, or missing scores — only completed games count.</p>
        </>
      ),
    },
    {
      id: 'registrations',
      group: 'Running the season',
      heading: 'Managing registrations day to day',
      summary: 'Review the queue, approve/waitlist/decline (each emails the family), track fee status, and message registrants.',
      keywords: ['registrations', 'approve', 'waitlist', 'decline', 'fee paid', 'message registrants', 'withdrawn'],
      searchText: 'manage registrations pending active waitlist declined withdrawn approve decline confirm email guardian fee paid checkbox message registrants email blast add registration walk-in tabs',
      links: [
        { label: 'Registrations guide', href: '../help/registrations' },
      ],
      content: (
        <>
          <p>Registrations arrive via the public form while a season is in <strong>Registration Open</strong>. Each lands in <strong>Pending Review</strong> unless auto-approve is on. On the Registrations page, the tabs (Pending / Active / Waitlist / Declined &amp; Withdrawn) and the search box help you work a large list.</p>
          <ul>
            <li><strong>Approve</strong> — moves the player to Active and emails the family. They&apos;re eligible for team assignment.</li>
            <li><strong>Waitlist</strong> — holds the registration in queue and emails the family their position. If auto-promote is on, the next waitlisted player advances when a spot opens.</li>
            <li><strong>Decline</strong> — asks you to confirm, then emails a decline notice to the family.</li>
          </ul>
          <p>Each row has a <strong>Fee Paid</strong> toggle so you can track payment alongside status. <strong>Add Registration</strong> manually enters a player outside the public form (walk-ins or carry-overs). <strong>Message Registrants</strong> (owners and admins) emails a group — everyone active, or filtered by division, team, or status.</p>
          <p>For the full registration workflow, see the <a href="../help/registrations">Registrations guide</a>.</p>
        </>
      ),
    },
    {
      id: 'ledger-notifications',
      group: 'Running the season',
      heading: 'The season ledger and notification log',
      summary: 'Each division has a ledger for fees and a notifications page logging the emails the season has sent.',
      keywords: ['ledger', 'notifications', 'email log', 'fees', 'accounting'],
      searchText: 'season ledger division fees accounting notifications email log sent emails approval waitlist decline confirmation history',
      content: (
        <>
          <p>From a division you can open two record-keeping views alongside Registrations, Teams, Schedule, and Standings:</p>
          <ul>
            <li><strong>Ledger</strong> — a per-season view of registration fees and related entries. When the season auto-generates fees on approval, they land here.</li>
            <li><strong>Notifications</strong> — a log of the emails the season has sent (approvals, waitlist notices, declines), so you can confirm a family was contacted if they say they didn&apos;t receive something.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'public-page',
      group: 'Running the season',
      heading: 'Sharing the public season page',
      summary: 'Once a season leaves Draft it gets a public page with registration, schedule, and standings.',
      keywords: ['public page', 'public url', 'share', 'registration link'],
      searchText: 'public season page url share registration link schedule standings view public page draft no public page',
      content: (
        <>
          <p>A season has no public page while it&apos;s in <strong>Draft</strong>. Once you move it to Registration Open or beyond, a <strong>View public page</strong> button appears on the season detail page. That public page is where families register and, later, follow the schedule and standings — share its link directly.</p>
        </>
      ),
    },
    {
      id: 'closing',
      group: 'Running the season',
      heading: 'Closing out a season',
      summary: 'Mark the season Completed when games end, then Archived to retire it without losing data.',
      keywords: ['close season', 'completed', 'archived', 'season end'],
      searchText: 'closing season completed archived retire preserve data house league no seal step',
      content: (
        <>
          <p>When all games are complete, transition the season to <strong>Completed</strong>. This signals that the season is over without removing any data.</p>
          <p>When you&apos;re ready to retire it from active views, transition to <strong>Archived</strong>. Archived seasons are hidden from most views, but their data — registrations, teams, schedule, standings — is preserved and reachable from the season detail page.</p>
          <p>There is no seal step for house league seasons (sealing is a tournament-specific concept).</p>
        </>
      ),
    },
  ],
};

export default houseLeagueHelp;
