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
      keywords: ['division', 'capacity', 'pool', 'assign teams to pools', 'add teams to pools', 'move to pool', 'fees', 'payment', 'payment instructions', 'how to pay'],
      searchText: 'divisions capacity waitlist pools user selects pool self-select assign teams to pools add teams to pools put teams in pools move to pool randomize unassigned pool view place teams fee schedule deposit total fee registration open closed per division tournament level payment instructions how to pay e-transfer acceptance email coaches portal registration form manual payment',
      links: [
        { label: 'Divisions', href: '../tournaments/divisions' },
        { label: 'Event Settings', href: '../tournaments/settings/event' },
      ],
      content: (
        <>
          <p>Divisions are the registration and competition groups inside a tournament. They can represent age groups, skill levels, adult brackets, or custom groupings.</p>
          <p>Use <strong>capacity</strong> to set the number of teams a division can accept. If a division reaches capacity, admins can use waitlist status to hold additional teams.</p>
          <p>Use <strong>pools</strong> when a division needs smaller groups for round-robin play. Turn on <strong>Enable pools</strong> for the division and name them (Pool A, Pool B, and so on). Then decide how teams land in a pool: turn on <strong>self-select pool</strong> so teams pick their own during registration, or leave it off and assign teams yourself from the <strong>Teams</strong> page after they&rsquo;re accepted.</p>
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
            <p>Pools split one division into smaller groups, such as Pool A and Pool B. They help organize round-robin games and playoff paths when a division has more teams than one simple bracket should handle. After you enable pools here, you place teams into them from the <strong>Teams</strong> page &mdash; unless self-select pool is on, in which case teams choose their own as they register.</p>
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
      searchText: 'venues fields custom location contacts public contact email notifications communication news posts welcome message rules resources documents public site rename venue rename field rename diamond edit venue name field name updates everywhere live',
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
          id: 'faq-rename-venue-updates',
          question: 'If I rename a venue or field, does it update everywhere?',
          answerText: 'Yes. Renaming a venue or one of its fields updates the name everywhere fans see it — the schedule, standings, the playoff bracket, team pages, and individual game details — including games that were already scheduled. You do not need to rebuild the schedule.',
          keywords: ['rename venue', 'rename field', 'rename diamond', 'edit venue', 'venue name', 'field name', 'updates everywhere'],
          answer: (
            <p>Yes. If you rename a venue or one of its fields, the new name shows up everywhere fans see it — the schedule, standings, the playoff bracket, team pages, and individual game details — including games that were already scheduled. There&apos;s no need to rebuild the schedule.</p>
          ),
        },
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
      keywords: ['settings', 'branding', 'scoring', 'subscription', 'members', 'access', 'scorekeepers', 'tie-breaker', 'game timing', 'app icon', 'public directory', 'discover tournaments', 'notifications', 'notification settings', 'mute tournament', 'my notifications'],
      searchText: 'settings access members branding logo hero banner scoring finalization subscription plan tournament settings scorekeeper score finalization role members permissions public appearance tie-breaker tiebreaker ranking standings head to head run differential coin toss game timing game length duration buffer turnaround app icon home screen icon icon background colour color border app name custom short name initials add to home screen pwa icon logo size logo zoom resize logo make logo bigger smaller new installs public directory discover discovery list tournament publicly tournament directory find tournaments browse tournaments province region opt in listing my notification settings personal notifications manage notifications notification settings link in the bell mute one tournament mute all per tournament notifications mute only manage what you receive turn off notifications push email bell channels',
      links: [
        { label: 'Event Settings', href: '../tournaments/settings/event' },
        { label: 'Branding', href: '../tournaments/branding' },
        { label: 'Members', href: '../tournaments/settings/members' },
      ],
      content: (
        <>
          <p>Use <strong>Event Settings</strong> and <strong>Branding</strong> for tournament-specific administration after the core setup is in place.</p>
          <p><strong>Branding</strong> controls the tournament public appearance. Free tournaments use the default FieldLogicHQ look; Tournament Plus and above can give a tournament its own identity — a custom logo, colours, hero banner, fonts, and a custom <strong>App Icon</strong> (your event&rsquo;s branded icon and name inside the one FieldLogicHQ app fans use).</p>
          <p><strong>Event Settings</strong> controls dates, fee scope, score finalization, tie-breaker rules, game timing, whether the tournament is listed in the public tournament directory, and the Plus-only post-event results notification. When enabled, accepted team contacts receive the public results links once when the tournament is marked completed.</p>
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
          id: 'faq-public-directory',
          question: 'How do I list my tournament in the public directory?',
          answerText: 'Open Event Settings and turn on "List in public tournament directory". It is off by default and available on every plan. When it is on, pick a province so people can find your event by region. Listing adds your tournament to the public FieldLogicHQ directory, which shows your event name, dates, sport, and live scores and links to your existing public pages — player information always stays private. A listed, live tournament also surfaces on the app-wide Scores tab, the live board every visitor sees. Your listing only appears once the tournament is Active or Completed; a draft stays hidden even with the toggle on. Turn it off any time to remove the tournament from the directory.',
          keywords: ['public directory', 'discover', 'discovery', 'list tournament', 'tournament directory', 'find tournaments', 'browse tournaments', 'public listing', 'province', 'region', 'opt in', 'scores tab', 'live board'],
          answer: (
            <>
              <p>Open <strong>Event Settings</strong> and turn on <strong>List in public tournament directory</strong>. It&rsquo;s <strong>off by default</strong> and available on every plan, so a tournament is only listed when you choose to list it.</p>
              <p>When it&rsquo;s on, pick a <strong>province</strong> so people can find your event by region. Listing adds your tournament to the public FieldLogicHQ directory, which shows your event name, dates, sport, and live scores and links to your existing public pages. <strong>Player information always stays private.</strong></p>
              <p>A listed tournament that&rsquo;s currently underway also surfaces on the app&rsquo;s <strong>Scores</strong> tab — the platform-wide live board every visitor sees, whether or not they follow your event.</p>
              <p>Your listing only appears once the tournament is <strong>Active</strong> or <strong>Completed</strong> — a draft stays hidden even with the toggle on. Turn the toggle off any time to remove the tournament from the directory.</p>
            </>
          ),
        },
        {
          id: 'faq-app-icon',
          question: 'Can I give my event its own branded icon and name?',
          answerText: 'Yes, on Tournament Plus and above. Fans now install one FieldLogicHQ app, and your event gets its own branded space inside it. In Branding, the App Icon section shows a live preview of your event\'s branded icon and name. The background is matched to your logo automatically; you can override it with White, Dark, your Brand colour, or any custom colour — a colour that contrasts with your logo shows as a border, and Auto matches seamlessly. Use the Logo size slider to make your logo larger or smaller in the icon (zoom), with a live preview and a Reset to default. You can also set a short name for your event; about 12 characters read best, so initials work well for a long name (for example BoB for Battle of the Bats). The full event name still shows on your public pages and the browser tab.',
          keywords: ['app icon', 'branded icon', 'event icon', 'icon background', 'icon colour', 'icon color', 'border', 'app name', 'short name', 'initials', 'branded space', 'pwa icon', 'logo size', 'logo zoom', 'zoom logo', 'resize logo', 'bigger logo', 'smaller logo', 'logo scale'],
          answer: (
            <>
              <p>Yes — on <strong>Tournament Plus and above</strong>. Fans now install <strong>one</strong> FieldLogicHQ app, and your event gets its own branded space inside it. Open <strong>Branding</strong> and find <strong>App Icon</strong> — a live preview shows your event&rsquo;s branded icon and name.</p>
              <p><strong>Background.</strong> The icon background is matched to your logo automatically. To change it, choose <strong>White</strong>, <strong>Dark</strong>, your <strong>Brand</strong> colour, or any custom colour — a colour that contrasts with your logo shows as a border, and &ldquo;Auto&rdquo; matches seamlessly.</p>
              <p><strong>Logo size.</strong> Drag the <strong>Logo size</strong> slider to make your logo sit larger or smaller in the icon — the preview updates as you go, and &ldquo;Reset&rdquo; returns it to the default.</p>
              <p><strong>App name.</strong> Set the short label for your event — about 12 characters read best, so initials work well for a long name (for example &ldquo;BoB&rdquo; for Battle of the Bats). The full event name still shows on your public pages and the browser tab.</p>
              <p>One thing to know: fans install a single FieldLogicHQ app now, so these settings brand your event&rsquo;s space inside that app rather than adding a separate home-screen icon for each event.</p>
            </>
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
          answerText: 'When teams finish with the same record, tie-breaker rules decide their standings ranking. The default order is head-to-head, then run differential, then runs scored, then runs allowed. You can customize the order before playoffs. If you set a per-game run-differential cap, the standings RD column shows each team’s true run differential with the seeding-capped value in brackets — for example +10 (+7) — so fans see the real margin while seeding still uses the capped figure.',
          keywords: ['tie-breaker', 'tiebreaker', 'ranking', 'standings', 'h2h', 'head to head', 'run differential', 'coin toss', 'run differential cap', 'capped', '+10 (+7)'],
          popular: true,
          answer: (
            <>
            <p>When two or more teams finish pool play with the same record, <strong>tie-breaker rules</strong> decide who ranks higher in the standings. The default order is head-to-head result, then run differential, then runs scored, then runs allowed. Open <strong>Event Settings</strong> to change the order, set a per-game run-differential cap, or add a coin-toss step before playoffs.</p>
            <p>If you set a <strong>per-game run-differential cap</strong>, the standings RD column shows each team&rsquo;s <strong>true</strong> run differential with the seeding-capped value in brackets — for example <strong>+10 (+7)</strong>. Fans see the real margin, while the capped figure is what actually counts toward seeding.</p>
            </>
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
        {
          id: 'faq-my-notification-settings',
          question: 'Where do I set my own notifications, or mute one tournament?',
          answerText: 'Your personal notification settings live on one page, opened from the Notification settings link in the bell — a card per organization (and any team you coach), each with bell, push, and email switches per kind of event, plus your phones in one place. The per-tournament Notifications screen under a tournament\'s settings is now mute-only: it silences that one tournament for you (Mute all, or event by event) and can only mute — org settings decide what you actually receive, and a tournament can never turn a channel back on. Use its "Manage what you receive" link to jump to your full settings.',
          keywords: ['notification settings', 'my notifications', 'personal notifications', 'mute tournament', 'mute notifications', 'turn off notifications', 'per-tournament notifications', 'manage notifications', 'push settings', 'email notifications', 'stop notifications for a tournament', 'notification preferences'],
          answer: (
            <>
              <p>Your <strong>personal notification settings</strong> live on one page — open <strong>Notification settings</strong> from the <strong>bell</strong>. It shows a card for each organization (and any team you coach), each with <strong>bell</strong>, <strong>push</strong>, and <strong>email</strong> switches per kind of event, plus your phones managed in one place.</p>
              <p>The per-tournament <strong>Notifications</strong> screen (under a tournament&rsquo;s settings) is now <strong>mute-only</strong>: it silences that one tournament for you — <strong>Mute all</strong>, or event by event. As it says there, <em>org settings decide what you receive; a tournament can only mute, never turn a channel back on</em>. Use its <strong>Manage what you receive&nbsp;&rarr;</strong> link to jump to your full settings.</p>
            </>
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
      keywords: ['review teams', 'approve registration', 'waitlist team', 'payment status', 'accepted teams', 'registration health'],
      searchText: 'review team registrations approve accept waitlist reject pending payment deposit paid paid in full schedule eligibility selected teams bulk actions registration health score health score missing email no email on file needs action capacity filled percent filled add team email edit team email',
      links: [
        { label: 'Registrations', href: '../tournaments/registrations' },
      ],
      content: (
        <>
          <p>Review teams regularly while registration is open so schedule planning starts from a clean accepted-team list. The <strong>Registration Health</strong> card at the top of the Teams page gives you a one-glance score for exactly this — expand it any time to see what needs a look.</p>
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
          id: 'faq-registration-health-score',
          question: 'What does the Registration Health score tell me?',
          answerText: 'The Registration Health card at the top of the Teams page gives a 0-100 score for your tournament\'s registrations, plus four tiles — Teams, Missing email, Payments, and Needs action — and a list of specific issues. It starts collapsed; click Show to expand it. Each tile and issue is clickable and jumps straight to the matching filtered team list, so you go straight from "12 teams missing an email" to those exact 12 teams. The Payments tile requires Tournament Plus; on the free Tournament plan it shows a Plus badge instead of numbers. A full waitlist never lowers the score — it isn\'t a problem to fix.',
          keywords: ['registration health', 'health score', 'health card', 'needs action', 'missing email tile', 'capacity filled', 'percent filled', '/100'],
          popular: true,
          answer: (
            <>
              <p>The <strong>Registration Health</strong> card at the top of the <strong>Teams</strong> page gives you a 0&ndash;100 score for your tournament&rsquo;s registrations, plus four tiles &mdash; <strong>Teams</strong>, <strong>Missing email</strong>, <strong>Payments</strong>, and <strong>Needs action</strong> &mdash; and a list of specific issues underneath. It starts collapsed; tap <strong>Show</strong> to expand it.</p>
              <p>Every tile and issue is clickable and jumps straight to the matching filtered team list &mdash; so &ldquo;3 teams missing an email&rdquo; takes you directly to those 3 teams instead of making you hunt through the full roster.</p>
              <p>The <strong>Payments</strong> tile needs <strong>Tournament Plus</strong> (it tracks unpaid and past-due fees); on the free Tournament plan it shows a small <strong>Plus</strong> badge instead of numbers. A full waitlist never counts against the score &mdash; it isn&rsquo;t something you need to fix.</p>
            </>
          ),
        },
        {
          id: 'faq-add-team-email',
          question: 'How do I add or fix a team\'s email address?',
          answerText: 'Open Registrations, expand the team\'s row, and click the pencil (Edit) icon to add or change its email. If the Registration Health card or the dashboard flags teams with no email on file, click that flag to jump straight to the affected teams instead of searching the full list.',
          keywords: ['add team email', 'edit team email', 'fix email', 'no email on file', 'missing email', 'coach email'],
          answer: (
            <p>Open <strong>Registrations</strong>, expand the team&rsquo;s row, and click the pencil (<strong>Edit</strong>) icon &mdash; the email field is there along with the team name and coach name. If the <strong>Registration Health</strong> card or the dashboard&rsquo;s <strong>Coach Sign-ups &amp; Chat</strong> panel flags teams with no email on file, click that flag instead of searching manually &mdash; it jumps straight to the exact teams that need one.</p>
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

    {
      id: 'assign-teams-to-pools',
      group: 'Teams & Registration',
      heading: 'Put teams into pools',
      summary: 'Place accepted teams into a division’s pools by hand, in batches, or all at once.',
      keywords: ['assign pools', 'add teams to pools', 'put teams in pools', 'move to pool', 'randomize pools', 'unassigned', 'pool assignment'],
      searchText: 'assign teams to pools add teams to pools put teams in pools where do i add teams to pools move to pool randomize spread teams unassigned pool view flat view self-select pool place teams division pools pool a pool b',
      links: [
        { label: 'Teams', href: '../tournaments/registrations' },
        { label: 'Divisions', href: '../tournaments/divisions' },
      ],
      content: (
        <>
          <p>Pools are created on the <strong>Divisions</strong> page &mdash; turn on <strong>Enable pools</strong> for the division and name them first. Until a division has pools, every team sits under <strong>Unassigned</strong> on the Teams page, and that view links you back to Divisions to turn pools on.</p>
          <p>Once pools exist, open the <strong>Teams</strong> page, choose the division, and switch to <strong>Pools</strong> view. Every pool appears, even before it has any teams, so you always know where teams can go. There are three ways to place accepted teams:</p>
          <ul>
            <li><strong>One at a time</strong> &mdash; pick a pool from the dropdown on each team&rsquo;s row.</li>
            <li><strong>In batches</strong> &mdash; use <strong>Select Many</strong>, tick the teams you want together, then choose <strong>Move to pool</strong>.</li>
            <li><strong>All at once</strong> &mdash; use <strong>Randomize</strong> to spread every accepted team evenly across the pools, then adjust by hand.</li>
          </ul>
          <p>This is how you assign pools when <strong>self-select pool</strong> is off for the division. With self-select on, teams choose their own pool as they register, and you only step in to make changes.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-where-add-teams-to-pools',
          question: 'Where do I add teams to pools?',
          answerText: 'On the Teams page, choose the division and switch to Pools view. Set a team’s pool from the dropdown on its row, select several teams and use Move to pool, or use Randomize to spread all accepted teams across the pools. Pools must first be enabled and named on the Divisions page; the Pools toggle on the Teams page only changes how teams are grouped, it does not create pools.',
          keywords: ['where add teams to pools', 'assign pool', 'move to pool', 'randomize', 'pools view', 'unassigned'],
          popular: true,
          answer: (
            <p>On the <strong>Teams</strong> page, pick the division and switch to <strong>Pools</strong> view, then use the pool dropdown on a team&rsquo;s row, <strong>Move to pool</strong> after selecting several teams, or <strong>Randomize</strong> to spread them all at once. Note the <strong>Flat / Pools</strong> toggle only changes how teams are grouped &mdash; pools themselves are created on the <strong>Divisions</strong> page.</p>
          ),
        },
        {
          id: 'faq-only-unassigned-showing',
          question: 'Why do all my teams show as Unassigned?',
          answerText: 'Teams show under Unassigned until you place them in a pool, or because the division has no pools enabled yet. Empty pools still appear in Pools view so you can assign into them. If there are no pools at all, enable pools for the division on the Divisions page first, then assign teams on the Teams page.',
          keywords: ['unassigned', 'no pools', 'pools missing', 'teams not in pools'],
          answer: (
            <p>Teams stay under <strong>Unassigned</strong> until you place them, or because the division has no pools yet. If you see no pools at all, open the <strong>Divisions</strong> page, enable pools for that division, and name them &mdash; then come back to the Teams page and assign teams.</p>
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
      keywords: ['build schedule', 'generate schedule', 'round robin', 'edit games', 'venues', 'auto-generate', 'adjust today', 'shift the day', 'rain delay', 'tools menu', 'move all games', 'bulk reschedule', 'delay games', 'cancel games', 'division filter', 'venue filter'],
      searchText: 'build tournament schedule generate round robin auto-generate accepted teams venues time slots edit games cancel restore public schedule pools flat list timeline adjust today shift the day rain delay tools menu tournament plus running behind move push all remaining games back bulk reschedule delay cancel today games one step before after preview atomic filter by division venue field diamond',
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
          <p><strong>Rained out or running behind?</strong> Whenever the event has upcoming games, open <strong>Tools ▾ → Rain delay</strong> on the Schedule page. Pick a day (today or any upcoming day), optionally narrow to one division or venue, and it moves or cancels those games in one step — push them back 30 minutes, an hour, two hours, or a custom amount, and/or cancel a few — with a live before-and-after preview, then a ready-to-send notice so you update the schedule and tell everyone in one action. It applies all-or-nothing, leaves games that already have a result alone, and won&rsquo;t let a playoff game land before the games that feed it. <strong>Rain delay is a Tournament Plus tool</strong>; on the free plan you can still reschedule games one at a time and post a rain-delay banner (see the day-of question below).</p>
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
        {
          id: 'faq-shift-the-day',
          question: 'How do I move or cancel a whole day of games at once (rain delay)?',
          answerText: "On the Schedule page, open Tools then Rain delay (it appears whenever the event has upcoming games). Rain delay is a Tournament Plus tool — free Tournament orgs see it locked but can still reschedule games one at a time, post the free pinned rain-delay banner, and email coaches. In the panel: choose the day to adjust (today or any upcoming day), optionally filter by Division and/or Venue to act on just part of a day (only U11, or only the wetter diamond — Select all, the counts, and Apply act only on the shown games and leave the rest untouched), then pick how far to push the games (+30 minutes, +1 hour, +2 hours, or a custom amount) and/or mark some to cancel. You see each game's old and new time before you confirm. It applies as one action (all or nothing), never touches games that already have a result, and blocks a shift that would put a playoff game before the games that feed it (cancelling a playoff game is allowed with a warning). After it applies, it offers a prefilled announcement with the notify option on, so one more confirm posts the update to the public schedule and notifies opted-in fans plus your staff and coaches. Because you can pick an upcoming day, you can set a delay the evening before on the forecast; run it again for another division or field with a different amount.",
          keywords: ['rain delay', 'shift the day', 'tools menu', 'adjust today', 'move all games', 'bulk reschedule', 'delay games', 'push games back', 'cancel games', 'weather', 'running behind', 'forecast', 'tomorrow', 'tournament plus', 'division filter', 'venue filter'],
          popular: true,
          answer: (
            <>
              <p>On the Schedule page, open <strong>Tools ▾ → Rain delay</strong> — it appears whenever the event has upcoming games. Rain delay is a <strong>Tournament Plus</strong> tool; on the free plan you can still reschedule games one at a time and post a rain-delay banner (see the guardrail below). Then:</p>
              <ol>
                <li>Pick the <strong>day to adjust</strong> — today or any upcoming day, so you can act the evening before on a forecast.</li>
                <li><strong>Optional:</strong> filter by <strong>Division</strong> and/or <strong>Venue</strong> to act on only part of the day — say, only U11 games, or only the games on the wetter diamond. Select all, the count, and Apply act only on the games shown; the rest stay put.</li>
                <li>Choose how far to push those games: <strong>+30 minutes</strong>, <strong>+1 hour</strong>, <strong>+2 hours</strong>, or a custom number of minutes — and/or mark individual games to <strong>cancel</strong>.</li>
                <li>Check the <strong>before → after</strong> times, then <strong>Apply</strong>. Everything happens together — all of it or none of it.</li>
              </ol>
              <p>Games that already have a result are left alone. If a change would schedule a playoff game <em>before</em> the games that feed it, the tool blocks it until you fix the times. Cancelling a playoff game is allowed, with a reminder that its spot in the bracket will need to be sorted out by hand. Need a different amount for another division or field? Filter to that set and run it again.</p>
              <p>Right after it applies, you get a <strong>prefilled announcement</strong> with the notify option already on. One more confirm pins the update to the public <strong>Schedule</strong> and notifies opted-in <strong>fans</strong> plus your <strong>staff and coaches</strong> in the same step. Staff and coaches can turn the &ldquo;Tournament announcement&rdquo; alert off in their notification settings.</p>
            </>
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
      keywords: ['schedule', 'playoffs', 'bracket', 'seeds', 'manual bracket', 'bracket builder', 'tiers', 'split into tiers', 'gold silver bracket', 'playoff picture', 'playoffs are set', 'seeding summary', 'champions', 'champions page', 'champions crowned', 'final results', 'schedule health', 'current tag', 'projected tag'],
      searchText: 'playoff bracket manual build add game bracket view playoff wizard auto generate seeds single elimination consolation double elimination placement crossover reseed tiers split into tiers gold silver tier bracket separate brackets overall standings tiered bracket public bracket fans tap click bracket card game details directions field diamond on bracket card public standings bracket collapsed folded tap to preview playoff picture seeding summary seeding and matchups pending championship winner of semifinal playoffs are set announcement notification alert home hero takeover countdown first playoff game shareable share seeds matchups top seed schedule health team detail back-to-back max per day rest current projected if this seed keeps winning',
      links: [
        { label: 'Schedule', href: '../tournaments/schedule' },
      ],
      content: (
        <>
          <p>Switch to the <strong>Playoffs</strong> stage on the Schedule page to manage bracket games. Free Tournament orgs can add playoff games manually using the inline <strong>bracket editor</strong>; Tournament Plus, League Plus, and Club can also use the <strong>Playoff Wizard</strong> for format-based auto-generation.</p>
          <p>The inline bracket editor is a canvas where you add rounds, set up matchups, and wire Seed/Winner/Loser placeholders. Once pool play is complete and standings are known, the placeholders resolve to the real teams.</p>
          <p><strong>Bracket view</strong> on the Schedule page lets admins inspect playoff paths and advancement after games are created. It is a read-oriented visualization alongside the editable list and timeline.</p>
          <p><strong>Split a division into tiers.</strong> A large division can be split into two or more tiers — for example a <strong>Gold</strong> bracket for the top seeds and a <strong>Silver</strong> bracket for the rest — so every team keeps playing meaningful games. In the inline bracket editor, click <strong>Split into tiers</strong>, set how many teams go in each tier, and FieldLogicHQ seeds each tier from the division&apos;s overall standings. Building tiers by hand is free on every plan; Tournament Plus, League Plus, and Club can also produce tiers in one click from the Playoff Wizard. Each tier is its own bracket and shows as a separate, titled section in the editor, on the public schedule and standings pages, in the admin bracket view, and on the printable bracket PDF. Editing a tiered bracket — adding a venue or time, for instance — keeps every tier intact.</p>
          <p>To build a bracket:</p>
          <ol>
            <li>Confirm pool-play or round-robin games are complete and standings reflect final team records.</li>
            <li>Open <strong>Schedule</strong> and switch to the <strong>Playoffs</strong> stage.</li>
            <li>For manual building, click <strong>Build Bracket</strong> to enter the inline editor and add rounds and matchups.</li>
            <li>For automated format generation (Tournament Plus), open the <strong>Playoff Wizard</strong> and configure bracket format, number of teams qualifying, seeds, and scheduling.</li>
            <li>Review the bracket preview before saving.</li>
          </ol>
          <p><strong>When the bracket goes live.</strong> The first time you create a playoff bracket, FieldLogicHQ marks the moment for you: the public home page flips to a <strong>Playoffs</strong> look with a countdown to the first playoff game, a one-time <strong>&ldquo;Playoffs are set&rdquo;</strong> alert goes out to your staff and to fans who turned on score alerts (Tournament Plus and above), and a shareable <strong>Playoff Picture</strong> page is published with the seeding, the opening matchups, and standout-team highlights. Editing or regenerating the bracket afterward never re-sends that alert.</p>
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
          id: 'faq-public-playoff-bracket',
          question: 'What do fans see on the public playoff bracket?',
          answerText: 'The playoff bracket appears in two public places — the Schedule page (Playoffs → Bracket) and the Standings page — and both show the same brackets, with a separate titled section for each tier. On the Standings page during pool play, the bracket sits folded behind a one-tap "Playoff Bracket" row after the tables, so standings stay front and centre; fans tap the row to preview the bracket. Once playoff games begin (or the event is complete), the bracket expands automatically at the top of the Standings page. Every matchup card shows the date, time, and field, and fans can tap any card to open that game’s full details: teams, score, and the location with a Get Directions link.',
          keywords: ['public bracket', 'fans', 'tap bracket', 'click bracket', 'game details', 'field on bracket', 'diamond', 'directions', 'public standings bracket', 'tap to preview', 'collapsed bracket', 'where is the bracket', 'bracket folded'],
          answer: (
            <>
              <p>Your playoff bracket appears in two public places — the <strong>Schedule</strong> page (switch to <strong>Playoffs → Bracket</strong>) and the <strong>Standings</strong> page — and both show the same brackets, with a separate titled section for each tier.</p>
              <p>On the Standings page, placement follows the moment: during pool play the bracket sits folded behind a one-tap <strong>&ldquo;Playoff Bracket&rdquo;</strong> row after the tables — fans tap it to preview, and the standings stay front and centre. Once playoff games begin (or the event is complete), the bracket expands automatically at the <strong>top</strong> of the page, because it&apos;s the headline then.</p>
              <p>Each matchup card shows the date, time, and <strong>field</strong> for that game, and fans can <strong>tap any card</strong> to open the game&apos;s full details — the teams, the score, and the location with a <strong>Get Directions</strong> link.</p>
            </>
          ),
        },
        {
          id: 'faq-playoff-picture',
          question: 'What is the Playoff Picture page?',
          answerText: 'When you set the playoff bracket, FieldLogicHQ publishes a shareable Playoff Picture page for fans — a plain-language seeding summary with each seed’s record and run differential, the playoff cut line, the matchups with real team names, and standout-team highlights (top seed, best offense, stingiest defense, best differential). On phones it reads as a compact “Seeding & Matchups” view under the event header. While earlier rounds are still being played, that day’s later rounds (like the championship) appear as an honest Pending card with the time and field — “Winner of Semifinal 1 vs Winner of Semifinal 2” — and flip into a normal matchup card the moment the teams are decided. It has a Share button and the public home page links to it. The page follows your Standings page visibility, so if you hide Standings, the Playoff Picture is hidden too.',
          keywords: ['playoff picture', 'seeding summary', 'seeding and matchups', 'playoffs are set', 'seeds', 'share bracket', 'matchups', 'top seed', 'pending championship', 'winner of semifinal', 'championship time'],
          popular: true,
          answer: (
            <>
              <p>When you set the playoff bracket, FieldLogicHQ publishes a shareable <strong>Playoff Picture</strong> — a plain-language seeding summary fans can read and share. It shows each seed&rsquo;s record and run differential, marks the <strong>playoff cut</strong>, lists the matchups with the real team names filled in, and calls out standout teams (top seed, best offense, stingiest defense, best run differential). On phones it opens as a compact <strong>&ldquo;Seeding &amp; Matchups&rdquo;</strong> view under the event header. There&rsquo;s a <strong>Share</strong> button, and the public home page links to it from the Playoffs banner.</p>
              <p>On game day the page stays honest about what&rsquo;s still to come: while earlier rounds are being played, that day&rsquo;s later rounds — like tonight&rsquo;s championship — appear as a <strong>Pending</strong> card with the time and field (&ldquo;Winner of Semifinal 1 vs Winner of Semifinal 2&rdquo;), then flip into a normal matchup card the moment the teams are decided.</p>
              <p>The Playoff Picture follows your <strong>Standings</strong> page visibility — if you hide Standings for the event, the Playoff Picture is hidden too.</p>
            </>
          ),
        },
        {
          id: 'faq-playoffs-set-alert',
          question: 'Does anyone get notified when I set the playoffs?',
          answerText: 'Yes. The first time you create the playoff bracket, a one-time “Playoffs are set” alert is sent automatically — a push and in-app bell to your staff, and a push to fans who turned on score alerts (Tournament Plus and above). It links to the Playoff Picture. Editing the bracket later never re-sends it. Staff can manage this under notification settings as the “Playoff bracket set” event.',
          keywords: ['playoffs are set', 'playoff notification', 'bracket notification', 'alert', 'push', 'staff', 'fans', 'playoff bracket set'],
          answer: (
            <>
              <p>Yes. The <strong>first time</strong> you create the playoff bracket, a one-time <strong>&ldquo;Playoffs are set&rdquo;</strong> alert goes out automatically:</p>
              <ul>
                <li>Your <strong>staff</strong> get a push and an in-app bell — manage it under notification settings as the <strong>&ldquo;Playoff bracket set&rdquo;</strong> event.</li>
                <li>Fans who turned on <strong>score alerts</strong> (Tournament Plus and above) get a push.</li>
              </ul>
              <p>Both link to the <strong>Playoff Picture</strong>. Editing or regenerating the bracket later never re-sends the alert.</p>
            </>
          ),
        },
        {
          id: 'faq-champions-recap',
          question: 'What is the Champions page?',
          answerText: 'When a tournament’s whole playoffs finish and the champion is decided, FieldLogicHQ publishes a shareable Champions page — the finish-line counterpart to the Playoff Picture. It headlines the winning team (the top-tier winner in a tiered division), lists every tier’s champion with the final score, and shows the final standings. It has a Share button and the public home page links to it. The Champions page follows your Standings page visibility, so if you hide Standings it is hidden too, and it only appears once the whole tournament’s playoffs are complete.',
          keywords: ['champions page', 'champions', 'final results', 'recap', 'winners', 'share results', 'champion'],
          popular: true,
          answer: (
            <>
              <p>When your tournament&rsquo;s whole playoffs finish and the champion is decided, FieldLogicHQ publishes a shareable <strong>Champions</strong> page &mdash; the finish-line counterpart to the Playoff Picture. It headlines the winning team, lists every tier&rsquo;s champion with the final score, and shows the final standings, with a <strong>Share</strong> button that the public home page links to.</p>
              <p>In a tiered division (Gold/Silver or Tier 1/Tier 2), the headline champion is the <strong>top tier&rsquo;s</strong> winner. The Champions page follows your <strong>Standings</strong> page visibility &mdash; if you hide Standings, it&rsquo;s hidden too &mdash; and it appears once the <strong>whole</strong> tournament&rsquo;s playoffs are complete.</p>
            </>
          ),
        },
        {
          id: 'faq-champions-crowned-alert',
          question: 'Does anyone get notified when the champion is crowned?',
          answerText: 'Yes. The first time a tournament’s whole playoffs finish and the champion is decided, a one-time “Champions crowned” alert is sent automatically — a push and in-app bell to your staff, and a push to fans who turned on score alerts (Tournament Plus and above). It links to the Champions page. It fires once off the scores you already enter and never re-sends if you re-score later. Staff can manage this under notification settings as the “Champions crowned” event. Marking the tournament Completed stays a separate, optional step.',
          keywords: ['champions crowned', 'champion notification', 'final results alert', 'alert', 'push', 'staff', 'fans', 'tournament complete', 'champions'],
          answer: (
            <>
              <p>Yes. The <strong>first time</strong> your tournament&rsquo;s whole playoffs finish and the champion is decided, a one-time <strong>&ldquo;Champions crowned&rdquo;</strong> alert goes out automatically:</p>
              <ul>
                <li>Your <strong>staff</strong> get a push and an in-app bell &mdash; manage it under notification settings as the <strong>&ldquo;Champions crowned&rdquo;</strong> event.</li>
                <li>Fans who turned on <strong>score alerts</strong> (Tournament Plus and above) get a push.</li>
              </ul>
              <p>Both link to the <strong>Champions</strong> page. It fires once off the scores you already enter and never re-sends if you re-score afterward. Formally marking the tournament <strong>Completed</strong> stays a separate, optional step.</p>
            </>
          ),
        },
        {
          id: 'faq-split-into-tiers',
          question: 'Can I split a division into tiers (like Gold and Silver)?',
          answerText: 'Yes. In the inline bracket editor click Split into tiers, then set how many teams go in each tier. FieldLogicHQ seeds each tier from the division’s overall standings and makes each tier its own bracket — shown as a separate, titled section in the editor, on the public schedule and standings pages, in the admin bracket view, and on the PDF. Building tiers by hand is free on every plan; Tournament Plus can also generate tiers in one click from the Playoff Wizard. Editing a tiered bracket keeps the tiers intact.',
          keywords: ['tiers', 'split into tiers', 'gold', 'silver', 'tiered bracket', 'separate brackets', 'consolation'],
          popular: true,
          answer: (
            <>
              <p>Yes. A division can run as two or more tiers so every team keeps playing — for example a Gold bracket for the top seeds and a Silver bracket for the rest.</p>
              <ul>
                <li>In the inline bracket editor, click <strong>Split into tiers</strong> and set how many teams go in each tier. Tiers fill from the division&apos;s overall standings, top seeds first.</li>
                <li>Each tier becomes its own bracket and appears as a separate, titled section in the editor, on the public schedule and standings pages, in the admin bracket view, and on the printable PDF.</li>
                <li>Editing a tiered bracket — such as adding a venue or time — keeps every tier intact.</li>
              </ul>
              <p>Building tiers by hand is free on every plan. Tournament Plus, League Plus, and Club can also generate tiers in one click from the Playoff Wizard.</p>
            </>
          ),
        },
        {
          id: 'faq-playoffs-current-projected-tags',
          question: 'What do the "Current" and "Projected" tags mean on the Playoffs schedule health card?',
          answerText: 'On the Playoffs stage, the Schedule Health card\'s Team Detail table shows every seed\'s rest, back-to-back, and games-per-day numbers, plus how many games in a row they\'d play if they kept winning all the way to the final — since every round\'s date, time, and venue is already fixed the moment the bracket is built, only the opponent is unknown. A seed still shows as "Seed #N" until its real team is known. A "Current" tag means the team name came from live round-robin standings, which can still shift before round robin ends (once at least one round-robin game has been played). A "Projected" tag means some of that row\'s games have not actually happened yet — it assumes that seed keeps winning through the final. Projected rounds are always tagged so a hypothetical scheduling conflict is never mistaken for one that\'s already locked in.',
          keywords: ['schedule health', 'health card', 'team detail', 'current tag', 'projected tag', 'seed number', 'back-to-back', 'max per day', 'rest', 'if this seed keeps winning', 'single elimination', 'standings resolved'],
          popular: true,
          answer: (
            <>
              <p>On the <strong>Playoffs</strong> stage, the <strong>Schedule Health</strong> card&rsquo;s <strong>Team Detail</strong> table shows every seed&rsquo;s rest, back-to-back, and games-per-day numbers — including rounds they haven&rsquo;t reached yet, since every round&rsquo;s date, time, and venue is already fixed the moment the bracket is built, only the opponent is unknown. Until a seed&rsquo;s real team is known, the row is simply labelled <strong>&ldquo;Seed #N&rdquo;</strong> — same numbers either way.</p>
              <ul>
                <li><strong>Current</strong> — the team name was resolved from live round-robin standings (once at least one round-robin game has been played), which can still shift before round robin ends.</li>
                <li><strong>Projected</strong> — some of that row&rsquo;s games haven&rsquo;t actually happened yet; it assumes that team or seed wins every remaining game and reaches the final. It&rsquo;s a heads-up, not a locked-in schedule conflict.</li>
              </ul>
              <p>This projection only appears for a standard single-elimination bracket — double-elimination, consolation, and tiered crossover formats don&rsquo;t show it, since a team could legitimately land in either path there.</p>
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
      keywords: ['enter scores', 'finalize scores', 'pending review', 'scorekeeper submissions', 'results', 'review scores', 'now playing', 'up next', 'needs a score', 'game-day dashboard'],
      searchText: 'enter scores finalize scores scorekeeper submissions pending review results scoring completed games public standings correct score revert scheduled score finalization now playing up next needs a score game day dashboard live board overdue unscored game what is on now sections panels reorder',
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
          id: 'faq-game-day-sections',
          question: 'What do the Now Playing, Up Next, and Needs a Score sections mean?',
          answerText: 'On game day your tournament dashboard groups games into three sections. Now Playing is games being scored right now, plus scheduled games inside their play window. Up Next is today’s scheduled games that haven’t started yet, earliest first. Needs a Score is games whose scheduled time has fully passed but still have no result — your safety net so a finished game never sits unscored. Each section hides itself when it is empty, and you can reorder or hide these panels from the dashboard.',
          keywords: ['now playing', 'up next', 'needs a score', 'game day dashboard', 'game-day board', 'live games', 'overdue game', 'unscored', 'dashboard sections'],
          popular: true,
          answer: (
            <>
              <p>On game day your tournament <strong>dashboard</strong> groups games into three at-a-glance sections:</p>
              <ul>
                <li><strong>Now Playing</strong> — games being scored right now, plus scheduled games inside their play window.</li>
                <li><strong>Up Next</strong> — today&rsquo;s scheduled games that haven&rsquo;t started yet, earliest first.</li>
                <li><strong>Needs a Score</strong> — games whose scheduled time has fully passed but still have no result. It&rsquo;s your safety net so a finished game never sits unscored.</li>
              </ul>
              <p>Each section hides itself when there&rsquo;s nothing to show, and you can reorder or hide these panels from the dashboard.</p>
            </>
          ),
        },
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
      summary: 'Publish news to the public site, pin urgent day-of updates, email registered teams, and push notifications to fans.',
      keywords: ['communication', 'announcements', 'email', 'news posts', 'targeted email', 'pin', 'pinned', 'rain delay', 'schedule banner', 'email limit', 'recipient limit', 'free email cap', 'push', 'push notification', 'push to fans', 'notify fans', 'fan alerts', 'phone alert'],
      searchText: 'communication audiences send email announcements news posts public tournament page teams division payment status selected teams contact role targeted communication all teams pin pinned post top of news rain delay urgent day-of update game day schedule banner live event free plan email limit 100 recipients per send 10 announcements per day daily email cap volume limit basic email cap too many emails send limit push to fans push notification phone notification notify fans buzz fans phones fan alerts followed team alerts opt in tournament plus channels post to site email recipients three channels',
      links: [
        { label: 'Communication', href: '../tournaments/communication' },
      ],
      content: (
        <>
          <p>Use <strong>Communication</strong> for tournament messages. A single message can go out on up to three channels at once: <strong>Post to site</strong> (adds it to the public News page), <strong>Email recipients</strong> (sends to registered teams), and <strong>Push to fans</strong> (a phone notification to fans who&rsquo;ve turned on alerts). Free Tournament supports basic all-team email — up to 100 recipients per message and 10 email announcements per day. Tournament Plus removes those limits and can target by division, registration status, payment status, selected teams, and contact role.</p>
          <p><strong>Push to fans (Tournament Plus).</strong> Turn on <strong>Push to fans</strong> to send a phone notification to everyone following a team in this tournament who has turned on alerts. Because tapping the notification opens the tournament&rsquo;s public <strong>News</strong> page, <strong>Post to site</strong> stays on automatically whenever you push. It&rsquo;s built for rain delays and urgent day-of updates — <strong>pin</strong> the post too and it also shows as the banner on the public Schedule. After sending, you&rsquo;ll see how many fans were reached (or &ldquo;no fans have alerts on yet&rdquo; if nobody has opted in). On the free plan this option is locked.</p>
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
          answerText: 'If games are actually moving or being cancelled, use Tools then Rain delay on the Schedule page (a Tournament Plus tool) — pick the day, and it re-times that day and hands you a ready-to-send notice in one flow. If you are on the free plan, or you just need to get the word out without changing game times, post a message and pin it: a pinned site post stays at the top of the News page and, while the tournament is live, also shows as a banner at the top of the public Schedule page. On Tournament Plus you can also turn on Push to fans to send a phone notification at the same time. Unpin it once the situation clears.',
          keywords: ['rain delay', 'urgent update', 'game day', 'schedule banner', 'pin announcement', 'day-of', 'push to fans', 'notify fans', 'shift the day', 'move games', 'tools menu', 'tournament plus'],
          popular: true,
          answer: (
            <>
              <p><strong>If games are actually moving or being cancelled,</strong> start with <strong>Tools ▾ → Rain delay</strong> on the <strong>Schedule</strong> page — pick the day and it re-times that day, then hands you a ready-to-send notice in one flow (see &ldquo;How do I move or cancel a whole day of games at once&rdquo;). Rain delay is a <strong>Tournament Plus</strong> tool; on the free plan — or when you just need to get the word out <em>without</em> changing game times — use the steps below instead.</p>
              <p>Open <strong>Communication</strong>, write the update, keep <strong>Post to site</strong> on, and turn on <strong>Pin</strong>. While the tournament is live, a pinned site post appears as a banner at the top of the public <strong>Schedule</strong> (and stays pinned at the top of <strong>News</strong>). It&rsquo;s the fastest way to reach fans already watching the schedule for a rain delay, a diamond change, or a start-time push.</p>
              <p>On <strong>Tournament Plus</strong>, also turn on <strong>Push to fans</strong> to buzz the phones of fans who&rsquo;ve enabled alerts — the fastest way to reach people who aren&rsquo;t looking at the schedule right then.</p>
              <p><strong>Unpin</strong> it once the situation clears so the banner stays reserved for things that matter in the moment.</p>
            </>
          ),
        },
        {
          id: 'faq-push-to-fans',
          question: 'Can I send a push notification to fans?',
          answerText: 'Yes, on Tournament Plus and higher. Turn on "Push to fans" when posting a message to send a phone notification to everyone following a team in this tournament who has turned on alerts. It requires "Post to site" because the notification opens the public News page, and it is ideal for rain delays and day-of updates. Fans opt in themselves by following a team, signing in with a free account, and enabling alerts, so early on you may see "no fans have alerts on yet." On the free plan the option is locked.',
          keywords: ['push', 'push notification', 'push to fans', 'notify fans', 'phone alert', 'fan alerts', 'buzz phone', 'opt in'],
          popular: true,
          answer: (
            <>
              <p><strong>Yes — on Tournament Plus and higher.</strong> When you write a message, turn on <strong>Push to fans</strong> to send a phone notification to everyone following a team in this tournament who has turned on alerts. Because the notification opens the tournament&rsquo;s public <strong>News</strong> page, <strong>Post to site</strong> stays on whenever you push.</p>
              <p>It&rsquo;s ideal for rain delays and urgent day-of updates — pin the post and it also appears as the banner on the public <strong>Schedule</strong>. Fans opt in themselves by following a team, signing in, and turning on alerts, so early in an event you may see &ldquo;no fans have alerts on yet.&rdquo; On the free plan this option is locked.</p>
            </>
          ),
        },
      ],
    },

    {
      id: 'tournament-chat',
      group: 'Communicate & Publish',
      heading: 'Chat with your coaches',
      summary: 'A live group chat with every coach in your tournament — plus optional division "rooms" (channels) for big events — instead of one-way email blasts.',
      keywords: ['chat', 'tournament chat', 'coach chat', 'group chat', 'message coaches', 'live chat', 'rooms', 'division rooms', 'channels', 'all coaches room', 'new room', 'create room', 'switch rooms', 'manage room', 'rename room', 'delete room', 'close room', 'members', 'manage chat', 'manage panel', 'mute', 'remove message', 'delete message', 'delete own message', 'message removed', 'not yet joined', 'moderation', 'unread', 'reply', 'quote', 'mention', '@mention', 'emoji', 'react', 'search messages', 'pinned messages', 'pin message', 'unpin', 'read by', 'read receipt', 'last seen', 'coach sign-ups', 'coaches signed up', 'remind teams to sign up', 'chat adoption', 'sign-up tracker'],
      searchText: 'tournament chat group chat live chat with coaches message all coaches conversation real time chat tab division rooms channels create a room new room name the room pick divisions room covers a division coaches join automatically all coaches room undeletable switch rooms rooms button manage room button rename room close room reopen read only delete room empty room only protect history open members manage panel manage chat roster not yet joined invite coach mute coach remove message delete message delete your own message message removed moderate moderation unread count in-app bell phone push notification Tournament Plus every participating coach free and paid stays readable after tournament reply quote a message jump to original mention @mention tag a coach mention reaches them even if muted emoji smiley react with emoji search recent messages magnifier read receipt sent read by 3 of 8 read by everyone last seen pinned message pin unpin schedule field map rules banner at top of room collapsible coach sign-ups coaches signed up how many coaches signed up dashboard coach sign-ups and chat panel remind teams to sign up remind coaches one click bulk reminder who has signed up in the chat not yet joined no coach email on file flagged fill the room chat adoption tracker',
      links: [
        { label: 'Chat', href: '../tournaments/chat' },
      ],
      content: (
        <>
          <p><strong>Chat</strong> gives you a live group conversation with every coach in your tournament — a real back-and-forth instead of one-way email blasts. Open the <strong>Chat</strong> tab on your tournament; every coach who has registered a team is already in the <strong>All coaches</strong> room, free and paid alike. They don&rsquo;t need a plan of their own — being in your tournament is enough. You&rsquo;ll see an <strong>unread count</strong> on the Chat menu, and new messages also reach you by in-app bell and phone notification — no email.</p>
          <p><strong>Split a big event into rooms (optional).</strong> A small tournament just uses the one <strong>All coaches</strong> room — nothing to set up. For a larger, multi-division event you can add <strong>rooms</strong> (think Slack-style channels) so coaches only see what&rsquo;s relevant — a U12 room, a Championship room, and so on. Tap <strong>Rooms</strong> at the left of the chat header to see the room list and tap <strong>New room</strong> to create one: give it a name and tick which <strong>division(s)</strong> it covers. That&rsquo;s the whole setup — <strong>membership fills itself in</strong>: every coach whose team is in a covered division joins automatically, and as new teams register into that division their coaches are added too. There are no invite lists to keep up to date. The <strong>All coaches</strong> room is always there as the everyone/announcements room and can&rsquo;t be deleted.</p>
          <p><strong>It works like a real chat app.</strong> Add an <strong>emoji</strong> from the smiley in the message box, <strong>reply</strong> to a specific message so your answer quotes it (tap the quote to jump back to the original), and type <strong>@</strong> to <strong>mention</strong> a coach by name — a mention reaches that coach directly, even if they&rsquo;ve turned general chat notifications off. The <strong>magnifier</strong> in the chat header <strong>searches</strong> the conversation; today it filters the recent messages on screen, with full-history search coming later. Under your own most recent message, a small receipt moves from <strong>Sent</strong> to <strong>Read by 3 of 8</strong> to <strong>Read by everyone</strong> as coaches catch up.</p>
          <p><strong>Manage a room from &ldquo;Manage room.&rdquo;</strong> Tap <strong>Manage room</strong> at the right of the chat header to open the management panel for whichever room is open. It lists everyone in that room — with each coach&rsquo;s <strong>last seen</strong> time — and under <strong>Not yet joined</strong> it shows the coaches who haven&rsquo;t signed in yet, so nobody is silently left out. Beside a not-yet-joined name, use <strong>Copy link</strong> or <strong>Email</strong> to send that coach the sign-in link; they join automatically the moment they sign in with their team&rsquo;s email.</p>
          <p><strong>Keeping it on track.</strong> From the <strong>Manage room</strong> panel you can <strong>mute</strong> a coach for up to 72 hours (they can still read, just not post). The same panel holds <strong>Room settings</strong>: <strong>rename</strong> a room you created, <strong>close</strong> it to make it read-only (and reopen it any time), or <strong>delete</strong> it. To protect the record, <strong>delete is only offered for an empty room</strong> (one with no messages) — once coaches have talked, you can close the room but not delete it, and the <strong>All coaches</strong> room can always be closed but never renamed or deleted. Any coach can <strong>delete a message they sent</strong> (it then reads &ldquo;Message removed&rdquo;); as the organizer you can also <strong>remove anyone&rsquo;s</strong> message using the remove control on the message itself. A muted coach can&rsquo;t delete. Conversations stay readable after the tournament wraps up, so the record is always there.</p>
          <p><strong>Pin what coaches keep asking for.</strong> Pin the schedule, the field map, the rules — any message — to a <strong>banner at the top of the room</strong>. Pin several at once; the banner collapses and expands, and a coach can tap any pinned item to jump straight to it. Pinning and unpinning are yours alone (from the controls on a message, beside <strong>remove</strong>) — coaches see the banner but can&rsquo;t change it.</p>
          <p><strong>Coaches need no setup.</strong> Each coach automatically sees the <strong>All coaches</strong> room plus any division room that covers their team, with the tournament&rsquo;s name shown beside each so several rooms are easy to tell apart. They never create or manage rooms — they just post, react, and vote.</p>
          <p>Chat — and everything in it — is included with <strong>Tournament Plus and above</strong>; these conversation tools add no extra cost. On the free Tournament plan the tab shows an upgrade option instead.</p>
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
          answerText: 'A coach joins the chat automatically once they sign in with the email on their team registration — there is no manual step to add them. To nudge them, you have two ways. One at a time: open Manage room at the top of the Chat tab, find the Not yet joined list, and use Copy link or Email beside a name to send that coach their sign-in link. All at once: your tournament dashboard has a Coach Sign-ups & Chat panel with a Remind teams to sign up button that emails every not-yet-joined team their sign-in link in one click. Coaches are placed into the All coaches room and any division room covering their team automatically.',
          keywords: ['not yet joined', 'coach missing from chat', 'invite coach to chat', 'add coach', 'coach sign in', 'manage room', 'members', 'remind teams to sign up', 'remind all coaches'],
          answer: (
            <>
              <p>A coach joins automatically the moment they sign in with their team&rsquo;s email — there&rsquo;s no manual step to add them. They&rsquo;re placed into the <strong>All coaches</strong> room and into any division room that covers their team. If someone&rsquo;s missing, they just haven&rsquo;t signed in yet — and you can nudge them two ways.</p>
              <p><strong>One at a time:</strong> tap <strong>Manage room</strong> at the top of the Chat tab, look under <strong>Not yet joined</strong>, and use <strong>Copy link</strong> or <strong>Email</strong> beside a name to send that coach their sign-in link.</p>
              <p><strong>All at once:</strong> on your tournament <strong>dashboard</strong>, the <strong>Coach Sign-ups &amp; Chat</strong> panel has a <strong>Remind teams to sign up</strong> button that emails every not-yet-joined team their sign-in link in a single click.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-signups',
          question: 'How do I see how many coaches have signed up — and remind the rest?',
          answerText: 'Your tournament dashboard has a Coach Sign-ups & Chat panel that tracks it for you: how many of your teams have a coach signed up for their portal, how many are in the chat, and how many have not yet joined. When teams are still missing, use Remind teams to sign up to email everyone who has not joined a link to set up their portal — in one click, instead of chasing them one at a time. Any teams with no coach email on file are flagged with a link straight to those teams on the Teams page, so you can add an email and try again. Signing up is what puts a coach in the chat, so this is also the fastest way to fill the room. On the free Tournament plan the panel shows the Tournament Plus upgrade instead.',
          keywords: ['coach sign-ups', 'coaches signed up', 'how many coaches signed up', 'remind teams to sign up', 'remind coaches to sign up', 'chat adoption', 'dashboard chat panel', 'coach sign-up tracker', 'who has signed up', 'no coach email', 'not yet joined', 'add coach email', 'missing email'],
          popular: true,
          answer: (
            <>
              <p>Your tournament <strong>dashboard</strong> has a <strong>Coach Sign-ups &amp; Chat</strong> panel that tracks it for you: how many of your teams have a coach <strong>signed up</strong> for their portal, how many are <strong>in the chat</strong>, and how many have <strong>not yet joined</strong>.</p>
              <p>When teams are still missing, use <strong>Remind teams to sign up</strong> to email everyone who hasn&rsquo;t joined a link to set up their portal — in one click, instead of chasing them one at a time. Any teams with <strong>no coach email on file</strong> are flagged with a link that jumps straight to those teams on the <strong>Teams</strong> page — open a team and add an email from there, then send the reminder again. Because signing up is what puts a coach in the chat, this is also the fastest way to fill the room.</p>
              <p>On the free Tournament plan the panel shows the Tournament Plus upgrade option instead.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-rooms',
          question: 'What are division rooms, and how do I create one?',
          answerText: 'A small tournament uses one All coaches room with no setup. For a big multi-division event you can add rooms (channels) so coaches only see what is relevant. Tap Rooms at the left of the chat header, then New room: name it and tick the division(s) it covers. Membership fills itself in — every coach whose team is in a covered division joins automatically, and new teams added to that division join later too, with no invite lists. A room can cover several divisions. The All coaches room is always present and can be closed but never deleted. You can rename or delete a room you created, but delete is only available while a room is empty (no messages) — once people have talked you can close it but not delete it, so the record is protected.',
          keywords: ['division rooms', 'channels', 'create a room', 'new room', 'rooms', 'all coaches room', 'rename room', 'delete room', 'switch rooms', 'split chat by division'],
          popular: true,
          answer: (
            <>
              <p>A small tournament just uses the single <strong>All coaches</strong> room — nothing to set up. For a bigger, multi-division event you can add <strong>rooms</strong> (channels) so coaches only see what&rsquo;s relevant to them.</p>
              <p>Tap <strong>Rooms</strong> at the left of the chat header, then <strong>New room</strong>: give it a name (e.g. &ldquo;U12 Coaches&rdquo; or &ldquo;Championship&rdquo;) and tick which <strong>division(s)</strong> it covers — a room can cover one division or several. That&rsquo;s it: <strong>membership fills itself in</strong>, adding every coach whose team is in a covered division, and adding new teams&rsquo; coaches as they register. There are no invite lists to maintain.</p>
              <p>The <strong>All coaches</strong> room is always there and can be closed but never deleted. For a room you created, use <strong>Manage room → Room settings</strong> to <strong>rename</strong>, <strong>close</strong>, or <strong>delete</strong> it — <strong>delete is only offered while the room is empty</strong> (no messages). Once coaches have posted, you can close the room but not delete it, so the conversation is never lost.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-moderate',
          question: 'How do I mute a coach, close a room, or remove a message?',
          answerText: 'Tap Manage room at the top of the Chat tab to open the management panel for the open room. Beside a coach, Mute stops them posting for up to 72 hours — they can still read. Under Room settings, Close room makes that room read-only for everyone and you can reopen it any time. To take down any message, use the remove control on the message itself. Coaches can delete their own messages too (the message then reads Message removed); a muted coach cannot. Rooms stay readable after the tournament finishes.',
          keywords: ['mute coach', 'close room', 'close chat', 'read only', 'remove message', 'delete message', 'delete own message', 'message removed', 'moderate chat', 'reopen room', 'manage room', 'room settings', 'manage chat'],
          answer: (
            <>
              <p>Tap <strong>Manage room</strong> at the top of the <strong>Chat</strong> tab to open the management panel for whichever room is open. Beside a coach, <strong>Mute</strong> stops them posting for up to 72 hours while still letting them read. Under <strong>Room settings</strong>, <strong>Close room</strong> makes that conversation read-only for everyone — you can <strong>reopen</strong> it at any time. To take down <strong>any</strong> message, use the <strong>remove</strong> control on the message itself.</p>
              <p>Coaches can also <strong>delete their own</strong> messages — a removed message reads &ldquo;Message removed&rdquo; for everyone. A muted coach can&rsquo;t delete. Rooms stay readable after the tournament finishes, so the record is always there.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-pin',
          question: 'Can I pin the schedule or rules to the top of the chat?',
          answerText: 'Yes. As the organizer you can pin any message — the schedule, a field map, the rules — to a banner at the top of the room. You can pin several at once, and the banner collapses and expands. Pin or unpin from the controls on a message, beside the remove control. Coaches see the pinned banner and can tap an item to jump to it, but they cannot pin or unpin.',
          keywords: ['pin message', 'pinned messages', 'unpin', 'pin schedule', 'pin rules', 'field map', 'banner', 'pin to top'],
          answer: (
            <>
              <p>Yes. As the organizer you can <strong>pin</strong> any message — the schedule, a field map, the rules — to a <strong>banner at the top of the room</strong>. Pin several at once; the banner collapses and expands so it never crowds the conversation. Pin or unpin from the controls on a message, beside the <strong>remove</strong> control.</p>
              <p>Coaches see the pinned banner and can tap an item to jump to it, but only an organizer can pin or unpin.</p>
            </>
          ),
        },
      ],
    },

    {
      id: 'public-site-preview',
      group: 'Communicate & Publish',
      heading: 'The public tournament site, fan following, and preview',
      summary: 'What teams and fans see online — following a team, the Following tab, score alerts, the home-screen app — and how to preview it.',
      keywords: ['public site', 'preview', 'public tournament page', 'teams see', 'public schedule', 'standings', 'follow a team', 'following tab', 'score alerts', 'add to home screen', 'install app', 'offline', 'playoff picture', 'playoffs are set', 'champions', 'champions page', 'champions crowned', 'final results'],
      searchText: 'public tournament site preview schedule standings results teams rules news registration public page what teams see preview site before activation fans follow a team my team score alerts push notification final alert add to home screen install the app home screen icon fan app works offline last scores branded icon iphone android consistent standings rank same rank everywhere team card team profile tie-breaker head-to-head app icon background colour color app name short name initials border branding playoff picture playoffs are set seeding summary bracket countdown home finished wrap-up playoff day schedule opens on playoffs stage automatically live tag running score automatically finished without marking complete shareable champions crowned champions page final results winners celebration recap top tier following tab my teams account follows cross tournament game day feed live now coming up recent result scores tab live board discover tab updated ago freshness fan signup from follow prompt keeps the follow create account nudge',
      links: [
        { label: 'Preview Site', href: '../tournaments/dashboard' },
      ],
      content: (
        <>
          <p>Use <strong>Preview Site</strong> from the tournament sidebar footer to inspect the public tournament experience before or after activation.</p>
          <p>The public tournament site can include registration, schedule, standings, results, teams, rules, resources, and news depending on tournament setup and status.</p>
          <p>Preview is always available to admins regardless of tournament status. Share the preview link internally to review the public experience before you activate.</p>
          <p><strong>Consistent standings.</strong> A team&rsquo;s rank is the same everywhere it appears — the standings table, the Teams page cards, and the team&rsquo;s own page all rank by your tie-breaker rules (head-to-head, then run differential, and so on). So a team that wins a tie on head-to-head shows the same position to every fan, on every screen.</p>
          <p><strong>Following a team.</strong> Fans can follow a team on the public site — no account needed — to get a personalized &ldquo;my team&rdquo; view: next game, live score, and current standing, front and centre. They can also sign in with a free account so their follows travel to every device — and a fan who creates that account right from the follow prompt keeps the team they just followed automatically and lands back on the page they were watching. Either way, the app&rsquo;s <strong>Following</strong> tab becomes a personal game-day feed — every team they follow, across every tournament, sorted into <strong>Live now</strong>, <strong>Coming up</strong>, and <strong>Recent</strong> results, with anything live always shown first. Following, live public scores, and the home-screen app are included on every plan.</p>
          <p><strong>Score alerts.</strong> On Tournament Plus and above, fans who follow a team and <strong>sign in with a free FieldLogicHQ account</strong> can turn on <strong>score alerts</strong> — a push notification when their team&rsquo;s game goes live and a &ldquo;Final&rdquo; when it ends. The setting lives under <strong>Account → Notifications</strong> and covers every team they follow, on every device they sign in on. Tapping an alert opens that game, and on a branded event the notification carries your tournament logo.</p>
          <p><strong>The playoff moment.</strong> When you set the playoff bracket, the public home page turns into a <strong>Playoffs</strong> view — a badge, a countdown to the first playoff game, and a link to a shareable <strong>Playoff Picture</strong> that lays out the seeding and the opening matchups. Fans with score alerts on also get a one-time &ldquo;Playoffs are set&rdquo; push. On playoff day itself, the public <strong>Schedule</strong> opens on the <strong>Playoffs</strong> stage automatically whenever the division has a playoff game live or scheduled that day — fans land on the games that matter without touching the toggle, and a game that&rsquo;s underway shows a running score with a LIVE tag (never a winner) until it&rsquo;s final.</p>
          <p><strong>The champions moment.</strong> When the whole playoffs finish and the champion is decided, the public home page switches to its <strong>finished wrap-up</strong> &mdash; the champions (every tier, including Gold and Silver) and the final standings, with the live &ldquo;next game&rdquo; sections retired. Fans with score alerts on also get a one-time &ldquo;Champions crowned&rdquo; push, and a shareable <strong>Champions</strong> page headlines the winning team and lists every tier&rsquo;s winner alongside the final standings. It all happens off the scores you already enter &mdash; there&rsquo;s no extra step, and you don&rsquo;t need to mark the tournament complete first.</p>
          <p><strong>Add to home screen (the fan app).</strong> Fans can add the tournament to their phone&rsquo;s home screen and open it like an app — straight to your event. On iPhone, alerts only work once the page has been added to the home screen (Apple&rsquo;s rule), so the alerts button there shows an &ldquo;add to home screen for alerts&rdquo; prompt first, with a one-time reminder after they install. On Tournament Plus events the home-screen icon and app name carry your tournament branding — you set the icon background colour and a short app name under <strong>Branding → App Icon</strong>; free events use the default FieldLogicHQ icon.</p>
          <p><strong>Works at the field.</strong> Once a fan has opened the tournament, the installed app keeps the last-loaded scores and schedule available on a weak or dropped signal and shows a tidy &ldquo;you&rsquo;re offline&rdquo; screen instead of a browser error.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-fan-score-alerts',
          question: 'Can fans get a notification when their team scores?',
          answerText: 'Yes, on Tournament Plus and above. A fan follows a team on the public site, signs in with a free FieldLogicHQ account, and turns on score alerts — a push when the game goes live and a Final when it ends. The setting lives under Account → Notifications, covers every team they follow, and works on every device they sign in on. Following, live public scores, and the home-screen app stay free on every plan and never need an account — alerts are what signing in gets you.',
          keywords: ['score alerts', 'fan alerts', 'push notification', 'follow a team', 'live score', 'Tournament Plus', 'sign in', 'fan account'],
          popular: true,
          answer: (
            <>
              <p>Yes — on <strong>Tournament Plus and above</strong>. A fan follows a team on the public tournament site, <strong>signs in with a free FieldLogicHQ account</strong>, and taps <strong>Get score alerts</strong>. They get a push when that team&rsquo;s game goes live and a &ldquo;Final&rdquo; when it ends. The setting lives under <strong>Account → Notifications</strong>, covers every team they follow, and works on every device they sign in on.</p>
              <p>Following a team, live public scores, and adding the FieldLogicHQ app to the home screen are included on <strong>every plan</strong> and never need an account — <strong>alerts are what signing in gets you</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-following-tab',
          question: 'What does a fan&rsquo;s Following tab show?',
          answerText: 'The Following tab in the FieldLogicHQ app is a fan’s personal game-day feed — every team they follow, across every tournament, in one place. Teams are grouped into Live now (score, always shown first), Coming up (next game time and field), and Recent (latest result). While a game is live the feed keeps itself fresh and shows a quiet "updated Xs ago" beside Live now. A team with nothing scheduled yet shows a quiet "no games yet." This is separate from the Scores tab, which is a platform-wide live board of every tournament underway right now, not just the fan’s own teams.',
          keywords: ['following tab', 'my teams', 'live now', 'coming up', 'recent result', 'game-day feed', 'scores tab', 'account follows', 'cross tournament', 'updated ago', 'refresh'],
          popular: true,
          answer: (
            <>
              <p>The <strong>Following</strong> tab in the FieldLogicHQ app is a fan&rsquo;s personal game-day feed — every team they follow, across every tournament, in one place. Teams are grouped into <strong>Live now</strong> (score, always shown first), <strong>Coming up</strong> (next game time and field), and <strong>Recent</strong> (latest result). While a game is live the feed keeps itself fresh — a quiet &ldquo;updated Xs ago&rdquo; beside <strong>Live now</strong> shows how current the scores are. A team with nothing scheduled yet shows a quiet &ldquo;no games yet.&rdquo;</p>
              <p>This is separate from the <strong>Scores</strong> tab, which is a platform-wide live board of every tournament underway right now — not just the fan&rsquo;s own teams. Following is personal; Scores is discovery.</p>
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
              <p>Once a fan adds it to their home screen from the tournament page and opens it from there, the <strong>Get score alerts</strong> button works normally, with a one-time reminder to switch alerts on. Android shows the alerts button directly — no install step needed.</p>
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
      keywords: ['closeout', 'complete tournament', 'mark complete', 'ready to finalize', 'finalize tournament', 'archive', 'seal', 'final results', 'completed', 'archived', 'sealed'],
      searchText: 'closeout tournament complete mark complete mark tournament complete ready to finalize finalize dashboard prompt lock results read-only reopen archive seal final results post-event summary free tournament slot immutable snapshot board report results email lifecycle draft active completed archived sealed public page shows final results automatically without marking complete fans champions final standings wrap up next on the schedule do i need to mark complete round robin',
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
          <p>Once every game is in, your tournament <strong>dashboard</strong> shows a <strong>You&rsquo;re ready to finalize</strong> prompt with a one-click <strong>Mark tournament complete</strong> — so you can close out right from the dashboard. You can also change the status from <strong>Event Settings</strong> or <strong>Manage Tournaments</strong>.</p>
          <p>Marking a tournament complete locks it: registrations close and all event data — scores, standings, schedules, divisions, and registrations — becomes read-only and final. You can reopen it any time by setting the status back to <strong>Active</strong>.</p>
          <p>Your public tournament page shows its <strong>finished wrap-up</strong> — the champions and final standings — on its own once the games are done, so completing is about locking your records, not about what fans see.</p>
          <p>Close-out steps:</p>
          <ol>
            <li>Confirm all scores, standings, and playoff results are complete.</li>
            <li>Mark the tournament <strong>Completed</strong> — from the dashboard&rsquo;s finalize prompt, <strong>Event Settings</strong>, or <strong>Manage Tournaments</strong>.</li>
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
          id: 'faq-public-final-results-automatic',
          question: 'Do I have to mark the tournament complete for fans to see the final results?',
          answerText: 'No. Your public tournament page switches to its finished wrap-up on its own once the games are done — the champion has been decided, or every game in a round-robin event has been played. It brings up the champions (every tier, including Gold and Silver), the final standings recap, and drops the "next on the schedule" section. Marking the tournament Completed is an optional admin step that locks the scores and standings and keeps the event for your records — it is not required for fans to see the final results. If you use the optional post-event results email, that still sends when you mark the tournament Completed.',
          keywords: ['public page', 'final results', 'mark complete', 'do i need to mark complete', 'fans', 'champions', 'final standings', 'wrap up', 'automatic', 'next on the schedule'],
          popular: true,
          answer: (
            <>
              <p><strong>No.</strong> Your public tournament page switches to its <strong>finished wrap-up</strong> on its own once the games are done — when the champion has been decided, or every game in a round-robin event has been played. It brings up the <strong>champions</strong> (every tier, including Gold and Silver), the <strong>final standings</strong> recap, and drops the &ldquo;next on the schedule&rdquo; section, so fans always see an accurate finish.</p>
              <p>Marking the tournament <strong>Completed</strong> is an optional admin step &mdash; it locks the scores and standings and keeps the event for your records. It is <strong>not</strong> required for fans to see the final results. If you use the optional post-event results email, that still sends when you mark the tournament <strong>Completed</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-where-mark-complete',
          question: 'Where do I mark a tournament complete?',
          answerText: 'When every game is scored, the tournament dashboard shows a "You\'re ready to finalize" prompt with a one-click Mark tournament complete button. You can also change the status from Event Settings or Manage Tournaments. Completing locks the results; reopen any time by setting the status back to Active.',
          keywords: ['mark complete', 'ready to finalize', 'finalize tournament', 'close out', 'dashboard prompt', 'lock results'],
          popular: true,
          answer: (
            <p>When every game is scored, your tournament <strong>dashboard</strong> shows a <strong>You&rsquo;re ready to finalize</strong> prompt with a one-click <strong>Mark tournament complete</strong>. You can also change the status from <strong>Event Settings</strong> or <strong>Manage Tournaments</strong>. Completing locks the results and standings as final; reopen any time by setting the status back to <strong>Active</strong>.</p>
          ),
        },
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
