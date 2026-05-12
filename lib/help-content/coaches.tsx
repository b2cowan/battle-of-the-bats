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
