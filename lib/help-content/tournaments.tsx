/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

const tournamentsHelp: HelpPageContent = {
  title: 'Tournaments',
  role: 'Admin, Owner',
  searchPlaceholder: 'Search tournament help...',
  intro: 'Use this guide to set up, publish, operate, and close out tournaments in FieldLogicHQ. It is organized around the same workflow you use in the tournament admin menu.',
  sections: [
    {
      id: 'getting-started',
      group: 'Getting Started',
      heading: 'Tournament workflow at a glance',
      summary: 'The shortest path from draft setup to a live public tournament.',
      hideFromContents: true,
      keywords: ['start', 'setup order', 'first tournament', 'draft', 'publish'],
      searchText: 'create tournament draft dates URL slug divisions capacity venues contacts rules announcements scoring settings access branding preview activate registration public launch checklist',
      links: [
        { label: 'Open Dashboard', href: '../tournaments/dashboard' },
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
      ],
      content: (
        <>
          <p>A tournament contains the public tournament site, divisions, team registrations, venues, schedule, scores, announcements, rules, contacts, and archive status.</p>
          <p>Recommended setup order:</p>
          <ol>
            <li>Create the tournament as a draft.</li>
            <li>Confirm the name, year, dates, and public URL slug.</li>
            <li>Add divisions, capacities, pools, and fee settings.</li>
            <li>Add venues and a public contact email.</li>
            <li>Add rules, resources, and a welcome announcement.</li>
            <li>Review scoring, branding, subscription, and member access settings.</li>
            <li>Preview the tournament site.</li>
            <li>Activate when the launch checklist is complete.</li>
          </ol>
        </>
      ),
      faqs: [
        {
          id: 'faq-publish-tournament',
          question: 'How do I publish a tournament?',
          answerText: 'Use Manage Tournaments or the dashboard activation button. A tournament must have dates, divisions, public contact, and at least one open division before activation.',
          keywords: ['publish', 'activate', 'go live', 'registration open'],
          popular: true,
          answer: (
            <p>Open <strong>Manage Tournaments</strong>, change the tournament status to <strong>Active</strong>, and confirm the activation prompt. Activation is blocked until required launch items are complete: dates, at least one division, a public contact email, and at least one division open for registration.</p>
          ),
        },
        {
          id: 'faq-activation-blocked',
          question: 'Why can I not activate my tournament?',
          answerText: 'Activation is blocked when dates, divisions, public contact, or an open division are missing.',
          keywords: ['blocked', 'not ready', 'launch checklist', 'draft only'],
          popular: true,
          answer: (
            <p>The launch checklist is missing a required item. Check the tournament dashboard for the exact blocker, then add tournament dates, create a division, choose a public contact, or open at least one division for registration.</p>
          ),
        },
      ],
    },
    {
      id: 'launch-checklist',
      group: 'Setup',
      heading: 'Create, edit, and launch a tournament',
      summary: 'Names, dates, public URLs, draft mode, and launch readiness.',
      keywords: ['new tournament', 'edit tournament', 'slug', 'dates', 'launch checklist'],
      searchText: 'new tournament name year slug URL public link dates draft active status activation checklist tournament slot limit',
      links: [
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
        { label: 'Dashboard Checklist', href: '../tournaments/dashboard' },
      ],
      content: (
        <>
          <p>Click <strong>New Tournament</strong> from Manage Tournaments. The setup wizard saves the tournament as a draft so you can finish the details before anything appears publicly.</p>
          <p>The <strong>URL slug</strong> is used in every public tournament link. Choose it carefully. Changing it later can break links already shared by email, social media, or team communications.</p>
          <p>The dashboard launch checklist shows what is still required before activation. When every required item is complete, use Manage Tournaments to change the status from <strong>Draft</strong> to <strong>Active</strong>.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-change-slug',
          question: 'What happens if I change the tournament URL slug?',
          answerText: 'Changing a tournament slug changes public URLs and can break shared links.',
          keywords: ['slug', 'url', 'public link', 'broken links'],
          popular: true,
          answer: (
            <p>The public URL changes immediately. Any previously shared links to registration, schedule, standings, rules, or results may stop working. Update external links before saving a new slug.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-open-tournament-registration',
      group: 'How-to recipes',
      heading: 'How to open team registration',
      summary: 'Activate the tournament and make at least one division available on the public registration form.',
      keywords: ['open registration', 'team registration', 'activate tournament', 'public form', 'division open'],
      searchText: 'open team registration activate tournament public registration form active draft division open capacity fees contact launch checklist',
      links: [
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
        { label: 'Age Groups', href: '../tournaments/age-groups' },
      ],
      content: (
        <>
          <p>Team registration opens only when the tournament and at least one division are ready.</p>
          <ol>
            <li>Finish the launch checklist: dates, public contact, divisions, and required public information.</li>
            <li>Open <strong>Age Groups</strong> and confirm at least one division is accepting registrations.</li>
            <li>Review capacities, fees, and custom registration questions before sharing the link.</li>
            <li>Use <strong>Manage Tournaments</strong> to move the tournament from <strong>Draft</strong> to <strong>Active</strong>.</li>
            <li>Open the public registration page and submit a quick internal test if your workflow allows it.</li>
            <li>Share the public registration link with teams only after the form shows the right divisions and fees.</li>
          </ol>
          <p>If registration is not visible, check the tournament status and division registration settings first.</p>
        </>
      ),
    },
    {
      id: 'recipe-review-tournament-teams',
      group: 'How-to recipes',
      heading: 'How to review team registrations',
      summary: 'Approve, waitlist, reject, and track payment readiness for teams.',
      keywords: ['review teams', 'approve registration', 'waitlist team', 'payment status', 'accepted teams'],
      searchText: 'review team registrations approve accept waitlist reject pending payment deposit paid paid in full schedule eligibility selected teams bulk actions',
      links: [
        { label: 'Registrations', href: '../tournaments/teams' },
      ],
      content: (
        <>
          <p>Review teams regularly while registration is open so schedule planning starts from a clean accepted-team list.</p>
          <ol>
            <li>Open <strong>Registrations</strong> from tournament admin.</li>
            <li>Filter by division or status if the list is large.</li>
            <li>Open each pending team and confirm contacts, division, payment status, and custom question answers.</li>
            <li>Move the team to <strong>Accepted</strong>, <strong>Waitlist</strong>, or <strong>Rejected</strong>.</li>
            <li>Track deposit or full payment status as payments arrive.</li>
            <li>Before building the schedule, confirm every team that should play is <strong>Accepted</strong>.</li>
          </ol>
          <p>Only accepted teams appear in schedule assignment controls. If a team is missing from the schedule builder, check its registration status.</p>
        </>
      ),
    },
    {
      id: 'recipe-build-tournament-schedule',
      group: 'How-to recipes',
      heading: 'How to build and adjust the tournament schedule',
      summary: 'Create games manually or generate round-robin schedules, then edit exceptions before game day.',
      keywords: ['build schedule', 'generate schedule', 'round robin', 'edit games', 'venues'],
      searchText: 'build tournament schedule generate round robin auto-generate accepted teams venues time slots edit games cancel restore public schedule playoffs',
      links: [
        { label: 'Schedule', href: '../tournaments/schedule' },
      ],
      content: (
        <>
          <p>Build the schedule after accepted teams, venues, and time slots are ready.</p>
          <ol>
            <li>Open <strong>Schedule</strong>.</li>
            <li>Add games manually for small events or special matchups.</li>
            <li>Use <strong>Auto-Generate</strong> for round-robin play when accepted teams and venue/time-slot data are complete.</li>
            <li>Preview generated games before saving.</li>
            <li>Edit individual games for field changes, rest gaps, weather adjustments, or custom matchups.</li>
            <li>Use the public preview to confirm the schedule is readable for teams.</li>
          </ol>
          <p>There is no separate schedule publish button. Saved schedule changes flow to the public tournament pages.</p>
        </>
      ),
    },
    {
      id: 'recipe-finalize-tournament-scores',
      group: 'How-to recipes',
      heading: 'How to enter, review, and finalize scores',
      summary: 'Record results from admins or scorekeepers and understand pending review.',
      keywords: ['enter scores', 'finalize scores', 'pending review', 'scorekeeper submissions', 'results'],
      searchText: 'enter scores finalize scores scorekeeper submissions pending review results scoring completed games public standings correct score revert scheduled',
      links: [
        { label: 'Results & Scoring', href: '../tournaments/results' },
      ],
      content: (
        <>
          <p>Use <strong>Results &amp; Scoring</strong> to keep public results accurate during the event.</p>
          <ol>
            <li>Open the game that has a final result.</li>
            <li>Enter home and away scores, or review the scorekeeper's submitted score.</li>
            <li>If score finalization is enabled, mark reviewed submissions as final.</li>
            <li>Correct mistakes by editing the score or reverting the game to scheduled and re-entering it.</li>
            <li>Check standings or bracket paths after important score changes.</li>
          </ol>
          <p>Pending review means a score has been submitted but still needs admin confirmation before it is treated as final.</p>
        </>
      ),
    },
    {
      id: 'recipe-closeout-tournament',
      group: 'How-to recipes',
      heading: 'How to close out a tournament',
      summary: 'Complete the event, share final results, archive when ready, and seal only after review.',
      keywords: ['closeout', 'complete tournament', 'archive', 'seal', 'final results'],
      searchText: 'closeout tournament complete archive seal final results post-event summary free tournament slot immutable snapshot board report results email',
      links: [
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
        { label: 'Past Tournaments', href: '../tournaments/archives' },
      ],
      content: (
        <>
          <p>Closeout should happen after game data is reviewed and teams no longer need operational updates.</p>
          <ol>
            <li>Confirm all scores, standings, and playoff results are complete.</li>
            <li>Mark the tournament <strong>Completed</strong>.</li>
            <li>Send or share public final results if your plan and workflow include post-event communication.</li>
            <li>Export any registration, schedule, accounting, or results reports needed by your board.</li>
            <li>Archive the tournament when it should leave active views and free its tournament slot.</li>
            <li>Seal only after final review. Sealing creates a permanent snapshot and cannot be undone.</li>
          </ol>
          <p>Completed tournaments still count against plan limits until they are archived.</p>
        </>
      ),
    },
    {
      id: 'divisions-and-pools',
      group: 'Setup',
      heading: 'Divisions, capacities, pools, and fees',
      summary: 'Control who can register and how teams are organized.',
      keywords: ['division', 'age group', 'capacity', 'pool', 'fees', 'payment'],
      searchText: 'age groups divisions capacity waitlist pools user selects pool fee schedule deposit total fee registration open closed',
      links: [
        { label: 'Age Groups', href: '../tournaments/age-groups' },
        { label: 'Fee Settings', href: '../tournaments/manage' },
      ],
      content: (
        <>
          <p>Divisions are the registration and competition groups inside a tournament. They can represent age groups, skill levels, adult brackets, or custom groupings.</p>
          <p>Use <strong>capacity</strong> to set the number of teams a division can accept. If a division reaches capacity, admins can use waitlist status to hold additional teams.</p>
          <p>Use <strong>pools</strong> when a division needs smaller groups for round-robin play. If teams should choose a pool during registration, enable user-selectable pool registration for that division.</p>
          <p>Fee schedules can be set at the tournament level or per division. Payment status then appears beside accepted teams in the registrations view.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-how-pools-work',
          question: 'How do pools work?',
          answerText: 'Pools split a division into smaller groups for schedule and standings organization.',
          keywords: ['pools', 'pool play', 'round robin', 'division'],
          popular: true,
          answer: (
            <p>Pools split one division into smaller groups, such as Pool A and Pool B. They help organize round-robin games and playoff paths when a division has more teams than one simple bracket should handle.</p>
          ),
        },
        {
          id: 'faq-division-fees',
          question: 'Can I collect different fees by division?',
          answerText: 'Use division-level fee mode when each division needs its own deposit, total fee, or due dates.',
          keywords: ['fees', 'deposit', 'payments', 'division fee'],
          answer: (
            <p>Yes. Set the fee schedule mode to <strong>By Division</strong>, then edit each division to configure its own deposit, total fee, and due dates.</p>
          ),
        },
      ],
    },
    {
      id: 'venues-contacts-rules',
      group: 'Setup',
      heading: 'Venues, contacts, announcements, and rules',
      summary: 'Prepare the public information teams need before registration opens.',
      keywords: ['venues', 'diamonds', 'contacts', 'public contact', 'announcements', 'rules', 'resources'],
      searchText: 'venues diamonds fields custom location contacts public contact email notifications announcements welcome message rules resources documents public site',
      links: [
        { label: 'Venues', href: '../tournaments/venues' },
        { label: 'Contacts', href: '../tournaments/contacts' },
        { label: 'Announcements', href: '../tournaments/announcements' },
        { label: 'Rules & Resources', href: '../tournaments/rules' },
      ],
      content: (
        <>
          <p>Add venues before building the schedule so games can use consistent field names. You can still type a custom location on an individual game if needed.</p>
          <p>The public contact email is the address teams see for tournament questions. If no tournament-specific contact is set, FieldLogicHQ may fall back to the organization contact where available.</p>
          <p>Announcements and rules help teams self-serve key information. Use announcements for timely updates and rules/resources for durable documents or tournament policies.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-public-contact',
          question: 'Which email address do teams see for tournament questions?',
          answerText: 'Teams see the tournament public contact email when set, otherwise the organization contact may be used.',
          keywords: ['contact', 'email', 'questions', 'public'],
          answer: (
            <p>Teams see the tournament public contact when one is selected on the Contacts page. If none is selected, use the organization contact as the fallback where the product shows one.</p>
          ),
        },
        {
          id: 'faq-rules-resources',
          question: 'How do I show rules or resources to teams?',
          answerText: 'Add rules and documents from Rules & Resources so they appear on the public tournament site.',
          keywords: ['rules', 'resources', 'documents', 'public site'],
          answer: (
            <p>Open <strong>Rules & Resources</strong> and add the text, links, or documents teams need. These become part of the tournament public experience.</p>
          ),
        },
      ],
    },
    {
      id: 'registrations-and-teams',
      group: 'Registration and Teams',
      heading: 'Registration review and team management',
      summary: 'Review incoming teams, payment status, waitlists, and schedule eligibility.',
      keywords: ['registrations', 'teams', 'accepted', 'pending', 'waitlist', 'rejected', 'payments'],
      searchText: 'teams registrations public form pending accepted waitlist rejected payment status no schedule deposit paid paid in full past due export accepted teams schedule builder',
      links: [
        { label: 'Registrations', href: '../tournaments/teams' },
        { label: 'Registration Questions', href: '../tournaments/settings/registration-fields' },
      ],
      content: (
        <>
          <p>Teams register through the public tournament registration form once the tournament is active and at least one division is open.</p>
          <p>Each registration can be <strong>Pending</strong>, <strong>Accepted</strong>, <strong>Waitlist</strong>, or <strong>Rejected</strong>. Only accepted teams are eligible for schedule assignment and public competition views.</p>
          <p>Payment status helps admins track whether an accepted team has no schedule, pending payment, deposit paid, paid in full, or past due.</p>
          <p>The free Tournament plan supports standard registration fields, selected-row status updates, basic payment tracking, and waitlist collection for a starter event. Tournament Plus adds the registration operations tools serious organizers usually need: custom questions, file collection, Excel/PDF exports, payment reminders, and waitlist promotion workflows.</p>
          <p>Use <strong>Registration Questions</strong> when you need tournament-specific coach confirmations, dropdown answers, or uploaded documents. Submitted answers appear in admin registration details and registration exports.</p>
          <p>Use bulk actions only after filtering and selecting the exact registrations you want to change. Bulk actions update selected registrations only; they do not apply to hidden rows or every registration in the tournament.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-where-teams-register',
          question: 'Where do teams register?',
          answerText: 'Teams register on the public tournament registration page after activation and when a division is open.',
          keywords: ['registration form', 'public registration', 'teams register'],
          popular: true,
          answer: (
            <p>Teams use the public registration page for the tournament. The form is available when the tournament is active and at least one division is open for registration.</p>
          ),
        },
        {
          id: 'faq-team-missing-schedule',
          question: 'Why is a team missing from the schedule builder?',
          answerText: 'Only accepted teams appear for scheduling. Pending, waitlisted, or rejected registrations are excluded.',
          keywords: ['missing team', 'schedule builder', 'accepted team'],
          popular: true,
          answer: (
            <p>Check the registration status. A team must be <strong>Accepted</strong> before it appears in schedule assignment controls.</p>
          ),
        },
        {
          id: 'faq-payment-status',
          question: 'Where do payment statuses come from?',
          answerText: 'Payment statuses are based on fee schedule and team payment tracking.',
          keywords: ['payment status', 'deposit', 'paid', 'past due'],
          answer: (
            <p>Payment status is calculated from the tournament or division fee schedule and the payment values tracked for each accepted registration.</p>
          ),
        },
        {
          id: 'faq-custom-registration-questions',
          question: 'How do custom registration questions work?',
          answerText: 'Tournament Plus lets admins add tournament-specific questions and file uploads to the public team registration form.',
          keywords: ['custom questions', 'registration fields', 'file upload', 'Tournament Plus'],
          answer: (
            <p>Open <strong>Settings & Access</strong>, then <strong>Registration Questions</strong>. Tournament Plus questions appear on the public registration form and submitted answers appear in registration details and exports.</p>
          ),
        },
        {
          id: 'faq-bulk-registration-actions',
          question: 'How do bulk registration actions work?',
          answerText: 'Select the registrations you want to update, then choose the bulk action. Only selected registrations are changed.',
          keywords: ['bulk actions', 'selected teams', 'approve', 'reject', 'waitlist'],
          answer: (
            <p>Select specific rows on the Registrations page, then choose a bulk action such as accept, reject, waitlist, mark deposit paid, or mark paid. Basic selected-row updates are available on all tournament plans and only affect the selected rows.</p>
          ),
        },
        {
          id: 'faq-waitlist-order',
          question: 'How is waitlist order preserved?',
          answerText: 'Waitlisted teams receive a numbered position in their division queue, and promotions compact the remaining queue.',
          keywords: ['waitlist', 'queue', 'promotion', 'position'],
          answer: (
            <p>When a team joins or is moved to the waitlist, FieldLogicHQ assigns the next queue position for that division. Tournament Plus adds promotion and queue-management tools; when a waitlisted team is promoted, the remaining waitlist closes the gap so the queue stays in order.</p>
          ),
        },
      ],
    },
    {
      id: 'schedule-and-playoffs',
      group: 'Schedule and Playoffs',
      heading: 'Build schedules and playoff brackets',
      summary: 'Manual games, round-robin generation, pools, playoffs, and exports.',
      keywords: ['schedule', 'games', 'round robin', 'auto-generate', 'playoffs', 'bracket'],
      searchText: 'schedule add game edit game cancel restore auto generate round robin pools flat playoff wizard bracket view export csv',
      links: [
        { label: 'Schedule', href: '../tournaments/schedule' },
      ],
      content: (
        <>
          <p>Use <strong>Add Game</strong> for manual scheduling. Tournament Plus, League, and Club can also use <strong>Auto-Generate</strong> to create round-robin games from accepted teams, divisions, venues, and time slots.</p>
          <p>Use pool view when a division is split into pools. Use flat view when you want one combined list.</p>
          <p>For playoffs, switch to the Playoffs view. Free Tournament orgs can add playoff games manually; Tournament Plus, League, and Club can use the <strong>Playoff Wizard</strong>. Bracket view helps admins inspect playoff paths after games are created.</p>
          <p>The public schedule updates as games are added or edited. There is no separate schedule publish step.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-generate-round-robin',
          question: 'How do I generate a round-robin schedule?',
          answerText: 'Open Schedule, select Round Robin, then use Auto-Generate with divisions, accepted teams, venues, and time slots ready.',
          keywords: ['auto-generate', 'round robin', 'schedule generator'],
          popular: true,
          answer: (
            <p>Open <strong>Schedule</strong>, stay in <strong>Round Robin</strong> mode, and click <strong>Auto-Generate</strong>. Confirm your divisions, accepted teams, venues, and available time slots before saving generated games.</p>
          ),
        },
        {
          id: 'faq-playoff-wizard',
          question: 'When should I use the Playoff Wizard?',
          answerText: 'Use the Playoff Wizard after round-robin standings or seeds are ready and you need bracket rounds.',
          keywords: ['playoffs', 'wizard', 'bracket', 'seeds'],
          answer: (
            <p>Use it when pool play or round-robin games are ready to feed playoff rounds. The wizard helps create bracket games with placeholders such as winners or seeded teams.</p>
          ),
        },
        {
          id: 'faq-edit-generated-schedule',
          question: 'Can I edit a generated schedule?',
          answerText: 'Generated games can be edited, cancelled, restored, or deleted like manually created games.',
          keywords: ['edit schedule', 'generated games', 'cancel game'],
          answer: (
            <p>Yes. Generated games are normal schedule records after they are saved. You can edit time, location, teams, notes, status, or remove a game if needed.</p>
          ),
        },
      ],
    },
    {
      id: 'scores-and-results',
      group: 'Scores and Results',
      heading: 'Scores, scorekeeper submissions, and public results',
      summary: 'Understand score entry, pending review, final results, and score corrections.',
      keywords: ['scores', 'results', 'scorekeepers', 'scorekeeper', 'pending review', 'finalize'],
      searchText: 'results scoring scorekeepers score submission pending review completed finalization final public results revert score edit score',
      links: [
        { label: 'Results & Scoring', href: '../tournaments/results' },
      ],
      content: (
        <>
          <p>Admins can enter or edit scores from <strong>Results & Scoring</strong>. Scorekeepers use their separate scoring interface from the field.</p>
          <p>If score finalization is enabled, scorekeeper submissions appear as <strong>Pending Review</strong> until an admin finalizes them. Completed scores are treated as final results.</p>
          <p>Public result pages update from the game data in FieldLogicHQ. If a score is wrong, edit it from Results & Scoring or revert it to scheduled and enter the corrected result.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-scorekeeper-score-submit',
          question: 'How do scorekeepers submit scores?',
          answerText: 'Scorekeepers use the scorekeeper app and submit assigned game scores from the field.',
          keywords: ['scorekeepers', 'scorekeeper', 'submit score'],
          popular: true,
          answer: (
            <p>Scorekeepers use the scorekeeper app for your organization. They see the games available to them and submit scores from that focused interface.</p>
          ),
        },
        {
          id: 'faq-pending-review',
          question: 'What does Pending Review mean?',
          answerText: 'Pending Review means a scorekeeper submitted a score and an admin still needs to finalize it when score finalization is enabled.',
          keywords: ['pending review', 'finalize', 'score finalization'],
          popular: true,
          answer: (
            <p>It means a score was submitted but is waiting for admin confirmation. Use <strong>Finalize</strong> to mark it complete.</p>
          ),
        },
        {
          id: 'faq-results-public',
          question: 'Are results public immediately?',
          answerText: 'Results use the same game data as the public site. Pending review may be visible but not final depending on org settings.',
          keywords: ['public results', 'live results', 'visible'],
          answer: (
            <p>Results pages read from the tournament game data. If finalization is enabled, pending review scores may be visible as submitted but are not final until an admin completes them.</p>
          ),
        },
        {
          id: 'faq-undo-score',
          question: 'Can I undo a score?',
          answerText: 'Admins can revert a scored game to scheduled, which clears the score and lets them enter it again.',
          keywords: ['undo score', 'revert score', 'clear score'],
          answer: (
            <p>Yes. Revert the game to scheduled from Results & Scoring, then enter the corrected score. Reverting clears the existing score, so confirm before doing it.</p>
          ),
        },
      ],
    },
    {
      id: 'public-communication',
      group: 'Communication and Public Site',
      heading: 'Communication and public tournament pages',
      summary: 'Preview what teams see and send tournament updates from the admin.',
      keywords: ['communication', 'public site', 'preview', 'announcements', 'email'],
      searchText: 'communication audiences send email announcements public tournament page preview site schedule standings teams rules news registration',
      links: [
        { label: 'Communication', href: '../tournaments/communication' },
        { label: 'Preview Site', href: '../tournaments/dashboard' },
      ],
      content: (
        <>
          <p>Use <strong>Preview Site</strong> from the tournament sidebar footer to inspect the public tournament experience before or after activation.</p>
          <p>The public tournament site can include registration, schedule, standings, results, teams, rules, resources, and news depending on tournament setup and status.</p>
          <p>Use <strong>Communication</strong> for tournament messages. Free Tournament supports basic all-team email. Tournament Plus can target by division, registration status, payment status, selected teams, and contact role.</p>
          <p>Review recipients and message content carefully before sending. Targeted sends should be operational and useful for teams, not broad marketing blasts.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-targeted-communication',
          question: 'Who can use targeted tournament communication?',
          answerText: 'Tournament Plus, League, and Club can target messages by team status, payment status, division, selected teams, and contact role.',
          keywords: ['targeted communication', 'email selected', 'division email', 'payment status'],
          answer: (
            <p>Targeted communication is included with Tournament Plus and higher. Free Tournament can still send basic all-team email, but targeted filters are locked so an unauthorized filter never falls back to sending everyone.</p>
          ),
        },
      ],
    },
    {
      id: 'settings-and-access',
      group: 'Admin and Settings',
      heading: 'Settings, branding, scoring, and access',
      summary: 'Review tournament-specific controls that affect public appearance, scoring rules, billing visibility, and who can help administer the event.',
      keywords: ['settings', 'branding', 'scoring', 'subscription', 'members', 'access', 'scorekeepers'],
      searchText: 'settings access members branding logo hero banner scoring finalization subscription plan tournament settings scorekeeper score finalization role members permissions public appearance',
      links: [
        { label: 'Settings', href: '../tournaments/settings' },
        { label: 'Branding', href: '../tournaments/branding' },
        { label: 'Scoring', href: '../tournaments/settings/scoring' },
        { label: 'Members', href: '../tournaments/settings/members' },
      ],
      content: (
        <>
          <p>Use <strong>Settings & Access</strong> for tournament-specific administration after the core setup is in place.</p>
          <p><strong>Branding</strong> controls the tournament public appearance. Free tournaments use the default FieldLogicHQ look; Tournament Plus and higher can make a tournament look distinct with custom logo, colour, and appearance controls.</p>
          <p><strong>Event Settings</strong> controls dates, fees, score finalization, and the Plus-only post-event results notification. When enabled, accepted team contacts receive the public results links once when the tournament is marked completed.</p>
          <p><strong>Members</strong> helps you review who can administer tournament work. Keep access limited to people who need to manage setup, registrations, schedule, results, or communications.</p>
          <p><strong>Subscription</strong> stays inside tournament admin for Tournament and Tournament Plus users, so upgrade prompts do not send tournament-only organizers into organization admin billing pages.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-score-finalization-setting',
          question: 'Where do I control whether scores need admin review?',
          answerText: 'Use tournament scoring settings to control score finalization behavior.',
          keywords: ['score finalization', 'pending review', 'scorekeepers', 'scoring settings'],
          answer: (
            <p>Open <strong>Settings & Access</strong>, then <strong>Event Settings</strong>. Choose whether this tournament inherits the organization setting, sends scorekeeper submissions to Pending Review, or finalizes scorekeeper submissions immediately.</p>
          ),
        },
        {
          id: 'faq-tournament-branding',
          question: 'Can one tournament have different branding from the organization site?',
          answerText: 'Use tournament branding settings for tournament-specific public appearance.',
          keywords: ['branding', 'logo', 'hero', 'public site'],
          answer: (
            <p>Yes. Use <strong>Branding</strong> under tournament settings when a tournament needs its own public identity separate from the default organization look.</p>
          ),
        },
        {
          id: 'faq-post-event-results-email',
          question: 'How do teams get final results after the tournament?',
          answerText: 'Tournament Plus can send accepted team contacts one post-event email with public standings, schedule, and teams links when the tournament is marked completed.',
          keywords: ['post-event email', 'results notification', 'completed tournament', 'Tournament Plus'],
          answer: (
            <p>Open <strong>Event Settings</strong> and enable the post-event results notification. The email sends once when the tournament changes to Completed, and FieldLogicHQ records that it was sent so it is not resent by accident.</p>
          ),
        },
      ],
    },
    {
      id: 'archive-and-seal',
      group: 'Closeout and Plan Limits',
      heading: 'Complete, archive, and seal tournaments',
      summary: 'Close the event, free tournament slots, and create permanent records.',
      keywords: ['completed', 'archived', 'sealed', 'seal', 'plan limit', 'slot'],
      searchText: 'draft active completed archived sealed lifecycle tournament slot plan limit archive frees slot seal permanent immutable digital archive snapshot closeout',
      links: [
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
        { label: 'Past Tournaments', href: '../tournaments/archives' },
      ],
      content: (
        <>
          <p>Every tournament has a lifecycle:</p>
          <ul>
            <li><strong>Draft</strong> - setup mode, visible to admins.</li>
            <li><strong>Active</strong> - public and accepting registrations or live operations.</li>
            <li><strong>Completed</strong> - event is over but still counts as a tournament slot.</li>
            <li><strong>Archived</strong> - retired from active views and no longer counts against the active tournament slot limit.</li>
            <li><strong>Sealed</strong> - a permanent snapshot of final results has been created.</li>
          </ul>
          <p>Archive when you want to retire an event and free the slot. Seal only after scores and results are final. Sealing is permanent and cannot be undone.</p>
          <p>For completed or archived tournaments, Tournament Plus adds a <strong>Summary</strong> page with registration totals, payment readiness, schedule progress, division recaps, public results links, print/share actions, and a prompt to start next year from the same setup.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-completed-archived-sealed',
          question: 'What is the difference between completed, archived, and sealed?',
          answerText: 'Completed means over but still active for slot purposes. Archived retires it and frees a slot. Sealed creates a permanent immutable snapshot.',
          keywords: ['completed', 'archived', 'sealed', 'lifecycle'],
          popular: true,
          answer: (
            <p><strong>Completed</strong> means the event is over. <strong>Archived</strong> retires it from active views and frees a tournament slot. <strong>Sealed</strong> creates a permanent final-results snapshot that cannot be changed.</p>
          ),
        },
        {
          id: 'faq-completed-counts-limit',
          question: 'Does a completed tournament still count against my plan limit?',
          answerText: 'Completed tournaments still count against the tournament slot limit until archived.',
          keywords: ['plan limit', 'slot', 'completed', 'archive'],
          popular: true,
          answer: (
            <p>Yes. A completed tournament still occupies a tournament slot. Archive it when you are ready to retire it and free that slot.</p>
          ),
        },
        {
          id: 'faq-free-slot',
          question: 'How do I free up a tournament slot?',
          answerText: 'Archive a completed or old tournament to free a tournament slot.',
          keywords: ['free slot', 'plan limit', 'archive tournament'],
          answer: (
            <p>Change an old tournament to <strong>Archived</strong>. Archived tournaments preserve historical data but no longer count against the active tournament slot limit.</p>
          ),
        },
        {
          id: 'faq-when-seal',
          question: 'When should I seal a tournament?',
          answerText: 'Seal only when all scores are verified and final because sealing is permanent.',
          keywords: ['seal', 'permanent', 'final results', 'archive'],
          answer: (
            <p>Seal only after all scores, standings, and final results have been reviewed. Sealing creates an immutable record and cannot be reversed.</p>
          ),
        },
        {
          id: 'faq-post-event-summary',
          question: 'What is the post-event summary for?',
          answerText: 'Tournament Plus gives completed or archived tournaments a printable recap and repeat-event planning surface.',
          keywords: ['summary', 'recap', 'post-event', 'clone next year', 'renewal'],
          answer: (
            <p>The Summary page helps organizers share the public results record, print a recap, review registration and payment readiness, and start a future draft from the completed tournament setup.</p>
          ),
        },
      ],
    },

    // ── Exports cross-link ──────────────────────────────────────────────────
    {
      id: 'exports',
      heading: 'Exporting data',
      summary: 'Export registrations, schedules, and results to Excel, CSV, iCal, and PDF.',
      keywords: ['export', 'xlsx', 'csv', 'ical', 'pdf', 'spreadsheet', 'download', 'check-in', 'insurance'],
      searchText:
        'export xlsx csv excel spreadsheet ical calendar pdf report check-in insurance registrations schedule results download',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>
            Registration lists, schedules, and results can all be exported directly from their
            admin pages. Click the <strong>Export</strong> button in the top right of any table to
            download in Excel (.xlsx), CSV, Calendar (.ics), or PDF formats.
          </p>
          <ul>
            <li><strong>Registrations</strong> — Excel and CSV of the full team list; PDF check-in or insurance sheet (Tournament Plus)</li>
            <li><strong>Schedule</strong> — Excel, CSV, or iCal to add games to Google Calendar, Apple Calendar, or Outlook; PDF field ops sheet (Tournament Plus)</li>
            <li><strong>Results</strong> — Excel or CSV; PDF post-event board report (Tournament Plus)</li>
          </ul>
          <p>
            See the <a href="../help/exports">Exports &amp; Downloads guide</a> for format details,
            plan requirements, calendar import instructions, and privacy defaults.
          </p>
        </>
      ),
    },
  ],
};

export default tournamentsHelp;
