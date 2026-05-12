import type { HelpPageContent } from './index';

const repTeamsHelp: HelpPageContent = {
  title: 'Rep Teams',
  role: 'Admin, Owner',
  intro: 'The Rep Teams module manages competitive travel teams through a franchise model — your org creates and oversees teams at the top level, while coaches operate their teams day-to-day from the Coaches Portal.',
  sections: [
    {
      heading: 'The franchise model explained',
      content: (
        <>
          <p>FieldLogicHQ separates rep team management into two layers:</p>
          <ul>
            <li><strong>Org HQ (you)</strong> — creates teams, runs tryouts, sets cost allocations, publishes document templates, and controls program year lifecycle. Admins and owners work here.</li>
            <li><strong>Coach operators</strong> — manage their assigned team day-to-day from the Coaches Portal: roster, schedule, team finances, player documents. Coaches see only their own team.</li>
          </ul>
          <p>This separation keeps org-level decisions centralized while giving coaches the autonomy they need to operate efficiently.</p>
        </>
      ),
    },
    {
      heading: 'Creating teams and program years',
      content: (
        <>
          <p>From the Rep Teams page, click <strong>Add Team</strong> to create a team. Set a name, URL slug, sport, and optional age group and colour. The slug appears in public URLs — choose it carefully.</p>
          <p>Once a team exists, open it and create a <strong>Program Year</strong>. A program year represents one competitive season for that team. All rosters, schedules, finances, tryouts, and documents are scoped to a program year. Create a new program year at the start of each season — this preserves full history for past years.</p>
          <p>Program years move through statuses: <strong>Draft → Active → Completed → Archived</strong>. Only one program year per team should be Active at a time.</p>
        </>
      ),
    },
    {
      heading: 'Running tryouts',
      content: (
        <>
          <p>Open the Tryouts tab for a program year. Toggle <strong>Open Registration</strong> to make the public tryout form live — families can submit applications directly from your org&apos;s public page.</p>
          <p>When applications arrive they land in <strong>Pending Review</strong>. For each applicant:</p>
          <ul>
            <li><strong>Extend Offer</strong> — sends an offer notification to the guardian. The application moves to Offer Extended.</li>
            <li><strong>Accept</strong> — finalizes the offer. The player is added to the program year roster and becomes available to the coach.</li>
            <li><strong>Decline</strong> — sends a decline notification.</li>
          </ul>
          <p>You can also <strong>Add Applicant</strong> manually to enter a player outside the public form.</p>
          <p>Once tryouts are complete, close registration using the toggle. The public form goes offline immediately.</p>
        </>
      ),
    },
    {
      heading: 'Managing cost allocations',
      content: (
        <>
          <p>Cost allocations split a shared expense (e.g., diamond rental, insurance, tournament fees) across one or more teams for a program year.</p>
          <p>Go to <strong>Cost Allocations</strong> and click <strong>New Allocation</strong>. The wizard has three steps:</p>
          <ol>
            <li><strong>Details</strong> — enter a description and the total shared expense amount. Optionally link it to an org ledger entry.</li>
            <li><strong>Team Splits</strong> — assign a portion to each team. Use a fixed dollar amount, a percentage of the total, or a per-session rate. Set payment due dates or split into multiple installments.</li>
            <li><strong>Review</strong> — confirm the allocation before saving.</li>
          </ol>
          <p>Once created, coaches see their team&apos;s allocation on their accounting page as a budget target. The Allocations list shows total, collected, and outstanding amounts so you can track payment status across all teams.</p>
        </>
      ),
    },
    {
      heading: 'Working with coaches — who does what',
      content: (
        <>
          <p>After a player is accepted through tryouts, the coach can see and manage them from the Coaches Portal roster. Admins can view the roster but coaches are the ones who add events, manage dues, and track player documents.</p>
          <p>Admins control:</p>
          <ul>
            <li>Team and program year setup</li>
            <li>Tryout registration and applicant review</li>
            <li>Cost allocation amounts and due dates</li>
            <li>Document templates published to coaches</li>
            <li>Program year status transitions</li>
          </ul>
          <p>Coaches control:</p>
          <ul>
            <li>Team schedule (games, practices, events)</li>
            <li>Dues schedules and expense tracking</li>
            <li>Player document completion tracking</li>
            <li>Day-to-day roster management</li>
          </ul>
          <p>If a coach reports missing players on their roster, check the Tryouts tab — the player may be Offered but not yet Accepted.</p>
        </>
      ),
    },
    {
      heading: 'Team documents and templates',
      content: (
        <>
          <p>Go to <strong>Document Templates</strong> from the Rep Teams page to publish document types to your coaches (e.g., player waiver, medical consent form, code of conduct).</p>
          <p>Once a template is published, it appears in the coach&apos;s Documents tab for their team. Coaches can mark which players have completed each document and upload the signed copies.</p>
          <p>Documents are scoped to the program year — templates published during the 2025 program year carry forward only if re-published for the new year.</p>
        </>
      ),
    },
  ],
};

export default repTeamsHelp;
