/* eslint-disable react/no-unescaped-entities */
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
      id: 'recipe-create-team-program-year',
      group: 'How-to recipes',
      heading: 'How to create a rep team and program year',
      summary: 'Set up the team once, then create a program year for each competitive season.',
      keywords: ['create rep team', 'program year', 'season', 'team setup', 'active year'],
      searchText: 'create rep team add team program year competitive season slug active draft completed archived roster tryouts documents coaches',
      content: (
        <>
          <p>Use a team record for the long-running franchise, and a program year for each season of activity.</p>
          <ol>
            <li>Go to <strong>Rep Teams</strong> and click <strong>Add Team</strong>.</li>
            <li>Enter the team name, slug, sport, division, and colour.</li>
            <li>Open the team and create a <strong>Program Year</strong> for the upcoming season.</li>
            <li>Keep the program year in <strong>Draft</strong> while you prepare tryouts, coaches, documents, and cost allocations.</li>
            <li>Move the program year to <strong>Active</strong> when coaches and families should begin using it.</li>
            <li>At the end of the season, complete and archive the program year instead of overwriting it.</li>
          </ol>
          <p>Create a new program year each season so rosters, finances, schedules, and documents remain historically accurate.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-rep-team-vs-program-year',
          question: 'What is the difference between a team and a program year?',
          answerText: 'The team is the long-running franchise. The program year is one competitive season with its own roster, tryouts, documents, schedule, and finances.',
          keywords: ['team', 'program year', 'season'],
          popular: true,
          answer: (
            <p>The <strong>team</strong> is the long-running franchise. The <strong>program year</strong> is one season with its own roster, tryouts, documents, schedule, and finances.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-open-tryouts-review-applicants',
      group: 'How-to recipes',
      heading: 'How to open tryouts and review applicants',
      summary: 'Turn on the public tryout form, process applications, and close registration when evaluations are done.',
      keywords: ['tryouts', 'open registration', 'applicants', 'offer', 'accept', 'decline'],
      searchText: 'open tryouts review applicants public tryout form registration pending review extend offer accept decline close registration add applicant',
      content: (
        <>
          <p>Tryout registration belongs to a specific team program year.</p>
          <ol>
            <li>Open the team and select the correct program year.</li>
            <li>Go to <strong>Tryouts</strong>.</li>
            <li>Turn on <strong>Open Registration</strong> when families should be able to apply.</li>
            <li>Review incoming applicants from <strong>Pending Review</strong>.</li>
            <li>Use <strong>Extend Offer</strong> for players you want to invite onto the team.</li>
            <li>Use <strong>Accept</strong> only when the player is confirmed for the roster.</li>
            <li>Close registration when tryouts are finished so the public form is no longer available.</li>
          </ol>
          <p>If an applicant registered outside the form, use <strong>Add Applicant</strong> so the decision history stays with the program year.</p>
        </>
      ),
    },
    {
      id: 'recipe-accept-player-to-roster',
      group: 'How-to recipes',
      heading: 'How to accept a player onto a rep roster',
      summary: 'Move a player from tryout application to coach-visible roster.',
      keywords: ['accept player', 'roster', 'offer extended', 'coach portal', 'tryout applicant'],
      searchText: 'accept player roster tryout applicant offer extended accepted coach portal missing player pending review roster visibility',
      content: (
        <>
          <p>A player becomes visible to the coach only after the application reaches the accepted state.</p>
          <ol>
            <li>Open the program year's <strong>Tryouts</strong> tab.</li>
            <li>Find the applicant by player name or guardian email.</li>
            <li>If the player is still pending, extend an offer first if your workflow requires an offer step.</li>
            <li>Click <strong>Accept</strong> when the player is confirmed.</li>
            <li>Open the roster or ask the coach to refresh the Coaches Portal.</li>
            <li>If the player is still missing, confirm you accepted them in the same program year the coach is viewing.</li>
          </ol>
          <p>Declined and offer-only players do not appear on the active roster.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-coach-missing-rep-player',
          question: 'Why can a coach not see a player on the roster?',
          answerText: 'The player may still be pending or offered, or the coach may be looking at a different program year.',
          keywords: ['missing roster', 'coach portal', 'accepted player'],
          popular: true,
          answer: (
            <p>Check the Tryouts tab. The player must be <strong>Accepted</strong>, not just offered or pending. Also confirm the coach is viewing the same program year.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-assign-coach-access',
      group: 'How-to recipes',
      heading: 'How to give a coach access to their team',
      summary: 'Invite the coach, assign them to the correct team, and verify they only see their own program year.',
      keywords: ['coach access', 'assign coach', 'coaches portal', 'member invite', 'team access'],
      searchText: 'coach access assign coach invite coach coaches portal team program year member role missing team cannot access coach portal',
      content: (
        <>
          <p>Coach access has two parts: the person needs a member account, and that account needs to be assigned to the team/program year.</p>
          <ol>
            <li>Invite the person from <strong>Members</strong> using the <strong>Coach</strong> role if they do not already have an account.</li>
            <li>Open the rep team program year and go to the coaches area.</li>
            <li>Add the coach to the correct team/program year.</li>
            <li>Ask the coach to sign in and open the Coaches Portal.</li>
            <li>If they cannot see the team, confirm their invite was accepted and that they were assigned to the active program year.</li>
          </ol>
          <p>Coaches should not be made full admins just to operate a team. The coach assignment keeps their access scoped to the team they manage.</p>
        </>
      ),
    },
    {
      id: 'recipe-publish-document-templates',
      group: 'How-to recipes',
      heading: 'How to publish document templates for coaches',
      summary: 'Create reusable document requirements that coaches can track for each player.',
      keywords: ['document templates', 'waiver', 'medical form', 'coach documents', 'publish template'],
      searchText: 'publish document templates coach documents player waiver medical consent code of conduct upload signed copies program year',
      content: (
        <>
          <p>Use document templates for requirements that every team or player needs to complete.</p>
          <ol>
            <li>Go to <strong>Rep Teams &gt; Document Templates</strong>.</li>
            <li>Create a template for the document type, such as waiver, medical form, or code of conduct.</li>
            <li>Publish it for the appropriate program year.</li>
            <li>Tell coaches to open their Documents tab and begin tracking completion.</li>
            <li>Review completion status before roster deadlines or travel events.</li>
          </ol>
          <p>Templates are program-year specific. Re-publish or recreate them for the next season when requirements carry forward.</p>
        </>
      ),
    },
    {
      heading: 'Creating teams and program years',
      content: (
        <>
          <p>From the Rep Teams page, click <strong>Add Team</strong> to create a team. Set a name, URL slug, sport, and optional division and colour. The slug appears in public URLs — choose it carefully.</p>
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
