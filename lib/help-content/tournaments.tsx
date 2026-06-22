import type { HelpPageContent } from './index';

const tournamentsHelp: HelpPageContent = {
  title: 'Tournaments',
  role: 'Admin, Owner',
  searchPlaceholder: 'Search tournament help...',
  intro: 'Use this guide to set up, publish, operate, and close out tournaments in FieldLogicHQ. It follows the same workflow you use in the tournament admin menu.',
  sections: [
    // ── SET UP YOUR EVENT ──────────────────────────────────────────────────

    {
      id: 'getting-started',
      group: 'Set Up Your Event',
      subgroup: 'Create the tournament',
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
          answerText: 'Use Manage Tournaments or the dashboard activation button. A tournament must have dates, divisions, a public contact, and at least one open division before activation.',
          keywords: ['publish', 'activate', 'go live', 'registration open'],
          popular: true,
          answer: (
            <p>Open <strong>Manage Tournaments</strong>, change the tournament status to <strong>Active</strong>, and confirm the activation prompt. Activation is blocked until required launch items are complete: dates, at least one division, a public contact (a selected contact member or a contact email), and at least one division open for registration.</p>
          ),
        },
        {
          id: 'faq-activation-blocked',
          question: 'Why can I not activate my tournament?',
          answerText: 'Activation is blocked when dates, divisions, or a public contact are missing.',
          keywords: ['blocked', 'not ready', 'launch checklist', 'draft only'],
          popular: true,
          answer: (
            <p>The launch checklist is missing a required item. Check the tournament dashboard for the exact blocker, then add tournament dates, create a division, or choose a public contact. Opening a division for public registration is optional — skip it if you are loading or inviting teams yourself.</p>
          ),
        },
      ],
    },

    {
      id: 'recipe-open-tournament-registration',
      group: 'Set Up Your Event',
      subgroup: 'Create the tournament',
      heading: 'Create, edit, and launch a tournament',
      summary: 'Names, dates, public URLs, draft mode, and the launch checklist — plus how to open team registration.',
      keywords: ['new tournament', 'edit tournament', 'slug', 'dates', 'launch checklist', 'open registration', 'activate tournament', 'public form', 'division open'],
      searchText: 'new tournament name year slug URL public link dates draft active status activation checklist tournament slot limit open team registration activate public registration form accepted teams capacity fees contact',
      links: [
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
        { label: 'Dashboard Checklist', href: '../tournaments/dashboard' },
        { label: 'Divisions', href: '../tournaments/divisions' },
      ],
      content: (
        <>
          <p>Click <strong>New Tournament</strong> from Manage Tournaments. The setup wizard saves the tournament as a draft so you can finish the details before anything appears publicly.</p>
          <p>For repeat events, Tournament Plus can start the draft from a previous tournament so divisions, locations, registration setup, public settings, and content are ready for review.</p>
          <p>The <strong>URL slug</strong> is used in every public tournament link. Choose it carefully. Changing it later can break links already shared by email, social media, or team communications.</p>
          <p>The dashboard launch checklist shows what is still required before activation. When every required item is complete, use Manage Tournaments to change the status from <strong>Draft</strong> to <strong>Active</strong>.</p>
          <p>To open team registration:</p>
          <ol>
            <li>Finish the launch checklist: dates, public contact, divisions, and required public information.</li>
            <li>Open <strong>Divisions</strong> and confirm at least one division is accepting registrations.</li>
            <li>Review capacities, fees, and custom registration questions before sharing the link.</li>
            <li>Use <strong>Manage Tournaments</strong> to move the tournament from <strong>Draft</strong> to <strong>Active</strong>.</li>
            <li>Open the public registration page and submit a quick internal test if your workflow allows it.</li>
            <li>Share the public registration link with teams only after the form shows the right divisions and fees.</li>
          </ol>
          <p>If registration is not visible, check the tournament status and division registration settings first.</p>
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
      id: 'repeat-event-setup',
      group: 'Set Up Your Event',
      subgroup: 'Create the tournament',
      heading: 'Reuse setup for repeat tournaments',
      summary: 'Start the next event from prior setup without bringing teams, scores, or payments along.',
      keywords: ['reuse setup', 'repeat tournament', 'next year', 'previous tournament', 'Tournament Plus', 'clone'],
      searchText: 'reuse setup previous tournament repeat event next year copy clone Tournament Plus draft divisions pools slots venues locations registration questions fees branding public pages rules resources welcome never copied teams registrations waitlists games scores standings champions payments uploaded files private notes',
      links: [
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
        { label: 'Dashboard', href: '../tournaments/dashboard' },
        { label: 'Subscription', href: '../tournaments/settings/subscription' },
      ],
      content: (
        <>
          <p>Tournament Plus helps returning organizers turn a repeat event into review-and-adjust work instead of rebuilding from empty. Start from Manage Tournaments, the new tournament wizard, a draft dashboard prompt, or the completed tournament Summary page.</p>
          <p>The reused tournament is always created as a draft. Review dates, fees, registration questions, public page visibility, rules, and welcome content before activation.</p>
          <p>Default setup areas can include:</p>
          <ul>
            <li><strong>Event structure</strong> — divisions, pools, and empty schedule slots.</li>
            <li><strong>Locations</strong> — venues and playing surfaces.</li>
            <li><strong>Registration setup</strong> — custom questions and fee setup.</li>
            <li><strong>Public presence</strong> — branding and public page visibility.</li>
            <li><strong>Content</strong> — rules, resources, and welcome content.</li>
          </ul>
          <p><strong>Never copied:</strong> teams, registrations, waitlists, games, scores, standings, champions, payment status, reminders, uploaded files, message history, archived summaries, or private admin notes.</p>
          <p>Free Tournament users may see the repeat-event value prompt, but creating a reused setup draft is available on Tournament Plus, League Plus, and Club.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-reuse-previous-tournament-setup',
          question: 'Can I reuse a previous tournament setup?',
          answerText: 'Tournament Plus can create a new draft from a previous tournament while leaving teams, results, payments, files, and history behind.',
          keywords: ['reuse setup', 'previous tournament', 'next year', 'clone', 'Tournament Plus'],
          popular: true,
          answer: (
            <p>Yes. Use <strong>Reuse setup</strong> from Manage Tournaments, the new tournament wizard, a draft dashboard prompt, or a completed tournament Summary page. Choose the setup areas to copy, then review the new draft before activation.</p>
          ),
        },
        {
          id: 'faq-repeat-event-never-copies',
          question: 'What is never copied into the new draft?',
          answerText: 'Teams, registrations, waitlists, games, scores, standings, champions, payments, files, message history, summaries, and private notes are not copied.',
          keywords: ['never copied', 'teams', 'scores', 'payments', 'registrations', 'files'],
          answer: (
            <p>Operational history stays behind. The new draft does not copy teams, registrations, waitlists, games, scores, standings, champions, payments, uploaded files, message history, archived summaries, or private admin notes.</p>
          ),
        },
        {
          id: 'faq-review-reused-setup',
          question: 'What should I review after reusing setup?',
          answerText: 'Review dates, divisions, venues, registration questions, fees, public pages, rules, resources, and welcome copy before activating.',
          keywords: ['review copied setup', 'activation', 'draft', 'warnings'],
          answer: (
            <p>Check the new draft before publishing: event dates, division capacities, venues, registration questions, fee amounts, public page visibility, rules, resources, and welcome/news copy. The workflow may also show review warnings when the source is old, still draft, or still active.</p>
          ),
        },
      ],
    },

    {
      id: 'divisions-and-pools',
      group: 'Set Up Your Event',
      subgroup: 'Define the structure',
      heading: 'Divisions, capacities, pools, and fees',
      summary: 'Control who can register and how teams are organized.',
      keywords: ['division', 'capacity', 'pool', 'fees', 'payment', 'payment instructions', 'how to pay'],
      searchText: 'divisions capacity waitlist pools user selects pool fee schedule deposit total fee registration open closed per division tournament level payment instructions how to pay e-transfer acceptance email coaches portal registration form manual payment',
      links: [
        { label: 'Divisions', href: '../tournaments/divisions' },
        { label: 'Event Settings', href: '../tournaments/settings/event' },
      ],
      content: (
        <>
          <p>Divisions are the registration and competition groups inside a tournament. They can represent age groups, skill levels, adult brackets, or custom groupings.</p>
          <p>Use <strong>capacity</strong> to set the number of teams a division can accept. If a division reaches capacity, admins can use waitlist status to hold additional teams.</p>
          <p>Use <strong>pools</strong> when a division needs smaller groups for round-robin play. If teams should choose a pool during registration, enable user-selectable pool registration for that division.</p>
          <p>Fee schedules can be set at the tournament level or per division from <strong>Event Settings</strong>. Payment status then appears beside accepted teams in the registrations view.</p>
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
            <p>Yes. Open <strong>Event Settings</strong> and set the fee schedule mode to <strong>By Division</strong>, then edit each division to configure its own deposit, total fee, and due dates.</p>
          ),
        },
        {
          id: 'faq-payment-instructions',
          question: 'Where do my payment instructions show up?',
          answerText: 'Payment instructions you enter with the fee schedule in Event Settings are always included in the team\'s acceptance email and shown to accepted coaches in their Coaches Portal. The "Where these appear" toggle controls the public registration form only — choose "Form & email" to also show them before teams register. Payment is recorded manually; there is no online payment.',
          keywords: ['payment instructions', 'how to pay', 'e-transfer', 'acceptance email', 'coaches portal', 'registration form'],
          answer: (
            <p>Payment instructions you enter with the fee schedule in <strong>Event Settings</strong> are always included in the team&apos;s acceptance email and shown to accepted coaches in their <strong>Coaches Portal</strong>. The <strong>Where these appear</strong> toggle controls the public registration form only — choose <strong>Form &amp; email</strong> to also show them to teams before they register. Payment is recorded manually; there is no online payment through FieldLogicHQ.</p>
          ),
        },
      ],
    },

    {
      id: 'venues-contacts-rules',
      group: 'Set Up Your Event',
      subgroup: 'Define the structure',
      heading: 'Venues, contacts, communication, and rules',
      summary: 'Prepare the public information teams need before registration opens.',
      keywords: ['venues', 'fields', 'contacts', 'public contact', 'communication', 'news posts', 'rules', 'resources'],
      searchText: 'venues fields custom location contacts public contact email notifications communication news posts welcome message rules resources documents public site',
      links: [
        { label: 'Venues', href: '../tournaments/venues' },
        { label: 'Communication', href: '../tournaments/communication' },
        { label: 'Rules & Resources', href: '../tournaments/rules' },
      ],
      content: (
        <>
          <p>Add venues before building the schedule so games can use consistent field names. You can still type a custom location on an individual game if needed.</p>
          <p>The public contact is the name and email teams see for tournament questions. Choose a contact from your organization members on the <strong>Contacts</strong> page inside tournament admin. If no tournament-specific contact is set, FieldLogicHQ may fall back to the organization contact where available.</p>
          <p>Use <strong>Communication</strong> to publish news posts and send email updates to teams. Rules and resources are for durable documents and tournament policies.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-public-contact',
          question: 'Which email address do teams see for tournament questions?',
          answerText: 'Teams see the tournament public contact email when set, otherwise the organization contact may be used.',
          keywords: ['contact', 'email', 'questions', 'public'],
          answer: (
            <p>Teams see the tournament public contact when one is selected on the Contacts page. If none is selected, FieldLogicHQ may use the organization contact as the fallback where the product shows one.</p>
          ),
        },
        {
          id: 'faq-rules-resources',
          question: 'How do I show rules or resources to teams?',
          answerText: 'Add rules and documents from Rules & Resources so they appear on the public tournament site. On the public Rules page, uploaded documents open in a new tab (so a PDF views in the browser instead of downloading), and long rule sets get jump-links so fans can skip to a section.',
          keywords: ['rules', 'resources', 'documents', 'public site', 'pdf', 'jump links'],
          answer: (
            <>
              <p>Open <strong>Rules & Resources</strong> and add the text, links, or documents teams need. These become part of the tournament public experience.</p>
              <p>On the public <strong>Rules</strong> page, uploaded documents open in a new tab — a PDF views right in the browser instead of forcing a download — and when you have several rule sections, fans get quick jump-links to skip straight to the one they need.</p>
            </>
          ),
        },
      ],
    },

    {
      id: 'settings-and-access',
      group: 'Set Up Your Event',
      subgroup: 'Define the structure',
      heading: 'Branding, scoring, and event settings',
      summary: 'Review tournament-specific controls that affect public appearance, scoring rules, billing visibility, and who can help administer the event.',
      keywords: ['settings', 'branding', 'scoring', 'subscription', 'members', 'access', 'scorekeepers', 'tie-breaker', 'game timing'],
      searchText: 'settings access members branding logo hero banner scoring finalization subscription plan tournament settings scorekeeper score finalization role members permissions public appearance tie-breaker tiebreaker ranking standings head to head run differential coin toss game timing game length duration buffer turnaround',
      links: [
        { label: 'Event Settings', href: '../tournaments/settings/event' },
        { label: 'Branding', href: '../tournaments/branding' },
        { label: 'Members', href: '../tournaments/settings/members' },
      ],
      content: (
        <>
          <p>Use <strong>Event Settings</strong> and <strong>Branding</strong> for tournament-specific administration after the core setup is in place.</p>
          <p><strong>Branding</strong> controls the tournament public appearance. Free tournaments use the default FieldLogicHQ look; Tournament Plus and higher can make a tournament look distinct with custom logo, colour, and appearance controls.</p>
          <p><strong>Event Settings</strong> controls dates, fee scope, score finalization, tie-breaker rules, game timing, and the Plus-only post-event results notification. When enabled, accepted team contacts receive the public results links once when the tournament is marked completed.</p>
          <p><strong>Members</strong> helps you review who can administer tournament work. Keep access limited to people who need to manage setup, registrations, schedule, results, or communications.</p>
          <p><strong>Subscription</strong> stays inside tournament admin for Tournament and Tournament Plus users, so upgrade prompts do not send tournament-only organizers into organization admin billing pages.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-score-finalization-setting',
          question: 'Where do I control whether scores need admin review?',
          answerText: 'Use Event Settings to control score finalization behavior. If fan score alerts are on (Tournament Plus), the Final alert is sent when a score becomes final — for tournaments that send submissions to Pending Review, that is when an admin finalizes it.',
          keywords: ['score finalization', 'pending review', 'scorekeepers', 'scoring settings', 'final alert'],
          answer: (
            <>
              <p>Open <strong>Event Settings</strong> and find the Scoring section. Choose whether this tournament inherits the organization setting, sends scorekeeper submissions to Pending Review, or finalizes scorekeeper submissions immediately. Admin score entry from Results &amp; Scoring remains an admin action and can always finalize or correct scores.</p>
              <p>If you&rsquo;ve turned on fan score alerts (Tournament Plus), the &ldquo;Final&rdquo; alert is sent when a score becomes final. For tournaments that send submissions to Pending Review, that&rsquo;s the moment an admin finalizes the score.</p>
            </>
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
        {
          id: 'faq-tie-breaker-rules',
          question: 'How do tie-breaker rules work?',
          answerText: 'When teams finish with the same record, tie-breaker rules decide their standings ranking. The default order is head-to-head, then run differential, then runs scored, then runs allowed. You can customize the order before playoffs.',
          keywords: ['tie-breaker', 'tiebreaker', 'ranking', 'standings', 'h2h', 'head to head', 'run differential', 'coin toss'],
          popular: true,
          answer: (
            <p>When two or more teams finish pool play with the same record, <strong>tie-breaker rules</strong> decide who ranks higher in the standings. The default order is head-to-head result, then run differential, then runs scored, then runs allowed. Open <strong>Event Settings</strong> to change the order, set a per-game run-differential cap, or add a coin-toss step before playoffs.</p>
          ),
        },
        {
          id: 'faq-game-timing',
          question: 'What is game timing and what is the default?',
          answerText: 'Game timing sets the default game length and the buffer between games, used when the schedule is built. The default is 90-minute games with a 15-minute turnaround, applied tournament-wide.',
          keywords: ['game timing', 'game length', 'duration', 'buffer', 'turnaround', 'schedule timing'],
          answer: (
            <p><strong>Game timing</strong> sets the default game length and the buffer between games — FieldLogicHQ uses these when it builds the schedule. The default is 90-minute games with a 15-minute turnaround, applied tournament-wide. Open <strong>Event Settings</strong> to change it before building the schedule; individual games can still be adjusted afterward.</p>
          ),
        },
      ],
    },

    // ── TEAMS & REGISTRATION ───────────────────────────────────────────────

    {
      id: 'registrations-and-teams',
      group: 'Teams & Registration',
      heading: 'Open and close registration',
      summary: 'Control when teams can sign up, and understand how the public registration form works.',
      keywords: ['registrations', 'open registration', 'close registration', 'public form', 'teams register'],
      searchText: 'open close registration teams public form active draft division open closed capacity registration questions custom questions Tournament Plus',
      links: [
        { label: 'Divisions', href: '../tournaments/divisions' },
        { label: 'Registrations', href: '../tournaments/registrations' },
        { label: 'Registration Questions', href: '../tournaments/settings/registration-fields' },
      ],
      content: (
        <>
          <p>Teams register through the public tournament registration form once the tournament is active and at least one division is open.</p>
          <p>To close registration for a division, mark it closed from the Divisions page. The tournament can remain active with other divisions still open, or you can leave all divisions closed once the team list is final.</p>
          <p>The free Tournament plan supports standard registration fields, payment tracking, and waitlist collection. Tournament Plus adds custom registration questions, file collection, Excel/PDF exports, payment reminders, and waitlist promotion workflows.</p>
          <p>Use <strong>Registration Questions</strong> (under Settings &amp; Access) when you need tournament-specific coach confirmations, dropdown answers, or uploaded documents. Submitted answers appear in admin registration details and registration exports.</p>
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
          id: 'faq-custom-registration-questions',
          question: 'How do custom registration questions work?',
          answerText: 'Tournament Plus lets admins add tournament-specific questions and file uploads to the public team registration form.',
          keywords: ['custom questions', 'registration fields', 'file upload', 'Tournament Plus'],
          answer: (
            <p>Open <strong>Settings &amp; Access</strong>, then <strong>Registration Questions</strong>. Tournament Plus questions appear on the public registration form and submitted answers appear in registration details and exports.</p>
          ),
        },
      ],
    },

    {
      id: 'recipe-review-tournament-teams',
      group: 'Teams & Registration',
      heading: 'Review and accept teams',
      summary: 'Approve, waitlist, reject, and track payment readiness for teams.',
      keywords: ['review teams', 'approve registration', 'waitlist team', 'payment status', 'accepted teams'],
      searchText: 'review team registrations approve accept waitlist reject pending payment deposit paid paid in full schedule eligibility selected teams bulk actions',
      links: [
        { label: 'Registrations', href: '../tournaments/registrations' },
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
      faqs: [
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
          id: 'faq-bulk-registration-actions',
          question: 'How do bulk registration actions work?',
          answerText: 'Select the registrations you want to update, then choose the bulk action. Only selected registrations are changed.',
          keywords: ['bulk actions', 'selected teams', 'approve', 'reject', 'waitlist'],
          answer: (
            <p>Select specific rows on the Registrations page, then choose a bulk action such as accept, reject, waitlist, mark deposit paid, or mark paid. Only the selected rows are affected.</p>
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

    // ── SCHEDULE & PLAYOFFS ────────────────────────────────────────────────

    {
      id: 'recipe-build-tournament-schedule',
      group: 'Schedule & Playoffs',
      subgroup: 'Build the schedule',
      heading: 'Build and adjust the tournament schedule',
      summary: 'Create games manually or generate round-robin schedules, then edit exceptions before game day.',
      keywords: ['build schedule', 'generate schedule', 'round robin', 'edit games', 'venues', 'auto-generate'],
      searchText: 'build tournament schedule generate round robin auto-generate accepted teams venues time slots edit games cancel restore public schedule pools flat list timeline',
      links: [
        { label: 'Schedule', href: '../tournaments/schedule' },
      ],
      content: (
        <>
          <p>Build the schedule after accepted teams, venues, and time slots are ready.</p>
          <ol>
            <li>Open <strong>Schedule</strong>.</li>
            <li>Add games manually with <strong>Add Game</strong> for small events or special matchups.</li>
            <li>Use <strong>Auto-Generate</strong> for round-robin play (Tournament Plus, League Plus, Club). Accepted teams, division data, venues, and time-slot setup must be complete before generating.</li>
            <li>Preview generated games before saving.</li>
            <li>Edit individual games for field changes, rest gaps, weather adjustments, or custom matchups. Generated games are normal schedule records after they are saved.</li>
            <li>Use the public preview to confirm the schedule is readable for teams.</li>
          </ol>
          <p>There is no separate schedule publish step — saved schedule changes flow to the public tournament pages. Use <strong>pool view</strong> when a division is split into pools. Use <strong>flat view</strong> when you want one combined list.</p>
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
            <p>Open <strong>Schedule</strong>, stay in <strong>Round Robin</strong> mode, and click <strong>Auto-Generate</strong>. Confirm your divisions, accepted teams, venues, and available time slots before saving generated games. Auto-Generate requires Tournament Plus, League Plus, or Club.</p>
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
      id: 'schedule-playoffs',
      group: 'Schedule & Playoffs',
      subgroup: 'Playoffs',
      heading: 'Build a playoff bracket',
      summary: 'Manual bracket building for all plans — inline bracket editor, tiers (Gold/Silver), and the Playoff Wizard.',
      keywords: ['schedule', 'playoffs', 'bracket', 'seeds', 'manual bracket', 'bracket builder', 'tiers', 'split into tiers', 'gold silver bracket'],
      searchText: 'playoff bracket manual build add game bracket view playoff wizard auto generate seeds single elimination consolation double elimination placement crossover reseed tiers split into tiers gold silver tier bracket separate brackets overall standings tiered bracket',
      links: [
        { label: 'Schedule', href: '../tournaments/schedule' },
      ],
      content: (
        <>
          <p>Switch to the <strong>Playoffs</strong> stage on the Schedule page to manage bracket games. Free Tournament orgs can add playoff games manually using the inline <strong>bracket editor</strong>; Tournament Plus, League Plus, and Club can also use the <strong>Playoff Wizard</strong> for format-based auto-generation.</p>
          <p>The inline bracket editor is a canvas where you add rounds, set up matchups, and wire Seed/Winner/Loser placeholders. Once pool play is complete and standings are known, the placeholders resolve to the real teams.</p>
          <p><strong>Bracket view</strong> on the Schedule page lets admins inspect playoff paths and advancement after games are created. It is a read-oriented visualization alongside the editable list and timeline.</p>
          <p><strong>Split a division into tiers.</strong> A large division can be split into two or more tiers — for example a <strong>Gold</strong> bracket for the top seeds and a <strong>Silver</strong> bracket for the rest — so every team keeps playing meaningful games. In the inline bracket editor, click <strong>Split into tiers</strong>, set how many teams go in each tier, and FieldLogicHQ seeds each tier from the division&apos;s overall standings. Building tiers by hand is free on every plan; Tournament Plus, League Plus, and Club can also produce tiers in one click from the Playoff Wizard. Each tier is its own bracket and shows as a separate, titled section in the editor, on the public schedule, in the admin bracket view, and on the printable bracket PDF. Editing a tiered bracket — adding a venue or time, for instance — keeps every tier intact.</p>
          <p>To build a bracket:</p>
          <ol>
            <li>Confirm pool-play or round-robin games are complete and standings reflect final team records.</li>
            <li>Open <strong>Schedule</strong> and switch to the <strong>Playoffs</strong> stage.</li>
            <li>For manual building, click <strong>Build Bracket</strong> to enter the inline editor and add rounds and matchups.</li>
            <li>For automated format generation (Tournament Plus), open the <strong>Playoff Wizard</strong> and configure bracket format, number of teams qualifying, seeds, and scheduling.</li>
            <li>Review the bracket preview before saving.</li>
          </ol>
        </>
      ),
      faqs: [
        {
          id: 'faq-playoff-wizard',
          question: 'When should I use the Playoff Wizard?',
          answerText: 'Use the Playoff Wizard after round-robin standings or seeds are ready and you need bracket rounds generated automatically. Requires Tournament Plus.',
          keywords: ['playoffs', 'wizard', 'bracket', 'seeds', 'auto generate'],
          answer: (
            <p>Use it when pool play or round-robin games are ready to feed playoff rounds. The wizard helps create bracket games with format configuration (single, double, consolation), seeding from standings, scheduling slots, and crossover options. The Playoff Wizard requires Tournament Plus, League Plus, or Club.</p>
          ),
        },
        {
          id: 'faq-bracket-view',
          question: 'What is the bracket view for?',
          answerText: 'Bracket view shows the playoff tree and advancement paths for the selected division.',
          keywords: ['bracket view', 'playoff paths', 'advancement'],
          answer: (
            <p>Bracket view is a visual display of the playoff tree — rounds, matchups, and team advancement paths. Switch to it from the layout options on the Schedule page when you are in Playoffs stage.</p>
          ),
        },
        {
          id: 'faq-split-into-tiers',
          question: 'Can I split a division into tiers (like Gold and Silver)?',
          answerText: 'Yes. In the inline bracket editor click Split into tiers, then set how many teams go in each tier. FieldLogicHQ seeds each tier from the division’s overall standings and makes each tier its own bracket — shown as a separate, titled section in the editor, on the public schedule, in the admin bracket view, and on the PDF. Building tiers by hand is free on every plan; Tournament Plus can also generate tiers in one click from the Playoff Wizard. Editing a tiered bracket keeps the tiers intact.',
          keywords: ['tiers', 'split into tiers', 'gold', 'silver', 'tiered bracket', 'separate brackets', 'consolation'],
          popular: true,
          answer: (
            <>
              <p>Yes. A division can run as two or more tiers so every team keeps playing — for example a Gold bracket for the top seeds and a Silver bracket for the rest.</p>
              <ul>
                <li>In the inline bracket editor, click <strong>Split into tiers</strong> and set how many teams go in each tier. Tiers fill from the division&apos;s overall standings, top seeds first.</li>
                <li>Each tier becomes its own bracket and appears as a separate, titled section in the editor, on the public schedule, in the admin bracket view, and on the printable PDF.</li>
                <li>Editing a tiered bracket — such as adding a venue or time — keeps every tier intact.</li>
              </ul>
              <p>Building tiers by hand is free on every plan. Tournament Plus, League Plus, and Club can also generate tiers in one click from the Playoff Wizard.</p>
            </>
          ),
        },
      ],
    },

    // ── GAME DAY & SCORES ──────────────────────────────────────────────────

    {
      id: 'scores-and-results',
      group: 'Game Day & Scores',
      heading: 'Hand scoring to scorekeepers',
      summary: 'Set up scorekeepers and the Staff Kit so volunteers can enter scores from the field.',
      keywords: ['scorekeepers', 'scorekeeper', 'staff kit', 'volunteer', 'day of scoring', 'submit score', 'game day'],
      searchText: 'scorekeepers staff kit qr code volunteer check-in gate scorekeeper view day of game scoring submit score results scoring pending review finalization',
      links: [
        { label: 'Staff Kit', href: '../tournaments/staff-kit' },
        { label: 'Scorekeeper View', href: '../../scorekeeper' },
        { label: 'Check-in', href: '../tournaments/check-in' },
      ],
      content: (
        <>
          <p>You do not have to enter every score yourself. Scorekeepers use <strong>Scorekeeper View</strong> at <code>/{'{orgSlug}'}/scorekeeper</code> — a field-focused interface that only shows assigned games, no admin access required.</p>
          <p>Use the <strong>Staff Kit</strong> page to distribute scorekeeper and gate volunteer links. Staff Kit generates a QR code and copy-link for each volunteer surface (Scorekeeper View and Check-in/Gate), so you can print one sheet and post it at the volunteer table.</p>
          <p>Gate check-in is a separate surface at <code>/{'{orgSlug}'}/check-in</code>. Use it to run team arrivals at the gate without giving volunteers full admin access. Open the <strong>Gate view</strong> link from the Check-in admin page.</p>
          <p>Volunteers still authenticate when they arrive at each surface — Staff Kit links do not bypass login.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-scorekeeper-score-submit',
          question: 'How do scorekeepers submit scores?',
          answerText: 'Scorekeepers use Scorekeeper View at the organization scorekeeper route and submit assigned game scores from the field.',
          keywords: ['scorekeepers', 'scorekeeper', 'submit score'],
          popular: true,
          answer: (
            <p>Scorekeepers use <strong>Scorekeeper View</strong> at <code>/{'{orgSlug}'}/scorekeeper</code>. They see the games available to them, filter by date, field, division, team, or status, and submit scores from that focused interface.</p>
          ),
        },
        {
          id: 'faq-open-scorekeeper-view',
          question: 'How do admins open the scorekeeper workflow?',
          answerText: 'Admins can open Scorekeeper View from Results & Scoring or visit the organization scorekeeper route directly if they have scoring access.',
          keywords: ['open scorekeeper view', 'scorekeeper route', 'day of scoring'],
          answer: (
            <p>Use the <strong>Open Scorekeeper View</strong> action from Results &amp; Scoring, or visit <code>/{'{orgSlug}'}/scorekeeper</code> directly. Opening the lightweight view does not grant admin access to scorekeepers; route permissions still come from member role and capability checks.</p>
          ),
        },
      ],
    },

    {
      id: 'recipe-finalize-tournament-scores',
      group: 'Game Day & Scores',
      heading: 'Review and finalize scores',
      summary: 'Record results from admins or scorekeepers, confirm pending reviews, and correct mistakes.',
      keywords: ['enter scores', 'finalize scores', 'pending review', 'scorekeeper submissions', 'results', 'review scores'],
      searchText: 'enter scores finalize scores scorekeeper submissions pending review results scoring completed games public standings correct score revert scheduled score finalization',
      links: [
        { label: 'Results & Scoring', href: '../tournaments/results' },
        { label: 'Scorekeeper View', href: '../../scorekeeper' },
      ],
      content: (
        <>
          <p>Admins can enter, review, finalize, correct, export, or revert scores from <strong>Results &amp; Scoring</strong>.</p>
          <ol>
            <li>Open the game that has a final result.</li>
            <li>Enter home and away scores from Results &amp; Scoring, or open <strong>Scorekeeper View</strong> for the lightweight day-of workflow.</li>
            <li>Review submitted scores — Results &amp; Scoring shows who submitted the current visible score, when it happened, and whether it came from Scorekeeper View or admin.</li>
            <li>If score finalization is enabled in Event Settings, mark reviewed scorekeeper submissions as final using <strong>Finalize</strong>.</li>
            <li>Correct mistakes by editing the score or reverting the game to Scheduled and re-entering it. Revert clears the current score and submission metadata.</li>
            <li>Check standings or bracket paths after important score changes.</li>
          </ol>
          <p><strong>Pending Review</strong> means a score has been submitted but still needs admin confirmation before it is treated as final. If finalization is disabled, scorekeeper submissions become completed scores immediately.</p>
          <p>Public result pages update from the game data in FieldLogicHQ. Pending Review scores may appear as submitted results, but only completed scores are treated as final for playoff advancement.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-pending-review',
          question: 'What does Pending Review mean?',
          answerText: 'Pending Review means a scorekeeper submitted a score and an admin still needs to finalize it when score finalization is enabled.',
          keywords: ['pending review', 'finalize', 'score finalization'],
          popular: true,
          answer: (
            <p>It means a score was submitted but is waiting for admin confirmation. Use <strong>Finalize</strong> in Results &amp; Scoring to mark it complete.</p>
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
            <p>Yes. Revert the game to Scheduled from Results &amp; Scoring, then enter the corrected score. Reverting clears the existing score and current submission metadata, so confirm before doing it.</p>
          ),
        },
        {
          id: 'faq-scorekeeper-edit-final',
          question: 'Can scorekeepers edit submitted scores?',
          answerText: 'Scorekeepers can correct a Pending Review score before admin finalization, but they cannot edit finalized scores from Scorekeeper View.',
          keywords: ['edit score', 'correct score', 'finalized score', 'pending review'],
          answer: (
            <p>Scorekeepers can correct a Pending Review score before an admin finalizes it. Once a score is completed or finalized, corrections stay in <strong>Results &amp; Scoring</strong> as an admin action.</p>
          ),
        },
      ],
    },

    // ── COMMUNICATE & PUBLISH ─────────────────────────────────────────────

    {
      id: 'public-communication',
      group: 'Communicate & Publish',
      heading: 'Announcements and email',
      summary: 'Publish news to the public site, pin urgent day-of updates, and send email updates to registered teams.',
      keywords: ['communication', 'announcements', 'email', 'news posts', 'targeted email', 'pin', 'pinned', 'rain delay', 'schedule banner', 'email limit', 'recipient limit', 'free email cap'],
      searchText: 'communication audiences send email announcements news posts public tournament page teams division payment status selected teams contact role targeted communication all teams pin pinned post top of news rain delay urgent day-of update game day schedule banner live event free plan email limit 100 recipients per send 10 announcements per day daily email cap volume limit basic email cap too many emails send limit',
      links: [
        { label: 'Communication', href: '../tournaments/communication' },
      ],
      content: (
        <>
          <p>Use <strong>Communication</strong> for tournament messages. Free Tournament supports basic all-team email — up to 100 recipients per message and 10 email announcements per day. Tournament Plus removes those limits and can target by division, registration status, payment status, selected teams, and contact role.</p>
          <p><strong>Pinning a site post.</strong> When you post a message to the site and <strong>pin</strong> it, it stays at the top of the public <strong>News</strong> page — and, while the tournament is live (today falls within the event dates), it also appears as a <strong>banner at the top of the public Schedule</strong>. That puts urgent day-of updates — a rain delay, a diamond change, a start-time push — right where fans are already looking. Pin sparingly so the banner stays meaningful; unpin it once the situation clears.</p>
          <p>Review recipients and message content carefully before sending. Targeted sends should be operational and useful for teams, not broad marketing blasts.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-targeted-communication',
          question: 'Who can use targeted tournament communication?',
          answerText: 'Tournament Plus, League Plus, and Club can target messages by team status, payment status, division, selected teams, and contact role, and remove the free plan\'s basic-email limits (100 recipients per send, 10 sends per day).',
          keywords: ['targeted communication', 'email selected', 'division email', 'payment status'],
          answer: (
            <p>Targeted communication is included with Tournament Plus and higher. Free Tournament can still send basic all-team email, but targeted filters are locked so an unauthorized filter never falls back to sending everyone. Tournament Plus also removes the free plan&apos;s volume limits (see below).</p>
          ),
        },
        {
          id: 'faq-free-email-limits',
          question: 'Is there a limit on emails from the free Tournament plan?',
          answerText: 'Yes. The free Tournament plan can send a basic all-team announcement to up to 100 recipients per message and up to 10 email announcements per day. Tournament Plus and above remove both limits. Posting to the public site (no email) is never limited.',
          keywords: ['email limit', 'free plan email', '100 recipients', '10 per day', 'send limit', 'too many emails', 'daily email limit'],
          answer: (
            <p>The free Tournament plan can send a basic all-team announcement to <strong>up to 100 recipients per message</strong> and <strong>up to 10 email announcements per day</strong>. If you reach a limit, you&apos;ll see a message saying so. <strong>Tournament Plus</strong> and above remove both limits. Posting to the public <strong>site</strong> (without email) is never limited.</p>
          ),
        },
        {
          id: 'faq-rain-delay-banner',
          question: 'How do I get a rain delay or urgent update in front of fans on game day?',
          answerText: 'Post a message to the site and pin it. A pinned site post stays at the top of the News page and, while the tournament is live, also shows as a banner at the top of the public Schedule page. Unpin it once the situation clears. This is the same pin control used for News.',
          keywords: ['rain delay', 'urgent update', 'game day', 'schedule banner', 'pin announcement', 'day-of'],
          popular: true,
          answer: (
            <>
              <p>Open <strong>Communication</strong>, write the update, keep <strong>Post to site</strong> on, and turn on <strong>Pin</strong>. While the tournament is live, a pinned site post appears as a banner at the top of the public <strong>Schedule</strong> (and stays pinned at the top of <strong>News</strong>). It&rsquo;s the fastest way to reach fans already watching the schedule for a rain delay, a diamond change, or a start-time push.</p>
              <p><strong>Unpin</strong> it once the situation clears so the banner stays reserved for things that matter in the moment.</p>
            </>
          ),
        },
      ],
    },

    {
      id: 'tournament-chat',
      group: 'Communicate & Publish',
      heading: 'Chat with your coaches',
      summary: 'A live group chat with every coach in your tournament — a real conversation instead of one-way email blasts.',
      keywords: ['chat', 'tournament chat', 'coach chat', 'group chat', 'message coaches', 'live chat', 'mute', 'close room', 'not yet joined', 'moderation'],
      searchText: 'tournament chat group chat live chat with coaches message all coaches conversation real time chat tab not yet joined invite coach mute coach close room reopen read only remove message moderate moderation push notification Tournament Plus every participating coach free and paid stays readable after tournament',
      links: [
        { label: 'Chat', href: '../tournaments/chat' },
      ],
      content: (
        <>
          <p><strong>Chat</strong> gives you a live group conversation with every coach in your tournament — a real back-and-forth instead of one-way email blasts. Open the <strong>Chat</strong> tab on your tournament; every coach who has registered a team is already in the room, free and paid alike. They don&rsquo;t need a plan of their own — being in your tournament is enough.</p>
          <p><strong>&ldquo;Not yet joined.&rdquo;</strong> Coaches who haven&rsquo;t finished signing in yet appear in a <strong>Not yet joined</strong> list, so nobody is silently left out. Use <strong>Copy link</strong> or <strong>Email</strong> beside a name to send that coach the sign-in link; they join the chat automatically the moment they sign in with their team&rsquo;s email.</p>
          <p><strong>Keeping it on track.</strong> As the organizer you moderate the room: <strong>mute</strong> a coach for up to 72 hours (they can still read, just not post), <strong>remove</strong> a message, or <strong>close</strong> the room to make it read-only. You can reopen a closed room at any time. The conversation stays readable after the tournament wraps up, so the record is always there.</p>
          <p>Chat is included with <strong>Tournament Plus and above</strong>. On the free Tournament plan the tab shows an upgrade option instead.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tournament-chat-who',
          question: 'Who is in the tournament chat, and who can use it?',
          answerText: 'Tournament Chat is included with Tournament Plus, League Plus, and Club. Every coach with a team in your tournament is in the room — free and paid coaches alike — and none of them need a plan of their own. Coaches reach it from the Chat entry in their coaches portal. On the free Tournament plan the Chat tab shows an upgrade option.',
          keywords: ['who can use chat', 'tournament chat plan', 'coaches in chat', 'free coaches', 'Tournament Plus chat'],
          popular: true,
          answer: (
            <>
              <p>Tournament Chat is included with <strong>Tournament Plus and above</strong>. Every coach with a team in your tournament is automatically in the room — both free and paid coaches — and none of them need a plan of their own.</p>
              <p>Coaches open it from the <strong>Chat</strong> entry in their coaches portal. On the free Tournament plan, the Chat tab shows an upgrade option instead.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-not-joined',
          question: 'A coach is missing from the chat — how do I add them?',
          answerText: 'Coaches who have not finished signing in appear under Not yet joined in the Chat tab. Use Copy link or Email beside their name to send them the coach sign-in link. They join the chat automatically once they sign in with the email on their team registration — there is no manual step to add them.',
          keywords: ['not yet joined', 'coach missing from chat', 'invite coach to chat', 'add coach', 'coach sign in'],
          answer: (
            <>
              <p>A coach who hasn&rsquo;t finished signing in yet appears under <strong>Not yet joined</strong> in the Chat tab. Use <strong>Copy link</strong> or <strong>Email</strong> beside their name to send them the coach sign-in link.</p>
              <p>They join the chat automatically the moment they sign in with their team&rsquo;s email — there&rsquo;s no manual step to add them.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-moderate',
          question: 'How do I mute a coach or close the chat?',
          answerText: 'In the Chat tab, use Mute beside a coach to stop them posting for up to 72 hours — they can still read the conversation. Use Close room to make the whole chat read-only for everyone, and reopen it any time. You can also remove an individual message. The room stays readable after the tournament finishes.',
          keywords: ['mute coach', 'close chat', 'read only', 'remove message', 'moderate chat', 'reopen room'],
          answer: (
            <>
              <p>Open the <strong>Chat</strong> tab. Beside any coach, <strong>Mute</strong> stops them posting for up to 72 hours while still letting them read. <strong>Close room</strong> makes the whole conversation read-only for everyone — you can <strong>reopen</strong> it at any time. You can also <strong>remove</strong> an individual message.</p>
              <p>The conversation stays readable after the tournament finishes, so the record is always there.</p>
            </>
          ),
        },
      ],
    },

    {
      id: 'public-site-preview',
      group: 'Communicate & Publish',
      heading: 'The public tournament site, fan following, and preview',
      summary: 'What teams and fans see online — following a team, score alerts, the home-screen app — and how to preview it.',
      keywords: ['public site', 'preview', 'public tournament page', 'teams see', 'public schedule', 'standings', 'follow a team', 'score alerts', 'add to home screen', 'install app', 'offline'],
      searchText: 'public tournament site preview schedule standings results teams rules news registration public page what teams see preview site before activation fans follow a team my team score alerts push notification final alert add to home screen install the app home screen icon fan app works offline last scores branded icon iphone android consistent standings rank same rank everywhere team card team profile tie-breaker head-to-head',
      links: [
        { label: 'Preview Site', href: '../tournaments/dashboard' },
      ],
      content: (
        <>
          <p>Use <strong>Preview Site</strong> from the tournament sidebar footer to inspect the public tournament experience before or after activation.</p>
          <p>The public tournament site can include registration, schedule, standings, results, teams, rules, resources, and news depending on tournament setup and status.</p>
          <p>Preview is always available to admins regardless of tournament status. Share the preview link internally to review the public experience before you activate.</p>
          <p><strong>Consistent standings.</strong> A team&rsquo;s rank is the same everywhere it appears — the standings table, the Teams page cards, and the team&rsquo;s own page all rank by your tie-breaker rules (head-to-head, then run differential, and so on). So a team that wins a tie on head-to-head shows the same position to every fan, on every screen.</p>
          <p><strong>Following a team.</strong> Fans can follow a team on the public site — no account needed — to get a personalized &ldquo;my team&rdquo; view: next game, live score, and current standing, front and centre. Following, live public scores, and the home-screen app are included on every plan.</p>
          <p><strong>Score alerts.</strong> On Tournament Plus and above, fans who follow a team can turn on <strong>score alerts</strong> — a push notification when their team&rsquo;s game goes live and a &ldquo;Final&rdquo; when it ends. Tapping an alert opens that game, and on a branded event the notification carries your tournament logo.</p>
          <p><strong>Add to home screen (the fan app).</strong> Fans can add the tournament to their phone&rsquo;s home screen and open it like an app — straight to your event. On iPhone, alerts only work once the page has been added to the home screen (Apple&rsquo;s rule), so the alerts button there shows an &ldquo;add to home screen for alerts&rdquo; prompt first, with a one-time reminder after they install. On Tournament Plus events the home-screen icon and app name carry your tournament branding; free events use the default FieldLogicHQ icon.</p>
          <p><strong>Works at the field.</strong> Once a fan has opened the tournament, the installed app keeps the last-loaded scores and schedule available on a weak or dropped signal and shows a tidy &ldquo;you&rsquo;re offline&rdquo; screen instead of a browser error.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-fan-score-alerts',
          question: 'Can fans get a notification when their team scores?',
          answerText: 'Yes, on Tournament Plus and above. Fans follow a team on the public site, then turn on score alerts to get a push when the game goes live and a Final when it ends. Following, live public scores, and the home-screen app are free on every plan; score alerts are Tournament Plus and above. No fan account is needed — it is per device.',
          keywords: ['score alerts', 'fan alerts', 'push notification', 'follow a team', 'live score', 'Tournament Plus'],
          popular: true,
          answer: (
            <>
              <p>Yes — on <strong>Tournament Plus and above</strong>. A fan follows a team on the public tournament site, then taps <strong>Get score alerts</strong> and allows notifications. They get a push when that team&rsquo;s game goes live and a &ldquo;Final&rdquo; when it ends.</p>
              <p>Following a team, live public scores, and adding the tournament to the home screen are included on <strong>every plan</strong>. Score alerts are available on Tournament Plus and above. No fan account is required — alerts are tied to that person&rsquo;s device.</p>
            </>
          ),
        },
        {
          id: 'faq-iphone-alerts',
          question: "Why don't score alerts appear on some iPhones?",
          answerText: 'Apple only allows web push alerts on iPhone and iPad after the page is added to the home screen. Until then the alerts button shows an add-to-home-screen prompt. Once the fan adds it and opens it from the home screen, the Get score alerts button works normally. Android shows the alerts button directly.',
          keywords: ['iphone alerts', 'ipad', 'add to home screen', 'safari', 'no alerts button', 'apple'],
          answer: (
            <>
              <p>On iPhone and iPad, Apple only allows these alerts <strong>after the page is added to the home screen</strong>. Until then, the alerts control shows an &ldquo;add to home screen for alerts&rdquo; prompt instead of a button that wouldn&rsquo;t work.</p>
              <p>Once a fan adds the tournament to their home screen and opens it from there, the <strong>Get score alerts</strong> button works normally, with a one-time reminder to switch alerts on. Android shows the alerts button directly — no install step needed.</p>
            </>
          ),
        },
      ],
    },

    // ── CLOSE OUT ─────────────────────────────────────────────────────────

    {
      id: 'recipe-closeout-tournament',
      group: 'Close Out',
      heading: 'Complete the tournament',
      summary: 'Wrap up once all games are done, share final results, and understand tournament lifecycle states.',
      keywords: ['closeout', 'complete tournament', 'archive', 'seal', 'final results', 'completed', 'archived', 'sealed'],
      searchText: 'closeout tournament complete archive seal final results post-event summary free tournament slot immutable snapshot board report results email lifecycle draft active completed archived sealed',
      links: [
        { label: 'Manage Tournaments', href: '../tournaments/manage' },
        { label: 'Past Tournaments', href: '../tournaments/archives' },
        { label: 'Summary', href: '../tournaments/summary' },
      ],
      content: (
        <>
          <p>Every tournament has a lifecycle:</p>
          <ul>
            <li><strong>Draft</strong> — setup mode, visible to admins only.</li>
            <li><strong>Active</strong> — public and accepting registrations or live operations.</li>
            <li><strong>Completed</strong> — event is over but still counts as a tournament slot.</li>
            <li><strong>Archived</strong> — retired from active views; no longer counts against the active tournament slot limit.</li>
            <li><strong>Sealed</strong> — a permanent immutable snapshot of final results has been created.</li>
          </ul>
          <p>Close-out steps:</p>
          <ol>
            <li>Confirm all scores, standings, and playoff results are complete.</li>
            <li>Mark the tournament <strong>Completed</strong> from Manage Tournaments.</li>
            <li>Send or share public final results if your plan and workflow include post-event communication.</li>
            <li>Export any registration, schedule, accounting, or results reports needed by your board.</li>
            <li>Archive the tournament when it should leave active views and free its tournament slot.</li>
            <li>Seal only after final review. Sealing creates a permanent snapshot and cannot be undone.</li>
          </ol>
          <p>For completed or archived tournaments, Tournament Plus adds a <strong>Summary</strong> page with registration totals, payment readiness, schedule progress, division recaps, public results links, print/share actions, and a prompt to reuse the setup for the next event.</p>
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
            <p>The Summary page helps organizers share the public results record, print a recap, review registration and payment readiness, and create a future draft from the completed tournament setup.</p>
          ),
        },
      ],
    },

    {
      id: 'data-tools-imports',
      group: 'Close Out',
      heading: 'Importing teams and schedules',
      summary: 'Use Data Tools for spreadsheet templates, safe previews, and recent import history.',
      keywords: ['import', 'data tools', 'xlsx', 'csv', 'spreadsheet', 'templates', 'teams', 'schedule', 'blocked rows', 'current template', 'empty template'],
      searchText: 'import data tools spreadsheet templates xlsx csv preview teams registrations schedule bulk add update recent imports blocked rows current template empty template warnings',
      links: [
        { label: 'Data Tools', href: '../tournaments/data-tools' },
      ],
      content: (
        <>
          <p>
            Open <strong>Data Tools</strong> when you need spreadsheet workflows. Download a
            current-data template when you want to edit existing records, or an empty template
            when you want to prepare new rows from scratch.
          </p>
          <ul>
            <li><strong>Current templates</strong> include existing IDs. Keep those IDs in place when you want FieldLogicHQ to update an existing team or game.</li>
            <li><strong>Empty templates</strong> are blank starting points for new rows. Leave the ID columns empty when creating new teams or games.</li>
            <li><strong>XLSX</strong> is the best format for most admins because it keeps workbook metadata and reference sheets where available. <strong>CSV</strong> is a flat compatibility option.</li>
            <li><strong>Teams &amp; Registrations</strong> and <strong>Schedule</strong> imports are add/update-only. Missing spreadsheet rows do not delete teams or games.</li>
            <li><strong>Recent Imports</strong> shows who uploaded a file, when it was previewed or applied, and the row counts.</li>
          </ul>
          <p>
            Uploading a file creates a preview first. Review creates, updates, unchanged rows,
            warnings, and blocked rows before applying. Warnings are advisory; blocked rows must
            be fixed before any schedule or team changes can be applied.
          </p>
          <p>
            Schedule imports block scored, submitted, completed, generator-locked, playoff,
            pool-slot structural, and facility-lane structural changes. Completed tournaments
            are locked until the status is set back to Active. Scores, delete imports, and
            replace/wipe imports are not supported.
          </p>
        </>
      ),
      faqs: [
        {
          id: 'faq-import-current-vs-empty',
          question: 'Should I use a current template or an empty template?',
          answerText: 'Use a current template to update existing rows because it includes IDs. Use an empty template when preparing new rows.',
          keywords: ['current template', 'empty template', 'ids', 'spreadsheet'],
          answer: (
            <p>Use a current template when editing existing teams or games because the ID columns tell FieldLogicHQ which record to update. Use an empty template for new rows and leave ID columns blank.</p>
          ),
        },
        {
          id: 'faq-import-warning-vs-blocked',
          question: 'What is the difference between a warning and a blocked row?',
          answerText: 'Warnings can still be applied after review. Blocked rows must be fixed and previewed again before apply.',
          keywords: ['warning', 'blocked row', 'preview', 'apply'],
          answer: (
            <p>Warnings call attention to something worth reviewing, such as a name match or timing buffer. Blocked rows fail a safety rule and stop the apply step until the file is fixed and previewed again.</p>
          ),
        },
        {
          id: 'faq-import-delete-replace',
          question: 'Can I wipe and replace teams or schedules from a spreadsheet?',
          answerText: 'No. Imports are add/update-only. Missing spreadsheet rows do not delete teams or games.',
          keywords: ['delete', 'replace', 'wipe', 'add update'],
          answer: (
            <p>No. Spreadsheet imports are add/update-only. Removing a row from the file does not remove the team or game from the tournament.</p>
          ),
        },
      ],
    },

    {
      id: 'exports',
      group: 'Close Out',
      heading: 'Exporting data',
      summary: 'Export registrations, schedules, and results to Excel, CSV, iCal, and PDF.',
      keywords: ['export', 'xlsx', 'csv', 'ical', 'pdf', 'spreadsheet', 'download', 'check-in', 'insurance'],
      searchText: 'export xlsx csv excel spreadsheet ical calendar pdf report check-in insurance registrations schedule results download',
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
