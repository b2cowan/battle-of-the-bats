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
