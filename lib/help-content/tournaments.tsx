import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef, HelpSteps, HelpNote } from '@/components/help/HelpBlocks';

const tournamentsHelp: HelpPageContent = {
  title: 'Tournaments',
  role: 'Admin, Owner',
  searchPlaceholder: 'Search tournament help',
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
      keywords: ['start', 'setup order', 'first tournament', 'draft', 'publish', 'tournament style', 'exhibition', 'bracket only'],
      searchText: 'create tournament draft dates URL slug divisions capacity venues contacts rules announcements scoring settings access branding preview activate registration public launch checklist round robin playoffs bracket only exhibition scrimmage day no playoffs tournament format schedule rules',
      links: [
        { label: 'Open Dashboard', href: '../tournaments/dashboard' },
        { label: 'Tournaments', href: '../tournaments/manage' },
      ],
      content: (
        <>
          <p>A tournament contains the public tournament site, divisions, team registrations, venues, schedule, scores, announcements, rules, contacts, and archive status.</p>
          <p>Recommended setup order:</p>
          <ol>
            <li>Create the tournament as a draft and pick its style &mdash; <strong>Round robin + playoffs</strong>, <strong>Bracket only</strong>, or <strong>Exhibition</strong> (games and standings, no bracket).</li>
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
          answerText: 'Open the tournament from the Tournaments list (it used to be called Manage Tournaments) and tap Activate under Status, or use the Activate button on its dashboard. It asks first, then the public site goes online. A tournament needs its dates, at least one division, and a public contact before it can be activated; until then its record says what to add first.',
          keywords: ['publish', 'activate', 'go live', 'registration open', 'Tournaments list', 'Manage Tournaments', 'event record'],
          popular: true,
          answer: (
            <p>Open <strong>Tournaments</strong>, tap the tournament to open its record, and tap <strong>Activate</strong> under <strong>Status</strong> &mdash; it asks first, then the public site goes online. You can also activate from the tournament&rsquo;s dashboard. Activation needs its dates, at least one division, and a public contact (a selected contact member or a contact email); until those are in, the record says what to add first.</p>
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
      keywords: ['new tournament', 'edit tournament', 'slug', 'dates', 'launch checklist', 'open registration', 'activate tournament', 'public form', 'division open', 'live preview', 'preview public page'],
      searchText: 'new tournament name year slug URL public link dates draft active status activation checklist tournament slot limit open team registration activate public registration form accepted teams capacity fees contact live preview phone preview public page preview while typing side by side desktop wide window countdown first pitch days to go missing preview no preview tournament colours colors theme presets swatches pick colour while creating Tournament Plus manage branding permission manage tournaments tournaments list new tournament sidebar event record',
      links: [
        { label: 'Tournaments', href: '../tournaments/manage' },
        { label: 'Dashboard Checklist', href: '../tournaments/dashboard' },
        { label: 'Divisions', href: '../tournaments/divisions' },
      ],
      content: (
        <>
          <p>Tap <strong>New tournament</strong> on the <strong>Tournaments</strong> list or in the sidebar. The setup wizard saves the tournament as a draft so you can finish the details before anything appears publicly.</p>
          <p>The <strong>URL slug</strong> is used in every public tournament link. Choose it carefully — changing it later can break links already shared by email, social media, or team communications.</p>
        </>
      ),
      subtopics: [
        {
          id: 'create-live-preview',
          title: 'The live preview, and starting from last year',
          content: (
            <>
              <p>On a wide desktop window, a live preview of your public tournament page sits beside the form. The event name, the date range, the countdown to first pitch, and the public link appear in it as you type, and the division and team-spot counts fill in once you reach the divisions step. Nothing is published until you activate the tournament. On narrower screens the wizard fills the window and the preview is not shown.</p>
              <p>On Tournament Plus and above, a row of colour presets sits above the preview. It starts on the colours this event would publish in anyway, and choosing one repaints the preview and gives the new tournament those colours. Leave it alone and the event keeps following your organization&rsquo;s colours, so a later rebrand still reaches it. Full colour control, including custom colours, stays in <strong>Branding</strong> under tournament settings.</p>
              <p>For repeat events, Tournament Plus can start the draft from a previous tournament so divisions, locations, registration setup, public settings, and content are ready for review.</p>
            </>
          ),
        },
        {
          id: 'create-opening-registration',
          title: 'Opening team registration',
          content: (
            <>
              <p>The dashboard launch checklist shows what is still required before activation. When every required item is complete:</p>
              <HelpSteps>
                <li>Finish the launch checklist: dates, public contact, divisions, and required public information.</li>
                <li>Open <strong>Divisions</strong> and confirm at least one division is accepting registrations.</li>
                <li>Review capacities, fees, and custom registration questions before sharing the link.</li>
                <li>Open the tournament from the <strong>Tournaments</strong> list and tap <strong>Activate</strong> in its record.</li>
                <li>Open the public registration page and submit a quick internal test if your workflow allows it.</li>
                <li>Share the public registration link with teams only after the form shows the right divisions and fees.</li>
              </HelpSteps>
              <p>If registration is not visible, check the tournament status and division registration settings first.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-creation-live-preview',
          question: 'Why can I not see the live preview next to the setup wizard?',
          answerText: 'The live preview of your public page needs a wide desktop window (about 1280 pixels or more). On a laptop with a narrow window, a tablet, or a phone the setup wizard fills the screen and the preview is hidden. Widen the browser window to bring it back. Apart from the colour presets on Tournament Plus, the preview is display only, and its colours are the ones your public tournament pages already publish in.',
          keywords: ['live preview', 'preview missing', 'no preview', 'phone preview', 'window width', 'desktop'],
          answer: (
            <>
              <p>The preview needs the width to sit beside the form, so it appears on desktop windows of roughly 1280 pixels or more. On a narrow window, a tablet, or a phone the wizard fills the screen and the preview is hidden — widen the browser window to bring it back. Nothing else about setup changes either way.</p>
              <p>Apart from the colour presets (Tournament Plus and above), the preview is display only. Its colours are the ones your public tournament pages already publish in: organizations on plans that include custom tournament branding see their own colours, and everyone else sees the FieldLogicHQ default.</p>
            </>
          ),
        },
        {
          id: 'faq-wizard-theme-swatches',
          question: 'Can I choose my tournament colours while creating it?',
          answerText: 'On Tournament Plus and above, a row of colour presets sits above the live preview in the setup wizard. Choosing one repaints the preview and creates the tournament with those colours. Leaving it alone means the event follows your organization colours, so a later organization rebrand still reaches it. Custom colours beyond the presets, logos, and banners stay in Branding under tournament settings. Members need the manage branding permission to see the row.',
          keywords: ['tournament colours', 'colors', 'theme', 'presets', 'swatches', 'branding', 'wizard'],
          answer: (
            <>
              <p>Yes, on Tournament Plus and above. A row of colour presets sits above the live preview while you create the tournament — choose one and the preview repaints, and the new tournament is created with those colours.</p>
              <p>Leave it alone and the event simply follows your organization&rsquo;s colours, which means a later organization rebrand still reaches it. Choosing a colour is what gives an event an identity of its own. Custom colours beyond the nine presets, plus logos and banners, live in <strong>Branding</strong> under tournament settings. Members need the manage-branding permission to see the row.</p>
            </>
          ),
        },
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
      keywords: ['reuse setup', 'reuse this setup', 'repeat tournament', 'next year', 'previous tournament', 'Tournament Plus', 'clone', 'live preview', 'create the draft'],
      searchText: 'reuse setup reuse this setup previous tournament repeat event next year copy clone Tournament Plus draft create the draft bring forward what to bring forward finished dashboard past tournaments summary event record new tournament divisions pools slots venues locations registration questions fees branding public pages rules resources welcome never copied teams registrations waitlists games scores standings champions payments uploaded files private notes live preview public page preview prefilled draft created from',
      links: [
        { label: 'Tournaments', href: '../tournaments/manage' },
        { label: 'Dashboard', href: '../tournaments/dashboard' },
        { label: 'Plan & billing', href: '../tournaments/settings/subscription' },
      ],
      content: (
        <>
          <p>On Tournament Plus and above, next year&rsquo;s event starts from this year&rsquo;s setup in one step. <strong>Reuse this setup</strong> is on a finished tournament&rsquo;s dashboard, its <strong>Summary</strong>, and its record, and a completed tournament&rsquo;s row on the <strong>Tournaments</strong> list carries <strong>Reuse setup</strong>. You can also choose <strong>Reuse a previous tournament setup</strong> when you start a <strong>New tournament</strong>, or fill a draft from an earlier event with the reuse prompt on the draft&rsquo;s dashboard.</p>
          <HelpSteps>
            <li>Tap <strong>Reuse this setup</strong>. The new draft&rsquo;s name and public link are filled in for you, a year on, and every area is already chosen.</li>
            <li>Enter the new dates.</li>
            <li>Under <strong>What to bring forward</strong>, clear any area you want to set up fresh.</li>
            <li>Tap <strong>Create the draft</strong>. You land on the new draft&rsquo;s dashboard, with a note saying which event it came from.</li>
          </HelpSteps>
          <p>The new tournament stays private as a draft until you activate it. The window lists what to check under <strong>Review before you publish</strong>: dates, fees, registration questions, public page visibility, rules, and welcome content.</p>
          <p>On a wide desktop window, the live preview of the public page arrives already filled in with the new name and dates, so you can check how the returning event reads before creating the draft. When <strong>Public presence</strong> is among the areas being reused, the preview also shows the colours carried over from that event; on Tournament Plus you can pick a different preset above the preview, and your choice replaces the copied colours.</p>
          <p>The five areas you can bring forward:</p>
          <ul>
            <li><strong>Event structure</strong> — divisions, pools, and empty schedule slots.</li>
            <li><strong>Locations</strong> — venues and playing surfaces.</li>
            <li><strong>Registration setup</strong> — registration questions and fees.</li>
            <li><strong>Public presence</strong> — branding and public page settings.</li>
            <li><strong>Content</strong> — rules, resources, and welcome content.</li>
          </ul>
          <p>Teams, registrations, waitlists, games, scores, standings, champions, payment status, reminders, uploaded files, message history, and private admin notes stay with the event you reused &mdash; they are never copied.</p>
          <p>Reusing a setup is on Tournament Plus, League Plus, and Club; on the Tournament plan each door shows a lock line instead.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-reuse-previous-tournament-setup',
          question: 'Can I reuse a previous tournament setup?',
          answerText: 'Yes, on Tournament Plus and above. Tap Reuse this setup on a finished tournament’s dashboard, its Summary, or its record, or Reuse setup on its row in the Tournaments list. Enter the new dates, choose what to bring forward, and tap Create the draft. You can also reuse a previous setup when you start a New tournament. Teams, results, payments, files, and history stay behind.',
          keywords: ['reuse setup', 'reuse this setup', 'previous tournament', 'next year', 'clone', 'Tournament Plus', 'create the draft'],
          popular: true,
          answer: (
            <p>Yes, on Tournament Plus and above. Tap <strong>Reuse this setup</strong> on a finished tournament&rsquo;s dashboard, its <strong>Summary</strong>, or its record &mdash; or <strong>Reuse setup</strong> on its row in the <strong>Tournaments</strong> list. Enter the new dates, choose what to bring forward, and tap <strong>Create the draft</strong>. You can also reuse a previous setup when you start a <strong>New tournament</strong>.</p>
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
            <p>Check the new draft before publishing: event dates, division capacities, venues, registration questions, fee amounts, public page visibility, rules, resources, and welcome/news copy. The reuse window also lists what to check under <strong>Review before you publish</strong> &mdash; for example when the event you reused is still a draft or still active, or ran more than a year earlier.</p>
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
      keywords: ['division', 'capacity', 'pool', 'assign teams to pools', 'add teams to pools', 'move to pool', 'fees', 'payment', 'payment instructions', 'how to pay', 'delete division', 'remove division'],
      searchText: 'divisions capacity waitlist pools user selects pool self-select assign teams to pools add teams to pools put teams in pools move to pool randomize unassigned pool view place teams fee schedule deposit total fee registration open closed per division tournament level payment instructions how to pay e-transfer acceptance email coaches portal registration form manual payment delete division remove division deleting a division deletes its games and scores and registered teams cannot be undone confirmation warning move teams first tournament locked completed',
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
        {
          id: 'faq-delete-division',
          question: 'What happens if I delete a division?',
          answerText: 'Deleting a division also deletes everything inside it — every game in that division, including any scores already recorded, and every team registered into it. It cannot be undone. If the division still holds games or teams, FieldLogicHQ stops and tells you exactly what is there ("this division still holds 12 games (8 with a recorded score) and 6 registered teams") so you can back out. You can move those teams and games to another division first, or confirm to delete everything together. Note this is the opposite of deleting a single team, which keeps that team\'s games. If the tournament is Completed and locked, deletion is blocked entirely until you reopen it from the Tournaments list.',
          keywords: ['delete division', 'remove division', 'delete a division', 'division deleted', 'lost games', 'lost scores', 'undo delete', 'accidentally deleted'],
          answer: (
            <>
              <p>Deleting a division also deletes <strong>everything inside it</strong> — every game in that division, including any scores already recorded, and every team registered into it. This cannot be undone.</p>
              <p>You won&rsquo;t do it by accident. If the division still holds games or teams, FieldLogicHQ stops and tells you exactly what&rsquo;s in there &mdash; for example &ldquo;this division still holds 12 games (8 with a recorded score) and 6 registered teams&rdquo; &mdash; so you can back out. Move those teams and games to another division first, or confirm to remove them together.</p>
              <p>This is the <strong>opposite</strong> of deleting a single team, which keeps that team&rsquo;s games (see <em>Review and accept teams</em>). If the tournament is <strong>Completed</strong> and locked, deletion is blocked entirely until you reopen it from the <strong>Tournaments</strong> list.</p>
            </>
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
      keywords: ['venues', 'fields', 'contacts', 'public contact', 'communication', 'news posts', 'rules', 'resources', 'no venues yet', 'venue library', 'import venues', 'venues set up late', 'link typed field names'],
      searchText: 'venues fields custom location contacts public contact email notifications communication news posts welcome message rules resources documents public site rename venue rename field rename diamond edit venue name field name updates everywhere live no venues set up yet create venues import from venue library league club somewhere else type it off-site set venues up late link typed field names to real records afterwards all games using one name renamed field follows linked games',
      links: [
        { label: 'Venues', href: '../tournaments/venues' },
        { label: 'Communications', href: '../tournaments/communication' },
        { label: 'Rules & Resources', href: '../tournaments/rules' },
      ],
      content: (
        <>
          <p>Add venues before building the schedule — a game&apos;s field is <strong>picked from your venues</strong>, and picked fields are what the double-booking check can protect. A typed location is still possible for genuinely off-site games (choose <strong>Somewhere else (type it)</strong> in the field picker), but typed locations aren&apos;t checked for double-bookings.</p>
          <p>If you try to schedule before any venues exist, the field picker asks you to set them up first. On <strong>League and Club plans</strong> it offers <strong>Import from your Venue Library</strong> — your club&apos;s own field list — so you define locations once and pull them into each event; other plans create venues directly. You can still choose to type a location anyway.</p>
          <p><strong>Set your venues up late?</strong> Games that already have a field name typed into them can be linked to the real records afterwards, all the games using one name at a time — the Schedule page offers this whenever it finds typed locations. Worth doing: a linked game follows the field when you rename it, and it can be checked for double-bookings.</p>
          <p>The public contact is the name and email teams see for tournament questions. Choose a contact from your organization members on the <strong>Contacts</strong> page inside tournament admin. If no tournament-specific contact is set, FieldLogicHQ may fall back to the organization contact where available.</p>
          <p>Use <strong>Communications</strong> to publish news posts and send email updates to teams. Rules and resources are for durable documents and tournament policies.</p>
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
      keywords: ['settings', 'branding', 'scoring', 'plan & billing', 'billing', 'subscription', 'members', 'access', 'scorekeepers', 'tie-breaker', 'game timing', 'app icon', 'public directory', 'discover tournaments', 'notifications', 'notification settings', 'mute tournament', 'my notifications'],
      searchText: 'built on fieldlogichq credit footer credit powered by badge platform name on my public page remove branding white label turn off the credit paid plan credit quiet line at the bottom settings access members branding logo hero banner scoring finalization plan and billing subscription plan tournament settings scorekeeper score finalization role members permissions public appearance tie-breaker tiebreaker ranking standings head to head run differential coin toss game timing game length duration buffer turnaround app icon home screen icon icon background colour color border app name custom short name initials add to home screen pwa icon logo size logo zoom resize logo make logo bigger smaller new installs public directory discover discovery list tournament publicly tournament directory find tournaments browse tournaments province region opt in listing my notification settings personal notifications manage notifications notification settings link in the bell mute one tournament mute all per tournament notifications mute only manage what you receive turn off notifications push email bell channels',
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
          <p><strong>Plan &amp; billing</strong> stays inside tournament admin for Tournament and Tournament Plus users, so upgrade prompts do not send tournament-only organizers into organization admin billing pages.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-built-on-credit',
          question: 'Why does my public tournament page say “Built on FieldLogicHQ”?',
          answerText: 'Paid plans (Tournament Plus and above) carry a small "Built on FieldLogicHQ" line at the very bottom of the public tournament page and the org home page. Only the name is a link. It is text-only — no badge, no banner, nothing for a visitor to dismiss — and it renders in your own theme colours so it stays quiet against your branding. It does not change or limit your branding: your logo, colours, hero banner, fonts, and app icon are all unaffected. Free Tournament events are different — they show a larger "Powered by FieldLogicHQ" badge plus a dismissible banner, and they do not get this line. There is no setting to turn the credit off.',
          keywords: ['built on fieldlogichq', 'credit', 'footer credit', 'powered by', 'branding', 'remove branding', 'white label', 'platform name on my page'],
          answer: (
            <>
              <p>On <strong>Tournament Plus and above</strong>, the very bottom of your public tournament page &mdash; and your organization&rsquo;s home page &mdash; carries a small line reading <strong>Built on FieldLogicHQ</strong>, where only the name is a link. It&rsquo;s text only: no badge, no banner, nothing for a visitor to dismiss, and it renders in your own theme colours so it stays quiet against your branding.</p>
              <p>It doesn&rsquo;t change or limit your branding. Your logo, colours, hero banner, fonts, and custom app icon are all unaffected &mdash; the credit sits below your content the way a printer&rsquo;s mark sits on the back of a programme.</p>
              <p><strong>Free Tournament events work differently</strong> and are unchanged: they carry the larger <strong>Powered by FieldLogicHQ</strong> badge and a dismissible banner instead, not this line. The two never appear together.</p>
              <p>There&rsquo;s no setting to turn the credit off.</p>
            </>
          ),
        },
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
          answerText: 'Use tournament branding settings for tournament-specific public appearance. On Tournament Plus you can also pick one of the colour presets while creating the tournament, in the setup wizard preview.',
          keywords: ['branding', 'logo', 'hero', 'public site', 'colours', 'presets'],
          answer: (
            <p>Yes. Use <strong>Branding</strong> under tournament settings when a tournament needs its own public identity separate from the default organization look. On Tournament Plus you can also pick one of the colour presets while you create the event, from the row above the setup wizard&rsquo;s live preview.</p>
          ),
        },
        {
          id: 'faq-public-directory',
          question: 'Is my tournament in the public directory, and how do I hide it?',
          answerText: 'Your tournament is listed in the public FieldLogicHQ directory by default, on every plan. To hide it, open Event Settings and turn off "List in public tournament directory". When it is listed, pick a province so people can find your event by region. The directory shows your event name, dates, sport, and live scores and links to your existing public pages — player information always stays private. A listed, live tournament also surfaces on the app-wide Scores tab, the live board every visitor sees. Listing also makes your event and its accepted teams findable in the app\'s Home search — a fan can search a team name and land on that team\'s page inside your event (team name and event only, never rosters or contacts). Your listing only appears once the tournament is Active or Completed; a draft stays hidden even while listed. Turn the toggle off any time to remove the tournament — and its teams — from the directory and search.',
          keywords: ['public directory', 'discover', 'discovery', 'list tournament', 'hide tournament', 'unlist tournament', 'remove from directory', 'listed by default', 'opt out', 'tournament directory', 'find tournaments', 'browse tournaments', 'public listing', 'province', 'region', 'scores tab', 'live board', 'team search', 'find teams', 'search for a team', 'home search'],
          answer: (
            <>
              <p>Your tournament is <strong>listed in the public tournament directory by default</strong>, on every plan — most events want to be found. To hide it, open <strong>Event Settings</strong> and turn off <strong>List in public tournament directory</strong>.</p>
              <p>While it&rsquo;s listed, pick a <strong>province</strong> so people can find your event by region. The directory shows your event name, dates, sport, and live scores and links to your existing public pages. <strong>Player information always stays private.</strong></p>
              <p>A listed tournament that&rsquo;s currently underway also surfaces on the app&rsquo;s <strong>Scores</strong> tab — on the platform-wide &ldquo;live right now&rdquo; board fans see there when they aren&rsquo;t already following teams of their own — so people can discover your event whether or not they follow it.</p>
              <p>Listing also makes your event and its <strong>accepted teams</strong> findable in the app&rsquo;s <strong>Home search</strong>: a fan can search a team by name and land on that team&rsquo;s page inside your event (team name and event only — never rosters or contacts). Hidden and private events never appear in search.</p>
              <p>Your listing only appears once the tournament is <strong>Active</strong> or <strong>Completed</strong> — a draft stays hidden even while listed. Turn the toggle off any time to remove the tournament — and its teams — from the directory and search.</p>
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
          answerText: 'Tournament Plus can send accepted team contacts one post-event email with public standings, schedule, and teams links. Turn on the post-event results notification in Event Settings. It sends once, the first time the tournament becomes Completed: when you mark it complete, or when you bring back an archived tournament that never sent it. The question before either step says the email will go.',
          keywords: ['post-event email', 'results notification', 'completed tournament', 'Tournament Plus'],
          answer: (
            <p>Open <strong>Event Settings</strong> and enable the post-event results notification. The email sends once, the first time the tournament becomes Completed &mdash; when you mark it complete, or when you bring back an archived tournament that never sent it &mdash; and the question before either step says the email will go. FieldLogicHQ records that it was sent, so it is not resent by accident.</p>
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
          answerText: 'Your personal notification settings live on one page, opened from the gear in the bell’s drawer (on a phone: More, then Account, then Notification settings) — a card per organization (and any team you coach), each with bell, push, and email switches per kind of event, plus your phones in one place. The per-tournament Notifications screen under a tournament\'s settings is now mute-only: it silences that one tournament for you (Mute all, or event by event) and can only mute — org settings decide what you actually receive, and a tournament can never turn a channel back on. Use its "Manage what you receive" link to jump to your full settings.',
          keywords: ['notification settings', 'my notifications', 'personal notifications', 'mute tournament', 'mute notifications', 'turn off notifications', 'per-tournament notifications', 'manage notifications', 'push settings', 'email notifications', 'stop notifications for a tournament', 'notification preferences'],
          answer: (
            <>
              <p>Your <strong>personal notification settings</strong> live on one page — open <strong>Notification settings</strong> from the <strong>gear</strong> in the <strong>bell</strong>&rsquo;s drawer (on a phone: <strong>More</strong> › <strong>Account</strong> › <strong>Notification settings</strong>). It shows a card for each organization (and any team you coach), each with <strong>bell</strong>, <strong>push</strong>, and <strong>email</strong> switches per kind of event, plus your phones managed in one place.</p>
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
      keywords: ['registrations', 'open registration', 'close registration', 'reopen registration', 'registration open', 'registration closed', 'public form', 'teams register', 'spots left', 'division full'],
      searchText: 'open close registration reopen registration teams public form active draft division open closed capacity spots full spots left no limit at a glance registration open registration closed close registration from the teams page registration questions custom questions Tournament Plus',
      links: [
        { label: 'Divisions', href: '../tournaments/divisions' },
        { label: 'Teams', href: '../tournaments/registrations' },
        { label: 'Registration Questions', href: '../tournaments/settings/registration-fields' },
      ],
      content: (
        <>
          <p>Teams register through the public tournament registration form once the tournament is active and at least one division is open.</p>
          <p>To close registration for a division, open <strong>Teams</strong>, pick the division, and tap the <strong>Registration open</strong> row in the <strong>At a glance</strong> card: it says how full the division is (&ldquo;6 of 6 spots &middot; full&rdquo;) and offers <strong>Close registration</strong>. <strong>Reopen registration</strong> is in the same place. You can also do it from the <strong>Divisions</strong> page. The tournament can remain active with other divisions still open, or you can leave all divisions closed once the team list is final.</p>
          <p>The free Tournament plan supports standard registration fields, payment tracking, and waitlist collection. Tournament Plus adds custom registration questions, file collection, Excel/PDF exports, payment reminders, and waitlist promotion workflows.</p>
          <p>Use <strong>Registration Questions</strong> (under Settings &amp; Access, or <strong>Tools</strong> &rarr; <strong>Registration questions</strong> on the Teams page) when you need tournament-specific coach confirmations, dropdown answers, or uploaded documents. Submitted answers appear in each team&rsquo;s record, under <strong>Registration answers</strong>, and in registration exports.</p>
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
      summary: 'Accept, waitlist or reject teams, one division at a time, and track what each team has paid.',
      keywords: ['review teams', 'approve registration', 'accept team', 'waitlist team', 'reject team', 'to review', 'pending', 'payment status', 'accepted teams', 'registration health', 'team record', 'delete team', 'remove team', 'delete registration', 'accepted needs a spot', 'promote', 'place'],
      searchText: 'review team registrations approve accept waitlist reject pending to review waiting for a decision pending chip accepted needs a spot open spot promote place team record previous next payment owes paid mark paid deposit paid paid in full schedule eligibility select many bulk actions registration health score health score missing email no email on file needs action capacity filled percent filled at a glance add team email edit team email link to rep team connect registration rep team recognize coach public page paid portal coaches portal delete team remove team delete a registration delete this team team has games confirmation warning games are kept blank side empty slot opponent score preserved cannot be undone tournament locked completed',
      links: [
        { label: 'Teams', href: '../tournaments/registrations' },
      ],
      content: (
        <>
          <p>Review teams while registration is open, so the schedule starts from a clean list of accepted teams. <strong>Teams</strong> opens on the first division with a team to review, and the division menu marks every division with teams waiting with an amber count. An amber dot on the menu means another division has teams waiting.</p>
          <ol>
            <li>Open <strong>Teams</strong> and pick the division.</li>
            <li>Teams waiting for a decision sit under <strong>To review</strong>. Tap <strong>Accept</strong> on the row, or tap the team to open its record first.</li>
            <li>In the record, check the coach, the team details and the registration answers, then choose <strong>Accept</strong> or <strong>Reject</strong>.</li>
            <li>Tap <strong>Next</strong> at the foot of the record to go straight to the next team.</li>
            <li>As payments arrive, open an accepted team and tap <strong>Mark paid</strong>, or enter the amounts under <strong>Deposit paid</strong> and <strong>Total paid</strong>.</li>
            <li>Before building the schedule, check that every team that should play is <strong>Accepted</strong>.</li>
          </ol>
          <p>In a division with pool spots, the list reads top to bottom: <strong>To review</strong>, then each pool with how full it is (&ldquo;Red Pool 3 of 3&rdquo;) and every spot in it, an open spot shown as its own row, the <strong>Waitlist</strong>, and <strong>Accepted &mdash; needs a spot</strong>. A team waiting for a decision that already holds a spot stays on it, marked <strong>Pending</strong>, with <strong>Accept</strong> beside it. A division without spots lists its teams by status.</p>
          <p>Only accepted teams appear in schedule assignment controls. If a team is missing from the schedule builder, check its status.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-registration-health-score',
          question: 'What does the Registration Health score tell me?',
          answerText: 'Registration health is the first row of the At a glance card on the Teams page. Closed, it shows a score out of 100 for every division and at most two things to fix, for example "Every division · 3 missing an email". Tap it to open four tiles — Teams, Missing email, Payments, and Needs action — and a list of specific issues. Each tile and issue is clickable and jumps straight to the matching filtered team list, so you go straight from "12 teams missing an email" to those exact 12 teams. The Payments tile requires Tournament Plus; on the free Tournament plan it shows a Plus badge instead of numbers. A full waitlist never lowers the score — it isn\'t a problem to fix.',
          keywords: ['registration health', 'health score', 'health card', 'at a glance', 'needs action', 'missing email tile', 'capacity filled', 'percent filled', '/100'],
          popular: true,
          answer: (
            <>
              <p><strong>Registration health</strong> is the first row of the <strong>At a glance</strong> card on the <strong>Teams</strong> page. Closed, it shows a score out of 100 for every division and at most two things to fix &mdash; for example &ldquo;Every division &middot; 3 missing an email&rdquo;. Tap it to open four tiles &mdash; <strong>Teams</strong>, <strong>Missing email</strong>, <strong>Payments</strong>, and <strong>Needs action</strong> &mdash; and a list of specific issues underneath.</p>
              <p>Every tile and issue is clickable and jumps straight to the matching teams &mdash; so &ldquo;3 missing an email&rdquo; takes you directly to those 3 teams instead of making you hunt through the full list. A line above the list says how many are in this division and how many more are in other divisions; <strong>Clear</strong> puts the full list back.</p>
              <p>The <strong>Payments</strong> tile needs <strong>Tournament Plus</strong> (it tracks unpaid and past-due fees); on the free Tournament plan it shows a small <strong>Plus</strong> badge instead of numbers. A full waitlist never counts against the score &mdash; it isn&rsquo;t something you need to fix.</p>
            </>
          ),
        },
        {
          id: 'faq-team-record',
          question: 'What’s in a team’s record?',
          answerText: 'Tap any team on the Teams page to open its record — full screen on a phone, a window at a desk. The team\'s name is the title, and beside it a chip says the team\'s status and where it sits. The record opens to read. To change anything, tap the pencil at the top: every section becomes fields at once, saving as you type, and the check in the same spot takes you back to reading. Accept, Reject, Mark paid and Resend the access link work either way. A team waiting for a decision shows Decision first; an accepted team shows Payment first. Then comes Team: the team name, coach and email (the address the coach signs in with), when it registered, Resend the access link, and on League and Club plans the Rep team line. Placement holds the Seed, and the Pool in a division with pools but no spots. Then Admin notes, which only admins see, and Registration answers. Delete this team… ends the record. Previous and Next at the foot move through the list without closing it and show your place, for example "3 of 8". Anything you have typed is saved before you move on or act.',
          keywords: ['team record', 'open a team', 'team details', 'rename team', 'edit team', 'change coach', 'change email', 'placement', 'admin notes', 'registration answers', 'resend the access link', 'seed', 'previous', 'next', 'saved', 'saves as you type'],
          answer: (
            <>
              <p>Tap any team on the <strong>Teams</strong> page to open its record &mdash; full screen on a phone, a window at a desk. The team&rsquo;s name is the title, and beside it a chip says the team&rsquo;s status and where it sits.</p>
              <p>The record opens to read. To change anything, tap the <strong>pencil</strong> at the top: every section becomes fields at once, saving as you type, and the <strong>check</strong> in the same spot takes you back to reading. Accept, Reject, Mark paid and Resend the access link work either way.</p>
              <ul>
                <li><strong>Decision</strong> comes first for a team waiting for one, with <strong>Accept</strong> and <strong>Reject</strong>; <strong>Payment</strong> comes first for an accepted team.</li>
                <li><strong>Team</strong> &mdash; the team name, coach and email (the address the coach signs in with), when it registered, <strong>Resend the access link</strong>, and on League and Club plans the <strong>Rep team</strong> line.</li>
                <li><strong>Placement</strong> &mdash; the Seed, and the Pool in a division with pools but no spots.</li>
                <li><strong>Admin notes</strong> (only admins see them), <strong>Registration answers</strong>, then <strong>Delete this team&hellip;</strong> at the end.</li>
              </ul>
              <p><strong>Previous</strong> and <strong>Next</strong> at the foot move through the list without closing it, and show your place (&ldquo;3 of 8&rdquo;). Anything you have typed is saved before you move on or act.</p>
            </>
          ),
        },
        {
          id: 'faq-add-team-manually',
          question: 'How do I add a team by hand — and what is the note under the email?',
          answerText: 'On the Teams page tap Add team. Type the team name, the coach and their email, pick the division and a payment status, and save — the team is accepted straight away. When you tab out of the email field the form tells you one of two things. "This coach is on FieldLogicHQ" means the address already belongs to a coach account: the Notify checkbox turns itself on, because that notification is how the coach accepts the entry — the moment they do, it appears in their Coaches Portal with the schedule, scores and status. You can turn the notification back off. The other note, "this email becomes their sign-in", means the address is new to the platform: notifying them creates their free Coaches Portal around this entry. There is no way to attach an entry to another club\'s team from your side, on purpose — a team joins a tournament only by its own coach registering or accepting. If you run the tournament from your own Coaches Portal, your own team has its own one-click door: Add my team.',
          keywords: ['add team', 'add team manually', 'add a team by hand', 'register a team for them', 'coach is on fieldlogichq', 'notify team', 'notification checkbox', 'email becomes their sign-in', 'this coach is on', 'attach to a team', 'search for a team', 'find a team on the platform', 'link a team', 'add my team'],
          answer: (
            <>
              <p>On the <strong>Teams</strong> page tap <strong>Add team</strong>. Type the team name, the coach and their email, pick the division and a payment status, and save &mdash; the team is accepted straight away.</p>
              <p>When you tab out of the <strong>Email</strong> field the form tells you one of two things:</p>
              <ul>
                <li><strong>&ldquo;This coach is on FieldLogicHQ&rdquo;</strong> &mdash; the address already belongs to a coach account. The <strong>Notify</strong> checkbox turns itself on, because that notification is how the coach <em>accepts</em> the entry: the moment they do, it appears in their Coaches Portal with the schedule, scores and status. You can turn the notification back off.</li>
                <li><strong>&ldquo;This email becomes their sign-in&rdquo;</strong> &mdash; the address is new to the platform. Notifying them creates their free Coaches Portal around this entry.</li>
              </ul>
              <p>There is no way to attach an entry to another club&rsquo;s team from your side, on purpose &mdash; a team joins a tournament only by its own coach registering or accepting. If you run the tournament from your own Coaches Portal, your own team has its own one-click door: <strong>Add my team</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-add-team-email',
          question: 'How do I add or fix a team\'s email address?',
          answerText: 'On the Teams page, tap the team to open its record, then tap the pencil at the top. Under Team, type the address in Email — it saves as you type, and "Saved" shows briefly at the foot of the record. A half-typed address is never saved: the record waits, saying "Enter a full email address to save it." To rename the team, change Team name in the same section. Tap the check when you\'re done. If Registration health or the dashboard flags teams with no email on file, tap that line to jump straight to the teams that need one.',
          keywords: ['add team email', 'edit team email', 'change team email', 'fix email', 'no email on file', 'missing email', 'coach email', 'rename team', 'edit team name', 'team details'],
          answer: (
            <>
              <p>On the <strong>Teams</strong> page, tap the team to open its record, then tap the pencil at the top. Under <strong>Team</strong>, type the address in <strong>Email</strong> &mdash; it saves as you type, and <strong>Saved</strong> shows briefly at the foot of the record. A half-typed address is never saved: the record waits, saying &ldquo;Enter a full email address to save it.&rdquo; To rename the team, change <strong>Team name</strong> in the same section. Tap the check when you&rsquo;re done.</p>
              <p>If <strong>Registration health</strong> or the dashboard&rsquo;s <strong>Coach Sign-ups &amp; Chat</strong> panel flags teams with no email on file, tap that line instead of searching &mdash; it jumps straight to the teams that need one.</p>
            </>
          ),
        },
        {
          id: 'faq-link-registration-rep-team',
          question: 'How do I connect a team’s registration to one of my rep teams?',
          answerText: 'On League and Club plans, open the team’s record on the Teams page and, in its Coach block, tap "Link to a rep team" on the Rep team line to attach it to one of your organization’s rep teams. Once linked, that team’s coaches are recognized as coaches on your public tournament pages — the flip pill in the top-right corner takes them straight to their coach view. Coaches whose email is already on the registration are recognized automatically, so you only need this when a team was registered under a shared office email. You can pick a different team or unlink at any time. You can only link to rep teams in your own organization.',
          keywords: ['link to rep team', 'link to a rep team', 'unlink rep team', 'rep team', 'connect registration', 'recognize coach', 'public page coach', 'rep coach recognition', 'paid portal coach'],
          answer: (
            <>
              <p>On <strong>League</strong> and <strong>Club</strong> plans, open the team&rsquo;s record on the <strong>Teams</strong> page and, in its <strong>Coach</strong> block, tap <strong>Link to a rep team</strong> on the <strong>Rep team</strong> line to attach it to one of your organization&rsquo;s rep teams. Once linked, that team&rsquo;s coaches are recognized as coaches on your <strong>public tournament pages</strong> &mdash; the <strong>flip pill</strong> in the top-right corner takes them straight to their team&rsquo;s <strong>tournament record</strong> for this event in their coach portal.</p>
              <p>Coaches whose email is already on the registration are recognized <em>automatically</em>, so you only need this when a team was registered under a shared office email that doesn&rsquo;t match any coach. You can pick a different team or <strong>unlink</strong> at any time. You can only link to rep teams in <strong>your own organization</strong>.</p>
            </>
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
          answerText: 'On the Teams page open Tools and choose Select many, tick the teams you want (Select visible ticks every team the list is showing), then choose Accept, Waitlist, Reject, Deposit paid, Paid in full, Send a reminder (Tournament Plus), or Move to pool where the division has pools. Accept, Waitlist, Reject and the payment marks ask before they change anything, and only the ticked teams change. Tap Done to leave.',
          keywords: ['bulk actions', 'select many', 'selected teams', 'select visible', 'approve', 'accept several', 'reject', 'waitlist', 'deposit paid', 'paid in full', 'send a reminder', 'move to pool'],
          answer: (
            <>
              <p>On the <strong>Teams</strong> page open <strong>Tools</strong> and choose <strong>Select many</strong>, then tick the teams you want &mdash; <strong>Select visible</strong> ticks every team the list is showing. Then choose <strong>Accept</strong>, <strong>Waitlist</strong>, <strong>Reject</strong>, <strong>Deposit paid</strong>, <strong>Paid in full</strong>, <strong>Send a reminder</strong> (Tournament Plus), or <strong>Move to pool</strong> where the division has pools.</p>
              <p>Accept, Waitlist, Reject and the payment marks ask before they change anything, and only the ticked teams change. Tap <strong>Done</strong> to leave.</p>
            </>
          ),
        },
        {
          id: 'faq-accept-reject-email',
          question: 'Does accepting or rejecting a team email the coach?',
          answerText: 'Yes, when that email is switched on. Accepting sends the Team accepted email and rejecting sends the Registration declined email, to the team\'s coach contact, or to the registration email when no coach contact is set. Both are on by default; turn either off, or pause all automatic coach emails, under Event settings → Coach Emails. A team with no email address gets no email. The Accept or Reject window tells you before you confirm: "An email will go to" the address, or "No email will go out" and why. A bulk accept or reject says how many of the selected teams will get one; a team already in that status gets none.',
          keywords: ['acceptance email', 'rejection email', 'decline email', 'does accepting email the coach', 'accept email', 'team accepted email', 'registration declined email', 'no email will go out', 'coach emails', 'automatic coach emails'],
          answer: (
            <>
              <p>Yes, when that email is switched on. Accepting sends the <strong>Team accepted</strong> email and rejecting sends the <strong>Registration declined</strong> email, to the team&rsquo;s coach contact (or the registration email when no coach contact is set). Both are on by default; turn either off, or pause all automatic coach emails, under <strong>Event settings &rarr; Coach Emails</strong>. A team with no email address gets no email.</p>
              <p>The Accept or Reject window tells you before you confirm: <em>&ldquo;An email will go to&rdquo;</em> the address, or <em>&ldquo;No email will go out&rdquo;</em> and why. A bulk accept or reject says how many of the selected teams will get one; a team that is already in that status gets none.</p>
            </>
          ),
        },
        {
          id: 'faq-delete-team-with-games',
          question: 'Can I delete a team that already has games?',
          answerText: 'Yes. Open the team\'s record and tap Delete this team… at the end. FieldLogicHQ checks first: if the team appears in any game, deleting is paused and you are told how many games it plays in and how many already have a recorded score — for example "this team appears in 6 games (4 with a recorded score)". You can back out, or confirm to continue. If you continue, those games are KEPT, not deleted: each one loses that one side and shows an empty slot where the team was, and the opponent\'s record and score are untouched. This is deliberate — a game belongs to both teams, so removing one team must never erase the other team\'s history. Tidy up by reassigning or removing those games from the schedule afterwards. Note this differs from deleting a whole division, which does remove its games and scores. If the tournament is Completed and locked, deletion is blocked until you reopen it from the Tournaments list.',
          keywords: ['delete team', 'remove team', 'delete registration', 'team has games', 'delete a team with games', 'blank team', 'empty slot in schedule', 'undo delete team'],
          answer: (
            <>
              <p>Yes. Open the team&rsquo;s record and tap <strong>Delete this team&hellip;</strong> at the end. FieldLogicHQ checks first: if the team appears in any game, deleting pauses and tells you what&rsquo;s at stake &mdash; for example &ldquo;this team appears in 6 games (4 with a recorded score).&rdquo; You can back out, or confirm to continue.</p>
              <p>If you continue, <strong>those games are kept, not deleted</strong>. Each one loses that one side and shows an empty slot where the team was, while the opponent&rsquo;s record and score stay exactly as they were. That&rsquo;s deliberate: a game belongs to <em>both</em> teams, so removing one team must never erase the other team&rsquo;s history. Tidy up by reassigning or removing those games in the schedule afterwards.</p>
              <p>This differs from deleting a whole <strong>division</strong>, which <em>does</em> remove its games and scores. If the tournament is <strong>Completed</strong> and locked, deletion is blocked until you reopen it from the Tournaments list.</p>
            </>
          ),
        },
        {
          id: 'faq-payment-status',
          question: 'Where do payment statuses come from?',
          answerText: 'Payment status is calculated from the tournament or division fee schedule and the amounts recorded for each accepted team. On the Teams page an accepted team reads Paid or Owes and the amount. Its record\'s Payment block states the facts, for example "Owes $475 · deposit due May 28 · balance due Jun 7", with Mark paid and the Deposit paid and Total paid amounts. On Tournament Plus, the Payments row in At a glance totals the division: what is in, what is left to collect, and what is past due.',
          keywords: ['payment status', 'deposit', 'paid', 'owes', 'past due', 'mark paid', 'deposit paid', 'total paid', 'to collect', 'all collected'],
          answer: (
            <>
              <p>Payment status is calculated from the tournament or division fee schedule and the amounts recorded for each accepted team. On the <strong>Teams</strong> page an accepted team reads <strong>Paid</strong> or <strong>Owes</strong> and the amount.</p>
              <p>Its record&rsquo;s <strong>Payment</strong> block states the facts &mdash; for example &ldquo;Owes $475 &middot; deposit due May 28 &middot; balance due Jun 7&rdquo; &mdash; with <strong>Mark paid</strong> and the <strong>Deposit paid</strong> and <strong>Total paid</strong> amounts. On <strong>Tournament Plus</strong>, the <strong>Payments</strong> row in <strong>At a glance</strong> totals the division: what is in, what is left to collect, and what is past due.</p>
            </>
          ),
        },
        {
          id: 'faq-waitlist-order',
          question: 'How is waitlist order preserved?',
          answerText: 'When a team joins or is moved to the waitlist, it gets the next place in its division\'s queue — the Waitlist band lists teams in that order (#1, #2…). When a spot opens, a waitlisted team\'s row offers Promote on Tournament Plus, and the rest of the queue closes the gap. On the Tournament plan, the team\'s record shows Promote from the waitlist as a Tournament Plus line instead. An accepted team without a spot sits under Accepted — needs a spot, and offers Place when a spot opens.',
          keywords: ['waitlist', 'queue', 'promotion', 'promote', 'place', 'position', 'accepted needs a spot', 'open spot'],
          answer: (
            <>
              <p>When a team joins or is moved to the waitlist, it gets the next place in its division&rsquo;s queue &mdash; the <strong>Waitlist</strong> band lists teams in that order (#1, #2&hellip;).</p>
              <p>When a spot opens, a waitlisted team&rsquo;s row offers <strong>Promote</strong> on <strong>Tournament Plus</strong>, and the rest of the queue closes the gap. On the Tournament plan, the team&rsquo;s record shows <strong>Promote from the waitlist</strong> as a Tournament Plus line instead. An accepted team without a spot sits under <strong>Accepted &mdash; needs a spot</strong>, and offers <strong>Place</strong> when a spot opens.</p>
            </>
          ),
        },
      ],
    },

    {
      id: 'assign-teams-to-pools',
      group: 'Teams & Registration',
      heading: 'Put teams into pools',
      summary: 'Place accepted teams into a division’s pools by hand, in batches, or all at once.',
      keywords: ['assign pools', 'add teams to pools', 'put teams in pools', 'move to pool', 'randomize pools', 'no pool yet', 'unassigned', 'pool assignment', 'swap teams', 'swap spots', 'pool spots'],
      searchText: 'assign teams to pools add teams to pools put teams in pools where do i add teams to pools move to pool randomize spread teams no pool yet unassigned group by pools group by status filter tools menu self-select pool place teams division pools pool a pool b spots open spot red team 2 swap two teams swap their places next open spot accepting places a team',
      links: [
        { label: 'Teams', href: '../tournaments/registrations' },
        { label: 'Divisions', href: '../tournaments/divisions' },
      ],
      content: (
        <>
          <p>Pools are created on the <strong>Divisions</strong> page &mdash; turn on <strong>Enable pools</strong> for the division and name them first. A division without pools lists its teams by status on the Teams page.</p>
          <p>Once pools exist, open the <strong>Teams</strong> page, choose the division, and under <strong>Filter</strong> group by <strong>Pools</strong>. Teams not yet placed sit under <strong>No pool yet</strong>, and every pool appears, even before it has any teams. There are three ways to place accepted teams:</p>
          <ul>
            <li><strong>One at a time</strong> &mdash; open the team, tap the pencil, and pick its <strong>Pool</strong> under <strong>Placement</strong>.</li>
            <li><strong>In batches</strong> &mdash; open <strong>Tools</strong> and choose <strong>Select many</strong>, tick the teams you want together, then choose <strong>Move to pool</strong>.</li>
            <li><strong>All at once</strong> &mdash; choose <strong>Randomize</strong> in <strong>Tools</strong> to spread every accepted team evenly across the pools, then adjust by hand.</li>
          </ul>
          <p>A division whose pools have numbered spots (&ldquo;Red Team 2&rdquo;) always shows its pools and every spot. Accepting a team places it in the next open spot. To move teams, open <strong>Tools</strong> and choose <strong>Swap</strong>, then tap two teams &mdash; or a team and an open spot &mdash; to swap their places; <strong>Randomize</strong>, also in Tools, shuffles the spots. A search or a filter shows only the teams that match, still under their pools; Swap comes back when every spot is showing again.</p>
          <p>This is how you assign pools when <strong>self-select pool</strong> is off for the division. With self-select on, teams choose their own pool as they register, and you only step in to make changes.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-where-add-teams-to-pools',
          question: 'Where do I add teams to pools?',
          answerText: 'On the Teams page, choose the division and, under Filter, group by Pools. Open a team, tap the pencil and pick its Pool under Placement; open Tools and choose Select many, then Move to pool, for several teams; or choose Randomize in Tools to spread all accepted teams across the pools. Pools must first be enabled and named on the Divisions page; grouping by Pools or Status only changes how the list is arranged, it does not create pools. In a division whose pools have numbered spots, accepting a team places it in the next open spot, and Swap, in Tools, moves teams between spots.',
          keywords: ['where add teams to pools', 'assign pool', 'move to pool', 'randomize', 'group by pools', 'pools view', 'no pool yet', 'unassigned', 'swap'],
          popular: true,
          answer: (
            <>
              <p>On the <strong>Teams</strong> page, pick the division and, under <strong>Filter</strong>, group by <strong>Pools</strong>. Then open a team, tap the pencil and pick its <strong>Pool</strong> under <strong>Placement</strong>; use <strong>Move to pool</strong> after ticking several teams in <strong>Select many</strong> (in <strong>Tools</strong>); or choose <strong>Randomize</strong> in Tools to spread them all at once.</p>
              <p>Grouping by <strong>Pools</strong> or <strong>Status</strong> only changes how the list is arranged &mdash; pools themselves are created on the <strong>Divisions</strong> page. In a division whose pools have numbered spots, accepting a team places it in the next open spot, and <strong>Swap</strong>, in Tools, moves teams between spots.</p>
            </>
          ),
        },
        {
          id: 'faq-only-unassigned-showing',
          question: 'Why do my teams show under No pool yet?',
          answerText: 'When you group by Pools, a team sits under No pool yet until you place it in a pool. Empty pools still appear so you can place teams into them. If the Pools grouping is missing, the division has no pools: enable and name them on the Divisions page first, then place teams on the Teams page.',
          keywords: ['no pool yet', 'unassigned', 'no pools', 'pools missing', 'teams not in pools', 'pools grouping missing'],
          answer: (
            <p>When you group by <strong>Pools</strong>, a team sits under <strong>No pool yet</strong> until you place it. Empty pools still appear so you can place teams into them. If the <strong>Pools</strong> grouping is missing, the division has no pools &mdash; open the <strong>Divisions</strong> page, enable pools for that division and name them, then come back to the Teams page and place teams.</p>
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
      keywords: ['build schedule', 'generate schedule', 'round robin', 'edit games', 'venues', 'auto-generate', 'adjust today', 'shift the day', 'rain delay', 'running late', 'tools menu', 'move all games', 'bulk reschedule', 'delay games', 'cancel games', 'division filter', 'venue filter', 'exhibition', 'scrimmage day', 'no playoffs', 'notify teams', 'schedule change notification', 'does editing a game notify', 'who gets told', 'edit game warning', 'unpublished schedule silent', 'one message per team', 'double-booked', 'double booking', 'conflict warning', 'buffer warning', 'field picker', 'somewhere else', 'off-site game', 'not being checked', 'no field set', 'schedule health', 'locations typed by hand', 'review locations', 'match typed locations', 'link typed field name', 'create field from name', 'leave as typed text'],
      searchText: 'build tournament schedule generate round robin auto-generate accepted teams venues time slots edit games cancel restore public schedule pools flat list timeline exhibition tournament scrimmage day no playoffs no bracket to build adjust today shift the day rain delay running late tools menu tournament plus running behind move push all remaining games back bulk reschedule delay cancel today games one step before after preview atomic filter by division venue field diamond editing a published game notifies the teams edit game dialog warning saving alerts followers who gets told coaches and families same message tournament plus reaches phones free plan nobody notified knowing is not the paid part unpublished division is silent build freely nobody has seen those times notes game length bracket wiring do not notify swapping a team into or out of a game is silent no true your game moved already started already played never notifies one message per team not one per game held a few minutes imminent game sent straight away reminder email refreshed stale first game time announcement replaces the automatic alert skip lets it send double-booked two games same field same time conflict warning buffer too close save blocked pick a field somewhere else type it off-site typed location not checked no field set unchecked schedule health score clear a field no diamond locations typed by hand review match typed locations link a typed field name to a real field one row per name exact match no match create field from typed name leave as typed text undo already linked change field for many games at once nobody notified tidy field names greyed out completed tournament dismiss notice',
      links: [
        { label: 'Schedule', href: '../tournaments/schedule' },
      ],
      content: (
        <>
          <p>Build the schedule after accepted teams, venues, and time slots are ready. There is no separate schedule publish step — saved schedule changes flow to the public tournament pages.</p>
        </>
      ),
      subtopics: [
        {
          id: 'schedule-build',
          title: 'Building the schedule',
          content: (
            <>
              <HelpSteps>
                <li>Open <strong>Schedule</strong>.</li>
                <li>Add games manually with <strong>Add Game</strong> for small events or special matchups. For an <strong>Exhibition</strong> event (no playoffs) this is the whole job &mdash; a scrimmage day is a handful of rows, and the page shows one list of games with no Playoffs stage.</li>
                <li>Use <strong>Auto-Generate</strong> for round-robin play (Tournament Plus, League Plus, Club). Accepted teams, division data, venues, and time-slot setup must be complete before generating.</li>
                <li>Preview generated games before saving.</li>
                <li>Edit individual games for field changes, rest gaps, weather adjustments, or custom matchups. Generated games are normal schedule records after they are saved.</li>
                <li>Use the public preview to confirm the schedule is readable for teams.</li>
              </HelpSteps>
              <p>Use <strong>pool view</strong> when a division is split into pools. Use <strong>flat view</strong> when you want one combined list.</p>
            </>
          ),
        },
        {
          id: 'schedule-fields',
          title: 'A game’s field is picked, not typed',
          content: (
            <>
              <p>Everywhere a game gets a location — the Add/Edit window, the inline row, the timeline, the bracket builder — you pick from the tournament&apos;s venues, and the displayed name (&ldquo;Lions Park — Diamond 2&rdquo;) is written for you from the venue itself.</p>
              <p>Two games on the same field at the same time are flagged before you save: a true overlap <strong>blocks the save</strong> and names the other game, its time, and the field; games merely too close together get a buffer warning you can save through.</p>
              <HelpNote variant="warning" title="Off-site games can’t be checked">Genuinely off-site games use <strong>Somewhere else (type it)</strong> — typed locations still warn when two games share the same typed name, but they can&apos;t be checked against your real fields, and the schedule health panel counts them (and games with no field at all) as <em>not being checked for double-bookings</em>.</HelpNote>
            </>
          ),
        },
        {
          id: 'schedule-link-typed-fields',
          title: 'Linking field names that were typed by hand',
          content: (
            <>
              <p>If games on this tournament name a field as plain text, the Schedule page shows a note — &ldquo;4 locations typed by hand&rdquo; — with a <strong>Review</strong> button. The panel lists one row per <em>name</em>, not per game, so &ldquo;Diamond 1&rdquo; is a single decision covering all 39 games that use it.</p>
              <p>Where a name matches one of your fields exactly it arrives already filled in and says <strong>Exact match</strong>; where it matches nothing you can <strong>create that field</strong> from the name, or <strong>leave it as typed text</strong> on purpose. Each row spells out the exact name your games will end up showing before you apply anything, nothing changes until you press <strong>Apply</strong>, and <strong>nobody is notified</strong> — tidying up your own records is not a schedule change.</p>
              <p>Close names are never guessed at: &ldquo;Field 1&rdquo; will not be offered as &ldquo;Diamond&nbsp;1&rdquo;, because a wrong guess would move real games to the wrong field. Games marked <strong>TBD</strong> and games still on the generator&apos;s temporary fields aren&apos;t listed — the first name no field at all, and the second belong to <strong>Resolve Temporary Facilities</strong>.</p>
            </>
          ),
        },
        {
          id: 'schedule-edit-notifications',
          title: 'Who gets told when you change a game',
          content: (
            <>
              <p><strong>Once a division&apos;s schedule is published, editing one of its games tells the teams.</strong> The Edit Game dialog says so before you save, and names who gets told. Change the date, time, or venue — or cancel a game, or put a cancelled one back on — and everyone following those two teams is notified: the coaches and the families, in the same message. On <strong>Tournament Plus</strong> that reaches their phones; on the free plan the dialog says plainly that nobody gets a notification, though the change still shows on the public schedule and in coaches&apos; portals.</p>
              <p>Three things deliberately stay quiet: editing a division whose schedule <strong>isn&apos;t published yet</strong> (nobody has been shown those times, so there is nothing to correct — build freely); edits that touch only <strong>notes, game length, or bracket wiring</strong>; and an edit that also <strong>swaps a team into or out of the game</strong>, because &ldquo;your game moved&rdquo; isn&apos;t a true thing to say to either the incoming or the outgoing team.</p>
              <HelpNote variant="tip" title="One message, not one per game">If you move several games in one sitting, each team gets <strong>one</strong> message covering all of theirs.</HelpNote>
            </>
          ),
        },
        {
          id: 'schedule-rain-delay',
          title: 'Rained out or running behind',
          content: (
            <>
              <p>Whenever the event has upcoming games, open <strong>Tools ▾ → Rain delay</strong> on the Schedule page. Pick a day (today or any upcoming day), optionally narrow to one division or venue, and it moves or cancels those games in one step — push them back 30 minutes, an hour, two hours, or a custom amount, and/or cancel a few — with a live before-and-after preview, then a ready-to-send notice so you update the schedule and tell everyone in one action.</p>
              <p>It applies all-or-nothing, leaves games that already have a result alone, and won&rsquo;t let a playoff game land before the games that feed it. <strong>Rain delay is a Tournament Plus tool</strong>; on the free plan you can still reschedule games one at a time and post a rain-delay banner (see the day-of question below).</p>
              <p>On game day, a <strong>Running late?</strong> card on the tournament dashboard opens this same window — it shows while the event still has games left to play today or later, so you don&rsquo;t have to leave the board to push a day&rsquo;s games back. On the Tournament plan the card shows a lock and opens Plan &amp; billing&rsquo;s Tournament Plus panel instead.</p>
            </>
          ),
        },
      ],
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
          id: 'faq-double-booked-field',
          question: 'What stops me from putting two games on the same field at the same time?',
          answerText: 'The schedule checks every save. Two games on the same picked field with overlapping times block the save, and the warning names the other game, its time, and the field. Games that are merely too close together get a buffer warning you can still save through. Games placed by typed text are checked against each other by name — two games with the same typed name at the same time are flagged too, with a note that the match is on the typed words, so picking a real field makes it exact. A typed name is not compared against your real fields, so a game typed Diamond 1 and a game booked onto the actual Diamond 1 do not see each other; if you have games in both states, link the typed ones to the real field using the Review note on the Schedule page and those clashes start being caught. Games with no field set cannot be checked at all; the schedule health panel counts them so you can see how much of the schedule is actually protected.',
          keywords: ['double-booked', 'double booking', 'same field same time', 'conflict', 'overlap', 'buffer warning', 'save blocked', 'venue conflict', 'not being checked', 'no field set', 'schedule health', 'typed name not compared', 'link typed field'],
          popular: true,
          answer: (
            <>
              <p>The schedule checks every save. Two games on the same picked field with overlapping times <strong>block the save</strong> — the warning names the other game, its time, and the field. Games that are merely too close together get a <strong>buffer warning</strong> you can still save through, with the earliest clean start suggested.</p>
              <p>Games placed by typed text are checked against each other <strong>by name</strong>: two games with the same typed name at the same time are flagged too, with a note that the match is on the typed words — pick a set-up field to make it exact.</p>
              <p>A typed name is <strong>not</strong> compared against your real fields, so a game typed &ldquo;Diamond 1&rdquo; and a game booked onto the actual Diamond&nbsp;1 don&apos;t see each other. If you have games in both states, link the typed ones to the real field — see <em>&ldquo;My games have field names typed in as text&rdquo;</em> below — and those clashes start being caught.</p>
              <p>A game with <strong>no field set</strong> can&apos;t be checked at all. The schedule health panel says how many games are in that state, so a clean bill of health is never quietly unearned.</p>
            </>
          ),
        },
        {
          id: 'faq-offsite-game-location',
          question: 'How do I schedule a game somewhere that isn’t one of my venues?',
          answerText: 'In the field picker choose Somewhere else (type it) and type the location. Typed locations are for genuinely off-site games — they display everywhere like any other location, but they are not checked against your real fields for double-bookings, and the schedule health panel counts them as not being checked. To take a game off a field entirely, pick the no-field option at the top of the picker; clearing genuinely clears it. If a location you typed turns out to be one of your own fields after all, you do not have to edit those games one by one — the Schedule page offers a Review note that links a typed name to a real field for every game using it at once.',
          keywords: ['off-site', 'somewhere else', 'type a location', 'custom location', 'away game', 'not our field', 'clear a field', 'remove venue from game', 'no field', 'typed location', 'link typed location to field'],
          answer: (
            <>
              <p>In the field picker choose <strong>Somewhere else (type it)</strong> and type the location. It displays everywhere like any other location — but it isn&apos;t checked against your real fields for double-bookings, and the schedule health panel counts it as not being checked. The picker says so right where you type.</p>
              <p>To take a game off a field entirely, pick the <strong>&ldquo;No&nbsp;…&rdquo;</strong> option at the top of the picker (it&apos;s named for your sport — &ldquo;No diamond&rdquo;, &ldquo;No court&rdquo;). Clearing genuinely clears it.</p>
              <p>If a location you typed turns out to be one of your own fields after all, you don&apos;t have to edit those games one by one — see <em>&ldquo;My games have field names typed in as text&rdquo;</em> below.</p>
            </>
          ),
        },
        {
          id: 'faq-resolve-typed-locations',
          question: 'My games have field names typed in as text. How do I link them to my real fields?',
          answerText: 'Open the Schedule page. If any games name a field as plain text, a note at the top says how many typed locations there are, with a Review button. The panel lists one row per name rather than per game, so one decision covers every game using that name. A name that matches one of your fields exactly is filled in for you and marked Exact match; a name that matches nothing can be created as a new field, or deliberately left as typed text. Each row shows the exact name your games will display before you apply, and nothing changes until you press Apply. Nobody is notified — linking a name to a field is tidying your own records, not moving a game, so no family or coach gets a "game moved" message. Close names are never guessed: Field 1 is not offered as Diamond 1, because a wrong guess would move real games to the wrong field. Games marked TBD are not listed because they name no field at all, and games still using the generator temporary fields belong to Resolve Temporary Facilities instead. After applying, each row keeps an Undo for as long as the panel stays open, which puts the typed text back. Below the pending rows, every field your games are already on is listed with its game count, and any of those groups can be moved to a different field at any time — that is how you correct a wrong choice later, once the Undo is gone. If someone else changed one of those games in the meantime, Undo leaves that game alone and tells you. Once a name is linked, renaming the field updates every one of those games automatically, and the double-booking check can protect them. If the Review button is greyed out, the tournament status is Completed — reopen it from the Tournaments list to make changes. Dismissing the note with the X hides it in your browser until a new typed location appears, which is how you keep names you meant to leave as text.',
          keywords: ['typed field name', 'typed location', 'link to real field', 'match typed locations', 'resolve locations', 'review locations', 'locations typed by hand', 'convert typed location', 'tidy field names', 'create field from name', 'leave as typed text', 'undo', 'already linked', 'change field for many games', 'bulk change field', 'exact match', 'no match', 'dismiss notice'],
          popular: true,
          answer: (
            <>
              <p>Open the <strong>Schedule</strong> page. If any games name a field as plain text, a note at the top says how many typed locations there are, with a <strong>Review</strong> button.</p>
              <p>The panel lists <strong>one row per name</strong>, not per game — so one decision covers every game using that name. A name matching one of your fields exactly is filled in for you and marked <strong>Exact match</strong>. A name matching nothing can be <strong>created as a new field</strong>, or deliberately <strong>left as typed text</strong>. Each row shows the exact name your games will display, and nothing changes until you press <strong>Apply</strong>.</p>
              <p><strong>Nobody is notified.</strong> Linking a name to a field is tidying your own records, not moving a game — no family or coach gets a &ldquo;game moved&rdquo; message.</p>
              <p>Close names are never guessed at: &ldquo;Field&nbsp;1&rdquo; is not offered as &ldquo;Diamond&nbsp;1&rdquo;. Games marked <strong>TBD</strong> aren&apos;t listed, because they name no field at all, and games still on the generator&apos;s temporary fields belong to <strong>Resolve Temporary Facilities</strong>.</p>
              <p>After applying, each row keeps an <strong>Undo</strong> for as long as the panel stays open, which puts the typed text back. Below the pending rows, every field your games are already on is listed with its game count — and any of those groups can be moved to a different field at any time. That is how you correct a choice later, once the Undo is gone. If someone else changed one of those games in the meantime, Undo leaves that game alone and tells you.</p>
              <p>Once a name is linked, renaming that field updates every one of those games automatically, and the double-booking check can protect them.</p>
              <p>If <strong>Review</strong> is greyed out, the tournament status is <strong>Completed</strong> — reopen it from the <strong>Tournaments</strong> list to make changes. Dismissing the note with the <strong>×</strong> hides it in your browser until a new typed location appears, which is how you keep names you meant to leave as text.</p>
            </>
          ),
        },
        {
          id: 'faq-schedule-change-notifies',
          question: 'If I move or cancel one game, does anyone get told?',
          answerText: 'Yes, once that division’s schedule is published. Changing a game’s date, time or venue — or cancelling it, or putting a cancelled game back on — notifies everyone following the two teams involved: the coaches and the families, in the same message. The Edit Game dialog tells you this before you save and names the teams. On Tournament Plus the message reaches phones; on the free Tournament plan the dialog says plainly that nobody gets a notification, though the change still appears on the public schedule and in coaches’ portals — knowing is never the paid part, the phone alert is. Nothing is sent when the division’s schedule is not published yet (build freely — nobody has seen those times), when the edit only touches notes, game length or bracket wiring, or when the edit also swaps a team into or out of the game (there is no true "your game moved" to send to either the incoming or the outgoing team). Move several games in one sitting and each team gets ONE message covering all of theirs, held for a few minutes so you are not buzzing people with every keystroke; a game starting shortly is sent straight away instead. A game that has already started or been played never triggers anything. Moving a game by hand also refreshes the "your first game is tomorrow" reminder email for the affected teams, which previously could go out quoting the old time.',
          keywords: ['notify teams', 'does moving a game notify', 'schedule change notification', 'who gets told', 'edit game warning', 'published schedule', 'unpublished schedule', 'silent edit', 'no notification', 'coaches notified', 'families notified', 'parents notified', 'tournament plus alerts', 'free plan no push', 'one message per team', 'batched', 'reminder email stale time', 'swap team no alert'],
          popular: true,
          answer: (
            <>
              <p>Yes — once that division&apos;s schedule is <strong>published</strong>. Changing a game&apos;s date, time or venue, cancelling it, or putting a cancelled game back on notifies everyone following the two teams: <strong>coaches and families, in the same message</strong>. The Edit Game dialog tells you before you save and names the teams.</p>
              <p>On <strong>Tournament Plus</strong> that reaches their phones. On the free Tournament plan the dialog says plainly that nobody gets a notification — the change still appears on the public schedule and in coaches&apos; portals. Knowing is never the paid part; the phone alert is.</p>
              <p><strong>Nothing is sent when:</strong></p>
              <ul>
                <li>the division&apos;s schedule <strong>isn&apos;t published yet</strong> — build and rearrange freely, nobody has been shown those times;</li>
                <li>the edit only touches <strong>notes, game length, or bracket wiring</strong>;</li>
                <li>the edit also <strong>swaps a team into or out of the game</strong> — there is no honest &ldquo;your game moved&rdquo; to send to either side;</li>
                <li>the game has <strong>already started or been played</strong>.</li>
              </ul>
              <p>Move several games in one sitting and each team gets <strong>one</strong> message covering all of theirs, held for a few minutes so you aren&apos;t buzzing families with every keystroke. A game starting shortly skips the wait and goes straight out.</p>
              <p>Moving a game by hand also <strong>refreshes the &ldquo;your first game is tomorrow&rdquo; reminder email</strong> for the affected teams — it used to be able to go out quoting the old time.</p>
            </>
          ),
        },
        {
          id: 'faq-shift-the-day',
          question: 'How do I move or cancel a whole day of games at once (rain delay)?',
          answerText: "On the Schedule page, open Tools then Rain delay (it appears whenever the event has upcoming games). Rain delay is a Tournament Plus tool — free Tournament orgs see it locked but can still reschedule games one at a time, post the free pinned rain-delay banner, and email coaches. In the panel: choose the day to adjust (today or any upcoming day), optionally filter by Division and/or Venue to act on just part of a day (only U11, or only the wetter diamond — Select all, the counts, and Apply act only on the shown games and leave the rest untouched), then pick how far to push the games (+30 minutes, +1 hour, +2 hours, or a custom amount) and/or mark some to cancel. You see each game's old and new time before you confirm. It applies as one action (all or nothing), never touches games that already have a result, and blocks a shift that would put a playoff game before the games that feed it (cancelling a playoff game is allowed with a warning). After it applies, it offers a prefilled announcement with the notify option on, so one more confirm posts the update to the public schedule and notifies opted-in fans plus your staff and coaches. Because you can pick an upcoming day, you can set a delay the evening before on the forecast; run it again for another division or field with a different amount. Sending that announcement with notify on also replaces the automatic 'your game moved' alert those shifted games would otherwise raise, so a rain delay is one message rather than two; posting to the site only (notify off) or clicking Skip lets the automatic alert send instead a few minutes later, so the teams are told either way.",
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
              <p><strong>Send it and yours is the only message they get.</strong> A shift on a published schedule would otherwise raise the automatic &ldquo;your game moved&rdquo; alert on its own; sending your announcement with notify on replaces it, so a rain delay is one message rather than two. If you post it to the site only (notify off) or click <strong>Skip</strong>, the automatic alert goes out instead a few minutes later — so the teams are told either way.</p>
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
          <p>An <strong>Exhibition</strong> event (the third tournament style) has no Playoffs stage at all &mdash; its Schedule page is one list of games, there is no bracket to build, and the public site never shows a Playoffs tab. Pick the style when you create the tournament, or under Event settings &rarr; Schedule Rules while it is still a draft.</p>
        </>
      ),
      subtopics: [
        {
          id: 'playoffs-build-steps',
          title: 'To build a bracket',
          content: (
            <HelpSteps>
              <li>Confirm pool-play or round-robin games are complete and standings reflect final team records.</li>
              <li>Open <strong>Schedule</strong> and switch to the <strong>Playoffs</strong> stage.</li>
              <li>For manual building, click <strong>Build Bracket</strong> to enter the inline editor and add rounds and matchups.</li>
              <li>For automated format generation (Tournament Plus), open the <strong>Playoff Wizard</strong> and configure bracket format, number of teams qualifying, seeds, and scheduling.</li>
              <li>Review the bracket preview before saving.</li>
            </HelpSteps>
          ),
        },
        {
          id: 'playoffs-editor',
          title: 'The bracket editor and bracket view',
          content: (
            <>
              <p>The inline bracket editor is a canvas where you add rounds, set up matchups, and wire Seed/Winner/Loser placeholders. Once pool play is complete and standings are known, the placeholders resolve to the real teams.</p>
              <p><strong>Bracket view</strong> on the Schedule page lets admins inspect playoff paths and advancement after games are created. It is a read-oriented visualization alongside the editable list and timeline.</p>
            </>
          ),
        },
        {
          id: 'playoffs-tiers',
          title: 'Split a division into tiers',
          content: (
            <>
              <p>A large division can be split into two or more tiers — for example a <strong>Gold</strong> bracket for the top seeds and a <strong>Silver</strong> bracket for the rest — so every team keeps playing meaningful games. In the inline bracket editor, click <strong>Split into tiers</strong>, set how many teams go in each tier, and FieldLogicHQ seeds each tier from the division&apos;s overall standings.</p>
              <p>Building tiers by hand is free on every plan; Tournament Plus, League Plus, and Club can also produce tiers in one click from the Playoff Wizard. Each tier is its own bracket and shows as a separate, titled section in the editor, on the public schedule and standings pages, in the admin bracket view, and on the printable bracket PDF. Editing a tiered bracket — adding a venue or time, for instance — keeps every tier intact.</p>
            </>
          ),
        },
        {
          id: 'playoffs-go-live',
          title: 'When the bracket goes live',
          content: (
            <>
              <p>The first time you create a playoff bracket, FieldLogicHQ marks the moment for you: the public home page flips to a <strong>Playoffs</strong> look with a countdown to the first playoff game, a one-time <strong>&ldquo;Playoffs are set&rdquo;</strong> alert goes out to your staff and to fans who turned on score alerts (Tournament Plus and above), and a shareable <strong>Playoff Picture</strong> page is published with the seeding, the opening matchups, and standout-team highlights.</p>
              <HelpNote variant="info" title="It only happens once">Editing or regenerating the bracket afterward never re-sends that alert.</HelpNote>
            </>
          ),
        },
      ],
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
      heading: 'Hand scoring and check-in to volunteers',
      summary: 'Invite volunteers for scoring, the gate, or both, hand out the Staff kit’s codes, and know what each job looks like on a phone.',
      keywords: ['volunteers', 'volunteer', 'scorekeepers', 'scorekeeper', 'gate', 'staff kit', 'qr code', 'helping with', 'field scores', 'check-in', 'day of scoring', 'submit score', 'game day', 'public site pill', 'not arrived', 'checked in', 'no-show', 'still owe', 'check in button', 'undo button', 'arrival filter', 'sent back', 'no access', 'install the app', 'print volunteer sheet'],
      searchText: 'volunteers volunteer role scorekeeper gate jobs helping with scoring the gate both invite a volunteer staff kit qr code copy link open print one page volunteer table three steps field scores to score review final all score gate account tabs today filters date team field division enter the score sheet finalize score submit for review cancel tap outside does nothing notice final sent for review sent back to score again forfeit under final public site pill flip public schedule chooser check-in picker event status finished draft check-in closed all not arrived checked in no-show teams still owe all teams are paid check in button undo button in chip time team sheet division payment mark paid roster add roster gate view table desk phone refreshes every 30 seconds account sheet install this app add to home screen sign out no access wrong code not one of your jobs lands on their job change their job members manage seat limit free',
      links: [
        { label: 'Staff kit', href: '../tournaments/staff-kit' },
        { label: 'Field scores', href: '../../scorekeeper' },
        { label: 'Check-in', href: '../tournaments/check-in' },
      ],
      content: (
        <p>You don&rsquo;t have to enter every score or check in every team yourself. Volunteers do both from their own phones, on two screens built for the field — <strong>Field scores</strong> and <strong>Check-in</strong> — with no way into the admin area. This topic covers inviting them, handing out their codes, and what each job looks like.</p>
      ),
      subtopics: [
        {
          id: 'scores-t-invite',
          title: 'Invite a volunteer and choose their job',
          content: (
            <>
              <p>A volunteer holds one or both of two jobs: <strong>Scorekeeper</strong> (entering scores) and <strong>Gate</strong> (checking teams in). You choose which when you invite them.</p>
              <HelpSteps>
                <li>Open the tournament&rsquo;s <strong>Staff kit</strong> and tap <strong>Invite a volunteer</strong>, or go to <strong>Members</strong> and tap <strong>Invite</strong>.</li>
                <li>Enter their email. From the Staff kit the role is already <strong>Volunteer</strong>; from Members, choose it.</li>
                <li>Under <strong>Helping with</strong>, choose <strong>Scoring</strong>, <strong>The gate</strong>, or <strong>Both</strong>. The line under it says what they&rsquo;ll be able to do.</li>
                <li>Send the invite. They get an email with a link to set up their account.</li>
              </HelpSteps>
              <p>Whenever they sign in — from the link, the sign-in page or the installed app — they land on their job: <strong>Field scores</strong> for Scoring or Both, <strong>Check-in</strong> for The gate. A volunteer helping with both reaches the other job in one tap.</p>
              <p>You can change their job any time under <strong>Helping with</strong> in <strong>Members › Manage</strong>, and anyone who can invite members can change it. A volunteer always keeps at least one job; to end their access, remove them. Volunteers never count toward your plan&rsquo;s seat limit.</p>
            </>
          ),
        },
        {
          id: 'scores-t-staff-kit',
          title: 'Hand out the Staff kit',
          content: (
            <>
              <p>The <strong>Staff kit</strong> is how volunteers find their screen on game day. Open the tournament, then <strong>Staff kit</strong> in the side menu.</p>
              <ul>
                <li>Two cards, <strong>Scorekeeper</strong> and <strong>Gate</strong>, each with a QR code, its link, <strong>Copy link</strong> and <strong>Open</strong>.</li>
                <li><strong>Print</strong> gives one page for the volunteer table: your club&rsquo;s name, the tournament and its dates, both codes, and three short steps for the volunteer. Nothing of the admin screen prints.</li>
                <li><strong>Invite a volunteer</strong> opens the invite with the Volunteer role already chosen.</li>
              </ul>
              <HelpNote variant="info">The codes don&rsquo;t skip sign-in. Each volunteer signs in with the email you invited and sees only their own job, so a printed sheet left on a table opens nothing for someone you didn&rsquo;t invite.</HelpNote>
            </>
          ),
        },
        {
          id: 'scores-t-field-scores',
          title: 'What a scorekeeper sees: Field scores',
          content: (
            <>
              <p>Field scores lists the day&rsquo;s games as cards, each with its time, field, division and one status chip. The day sits at the top, with <strong>Today</strong> to jump back to it, and <strong>Filters</strong> narrows the list by team, field or division. On a phone, <strong>To score</strong>, <strong>Review</strong>, <strong>Final</strong> and <strong>All</strong> sort the games at the foot of the screen, above the tabs <strong>Score</strong>, <strong>Gate</strong> (for a volunteer who also works the gate) and <strong>Account</strong>. On a tablet or computer, the other job and <strong>Sign out</strong> sit in the header instead.</p>
              <HelpSteps>
                <li>Tap a game under <strong>To score</strong>. A sheet rises with one big box per team.</li>
                <li>Type both scores. The line above the button says what saving does: <em>This score is final as soon as you save it</em>, or <em>The organizer reviews this score before it&rsquo;s final</em>.</li>
                <li>Tap <strong>Finalize score</strong> (or <strong>Submit for review</strong>). A short notice confirms it — &ldquo;Final · Wolves 7, Royals 4&rdquo; — and the list stays where it was.</li>
              </HelpSteps>
              <p>A tap outside the sheet does nothing, so a stray thumb can&rsquo;t lose a score; <strong>Cancel</strong> (or the phone&rsquo;s Back) closes it. If you send a score back from Results &amp; Scoring while their screen is open, they see &ldquo;Sent back to score again&rdquo; with the game&rsquo;s teams, and the game returns to To score. A forfeit sits under Final and can&rsquo;t be scored there.</p>
              <p>The <strong>⇄ Public site</strong> pill in the header opens the public schedule for the event being scored, so a volunteer can check a posted score is live. If two of your events run that day, it opens a small chooser.</p>
            </>
          ),
        },
        {
          id: 'scores-t-gate',
          title: 'What a gate volunteer sees: Check-in',
          content: (
            <>
              <p>The volunteer&rsquo;s Check-in is the same board as your admin Check-in page, so a gate volunteer&rsquo;s work shows up there within 30 seconds, without a reload. With more than one event, a picker under the title names each with its status. If the event is finished, or still a draft, the screen says so in words and check-in stays closed.</p>
              <ul>
                <li><strong>All</strong>, <strong>Not arrived</strong>, <strong>Checked in</strong> and <strong>No-show</strong> sort the teams, each with its count, and a line says how many teams still owe (or that every team is paid).</li>
                <li>Each team&rsquo;s row has one <strong>Check in</strong> button. Once they&rsquo;re in, the row shows <strong>IN</strong> with the time, and the button becomes <strong>Undo</strong>.</li>
                <li>Tapping a team&rsquo;s name opens its sheet: its division and where it stands, <strong>Payment</strong> (with <strong>Mark paid</strong> while it owes), its <strong>Roster</strong>, and <strong>No-show</strong>, which lives only here.</li>
              </ul>
              <p>At a desk the board is a table (Team, Roster, Payment); on a phone it&rsquo;s one list of rows. To open the volunteer&rsquo;s board yourself, use <strong>Gate view</strong> on the admin Check-in page.</p>
            </>
          ),
        },
        {
          id: 'scores-t-account',
          title: 'Account, installing the app, and the wrong code',
          content: (
            <>
              <p>On a phone, the <strong>Account</strong> tab opens a sheet showing who is signed in, their jobs and your club, with <strong>Install this app</strong> and <strong>Sign out</strong>. Tapping Account again closes it. On a shared or borrowed phone, it&rsquo;s the quickest way to check whose sign-in it is.</p>
              <p>Installing puts FieldLogicHQ on the phone&rsquo;s home screen. On an iPhone, a banner shows how: tap Share, then Add to Home Screen.</p>
              <p>A volunteer who opens the other job&rsquo;s link — a gate volunteer scanning the Scorekeeper code, say — sees <strong>No access</strong>, a line saying it isn&rsquo;t one of their jobs, and a button to the job they do hold. If they should have it, change their job in <strong>Members › Manage</strong>.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-scorekeeper-score-submit',
          question: 'How do volunteers enter scores?',
          answerText: 'A volunteer helping with scoring opens Field scores, from the Staff kit’s Scorekeeper code or simply by signing in. They tap a game under To score, type both scores in the sheet that rises, and tap Finalize score, or Submit for review if this tournament reviews scores first. They can change the day at the top, and Filters narrows it by team, field or division; the field list shows only the places that day’s games are at, and a game whose location was typed rather than picked appears as its own entry.',
          keywords: ['scorekeepers', 'scorekeeper', 'submit score', 'enter score', 'volunteer', 'field scores', 'finalize score', 'submit for review', 'to score'],
          popular: true,
          answer: (
            <p>A volunteer helping with scoring opens <strong>Field scores</strong>, from the Staff kit&rsquo;s <strong>Scorekeeper</strong> code or simply by signing in. They tap a game under <strong>To score</strong>, type both scores in the sheet that rises, and tap <strong>Finalize score</strong> (or <strong>Submit for review</strong>, if this tournament reviews scores first). They can change the day at the top, and <strong>Filters</strong> narrows it by team, field or division. The field list shows only the places that day&rsquo;s games are at, and a game whose location was typed rather than picked appears as its own entry.</p>
          ),
        },
        {
          id: 'faq-open-scorekeeper-view',
          question: 'How do I open the volunteers’ screens myself?',
          answerText: 'On Results & Scoring, the Scorekeeper button opens Field scores in a new tab. On the admin Check-in page, Gate view opens the gate volunteer’s board. The Staff kit’s Open buttons do the same. They are the volunteers’ own screens, useful for trying the field workflow before game day, and opening them never gives a volunteer admin access.',
          keywords: ['open scorekeeper view', 'scorekeeper view', 'scorekeeper route', 'day of scoring', 'gate view', 'field scores', 'try the volunteer screen', 'test scoring before game day'],
          answer: (
            <p>On <strong>Results &amp; Scoring</strong>, the <strong>Scorekeeper</strong> button opens <strong>Field scores</strong> in a new tab. On the admin <strong>Check-in</strong> page, <strong>Gate view</strong> opens the gate volunteer&rsquo;s board. The Staff kit&rsquo;s <strong>Open</strong> buttons do the same. They&rsquo;re the volunteers&rsquo; own screens, useful for trying the field workflow before game day, and opening them never gives a volunteer admin access.</p>
          ),
        },
        {
          id: 'faq-volunteer-no-access',
          question: 'A volunteer sees “No access” — what happened?',
          answerText: 'They opened the screen for a job they don’t hold — usually a gate volunteer scanning the Scorekeeper code, or a scoring volunteer scanning the Gate code. The screen says that job isn’t one of theirs and offers a button to the job they do hold. If they should do both, open Members, Manage on their row, and set Helping with to Both.',
          keywords: ['no access', 'wrong code', 'wrong qr code', 'scoring isn’t one of your jobs', 'check-in isn’t one of your jobs', 'volunteer cannot score', 'volunteer cannot check in', 'helping with'],
          answer: (
            <p>They opened the screen for a job they don&rsquo;t hold — usually a gate volunteer scanning the <strong>Scorekeeper</strong> code, or a scoring volunteer scanning the <strong>Gate</strong> code. The screen says that job isn&rsquo;t one of theirs and offers a button to the job they do hold. If they should do both, open <strong>Members</strong>, tap <strong>Manage</strong> on their row, and set <strong>Helping with</strong> to <strong>Both</strong>.</p>
          ),
        },
        {
          id: 'faq-scorekeeper-signed-out-recovery',
          question: 'What happens if a scorekeeper gets signed out while entering a score?',
          answerText: 'If a volunteer’s sign-in lapses while a score is open, the score sheet itself shows a “sign in required” notice above the numbers instead of failing silently, and the score they typed is kept. After they sign back in they land back on the same game with the numbers still filled in, ready to save. Check-in volunteers get the same clear sign-in prompt if their session lapses.',
          keywords: ['signed out', 'session expired', 'sign in required', 'lost score', 'score not saved', 'kicked out', 'log back in', 'session lapsed', 'volunteer signed out', 'check-in signed out'],
          answer: (
            <>
              <p>The score sheet itself shows a <strong>&ldquo;sign in required&rdquo;</strong> notice above the numbers rather than failing silently — and the score they typed is <strong>kept</strong>. After they sign back in they land back on the <strong>same game</strong> with the numbers still filled in, ready to save.</p>
              <p>Check-in / gate volunteers get the same clear <strong>sign-in prompt</strong> if their session lapses, instead of a generic error.</p>
            </>
          ),
        },
      ],
    },

    {
      id: 'recipe-finalize-tournament-scores',
      group: 'Game Day & Scores',
      heading: 'Review and finalize scores',
      summary: 'Record results from admins or scorekeepers, confirm pending reviews, and correct mistakes.',
      keywords: ['enter scores', 'finalize scores', 'pending review', 'scorekeeper submissions', 'results', 'review scores', 'playing now', 'up next', 'needs a score', 'to finalize', 'game-day dashboard', 'needs you', 'all games', 'correct a final score', 'score submitted notification', 'no games found', 'results is empty', 'nothing in results', 'show all games', 'results filters', 'why cant i see my games', 'tie', 'level score', 'who can change a final score', 'who can finalize', 'this game is final', 'read-only final game'],
      searchText: 'enter scores finalize scores scorekeeper submissions pending review results scoring final games public standings correct score revert scheduled score to finalize needs a score playing now up next game day dashboard game-day board overdue live game what is on now lists hidden when empty one tap open score editor needs you all games lens scheduled cancelled correct an already final score score submitted notification opens results with the game ready no games found results is empty nothing shows in results why cant i see my games all my games are missing show all games button tie level score scores are level forfeit pending review final export status column word customize this board show hide checkboxes drag to reorder who can finalize who can change a final score this game is final only someone who can finalize scores can change it read-only final game staff cannot change a final result save score stays off seal archive tournaments permission forfeit under final scorekeeper volunteer field scores scorekeeper button opens field scores',
      links: [
        { label: 'Results & Scoring', href: '../tournaments/results' },
        { label: 'Field scores', href: '../../scorekeeper' },
      ],
      content: (
        <p>Admins can enter, review, finalize, correct, export, or revert scores from <strong>Results &amp; Scoring</strong>. It opens on <strong>Needs you</strong> — games waiting to finalize, needing a score, or playing right now — with <strong>All games</strong> one tap away.</p>
      ),
      subtopics: [
        {
          id: 'results-needs-you-all-games',
          title: 'Needs you and All games',
          content: (
            <p><strong>Results &amp; Scoring</strong> opens on <strong>Needs you</strong> — every division&rsquo;s games waiting to finalize, needing a score, or playing right now. Tap <strong>All games</strong> to also see games not yet due and games already final. Tap any game&rsquo;s row to open its score editor in that same place in the list, or tap <strong>Scorekeeper</strong> to open <strong>Field scores</strong>, the volunteers&rsquo; screen, in a new tab.</p>
          ),
        },
        {
          id: 'results-score-editor',
          title: 'The score editor',
          content: (
            <p>Enter home and away scores with the − / + steppers. On a score a scorekeeper submitted that you haven&rsquo;t changed, the main button already reads <strong>Finalize</strong> — one tap confirms it; otherwise it reads <strong>Save score</strong>. A row still waiting on your review also carries its own worded <strong>Finalize</strong> button beside its chevron, so a score you&rsquo;re happy with takes two taps total (the row, then Finalize) without opening the full editor. <strong>Discard</strong> closes without saving; <strong>Revert score</strong> clears the score and sends the game back to Scheduled so you can re-enter it.</p>
          ),
        },
        {
          id: 'results-who-can-change-final',
          title: 'Who can finalize, and change a final result',
          content: (
            <>
              <p>Finalizing a waiting score and changing a result that&rsquo;s already final belong to the same people: owners and admins, plus any member you&rsquo;ve given <strong>Seal (archive) tournaments</strong> in their member settings &mdash; that one permission covers both.</p>
              <ul>
                <li><strong>Staff</strong> can enter scores, and correct or revert a score that&rsquo;s still <strong>Pending Review</strong>. On a waiting score they haven&rsquo;t changed, <strong>Save score</strong> stays off until the numbers actually change. Volunteers enter scores, and correct one that&rsquo;s still Pending Review, on Field scores instead.</li>
                <li><strong>A final game</strong> &mdash; Final or Forfeit &mdash; opens read-only for them, saying <em>&ldquo;This game is final. Only someone who can finalize scores can change it.&rdquo;</em> They don&rsquo;t see <strong>Finalize</strong>.</li>
                <li>On <strong>Field scores</strong>, a forfeited game sits under <strong>Final</strong>, not To score, and can&rsquo;t be scored there.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'results-pending-review',
          title: 'Pending Review, and what’s public',
          content: (
            <p><strong>Pending Review</strong> means a score has been submitted but still needs admin confirmation before it is treated as final. If finalization is disabled, scorekeeper submissions become completed scores immediately. Public result pages update from the same game data — Pending Review scores may appear as submitted results, but only completed scores are treated as final for playoff advancement.</p>
          ),
        },
        {
          id: 'results-tied-score',
          title: 'A tied score',
          content: (
            <p>When the two scores you&rsquo;ve entered are level, the editor says so — <em>&ldquo;Scores are level — this game will save as a tie&rdquo;</em> — and you can still save it that way. For a playoff game it adds that the bracket won&rsquo;t advance the winner until the game is re-scored or a forfeit is recorded; a tied playoff score does save, and the next round keeps reading &ldquo;Winner of &hellip;&rdquo; until it&rsquo;s resolved.</p>
          ),
        },
        {
          id: 'results-stays-current',
          title: 'It stays current, and one word everywhere',
          content: (
            <p>Results &amp; Scoring re-checks itself every 30 seconds while it&rsquo;s open, so a scorekeeper&rsquo;s submission from the field appears without a reload — it never refreshes while you have an editor, the view sheet, or a confirm dialog open. Every screen that names a game&rsquo;s state — this page, the game-day dashboard, the schedule&rsquo;s game tags, and the scorekeeper — uses the same five words: <strong>Needs a score, Pending Review, Final, Forfeit,</strong> and <strong>Tie</strong>. The export&rsquo;s Status column says the same words, adding <strong>Scheduled</strong> and <strong>Cancelled</strong> for games that aren&rsquo;t due yet or were called off.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-score-submitted-notification',
          question: 'Where does a “score submitted” notification take me?',
          answerText: 'When a scorekeeper submits a score, admins get a notification. Tapping it opens Results & Scoring for that tournament with the game expanded and ready to review, finalize, or correct — no hunting for it. If you are signed out when you tap, you sign in first and then land on the same game.',
          keywords: ['score submitted notification', 'score alert', 'notification takes me', 'where does the score notification go', 'scorekeeper submitted', 'review submitted score', 'notification opens results'],
          answer: (
            <>
              <p>When a scorekeeper submits a score, admins get a notification. <strong>Tapping it opens Results &amp; Scoring</strong> for that tournament with the game <strong>expanded and ready</strong> to review, finalize, or correct — no hunting for it.</p>
              <p>If you happen to be signed out when you tap, you&rsquo;ll sign in first and then land on that same game.</p>
            </>
          ),
        },
        {
          id: 'faq-correct-final-score-mobile',
          question: 'How do I correct a score that’s already final?',
          answerText: 'Open Results and tap All games — Final and Forfeit games are there alongside Scheduled ones (Needs you, the view it opens on, only shows what still needs your attention: games waiting to finalize, needing a score, or playing now). Find the game, tap its row to open the score editor in place, and correct it, or use Revert score to send it back to Scheduled and re-enter. Changing a final result takes someone who can finalize scores — owners and admins, or a member given Seal (archive) tournaments. Anyone else sees the final game read-only.',
          keywords: ['correct final score', 'correct final score on phone', 'mobile results', 'all games', 'needs you', 'fix a final score', 'no games found', 'results looks empty', 'results empty', 'show all games', 'nothing in results', 'who can change a final score', 'this game is final', 'read-only final game'],
          answer: (
            <>
              <p>Open <strong>Results &amp; Scoring</strong> and tap <strong>All games</strong>. <strong>Final</strong> and <strong>Forfeit</strong> games are there alongside <strong>Scheduled</strong> ones — the page opens on <strong>Needs you</strong>, which only shows what still needs your attention: games waiting to finalize, needing a score, or playing now.</p>
              <p>Find the game and tap its row — the score editor opens in that same place in the list. Correct it there, or use <strong>Revert score</strong> to send it back to Scheduled and re-enter.</p>
              <p>Changing a final result takes someone who can finalize scores &mdash; owners and admins, or a member you&rsquo;ve given <strong>Seal (archive) tournaments</strong>. Anyone else sees the final game read-only.</p>
            </>
          ),
        },
        {
          id: 'faq-game-day-sections',
          question: 'What do To finalize, Needs a score, Playing now, and Up next mean on the dashboard?',
          answerText: 'On game day your tournament dashboard is four lists, in the order of the day. To finalize is scores a scorekeeper submitted from the field, waiting for you to confirm them. Needs a score is games whose scheduled time has passed with no result yet — it shows the day when that day is not today. Playing now is games in progress right now. Up next is today\'s scheduled games that have not started yet, earliest first. Each list carries its own count and hides itself when it is empty. Tap any game to open it in Results with its score editor already open — a waiting score finalizes with one more tap on Finalize. Once your event reaches game day (its dates, or its first game starting, until you mark it complete) the header\'s status chip reads Game day too.',
          keywords: ['to finalize', 'needs a score', 'playing now', 'up next', 'game day dashboard', 'game-day board', 'live games', 'overdue game', 'dashboard lists', 'game day chip', 'header status'],
          popular: true,
          answer: (
            <>
              <p>On game day your tournament <strong>dashboard</strong> is four lists, in the order of your day:</p>
              <ul>
                <li><strong>To finalize</strong> — scores a scorekeeper submitted from the field, waiting for you to confirm them.</li>
                <li><strong>Needs a score</strong> — games whose scheduled time has passed with no result yet (it shows the day when that day isn&rsquo;t today).</li>
                <li><strong>Playing now</strong> — games in progress right now.</li>
                <li><strong>Up next</strong> — today&rsquo;s scheduled games that haven&rsquo;t started yet, earliest first.</li>
              </ul>
              <p>Each list carries its own count and hides itself when there&rsquo;s nothing to show. <strong>Tap any game</strong> to open it in Results with its score editor already open — a waiting score finalizes with one more tap on <strong>Finalize</strong>.</p>
              <p><strong>Customize this board</strong>, at the board&rsquo;s foot, shows and hides these lists — on game day it no longer reorders them; the order follows the day. Once your event reaches game day (its dates, or its first game starting, until you mark it complete) the header&rsquo;s status chip reads <strong>Game day</strong> too.</p>
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
          answerText: 'Yes — Revert score in Results & Scoring clears the score and sends the game back to Scheduled so it can be entered again. A score still Pending Review can be reverted by anyone who can score; a final score only by someone who can finalize scores (owners and admins, or a member given Seal (archive) tournaments).',
          keywords: ['undo score', 'revert score', 'clear score', 'revert a final score'],
          answer: (
            <>
              <p>Yes. Revert the game to Scheduled from Results &amp; Scoring, then enter the corrected score. Reverting clears the existing score and current submission metadata, so confirm before doing it.</p>
              <p>A score still <strong>Pending Review</strong> can be reverted by anyone who can score. A <strong>final</strong> score can be reverted only by someone who can finalize scores &mdash; owners and admins, or a member you&rsquo;ve given <strong>Seal (archive) tournaments</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-scorekeeper-edit-final',
          question: 'Can volunteers change a score after submitting it?',
          answerText: 'Volunteers can correct a Pending Review score before it is finalized, but not a final result — a completed score or a forfeit. On Field scores a forfeited game sits under Final and cannot be scored. A final result is changed in Results & Scoring by someone who can finalize scores: owners and admins, or a member given Seal (archive) tournaments.',
          keywords: ['edit score', 'correct score', 'finalized score', 'pending review', 'forfeit', 'final result', 'forfeit under final', 'scorekeeper edit score', 'volunteer correct score', 'save correction'],
          answer: (
            <>
              <p>Volunteers can correct a <strong>Pending Review</strong> score before it&rsquo;s finalized, but not a final result &mdash; a completed score or a forfeit. On Field scores a forfeited game sits under <strong>Final</strong> and can&rsquo;t be scored.</p>
              <p>A final result is changed in <strong>Results &amp; Scoring</strong> by someone who can finalize scores: owners and admins, or a member you&rsquo;ve given <strong>Seal (archive) tournaments</strong>.</p>
            </>
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
      keywords: ['communications', 'communication', 'announcements', 'new message', 'email', 'email the teams', 'news posts', 'post to the public site', 'targeted email', 'templates', 'start from', 'pin', 'pinned', 'rain delay', 'schedule banner', 'email limit', 'recipient limit', 'free email cap', 'push', 'push notification', 'push to fans', 'notify fans', 'fan alerts', 'phone alert', 'who it reached', 'removed from the site', 'restore post'],
      searchText: 'communications communication new message start from a blank message template schedule is live payment reminder weather update welcome and info results are in title message where it goes post to the public site news page pin it at the top show under divisions email the teams each accepted team coach teams accepted waitlisted waiting for a decision all except rejected division payment any owes paid live count post and email send button number send announcements news posts public tournament page targeted communication accepted teams only rejected teams never emailed rain delay urgent day-of update game day schedule banner live event free plan email limit 100 recipients per send 10 announcements per day daily email cap volume limit basic email cap too many emails send limit push to fans phones push notification phone notification notify fans buzz fans phones fan alerts followed team alerts opt in tournament plus all on the site emailed filter removed from the site restore to site remove from site edit post email record delivered failed copy failed see who it reached',
      links: [
        { label: 'Communications', href: '../tournaments/communication' },
      ],
      content: (
        <>
          <p>Use <strong>Communications</strong> for tournament messages. One message can go to the public site, to your teams by email, and to fans&rsquo; phones, all at once.</p>
          <ol>
            <li>Tap <strong>New message</strong>.</li>
            <li>Under <strong>Start from</strong>, keep <strong>A blank message</strong> or pick a template such as <strong>Schedule is live</strong> or <strong>Weather update</strong>, then write the <strong>Title</strong> and <strong>Message</strong>.</li>
            <li>Under <strong>Where it goes</strong>, tick <strong>Post to the public site</strong> (the tournament&rsquo;s News page), <strong>Email the teams</strong>, <strong>Push to fans&rsquo; phones</strong>, or any mix.</li>
            <li>Check the count under the email choice, then send. The button says what it will do and for how many &mdash; for example <strong>Post and email 18</strong>.</li>
          </ol>
          <p>An email goes to each <strong>accepted</strong> team&rsquo;s coach unless you choose otherwise. On Tournament Plus you choose the teams by status, division and payment, and the count updates as you choose. A rejected team is never emailed.</p>
          <p>The list shows everything you have sent; filter it with <strong>All</strong>, <strong>On the site</strong> and <strong>Emailed</strong>. A post taken off the site moves to <strong>Removed from the site</strong> at the end &mdash; open it to put it back. Open any message to edit a post or to see who an email reached.</p>
          <p>Keep sends operational and useful for teams, not broad marketing blasts.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-targeted-communication',
          question: 'Who can use targeted tournament communication?',
          answerText: 'Tournament Plus and higher. Under Email the teams, three choices set who an email reaches: Teams (Accepted, Waitlisted, Waiting for a decision, or All except rejected), Division (all divisions or one), and Payment (Any, Owes, or Paid). The count below them updates as you choose, and the send button repeats it. A post can also show under chosen divisions. On the free Tournament plan an email goes to every accepted team\'s coach, and each choice appears as a locked line naming Tournament Plus — a choice you cannot make never widens who gets the email. Tournament Plus also removes the free plan\'s email limits (100 recipients per send, 10 sends per day).',
          keywords: ['targeted communication', 'choose teams', 'email waitlisted teams', 'email teams waiting for a decision', 'all except rejected', 'division email', 'payment status', 'owes', 'who gets the email', 'recipient count'],
          answer: (
            <>
              <p>Targeted communication is included with <strong>Tournament Plus</strong> and higher. Under <strong>Email the teams</strong>, three choices set who an email reaches:</p>
              <ul>
                <li><strong>Teams</strong> &mdash; Accepted, Waitlisted, Waiting for a decision, or All except rejected.</li>
                <li><strong>Division</strong> &mdash; all divisions, or one.</li>
                <li><strong>Payment</strong> &mdash; Any, Owes, or Paid.</li>
              </ul>
              <p>The count below them updates as you choose (&ldquo;18 teams &middot; every accepted team, all divisions&rdquo;), and the send button repeats it. A post can also show under chosen divisions. On the free Tournament plan an email goes to every accepted team&rsquo;s coach, and each choice appears as a locked line naming Tournament Plus &mdash; a choice you can&rsquo;t make never widens who gets the email. Tournament Plus also removes the free plan&rsquo;s volume limits (see below).</p>
            </>
          ),
        },
        {
          id: 'faq-free-email-limits',
          question: 'Is there a limit on emails from the free Tournament plan?',
          answerText: 'Yes. The free Tournament plan emails every accepted team, up to 100 recipients per message and up to 10 email announcements per day. Tournament Plus and above remove both limits. Posting to the public site (no email) is never limited.',
          keywords: ['email limit', 'free plan email', '100 recipients', '10 per day', 'send limit', 'too many emails', 'daily email limit'],
          answer: (
            <p>The free Tournament plan emails every accepted team, <strong>up to 100 recipients per message</strong> and <strong>up to 10 email announcements per day</strong>. If you reach a limit, you&apos;ll see a message saying so. <strong>Tournament Plus</strong> and above remove both limits. Posting to the public <strong>site</strong> (without email) is never limited.</p>
          ),
        },
        {
          id: 'faq-rain-delay-banner',
          question: 'How do I get a rain delay or urgent update in front of fans on game day?',
          answerText: 'If games are actually moving or being cancelled, use Tools then Rain delay on the Schedule page (a Tournament Plus tool) — pick the day, and it re-times that day and hands you a ready-to-send notice in one flow. If you are on the free plan, or you just need to get the word out without changing game times, post a message and tick Pin it at the top: a pinned site post stays at the top of the News page and, while the tournament is live, also shows as a banner at the top of the public Schedule page. On Tournament Plus you can also tick Push to fans’ phones to send a phone notification at the same time. Unpin it once the situation clears.',
          keywords: ['rain delay', 'urgent update', 'game day', 'schedule banner', 'pin announcement', 'day-of', 'push to fans', 'notify fans', 'shift the day', 'move games', 'tools menu', 'tournament plus'],
          popular: true,
          answer: (
            <>
              <p><strong>If games are actually moving or being cancelled,</strong> start with <strong>Tools ▾ → Rain delay</strong> on the <strong>Schedule</strong> page — pick the day and it re-times that day, then hands you a ready-to-send notice in one flow (see &ldquo;How do I move or cancel a whole day of games at once&rdquo;). Rain delay is a <strong>Tournament Plus</strong> tool; on the free plan — or when you just need to get the word out <em>without</em> changing game times — use the steps below instead.</p>
              <p>Open <strong>Communications</strong>, tap <strong>New message</strong>, write the update, keep <strong>Post to the public site</strong> ticked, and tick <strong>Pin it at the top</strong>. While the tournament is live, a pinned site post appears as a banner at the top of the public <strong>Schedule</strong> (and stays pinned at the top of <strong>News</strong>). It&rsquo;s the fastest way to reach fans already watching the schedule for a rain delay, a diamond change, or a start-time push.</p>
              <p>On <strong>Tournament Plus</strong>, also tick <strong>Push to fans&rsquo; phones</strong> to buzz the phones of fans who&rsquo;ve enabled alerts — the fastest way to reach people who aren&rsquo;t looking at the schedule right then.</p>
              <p><strong>Unpin</strong> it once the situation clears so the banner stays reserved for things that matter in the moment.</p>
            </>
          ),
        },
        {
          id: 'faq-push-to-fans',
          question: 'Can I send a push notification to fans?',
          answerText: 'Yes, on Tournament Plus and higher. Tick "Push to fans’ phones" in a new message to send a phone notification to everyone following a team in this tournament who has turned on alerts. It also posts to the site (Post to the public site ticks itself), so the notification opens the full message, and it is ideal for rain delays and day-of updates. Fans opt in themselves by following a team, signing in with a free account, and enabling alerts, so early on you may see "no fans have alerts on yet." On the free plan the option is locked.',
          keywords: ['push', 'push notification', 'push to fans', 'push to fans phones', 'notify fans', 'phone alert', 'fan alerts', 'buzz phone', 'opt in'],
          popular: true,
          answer: (
            <>
              <p><strong>Yes &mdash; on Tournament Plus and higher.</strong> In a new message, tick <strong>Push to fans&rsquo; phones</strong> to send a phone notification to everyone following a team in this tournament who has turned on alerts. It also posts to the site &mdash; <strong>Post to the public site</strong> ticks itself &mdash; so the notification opens the full message.</p>
              <p>It&rsquo;s ideal for rain delays and urgent day-of updates — pin the post and it also appears as the banner on the public <strong>Schedule</strong>. Fans opt in themselves by following a team, signing in, and turning on alerts, so early in an event you may see &ldquo;no fans have alerts on yet.&rdquo; On the free plan it appears as a locked line naming Tournament Plus.</p>
            </>
          ),
        },
        {
          id: 'faq-email-who-it-reached',
          question: 'How do I see who an email reached?',
          answerText: 'In Communications, the list shows each email\'s count, for example "Emailed to 18 · 1 failed". Open the message: its Email block says how many were delivered and how many failed, See who it reached lists the teams, and Copy failed copies the addresses that failed so you can check them. A message that went to the site and by email opens as one record, with its email inside. Older emails, sent before the list was kept, show the counts and any failed addresses but not the full list.',
          keywords: ['who it reached', 'see who it reached', 'email recipients', 'delivered', 'failed email', 'bounced', 'copy failed', 'email record', 'did my email send'],
          answer: (
            <>
              <p>In <strong>Communications</strong>, the list shows each email&rsquo;s count &mdash; for example &ldquo;Emailed to 18 &middot; 1 failed&rdquo;. Open the message: its <strong>Email</strong> block says how many were delivered and how many failed, <strong>See who it reached</strong> lists the teams, and <strong>Copy failed</strong> copies the addresses that failed so you can check them.</p>
              <p>A message that went to the site and by email opens as one record, with its email inside. Older emails, sent before the list was kept, show the counts and any failed addresses but not the full list.</p>
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
      keywords: ['chat', 'tournament chat', 'coach chat', 'group chat', 'message coaches', 'live chat', 'rooms', 'division rooms', 'channels', 'all coaches room', 'new room', 'create room', 'switch rooms', 'manage room', 'rename room', 'delete room', 'close room', 'members', 'manage chat', 'manage panel', 'mute', 'remove message', 'delete message', 'delete own message', 'message removed', 'not yet joined', 'moderation', 'unread', 'reply', 'quote', 'mention', '@mention', 'emoji', 'react', 'search messages', 'pinned messages', 'pin message', 'unpin', 'read by', 'read receipt', 'last seen', 'coach sign-ups', 'coaches signed up', 'remind teams to sign up', 'chat adoption', 'sign-up tracker', 'reported message', 'reported messages', 'reports', 'report', 'dismiss report', 'remove reported message'],
      searchText: 'tournament chat group chat live chat with coaches message all coaches conversation real time chat tab division rooms channels create a room new room name the room pick divisions room covers a division coaches join automatically all coaches room undeletable switch rooms rooms button manage room button rename room close room reopen read only delete room empty room only protect history open members manage panel manage chat roster not yet joined invite coach mute coach remove message delete message delete your own message message removed moderate moderation unread count in-app bell phone push notification Tournament Plus every participating coach free and paid stays readable after tournament reply quote a message jump to original mention @mention tag a coach mention reaches them even if muted emoji smiley react with emoji search recent messages magnifier read receipt sent read by 3 of 8 read by everyone last seen pinned message pin unpin schedule field map rules banner at top of room collapsible coach sign-ups coaches signed up how many coaches signed up dashboard coach sign-ups and chat panel remind teams to sign up remind coaches one click bulk reminder who has signed up in the chat not yet joined no coach email on file flagged fill the room chat adoption tracker coach reports a message reported message reported messages reports queue in manage room panel count badge remove the message or dismiss the report reporter stays anonymous member reports message',
      links: [
        { label: 'Chat', href: '../tournaments/chat' },
      ],
      content: (
        <p><strong>Chat</strong> gives you a live group conversation with every coach in your tournament — a real back-and-forth instead of one-way email blasts. Open the <strong>Chat</strong> tab on your tournament; every coach who has registered a team is already in the <strong>All coaches</strong> room, free and paid alike. They don&rsquo;t need a plan of their own — being in your tournament is enough. You&rsquo;ll see an <strong>unread count</strong> on the Chat menu, and new messages also reach you by in-app bell and phone notification — no email.</p>
      ),
      subtopics: [
        {
          id: 'chat-rooms',
          title: 'Split a big event into rooms (optional)',
          content: (
            <p>A small tournament just uses the one <strong>All coaches</strong> room — nothing to set up. For a larger, multi-division event you can add <strong>rooms</strong> (think Slack-style channels) so coaches only see what&rsquo;s relevant — a U12 room, a Championship room, and so on. Tap <strong>Rooms</strong> at the left of the chat header to see the room list and tap <strong>New room</strong> to create one: give it a name and tick which <strong>division(s)</strong> it covers. That&rsquo;s the whole setup — <strong>membership fills itself in</strong>: every coach whose team is in a covered division joins automatically, and as new teams register into that division their coaches are added too. There are no invite lists to keep up to date. The <strong>All coaches</strong> room is always there as the everyone/announcements room and can&rsquo;t be deleted.</p>
          ),
        },
        {
          id: 'chat-how-it-works',
          title: 'It works like a real chat app',
          content: (
            <>
              <p>Add an <strong>emoji</strong> from the smiley in the message box, <strong>reply</strong> to a specific message so your answer quotes it (tap the quote to jump back to the original), and type <strong>@</strong> to <strong>mention</strong> a coach by name — a mention reaches that coach directly, even if they&rsquo;ve turned general chat notifications off. The <strong>magnifier</strong> in the chat header <strong>searches</strong> the conversation; today it filters the recent messages on screen, with full-history search coming later. Under your own most recent message, a small receipt moves from <strong>Sent</strong> to <strong>Read by 3 of 8</strong> to <strong>Read by everyone</strong> as coaches catch up.</p>
              <p><strong>Coaches need no setup.</strong> Each coach automatically sees the <strong>All coaches</strong> room plus any division room that covers their team, with the tournament&rsquo;s name shown beside each so several rooms are easy to tell apart. They never create or manage rooms — they just post, react, and vote.</p>
            </>
          ),
        },
        {
          id: 'chat-manage-room',
          title: 'Managing a room, and keeping it on track',
          content: (
            <>
              <p>Tap <strong>Manage room</strong> at the right of the chat header to open the management panel for whichever room is open. It lists everyone in that room — with each coach&rsquo;s <strong>last seen</strong> time — and under <strong>Not yet joined</strong> it shows the coaches who haven&rsquo;t signed in yet, so nobody is silently left out. Beside a not-yet-joined name, use <strong>Copy link</strong> or <strong>Email</strong> to send that coach the sign-in link; they join automatically the moment they sign in with their team&rsquo;s email.</p>
              <p>From the same panel you can <strong>mute</strong> a coach for up to 72 hours (they can still read, just not post). <strong>Room settings</strong> lets you <strong>rename</strong> a room you created, <strong>close</strong> it to make it read-only (and reopen it any time), or <strong>delete</strong> it.</p>
              <HelpNote variant="info" title="Delete is only offered for an empty room">
                <p>To protect the record: once coaches have talked, you can close the room but not delete it, and the <strong>All coaches</strong> room can always be closed but never renamed or deleted. Conversations stay readable after the tournament wraps up.</p>
              </HelpNote>
              <p>Any coach can <strong>delete a message they sent</strong> (it then reads &ldquo;Message removed&rdquo;); as the organizer you can also <strong>remove anyone&rsquo;s</strong> message using the remove control on the message itself. A muted coach can&rsquo;t delete.</p>
            </>
          ),
        },
        {
          id: 'chat-reports-pins',
          title: 'Reported messages, and pinning what coaches keep asking for',
          content: (
            <>
              <p><strong>Reported messages come to you.</strong> A coach can flag a message they&rsquo;re uncomfortable with by pressing and holding it and choosing <strong>Report to organizers</strong>. Reported messages collect at the top of the <strong>Manage room</strong> panel (with a count on the button), each showing the message and who reported it. From there you can <strong>Remove</strong> the message — which also clears the report — or <strong>Dismiss</strong> the report if it&rsquo;s fine. Coaches never see each other&rsquo;s reports, and the reporter stays anonymous to the person they reported.</p>
              <p><strong>Pin what coaches keep asking for.</strong> Pin the schedule, the field map, the rules — any message — to a <strong>banner at the top of the room</strong>. Pin several at once; the banner collapses and expands, and a coach can tap any pinned item to jump straight to it. Pinning and unpinning are yours alone (from the controls on a message, beside <strong>remove</strong>) — coaches see the banner but can&rsquo;t change it.</p>
            </>
          ),
        },
        {
          id: 'chat-plan',
          title: 'What it costs',
          content: (
            <p>Chat — and everything in it — is included with <strong>Tournament Plus and above</strong>; these conversation tools add no extra cost. On the free Tournament plan the tab shows an upgrade option instead.</p>
          ),
        },
      ],
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
          id: 'faq-tournament-chat-reports',
          question: 'What happens when a coach reports a message?',
          answerText: 'Coaches can flag a message by pressing and holding it and choosing Report to organizers. Reported messages collect at the top of the Manage room panel, with a count on the Manage room button, so you notice them. Each shows the reported message and who reported it. You can Remove the message (which also clears the report) or Dismiss the report if the message is fine. Coaches never see each other reports, and the person who reported stays anonymous to the coach they reported. There is no separate coach-to-coach blocking — reporting to you is how coaches flag a problem.',
          keywords: ['reported message', 'reported messages', 'report', 'coach reported a message', 'dismiss report', 'remove reported message', 'reports queue', 'moderation', 'manage room', 'flag message', 'inappropriate message'],
          answer: (
            <>
              <p>A coach flags a message by <strong>pressing and holding</strong> it and choosing <strong>Report to organizers</strong>. Reported messages collect at the top of the <strong>Manage room</strong> panel — with a count on the <strong>Manage room</strong> button so you notice them — and each shows the reported message and who reported it.</p>
              <p>From there you can <strong>Remove</strong> the message (which also clears the report) or <strong>Dismiss</strong> the report if the message is fine. Coaches never see one another&rsquo;s reports, and the coach who reported stays anonymous to the person they reported. There&rsquo;s no separate coach-to-coach blocking — reporting to you is how a coach flags a problem.</p>
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
      summary: 'What teams and fans see online — following a team, the app Home and All following, score alerts, the home-screen app — and how to preview it.',
      keywords: ['public site', 'preview', 'public tournament page', 'teams see', 'public schedule', 'standings', 'playoffs tab', 'bracket tab', 'exhibition', 'exhibition tournament', 'no playoffs', 'where is the bracket', 'find the bracket', 'follow a team', 'home tab', 'all following', 'following', 'scores tab', 'my events', 'my games', 'live scores', 'live board', 'score alerts', 'add to home screen', 'install app', 'offline', 'playoff picture', 'playoffs are set', 'champions', 'champions page', 'champions crowned', 'final results', 'day selector', 'schedule day view', 'pool tag', 'recent results', 'new device', 'browse tournaments', 'search', 'home search', 'search for a team', 'find a team', 'search for an organization', 'find an organization', 'search for a tournament', 'find a tournament', 'search teams', 'search organizations', 'overview tab', 'top tabs', 'tab row', 'flip pill', 'flip', 'toggle sides', 'switch to admin', 'back to admin', 'coach view', 'open admin', 'roles', 'roles button', 'roles chooser', 'my other roles', 'admin and coach', 'i also coach', 'coach at my own tournament', 'switch roles', 'two roles', 'multiple roles', 'jump to my team', 'share this event', 'account chip', 'app bar', 'home scores chat account', 'get back to the app', 'discover link', 'no home tab', 'missing tabs', 'sign in button', 'admin area', 'coaches portal pill', 'qr code', 'get the app', 'scan'],
      searchText: 'public tournament site preview schedule standings results teams rules news registration public page what teams see preview site before activation fans follow a team my team score alerts push notification final alert add to home screen install the app home screen icon fan app works offline last scores branded icon iphone android consistent standings rank same rank everywhere team card team profile tie-breaker head-to-head app icon background colour color app name short name initials border branding playoff picture playoffs are set seeding summary bracket countdown home finished wrap-up playoff day schedule opens on playoffs stage automatically live tag running score automatically finished without marking complete shareable champions crowned champions page final results winners celebration recap top tier home tab all following page my teams account follows cross tournament followed teams tournament cards your team past events scores tab my events my games live board live now pinned live games today next few days recent results show earlier show later companion view home gathers scores shows games updated ago freshness fan signup from follow prompt keeps the follow create account nudge new phone new device follows carry over sign in pinned automatically unfollow everywhere shared device sign out browse tournaments discover exit live scores more menu sign in for alerts home search bar find a tournament team or organization search for a team search for an organization search teams search organizations type chips all tournaments organizations teams team match opens team page inside its event organization match opens org public page team results only from listed directory tournaments name and event only no rosters contacts schedule day view one day at a time day selector day chips all days chip opens on today date rail jump to a date week long event saturdays series pool tag a pool b pool cross-pool no tag tbd group unscheduled game no date yet semifinal 1 semifinal 2 numbered playoff games semifinal 1 winner bracket wording my team bar score pill minimized tap to restore team page bell recent results form wins losses game page game details countdown first pitch starting soon running score leading team lit up rolling score team colour tile monogram avatar follow star away home label game length winner advances championship gold winner takes the title get directions runs for runs against overview tab top tabs scrolling tab row page tabs under the header playoffs tab bracket tab where is the bracket how do parents find the bracket playoffs tab appears when you set a bracket hidden standings hides playoffs bracket only event playoff only tournament no round robin bracket only shows its playoffs tab exhibition tournament no playoffs scrimmage day never shows playoffs tab pool play only home scores chat account persistent app bar global bar neutral venue colours flip pill flip button toggle switch to admin switch to public back to admin coach view open admin roles roles button roles chooser my other roles admin and coach i also coach coach at my own tournament switch roles two roles multiple roles jump to my team same tab one tap scorekeeper tools share this event share event account chip header chip identity chip get back to the app step out of the event browse home scores tab always on screen desktop top strip thin strip across the top computer laptop slim bar along the bottom phones bottom bar top bar app bar placement discover link instead of tabs no home tab on desktop where did the tabs go missing tab row why cant fans see scores tab anonymous visitor signed out visitor sign in button admin area button coaches portal button operator pill role pill qr code get the app scan with your phone camera also on your phone install on a computer laptop desktop how do i tell a parent to get the app',
      links: [
        { label: 'Preview Site', href: '../tournaments/dashboard' },
      ],
      content: (
        <>
          <p>Use the flip pill in the top-right corner of any tournament admin screen — labeled <strong>⇄ Preview</strong> on a draft and <strong>⇄ Public</strong> once the tournament is live — to open the matching public (or preview) page in the same tab and inspect the public tournament experience before or after activation.</p>
          <p>The public tournament site can include registration, schedule, standings, results, teams, rules, resources, and news depending on tournament setup and status. Preview is always available to admins regardless of tournament status — share the preview link internally to review the public experience before you activate.</p>
        </>
      ),
      subtopics: [
        {
          id: 'public-site-standings',
          title: 'Consistent standings',
          content: (
            <p>A team&rsquo;s rank is the same everywhere it appears — the standings table, the Teams page cards, and the team&rsquo;s own page all rank by your tie-breaker rules (head-to-head, then run differential, and so on). So a team that wins a tie on head-to-head shows the same position to every fan, on every screen.</p>
          ),
        },
        {
          id: 'public-site-following',
          title: 'Following a team',
          content: (
            <>
              <p>Fans can follow a team on the public site — <strong>no account needed</strong> — to get a personalized &ldquo;my team&rdquo; view: next game, live score, and current standing, front and centre.</p>
              <p><strong>Signing in makes follows travel.</strong> With a free account, a new phone needs only a sign-in — their latest team is pinned as &ldquo;my team&rdquo; again automatically, every team the account follows reads <strong>Following</strong> on the public pages, and unfollowing while signed in removes the team everywhere, not just on that device. A fan who creates that account right from the follow prompt keeps the team they just followed automatically and lands back on the page they were watching. (On a shared device, a pin that appeared just by signing in clears again at sign-out — teams followed by tapping Follow on that device stay.)</p>
              <p><strong>Either way, the app opens on Home</strong>, which gathers every team they follow across every tournament — one card per tournament, leading with that tournament and their team&rsquo;s live score, next game, or last result, with live events first and finished ones tucked into a <strong>Past</strong> group; tapping a card jumps straight into that event. The full list, with a star to unfollow, lives on the <strong>All following</strong> page reached from Home.</p>
              <p><strong>On game day</strong> a followed team also gets a <strong>my-team bar</strong> pinned above the bottom navigation; on the Schedule and the team&rsquo;s own page — where that team&rsquo;s live story is already on screen — it tucks into a small score pill, and a tap brings the full bar back. Each team&rsquo;s page shows its <strong>Recent results</strong> (the last few wins and losses at a glance) and, on Tournament Plus, its own score-alerts bell.</p>
              <HelpNote variant="info" title="Included on every plan">
                <p>Following, live public scores, and the home-screen app are included on every plan.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'public-site-schedule',
          title: 'The schedule opens on the right day',
          content: (
            <>
              <p>The public <strong>Schedule</strong> shows one day at a time and lands fans on the day that matters — today while the event is on (a day off lands on the next day with games), the first day before it starts, the last day after it ends. A row of date chips switches days, and an <strong>All days</strong> chip brings back the full-event view; events with many dates (like a Saturdays-only series) get a compact swipeable date rail with a &ldquo;jump to a date&rdquo; list grouped by week.</p>
              <p>Inside a day, every pool&rsquo;s games run in one start-time order, each row carrying a quiet pool tag — a cross-pool matchup shows no tag, because it doesn&rsquo;t belong to just one pool. A game that doesn&rsquo;t have a date yet (say, a final awaiting scheduling) always shows in a <strong>TBD</strong> group at the bottom of the day, so nothing disappears. Playoff games are numbered — <strong>Semifinal 1</strong>, <strong>Semifinal 2</strong> — and an undecided matchup reads plainly as &ldquo;Semifinal 1 winner,&rdquo; on both the schedule list and the bracket view.</p>
            </>
          ),
        },
        {
          id: 'public-site-game-page',
          title: 'The game page',
          content: (
            <p>Tapping any game — on the schedule, the bracket, or a team&rsquo;s page — opens that game&rsquo;s own page. Before start it counts down to first pitch; while the game is on it shows the running score from 0&ndash;0 with the leading team&rsquo;s number lit up and each team&rsquo;s colour tile on display; once final, the winner and loser read at a glance. Fans can follow either team right from the <strong>Away</strong>/<strong>Home</strong> labels, <strong>Get Directions</strong> sits under the location, and the game&rsquo;s division and game length round out the details. A playoff game says what&rsquo;s at stake — &ldquo;Winner advances&rdquo; — and the championship&rsquo;s &ldquo;winner takes the title&rdquo; line shows in gold.</p>
          ),
        },
        {
          id: 'public-site-alerts',
          title: 'Score alerts',
          content: (
            <p>On Tournament Plus and above, fans who follow a team and <strong>sign in with a free FieldLogicHQ account</strong> can turn on <strong>score alerts</strong> — a push notification when their team&rsquo;s game goes live and a &ldquo;Final&rdquo; when it ends. The setting lives under <strong>Account → Notifications</strong> and covers every team they follow, on every device they sign in on. Tapping an alert opens that game, and on a branded event the notification carries your tournament logo.</p>
          ),
        },
        {
          id: 'public-site-playoffs',
          title: 'The playoff and champions moments',
          content: (
            <>
              <p><strong>When you set the playoff bracket</strong>, the public home page turns into a <strong>Playoffs</strong> view — a badge, a countdown to the first playoff game, and a link to a shareable <strong>Playoff Picture</strong> that lays out the seeding and the opening matchups. Fans with score alerts on also get a one-time &ldquo;Playoffs are set&rdquo; push. On playoff day itself, the public <strong>Schedule</strong> opens on the <strong>Playoffs</strong> stage automatically whenever the division has a playoff game live or scheduled that day — fans land on the games that matter without touching the toggle, and a game that&rsquo;s underway shows a running score with a LIVE tag (never a winner) until it&rsquo;s final.</p>
              <p><strong>When the whole playoffs finish</strong> and the champion is decided, the public home page switches to its <strong>finished wrap-up</strong> &mdash; the champions (every tier, including Gold and Silver) and the final standings, with the live &ldquo;next game&rdquo; sections retired. Fans with score alerts on also get a one-time &ldquo;Champions crowned&rdquo; push, and a shareable <strong>Champions</strong> page headlines the winning team and lists every tier&rsquo;s winner alongside the final standings.</p>
              <HelpNote variant="tip" title="No extra step">
                <p>It all happens off the scores you already enter — you don&rsquo;t need to mark the tournament complete first.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'public-site-fan-app',
          title: 'Add to home screen (the fan app)',
          content: (
            <>
              <p>Fans can add the tournament to their phone&rsquo;s home screen and open it like an app — straight to your event. On iPhone, alerts only work once the page has been added to the home screen (Apple&rsquo;s rule), so the alerts button there shows an &ldquo;add to home screen for alerts&rdquo; prompt first, with a one-time reminder after they install. On Tournament Plus events the home-screen icon and app name carry your tournament branding — you set the icon background colour and a short app name under <strong>Branding → App Icon</strong>; free events use the default FieldLogicHQ icon.</p>
              <p><strong>Telling a parent who&rsquo;s on a computer.</strong> A phone is what installs the app, so on a laptop the app screens show a <strong>QR code</strong> &mdash; in the page footer, and as a <strong>Get the app</strong> card under <strong>Account</strong>. A parent points their phone camera at it and lands in the app on the phone, ready to add to the home screen. On a phone those screens show the direct <strong>Install app</strong> action instead, so nobody is ever told to scan a code with the device they&rsquo;re already holding.</p>
              <p><strong>Works at the field.</strong> Once a fan has opened the tournament, the installed app keeps the last-loaded scores and schedule available on a weak or dropped signal and shows a tidy &ldquo;you&rsquo;re offline&rdquo; screen instead of a browser error.</p>
            </>
          ),
        },
        {
          id: 'public-site-navigation',
          title: 'A door to the wider app',
          content: (
            <>
              <p>The app&rsquo;s own navigation stays with a fan the whole time they&rsquo;re inside your event, so someone who arrived by QR code or a shared link can always step back out &mdash; no menu to hunt for.</p>
              <HelpDefs>
                <HelpDef term="On a phone">A slim bar along the bottom: <strong>Home</strong> and <strong>Scores</strong> always, joined by <strong>Chat</strong> and <strong>Account</strong> once the fan signs in (signed out, those two collapse into a single <strong>Sign In</strong>, because both are sign-in walls until then).</HelpDef>
                <HelpDef term="On a computer">A thin strip across the top carrying the FieldLogicHQ wordmark and a <strong>Discover</strong> link back to the app-wide directory &mdash; deliberately no tab row there, so a platform &ldquo;Home&rdquo; link never sits next to your event&rsquo;s own <strong>Overview</strong> page competing to mean the same thing.</HelpDef>
              </HelpDefs>
              <p>A signed-out visitor also sees <strong>Sign In</strong> and <strong>Run a Tournament</strong>; a signed-in fan sees a chat icon (only if they&rsquo;re actually in a conversation, carrying any unread count) and a small account avatar; and a signed-in <strong>admin or coach</strong> sees one button straight to their own tools &mdash; <strong>Admin Area</strong> or <strong>Coaches Portal</strong> &mdash; in place of that CTA. It carries your event&rsquo;s colours so it reads as quiet app chrome, never a competing brand.</p>
              <p><strong>Your tournament&rsquo;s own pages</strong> sit in a row of tabs just under the branded header &mdash; <strong>Overview</strong>, News, Schedule, Standings, <strong>Playoffs</strong>, Teams, Rules (only the pages you publish), with a <strong>Share this event</strong> action on the Overview. <strong>Playoffs</strong> appears as soon as you have set up a bracket, sitting straight after Standings, so a parent hunting for &ldquo;who plays who next&rdquo; has somewhere obvious to tap. <strong>Hiding Standings hides Playoffs too</strong>, because the bracket gives the seeding away. Two formats are the exception, in opposite directions: a <strong>bracket-only</strong> event has no round-robin standings to show, so its Playoffs tab stands on its own &mdash; that bracket <em>is</em> the tournament &mdash; while an <strong>Exhibition</strong> event never shows a Playoffs tab at all, because it never has a bracket to point to.</p>
              <p>A <strong>coach, admin, or volunteer</strong> signed in and viewing the public site sees the <strong>flip pill</strong> in the top-right corner &mdash; a small <strong>&#8644;</strong> button &mdash; and one tap flips them straight to their own tools for this event, in the same tab and matched to the page they&rsquo;re on. It&rsquo;s the same control that sits in the top-right of every admin and coach screen, so one predictable spot toggles between the operator side and the public side everywhere. Fans don&rsquo;t see it &mdash; the bottom bar and the follow strip already cover signing in, following, and getting around.</p>
            </>
          ),
        },
        {
          id: 'public-site-roles',
          title: 'If you wear more than one hat at your own event',
          content: (
            <p>If you run it <em>and</em> you coach a team in it, or you also scorekeep, the control reads <strong>Roles</strong> instead of &ldquo;Public site&rdquo; and opens a short list: the public site first, then a row for each of your other roles on <em>this</em> event, named so you can tell them apart (&ldquo;Coach &middot; Milton Mustangs&rdquo;). One tap goes straight there in the same tab, so you no longer have to detour out to the public site to get from your admin screens to your team. It works in both directions, and if you coach two teams in the same event you get a row for each. <strong>If you only hold one role, nothing changes</strong> &mdash; the control stays the plain &ldquo;Public site&rdquo; link it has always been.</p>
          ),
        },
        {
          id: 'public-site-search',
          title: 'Search on Home',
          content: (
            <p>The app&rsquo;s <strong>Home</strong> leads with a search that finds a <strong>Tournament</strong>, a <strong>Team</strong>, or an <strong>Organization</strong> by name, with a chip to narrow to one kind. A tournament match opens that event; an organization match opens its public page; a <strong>team</strong> match drops the fan straight onto that team&rsquo;s page inside its event. Team matches come only from tournaments listed in the public directory — a private event&rsquo;s teams never appear, and only the team name and its event are shown, never rosters or contacts.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-fan-score-alerts',
          question: 'Can fans get a notification when their team scores?',
          answerText: 'Yes, on Tournament Plus and above. A fan follows a team on the public site, signs in with a free FieldLogicHQ account, and turns on score alerts — a push when the game goes live and a Final when it ends. The alerts bell appears beside the follow controls on the Schedule and right on the team\'s own page. The setting lives under Account → Notifications, covers every team they follow, and works on every device they sign in on. Following, live public scores, and the home-screen app stay free on every plan and never need an account — alerts are what signing in gets you.',
          keywords: ['score alerts', 'fan alerts', 'push notification', 'follow a team', 'live score', 'Tournament Plus', 'sign in', 'fan account', 'team page bell', 'alerts bell'],
          popular: true,
          answer: (
            <>
              <p>Yes — on <strong>Tournament Plus and above</strong>. A fan follows a team on the public tournament site, <strong>signs in with a free FieldLogicHQ account</strong>, and taps <strong>Get score alerts</strong> — the alerts bell sits beside the follow controls on the Schedule and right on the team&rsquo;s own page. They get a push when that team&rsquo;s game goes live and a &ldquo;Final&rdquo; when it ends. The setting lives under <strong>Account → Notifications</strong>, covers every team they follow, and works on every device they sign in on.</p>
              <p>Following a team, live public scores, and adding the FieldLogicHQ app to the home screen are included on <strong>every plan</strong> and never need an account — <strong>alerts are what signing in gets you</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-follows-new-device',
          question: 'Do a fan&rsquo;s followed teams carry over to a new phone?',
          answerText: 'Yes — with a free account. Follows made while signed in live on the account, so on a new phone the fan just signs in: their most recent team in a tournament is pinned as "my team" again automatically, and every team the account follows shows "Following" on the public pages. Unfollowing while signed in removes the team from the account too, so it stays gone everywhere. Without an account, follows live only on the device where they were made. On a shared device, a pin that appeared just from signing in clears at sign-out; teams followed by tapping Follow on that device stay.',
          keywords: ['new phone', 'new device', 'follows carry over', 'lost my team', 're-follow', 'sign in follows', 'account follows', 'shared device', 'my team missing'],
          popular: true,
          answer: (
            <>
              <p>Yes — with a free account. Follows made while signed in live on the account, so on a new phone the fan just <strong>signs in</strong>: their most recent team in a tournament is pinned as &ldquo;my team&rdquo; again automatically, and every team the account follows shows <strong>Following</strong> on the public pages. Unfollowing while signed in removes the team from the account too, so it stays gone everywhere.</p>
              <p>Without an account, follows live only on the device where they were made. On a shared device, a pin that appeared just from signing in clears at sign-out — teams followed by tapping <strong>Follow</strong> on that device stay.</p>
            </>
          ),
        },
        {
          id: 'faq-following-tab',
          question: 'Where does a fan see the teams they follow?',
          answerText: 'The FieldLogicHQ app opens on Home, which gathers every team a fan follows across every tournament in one place — one card per tournament, leading with that tournament and their team’s live score, next game, or latest result, with live events first and finished ones tucked into a Past group. Tapping a card jumps straight into that tournament, with their team front and centre. Home also carries whole-tournament follows (an event card with a status line, no team line) and a Following · Organizations section for organizers the fan follows. The full list — teams, whole events, and organizations, each with a star to unfollow — lives on the All following page, reached from Home. Score alerts are managed under Account → Notifications. The Scores tab is the companion view: where Home shows one card per tournament, Scores lists the actual games for the teams and events a fan follows — a My Events strip on top (which also carries one tile per followed organization while it has something on), then My Games with anything live pinned first, today, the next few days, and recent results. A fan who follows nothing, or isn’t signed in, sees a platform-wide board of tournaments live right now instead, so the tab is never empty. In short: Home gathers who you follow; Scores shows their games as they happen.',
          keywords: ['home tab', 'all following', 'following', 'my teams', 'followed teams', 'your team', 'past events', 'scores tab', 'my events', 'my games', 'live board', 'live games', 'account follows', 'cross tournament', 'unfollow', 'organizations', 'following organizations', 'whole event', 'organization card', 'org tile'],
          popular: true,
          answer: (
            <>
              <p>The FieldLogicHQ app opens on <strong>Home</strong>, which gathers every team a fan follows across every tournament in one place — <strong>one card per tournament</strong>, leading with that tournament and their team&rsquo;s live score, next game, or latest result, with live events first and finished ones tucked into a <strong>Past</strong> group. Tapping a card jumps straight into that tournament, with their team front and centre. Home also carries <strong>whole-tournament</strong> follows (an event card with a status line) and a <strong>Following · Organizations</strong> section for organizers a fan follows. The full list — teams, whole events, and organizations, each with a star to unfollow — lives on the <strong>All following</strong> page, reached from Home.</p>
              <p>The <strong>Scores</strong> tab is the companion view. Where Home shows one card per tournament, Scores lists the actual <strong>games</strong> for the teams and events you follow — a <strong>My Events</strong> strip on top (which also carries one tile per followed <strong>organization</strong> while it has something on), then <strong>My Games</strong> with anything <strong>live</strong> pinned first, then today, the next few days, and recent results. A fan who follows nothing, or isn&rsquo;t signed in, sees a platform-wide board of tournaments live right now instead, so the tab is never empty. In short: <strong>Home</strong> gathers who you follow; <strong>Scores</strong> shows their games as they happen.</p>
            </>
          ),
        },
        {
          id: 'faq-follow-tournament-org',
          question: 'Can a fan follow a whole tournament or an organization, not just a team?',
          answerText: 'Yes — and neither needs an account. A "Follow this tournament" strip sits just under the event header on a tournament\'s home page (and as a row in the account menu opened from the header chip); one tap follows the whole event, so it shows up on the fan\'s Home with a live status line (like "3 live now" or "Starts Saturday") and as a tile on their Scores tab until it wraps up. Following an organization works the same way — a Follow button on the organizer\'s public page (/{org}) — and puts a permanent card on the fan\'s Home showing that organizer\'s next event ("Next: Summer Classic · Aug 8–10") or a quiet off-season line, so their next tournament finds the fan instead of the fan hunting for it. Both follow instantly with no sign-in; signing in is a quiet, optional nudge that syncs follows across devices and unlocks score alerts. When a signed-in fan first signs in, they get one explicit offer to bring this device\'s follows onto their account — nothing ever moves silently. All three follow types — teams, whole tournaments, and organizations — are grouped on the All following page, each with a star to unfollow.',
          keywords: ['follow a tournament', 'follow the whole event', 'follow an organization', 'follow organizer', 'whole event', 'organization follow', 'org follow', 'following organizations', 'no account', 'follow button', 'next event'],
          popular: true,
          answer: (
            <>
              <p>Yes — and neither needs an account. A <strong>&ldquo;Follow this tournament&rdquo;</strong> strip sits just under the event header on a tournament&rsquo;s home page (and as a row in the account menu opened from the header chip); one tap follows the <strong>whole event</strong>, so it shows up on the fan&rsquo;s <strong>Home</strong> with a live status line (like &ldquo;3 live now&rdquo; or &ldquo;Starts Saturday&rdquo;) and as a tile on their <strong>Scores</strong> tab until it wraps up.</p>
              <p>Following an <strong>organization</strong> works the same way — a <strong>Follow</strong> button on the organizer&rsquo;s public page — and puts a permanent card on the fan&rsquo;s Home showing that organizer&rsquo;s next event (&ldquo;Next: Summer Classic · Aug 8&ndash;10&rdquo;) or a quiet off-season line, so their next tournament finds the fan instead of the fan hunting for it.</p>
              <p>Both follow <strong>instantly with no sign-in</strong>; signing in is a quiet, optional nudge that syncs follows across devices and unlocks <strong>score alerts</strong>. A signed-in fan gets one explicit offer to bring this device&rsquo;s follows onto their account — nothing ever moves silently. All three follow types — teams, whole tournaments, and organizations — are grouped on the <strong>All following</strong> page, each with a star to unfollow.</p>
            </>
          ),
        },
        {
          id: 'faq-home-search',
          question: 'Can a fan search for a team or organization, not just a tournament?',
          answerText: 'Yes. The app\'s Home leads with a search that finds a Tournament, a Team, or an Organization by name, with chips to narrow to one kind. A tournament match opens that event; an organization match opens its public page; a team match opens that team\'s page inside its tournament. Team matches only come from tournaments that are listed in the public directory (the "List in public tournament directory" toggle in Event Settings) — a team in an unlisted or private event never appears in search, and results show only the team name and its event, never rosters, coach contacts, or player information. The Teams chip only shows when a search actually finds teams. No account is needed to search.',
          keywords: ['search', 'home search', 'search for a team', 'find a team', 'search for an organization', 'find an organization', 'search teams', 'search organizations', 'search bar', 'find a tournament', 'type chips', 'team search', 'org search'],
          answer: (
            <>
              <p>Yes. The app&rsquo;s <strong>Home</strong> leads with a search that finds a <strong>Tournament</strong>, a <strong>Team</strong>, or an <strong>Organization</strong> by name — with chips to narrow to one kind. A tournament match opens that event, an organization match opens its public page, and a <strong>team</strong> match opens that team&rsquo;s page inside its tournament.</p>
              <p>Team matches come only from tournaments <strong>listed in the public directory</strong> (the &ldquo;List in public tournament directory&rdquo; toggle in Event Settings). A team in an unlisted or private event never appears, and results show only the <strong>team name and its event</strong> — never rosters, coach contacts, or player information. The <strong>Teams</strong> chip only appears when a search actually finds teams, and no account is needed to search.</p>
            </>
          ),
        },
        {
          id: 'faq-schedule-day-view',
          question: 'Why does the public schedule show only one day of games?',
          answerText: 'By design — the schedule opens on the day that matters so fans stop scrolling past other days to find what\'s on now: today during the event (a day off lands on the next day with games), the first day before the event, the last day after it. The date chips above the list switch days, and the All days chip shows the whole event at once. Events with many dates get a compact swipeable date rail with a jump-to-a-date list grouped by week. Searching a team or tapping My Games always shows that team\'s whole event regardless of the selected day. A game with no date yet appears in a TBD group at the bottom of every day.',
          keywords: ['one day', 'day view', 'day selector', 'all days', 'date chips', 'missing games', 'where are the other days', 'schedule only shows today', 'my games', 'tbd'],
          popular: true,
          answer: (
            <>
              <p>By design — the schedule opens on the day that matters, so fans aren&rsquo;t scrolling past other days to find what&rsquo;s on now. During the event that&rsquo;s <strong>today</strong> (a day off lands on the next day with games); before the event it&rsquo;s the first day, and after, the last.</p>
              <p>The <strong>date chips</strong> above the list switch days, and the <strong>All days</strong> chip brings back the whole event at once. Events with many dates get a compact swipeable date rail plus a &ldquo;jump to a date&rdquo; list grouped by week. Searching a team or tapping <strong>My Games</strong> always shows that team&rsquo;s whole event, whatever day is selected — and a game with no date yet appears in a <strong>TBD</strong> group at the bottom of every day, so nothing is ever hidden.</p>
            </>
          ),
        },
        {
          id: 'faq-iphone-alerts',
          question: "Why don't score alerts appear on some iPhones?",
          answerText: 'Apple only allows web push alerts on iPhone and iPad after the page is added to the home screen. Until then the alerts button shows an add-to-home-screen prompt. A fan can add the app two ways — from that prompt on a tournament page, or from the Install app row on the Account tab — and once they open it from the home screen, the Get score alerts button works normally. Android shows the alerts button directly.',
          keywords: ['iphone alerts', 'ipad', 'add to home screen', 'safari', 'no alerts button', 'apple', 'install app', 'account tab', 'install from account'],
          answer: (
            <>
              <p>On iPhone and iPad, Apple only allows these alerts <strong>after the page is added to the home screen</strong>. Until then, the alerts control shows an &ldquo;add to home screen for alerts&rdquo; prompt instead of a button that wouldn&rsquo;t work.</p>
              <p>A fan can add the app two ways — from that prompt on a tournament page, or from the <strong>Install app</strong> row on the <strong>Account</strong> tab. Once they open it from the home screen, the <strong>Get score alerts</strong> button works normally, with a one-time reminder to switch alerts on. Android shows the alerts button directly — no install step needed.</p>
            </>
          ),
        },
        {
          id: 'faq-app-appearance',
          question: "Can people change how the app looks, and does it affect my tournament's colours?",
          answerText: "Anyone can pick a Warm (light) or Dark look for FieldLogicHQ under Account then Appearance. Warm is the default; Dark is optional. It's ONE account-wide setting per person — not one per area — that follows a signed-in person across their devices (signed out, it's remembered on that one device). The choice applies everywhere they work: the app's own screens (Home, Scores, Chat, Account), an organizer's admin panel, and, for coaches, their whole coaches workspace. It never changes your tournament pages: those always show your organization's branding and colours to everyone, so someone choosing Dark can't change how your event looks.",
          keywords: ['dark mode', 'light mode', 'dark theme', 'warm', 'warm default', 'default theme', 'app appearance', 'appearance', 'theme', 'app colours', 'app colors', 'does dark mode change my tournament', 'account appearance', 'app looks different', 'change app colour', 'coaches workspace theme', 'coach portal colours', 'change coaches portal colour', 'one setting or per area', 'admin panel dark', 'does dark mode change my admin'],
          answer: (
            <>
              <p>Yes — under <strong>Account &rarr; Appearance</strong>, anyone can switch FieldLogicHQ between a <strong>Warm</strong> (light) look and a <strong>Dark</strong> look. <strong>Warm is the default</strong>; Dark is there for anyone who prefers it.</p>
              <p>It&rsquo;s <strong>one setting per person</strong> — not one per area. It follows a signed-in person across their devices and applies everywhere they work: the app&rsquo;s own screens (<strong>Home, Scores, Chat, Account</strong>), an organizer&rsquo;s <strong>admin panel</strong>, and, for coaches, their whole <strong>coaches workspace</strong>. (Signed out, it&rsquo;s remembered on that one device.)</p>
              <p>It <strong>never</strong> changes your tournament pages. Those always show <strong>your organization&rsquo;s branding and colours</strong> to everyone, so someone choosing Dark can&rsquo;t affect how your event looks.</p>
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
      summary: 'Mark it complete, share and print how it finished, reuse the setup — and where every status change lives.',
      keywords: ['closeout', 'complete tournament', 'mark complete', 'ready to finalize', 'finalize tournament', 'archive', 'seal', 'final results', 'completed', 'archived', 'sealed', 'Manage Tournaments', 'Archives', 'Past tournaments', 'Tournaments list', 'Post-event summary', 'summary', 'how it finished', 'champions link', 'standings link', 'print summary', 'reopen', 'bring back', 'move back to draft', 'delete tournament', 'event record', 'sealed records', 'public ledger', 'results are locked'],
      searchText: 'closeout tournament complete mark complete mark tournament complete every game in ready to finalize finalize dashboard prompt lock results read-only results are locked reopen archive seal final results post-event summary free tournament slot immutable snapshot permanent public record public site goes offline links stop working bring back an archived tournament unarchive restore board report results email lifecycle draft active completed archived sealed public page shows final results automatically without marking complete fans champions final standings wrap up next on the schedule do i need to mark complete round robin manage tournaments archives past tournaments tournaments list finished board finished dashboard how it finished final not scored no final copy champions link copy standings link the event in numbers teams played games played collected still owed print letter one page next year reuse this setup event record status activate move back to draft delete this tournament public link sealed records public ledger free slot link taken',
      links: [
        { label: 'Tournaments', href: '../tournaments/manage' },
        { label: 'Summary', href: '../tournaments/summary' },
      ],
      content: (
        <>
          <p>When the last game is in, mark the tournament complete. Its dashboard becomes the finished board, <strong>Summary</strong> gives you a recap to share and print, and every later change &mdash; reopen, archive, bring back, seal, or delete &mdash; lives in the tournament&rsquo;s record.</p>
        </>
      ),
      subtopics: [
        {
          id: 'closeout-mark-complete',
          title: 'Mark the tournament complete',
          content: (
            <>
              <p>Once every game is in, your tournament dashboard shows <strong>Every game&rsquo;s in &mdash; ready to finalize</strong> with a <strong>Mark tournament complete</strong> button. You can also open the tournament from the <strong>Tournaments</strong> list and tap <strong>Mark complete</strong> in its record, or use the status switch in <strong>Event Settings</strong>.</p>
              <p>Each asks first and says what will happen: its results become read-only and final, and registration closes; on the <strong>Tournaments</strong> list it moves down to <strong>Completed</strong>. Its public site stays online. If the post-event results email is on, the question says each team&rsquo;s coach will get it.</p>
              <p>Your public tournament page shows its finished wrap-up &mdash; the champions and final standings &mdash; on its own once the games are done, so completing is about locking your records, not about what fans see.</p>
            </>
          ),
        },
        {
          id: 'closeout-finished-board',
          title: 'The finished dashboard',
          content: (
            <>
              <p>A completed tournament&rsquo;s dashboard shows how it ended and what comes next:</p>
              <ul>
                <li><strong>How it finished</strong> &mdash; each division&rsquo;s champion and the final&rsquo;s score. A division whose final was never scored shows the team first in the standings, marked <em>final not scored</em>; a division with no final shows its standings leader. An Exhibition shows its figures instead, because it names no winner.</li>
                <li>The line under it &mdash; the teams that played, the games played, what was collected, and anything still owed.</li>
                <li><strong>Copy champions link</strong> &mdash; copies the public champions page in one tap, or <strong>Copy standings link</strong> when the public page has no champion to name. If you hid the Standings page, there is no link to copy, and the board says why.</li>
                <li><strong>Next year</strong> &mdash; <strong>Reuse this setup</strong>, on Tournament Plus and above.</li>
                <li><strong>Summary</strong> &mdash; the door to the tournament&rsquo;s recap.</li>
              </ul>
              <p>On the Tournament plan, Next year says how many tournament slots are in use and offers <strong>Archive this tournament</strong>, so the slot is free for your next event.</p>
            </>
          ),
        },
        {
          id: 'closeout-summary',
          title: 'Summary and its printed page',
          content: (
            <>
              <p>Summary, on Tournament Plus and above, is the tournament&rsquo;s recap on one page: <strong>How it finished</strong>, <strong>The event in numbers</strong> (the teams that played, games played, what was collected, and anything still owed), and <strong>Next year</strong>. <strong>Copy champions link</strong> and <strong>Print</strong> sit at the top.</p>
              <p>Tap <strong>Print</strong> for a one-page recap on Letter paper &mdash; how each division finished and the final standings &mdash; with nothing of the admin screen around it.</p>
              <p>The money counts every accepted team, including one that never played a game; the teams figure counts only the teams that played. A tournament that charged no fees and collected nothing shows no money figures.</p>
            </>
          ),
        },
        {
          id: 'closeout-two-lists',
          title: 'The Tournaments list',
          content: (
            <>
              <p>Every tournament is on one list, <strong>Tournaments</strong>, in the <strong>Admin</strong> section of the menu. It used to be two lists, Tournaments and Past tournaments (and before that, Manage Tournaments and Archives). Each tournament sits in one group, by where it is in its life:</p>
              <ul>
                <li><strong>Active</strong> and <strong>Draft</strong> &mdash; what&rsquo;s ahead, soonest first.</li>
                <li><strong>Completed</strong> and <strong>Archived</strong> &mdash; what&rsquo;s finished, most recent first.</li>
                <li><strong>Sealed records</strong> &mdash; each opens its permanent public record; <strong>Public ledger</strong> opens the public page that lists them.</li>
              </ul>
              <p>Each group says whether its public sites are online. Tap a tournament to open its record. On Tournament Plus and above, a completed tournament&rsquo;s row also carries <strong>Reuse setup</strong>. On the Tournament plan the list says how many tournament slots are in use, and the tournament holding a slot is on the same list.</p>
            </>
          ),
        },
        {
          id: 'closeout-record',
          title: 'Change a status from the tournament’s record',
          content: (
            <>
              <p>Every status change lives in the tournament&rsquo;s record, and each one asks first, saying what it will do to the public site, registration, and your tournament slot:</p>
              <ul>
                <li><strong>Draft</strong> &mdash; <strong>Activate</strong> puts the public site online. It needs dates, a division, and a contact first; the record says what to add.</li>
                <li><strong>Active</strong> &mdash; <strong>Mark complete</strong>, or <strong>Move back to draft</strong>, which takes the public site offline so every link you&rsquo;ve shared stops working.</li>
                <li><strong>Completed</strong> &mdash; <strong>Reopen</strong> makes its results editable again and moves it back to Tournaments. <strong>Archive</strong> takes its public site offline and frees its tournament slot.</li>
                <li><strong>Archived</strong> &mdash; <strong>Bring back</strong> returns it as Completed, with its public site online at the same links.</li>
              </ul>
              <p>On Tournament Plus and above, a finished tournament&rsquo;s <strong>Permanent record</strong> offers <strong>Seal</strong>, which keeps a permanent public record of its results in your public ledger. Sealing can&rsquo;t be undone, and a sealed tournament can&rsquo;t be reopened.</p>
              <p>The record&rsquo;s <strong>Details</strong> &mdash; name, year, public link, and dates &mdash; edit with the pencil and save as you go. Changing the public link asks first, because every link you&rsquo;ve already shared stops working. A tournament that isn&rsquo;t active can be deleted from the end of its record.</p>
            </>
          ),
        },
      ],
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
          answerText: 'When every game is in, your tournament dashboard shows "Every game’s in — ready to finalize" with a Mark tournament complete button. You can also open the tournament from the Tournaments list and tap Mark complete in its record. Either way it asks first. Completing locks the results; to make changes afterwards, reopen it from the Tournaments list.',
          keywords: ['mark complete', 'ready to finalize', 'finalize tournament', 'close out', 'dashboard prompt', 'lock results', 'Manage Tournaments'],
          popular: true,
          answer: (
            <p>When every game is in, your tournament <strong>dashboard</strong> shows <strong>Every game&rsquo;s in &mdash; ready to finalize</strong> with a <strong>Mark tournament complete</strong> button. You can also open the tournament from the <strong>Tournaments</strong> list and tap <strong>Mark complete</strong> in its record. Either way it asks first. Completing locks the results and standings as final; to make changes afterwards, reopen it from the <strong>Tournaments</strong> list.</p>
          ),
        },
        {
          id: 'faq-reopen-completed',
          question: 'How do I change a completed tournament?',
          answerText: 'A completed tournament’s results are locked. Open it from the Tournaments list and tap Reopen: its results become editable again and it moves back to Active. A sealed tournament can’t be reopened.',
          keywords: ['reopen', 'results are locked', 'locked', 'edit completed tournament', 'undo complete', 'change results after complete'],
          answer: (
            <p>A completed tournament&rsquo;s results are locked. Open it from the <strong>Tournaments</strong> list and tap <strong>Reopen</strong>: its results become editable again and it moves back to <strong>Active</strong>, with its public site still online. A sealed tournament can&rsquo;t be reopened.</p>
          ),
        },
        {
          id: 'faq-completed-archived-sealed',
          question: 'What is the difference between completed, archived, and sealed?',
          answerText: 'Completed means the event is over: its results are read-only, its public site stays online, and it still holds a tournament slot. Archived takes its public site offline and frees the slot; you can bring it back from the Tournaments list. Sealed means a permanent public record of its results was kept in your public ledger; sealing can’t be undone, and a sealed tournament can’t be reopened.',
          keywords: ['completed', 'archived', 'sealed', 'lifecycle', 'Archives', 'Past tournaments'],
          popular: true,
          answer: (
            <p><strong>Completed</strong> means the event is over: its results are read-only, its public site stays online, and it still holds a tournament slot. <strong>Archived</strong> takes its public site offline and frees the slot; you can bring it back from the <strong>Tournaments</strong> list. <strong>Sealed</strong> means a permanent public record of its results was kept in your public ledger; sealing can&rsquo;t be undone, and a sealed tournament can&rsquo;t be reopened.</p>
          ),
        },
        {
          id: 'faq-completed-counts-limit',
          question: 'Does a completed tournament still count against my plan limit?',
          answerText: 'Completed tournaments still count against the tournament slot limit until archived.',
          keywords: ['plan limit', 'slot', 'completed', 'archive'],
          popular: true,
          answer: (
            <p>Yes. A completed tournament still holds a tournament slot. Archive it when you are ready to retire it and free that slot.</p>
          ),
        },
        {
          id: 'faq-free-slot',
          question: 'How do I free up a tournament slot?',
          answerText: 'Archive a finished tournament: open it from the Tournaments list and tap Archive. On the Tournament plan its finished dashboard also offers Archive this tournament. Its public site goes offline, so every link you have shared stops working.',
          keywords: ['free slot', 'plan limit', 'archive tournament'],
          answer: (
            <p>Archive a finished tournament: open it from the <strong>Tournaments</strong> list and tap <strong>Archive</strong>. On the Tournament plan, its finished dashboard also offers <strong>Archive this tournament</strong>. Archived tournaments keep their teams, games, and payments but no longer hold a slot. Archiving takes the public site offline, so every link you&rsquo;ve shared stops working.</p>
          ),
        },
        {
          id: 'faq-bring-back-archived',
          question: 'Can I bring an archived tournament back?',
          answerText: 'Yes. Open it from the Tournaments list and tap Bring back. It comes back as Completed, and its public site goes back online at the same links. It needs a free tournament slot: if every slot is in use, the record says which event holds it before you tap anything. If another tournament now uses its public link, change this tournament’s public link in Details first.',
          keywords: ['bring back archived', 'restore tournament', 'unarchive', 'undo archive', 'reactivate tournament', 'archived by mistake', 'public site offline', 'Archives'],
          answer: (
            <>
              <p>Yes. Open it from the <strong>Tournaments</strong> list and tap <strong>Bring back</strong>. It comes back as <strong>Completed</strong>, and its public site goes back online at the same links.</p>
              <p>It needs a free tournament slot: if every slot is in use, the record says which event holds it before you tap anything. If another tournament now uses its public link, change this tournament&rsquo;s public link in <strong>Details</strong> first.</p>
            </>
          ),
        },
        {
          id: 'faq-when-seal',
          question: 'When should I seal a tournament?',
          answerText: 'Seal only when all scores are verified and final, because sealing is permanent and a sealed tournament can’t be reopened. Seal it from its record’s Permanent record, on Tournament Plus and above. Its sealed public record stays even if you later delete the tournament.',
          keywords: ['seal', 'permanent', 'final results', 'archive', 'permanent record', 'public ledger'],
          answer: (
            <p>Seal only after all scores, standings, and final results have been reviewed: sealing is permanent, and a sealed tournament can&rsquo;t be reopened. Seal it from its record&rsquo;s <strong>Permanent record</strong>, on Tournament Plus and above. Its sealed public record stays even if you later delete the tournament.</p>
          ),
        },
        {
          id: 'faq-post-event-summary',
          question: 'What is the post-event summary for?',
          answerText: 'Summary, on Tournament Plus and above, is a finished tournament’s recap on one page: how each division finished, the event in numbers, and Reuse this setup for next year. Copy the champions link to share it, or Print a one-page recap on Letter paper for your records.',
          keywords: ['summary', 'Post-event summary', 'recap', 'post-event', 'print', 'champions link', 'clone next year', 'renewal'],
          answer: (
            <p><strong>Summary</strong>, on Tournament Plus and above, is a finished tournament&rsquo;s recap on one page: how each division finished, the event in numbers, and <strong>Reuse this setup</strong> for next year. Copy the champions link to share it, or <strong>Print</strong> a one-page recap on Letter paper for your records.</p>
          ),
        },
      ],
    },

    {
      id: 'data-tools-imports',
      group: 'Close Out',
      heading: 'Importing teams and schedules',
      summary: 'Use Data Tools for spreadsheet templates, safe previews, and recent import history.',
      keywords: ['import', 'data tools', 'xlsx', 'csv', 'spreadsheet', 'templates', 'teams', 'schedule', 'blocked rows', 'current template', 'empty template', 'field names', 'location column', 'unmatched', 'link after import'],
      searchText: 'import data tools spreadsheet templates xlsx csv preview teams registrations schedule bulk add update recent imports blocked rows current template empty template warnings location column field names matched automatically unmatched field names didn\'t match typed text third-party schedule link typed text to a real field afterwards from the schedule page without re-importing',
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
            <strong>Field names in the Location column link themselves when they match.</strong> A
            schedule row whose Location exactly names one of your venues or fields (capitalization
            and punctuation don&apos;t matter) is linked to the real field record, so those games are
            covered by double-booking checks. Names that don&apos;t match are listed <em>by name, with a
            game count</em> in the preview — they import as typed text, aren&apos;t checked for
            double-bookings, and never block the file. A name matching more than one field stays
            text with a warning rather than being guessed; use the Venue/Facility columns to be
            exact. Anything that imported as typed text can be linked to a real field afterwards
            from the <strong>Schedule</strong> page, without re-importing the file.
          </p>
          <p>
            Schedule imports block scored, submitted, completed, generator-locked, playoff,
            pool-slot structural, and facility-lane structural changes. A completed tournament
            is locked until you reopen it from the Tournaments list. Scores, delete imports, and
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
            <li><strong>Schedule</strong> — Excel, CSV, or iCal to add games to Google Calendar, Apple Calendar, or Outlook; PDF wall copy (Tournament Plus). The PDF is built to be pinned up: one section per day, headed with the weekday, the number of games and the park. A cancelled game shows <strong>CANCELLED</strong> where its start time would be, so nobody reads it as a game still on.</li>
            <li><strong>Results</strong> — Excel or CSV, including who submitted each score, when, and through which door; PDF post-event board report grouped by division (Tournament Plus). The PDF prints the games and scores only — the score-submission trail is working data and stays in Excel and CSV.</li>
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
