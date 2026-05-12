import type { HelpPageContent } from './index';

const tournamentsHelp: HelpPageContent = {
  title: 'Tournaments',
  role: 'Admin, Owner',
  intro: 'Tournaments are the core unit of FieldLogicHQ. Each tournament has its own age groups, teams, schedule, and results — all managed from the admin panel.',
  sections: [
    {
      heading: 'Creating a tournament',
      content: (
        <>
          <p>Click <strong>New Tournament</strong> from the Tournaments page. You will set a name, year, URL slug, and optional start/end dates.</p>
          <p>The <strong>URL slug</strong> is used in all public links — choose it carefully. Changing it later will break any links you have already shared (e.g. on social media or email campaigns).</p>
          <p>On creation you can pre-select age divisions, set team capacities, and optionally migrate data from a previous year.</p>
        </>
      ),
    },
    {
      heading: 'The tournament lifecycle',
      content: (
        <>
          <p>Every tournament moves through these statuses in order:</p>
          <ul>
            <li><strong>Draft</strong> — setup mode. Visible only to admins. Build age groups, add teams, and configure the schedule before going public.</li>
            <li><strong>Active</strong> — live. The tournament appears on your public site and accepts registrations and score submissions.</li>
            <li><strong>Completed</strong> — season is over. The tournament is still visible but no longer accepting changes. Use this to free your active slot for a new tournament.</li>
            <li><strong>Archived</strong> — retired. Hidden from most views. Historical data is preserved but the tournament is no longer prominently displayed.</li>
            <li><strong>Sealed</strong> — permanent. Creates an immutable snapshot of the final results in the digital ledger. This cannot be undone — only seal when results are final.</li>
          </ul>
        </>
      ),
    },
    {
      heading: 'Managing registrations and teams',
      content: (
        <>
          <p>Teams register through your public registration form when the tournament is Active. Each registration appears in the <strong>Registrations</strong> page for review.</p>
          <p>Approve registrations to add the team to your accepted list. Accepted teams are available for schedule assignment and appear in the public bracket and standings.</p>
        </>
      ),
    },
    {
      heading: 'Building and publishing the schedule',
      content: (
        <>
          <p>Go to <strong>Schedule</strong> and add games manually, or use <strong>Auto-Generate</strong> to create a round-robin schedule based on your age groups and team count.</p>
          <p>For playoffs, use the <strong>Playoff Wizard</strong> to build bracket rounds. You can switch between list and bracket view at any time.</p>
          <p>The schedule is visible to the public as soon as games are added — there is no separate publish step.</p>
        </>
      ),
    },
    {
      heading: 'Score entry — what officials see',
      content: (
        <>
          <p>Officials access a separate scoring interface using their tournament credentials. They see only the games assigned to them and submit scores from the field.</p>
          <p>Submitted scores appear in <strong>Results &amp; Scoring</strong> immediately. If your org requires score finalization, submitted scores show as <strong>Pending Review</strong> until an admin finalizes them.</p>
        </>
      ),
    },
    {
      heading: 'Sealing and archiving',
      content: (
        <>
          <p><strong>Archive</strong> a tournament to retire it from active views while keeping its data accessible in Past Tournaments.</p>
          <p><strong>Seal</strong> a completed tournament to create a permanent, tamper-proof snapshot in the digital ledger. Sealed tournaments display a "SEALED" badge and cannot be modified. Only seal once all scores are entered and verified — this action cannot be reversed.</p>
        </>
      ),
    },
  ],
};

export default tournamentsHelp;
