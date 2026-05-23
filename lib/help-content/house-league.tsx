/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

const houseLeagueHelp: HelpPageContent = {
  title: 'House League',
  role: 'League Admin, Admin',
  intro: 'The House League module manages the full seasonal workflow for recreational leagues — from opening registration to recording final scores. Each season runs independently with its own registrations, teams, schedule, and standings.',
  sections: [
    {
      heading: 'Understanding the season lifecycle',
      content: (
        <>
          <p>Every season moves through these statuses in order:</p>
          <ul>
            <li><strong>Draft</strong> — setup mode. Create divisions, set capacity limits, and configure automation before going public. Nothing is visible to parents yet.</li>
            <li><strong>Registration Open</strong> — the public registration form is live. Parents can submit registrations for any division in this season.</li>
            <li><strong>Registration Closed</strong> — the public form is no longer accepting new submissions. Use this phase to build teams and prepare the schedule while reviewing any pending registrations.</li>
            <li><strong>Active</strong> — games are underway. Scores can be submitted and standings update automatically.</li>
            <li><strong>Completed</strong> — the season is over. The season is still visible but no longer accepting changes.</li>
            <li><strong>Archived</strong> — the season is retired from active views. Historical data is preserved.</li>
          </ul>
          <p>You advance the status manually using the transition button on the season detail page. Each step is intentional — there is no auto-advance.</p>
        </>
      ),
    },
    {
      heading: 'Creating and configuring a season',
      content: (
        <>
          <p>From the House League page, click <strong>Create Season</strong>. Set a name, URL slug, sport, age group, and optional start/end dates. The slug appears in public URLs — choose it carefully.</p>
          <p>After creation, open the season and add <strong>divisions</strong>. Each division is a sub-group within the season (e.g., "Division A", "Girls U11"). You can set a capacity per division to automatically cap registrations and start a waitlist.</p>
          <p>The <strong>Automation</strong> settings control whether registrations are auto-approved when a division has open spots, whether the waitlist auto-promotes when a spot opens, and whether accounting entries are auto-generated on approval.</p>
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
            <li>Add each division or age group that families should be able to register for.</li>
            <li>Set capacity for each division so the system knows when to start a waitlist.</li>
            <li>Review automation settings: auto-approve, auto-waitlist, waitlist promotion, and accounting entry creation.</li>
            <li>Preview the public registration flow if available, then move the season to <strong>Registration Open</strong>.</li>
            <li>Send the registration link from your website, email list, or social media after confirming the form is live.</li>
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
      searchText: 'open registration close registration pause public form season status registration open closed draft active waitlist capacity',
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
      heading: 'How to build teams from approved players',
      summary: 'Create teams, assign players manually or through a draft, and keep unapproved players out of rosters.',
      keywords: ['build teams', 'draft', 'assign players', 'player pool', 'approved players'],
      searchText: 'build teams create teams assign players player pool approved active registrations draft randomize finalize roster unassigned players',
      content: (
        <>
          <p>Teams should be built after most registrations are reviewed and the division player pool is clean.</p>
          <ol>
            <li>Open the season and go to <strong>Teams</strong>.</li>
            <li>Select a division.</li>
            <li>Create the team slots you need for that division.</li>
            <li>Confirm the player pool contains approved players only. Pending, declined, and waitlisted players should not be assigned.</li>
            <li>Assign players manually, use randomize for a quick balance pass, or start a structured draft.</li>
            <li>Review team sizes and obvious conflicts before finalizing assignments.</li>
          </ol>
          <p>If a player is missing from the pool, check their registration status first. They usually need to be moved to <strong>Active</strong>.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-player-missing-from-house-league-team-pool',
          question: 'Why is a player missing from the team builder?',
          answerText: 'Only active/approved registrations appear in the team assignment pool.',
          keywords: ['missing player', 'team builder', 'active registration'],
          popular: true,
          answer: (
            <p>Check the player's registration status. Only <strong>Active</strong> registrations should appear in the team assignment pool.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-generate-house-league-schedule',
      group: 'How-to recipes',
      heading: 'How to generate a house league schedule',
      summary: 'Create games after teams exist and preview the schedule before saving it.',
      keywords: ['generate schedule', 'round robin', 'games', 'preview', 'teams'],
      searchText: 'generate schedule house league round robin games preview teams divisions location time rounds per week schedule active standings',
      content: (
        <>
          <p>Generate schedules only after the division's teams are created.</p>
          <ol>
            <li>Open the season and go to <strong>Schedule</strong>.</li>
            <li>Select the division you want to schedule.</li>
            <li>Click <strong>Generate Schedule</strong>.</li>
            <li>Enter the first game date, default time, rounds per week, and location.</li>
            <li>Preview the generated games and look for date, field, or matchup problems.</li>
            <li>Save the schedule when it looks right. Edit individual games afterward for exceptions.</li>
          </ol>
          <p>The public schedule uses the saved game records. Once saved, schedule edits are reflected anywhere the season schedule is displayed.</p>
        </>
      ),
    },
    {
      id: 'recipe-record-house-league-scores',
      group: 'How-to recipes',
      heading: 'How to record scores and update standings',
      summary: 'Complete games, enter results, and understand when standings change.',
      keywords: ['scores', 'standings', 'completed games', 'record result'],
      searchText: 'record scores update standings completed games home score away score wins losses goal differential standings table',
      content: (
        <>
          <p>Standings are based on completed games, so score entry and game status matter.</p>
          <ol>
            <li>Open the season schedule.</li>
            <li>Select the game that has been played.</li>
            <li>Change its status to <strong>Completed</strong>.</li>
            <li>Enter the home and away scores.</li>
            <li>Save the game and review the <strong>Standings</strong> tab.</li>
          </ol>
          <p>If standings look wrong, check for games that are still scheduled, postponed, or missing scores. Only completed games should count.</p>
        </>
      ),
    },
    {
      heading: 'Managing registrations',
      content: (
        <>
          <p>Registrations arrive via the public form when a season is in <strong>Registration Open</strong> status. Each submission lands in <strong>Pending Review</strong> unless auto-approve is enabled.</p>
          <p>On the Registrations page, review each submission and choose:</p>
          <ul>
            <li><strong>Approve</strong> — moves to Active. The player is eligible for team assignment.</li>
            <li><strong>Waitlist</strong> — holds the registration in queue. If auto-promote is on, the next waitlisted player advances automatically when a spot opens.</li>
            <li><strong>Decline</strong> — sends a decline email to the parent. The spot remains open for manual waitlist management.</li>
          </ul>
          <p>Use the <strong>Add Registration</strong> button to manually enter a player outside the public form — useful for walk-ins or carry-over registrations.</p>
          <p>The search box and tabs (Pending / Active / Waitlist / Declined) help you work through a large registration list efficiently.</p>
        </>
      ),
    },
    {
      heading: 'Building teams and running a draft',
      content: (
        <>
          <p>Go to the <strong>Teams</strong> tab for the season. Select a division, then click <strong>Create Teams</strong> to create named team slots. You can set a team colour and coach name optionally.</p>
          <p>Once teams exist, assign players from the <strong>Player Pool</strong> on the left — drag them onto a team column, or use <strong>Randomize</strong> to distribute all unassigned players evenly.</p>
          <p>For a structured draft, click <strong>Start Draft</strong>. The draft runs in pick order — each team takes turns selecting from the unassigned pool. Picks can be undone one at a time. When all players are picked, click <strong>Finalize Draft</strong> to apply the assignments.</p>
          <p>Players can be re-assigned at any time by dragging them to a different team or back to the pool.</p>
        </>
      ),
    },
    {
      heading: 'Building the game schedule',
      content: (
        <>
          <p>Go to the <strong>Schedule</strong> tab. Select a division, then use <strong>Generate Schedule</strong> to create a round-robin schedule — every team plays every other team once. Set the first game date, time, rounds per week, and default location. Use <strong>Preview Schedule</strong> before saving to confirm the generated games.</p>
          <p>To add a single game manually, click <strong>Add Game</strong>. You can edit any game after it is created — change the time, location, or status.</p>
          <p>Practices are tracked separately under the <strong>Practices</strong> view. Add single or recurring practice sessions per team.</p>
        </>
      ),
    },
    {
      heading: 'Recording scores and updating standings',
      content: (
        <>
          <p>Open any game from the schedule and set its status to <strong>Completed</strong>, then enter the home and away scores. Standings update automatically based on completed game results.</p>
          <p>Standings are viewable on the <strong>Standings</strong> tab. The standings table ranks teams by wins, then by goal differential as a tiebreaker.</p>
        </>
      ),
    },
    {
      heading: 'Closing out a season',
      content: (
        <>
          <p>When all games are complete, transition the season to <strong>Completed</strong>. This signals to your org that the season is over without removing any data.</p>
          <p>When you are ready to retire the season from active views, transition to <strong>Archived</strong>. Archived seasons are hidden from most views but their data — registrations, teams, schedule, standings — is preserved and accessible from the season detail page.</p>
          <p>There is no seal step for house league seasons (sealing is a tournament-specific concept).</p>
        </>
      ),
    },
  ],
};

export default houseLeagueHelp;
