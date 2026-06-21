import type { HelpPageContent } from './index';

const coachesHelp: HelpPageContent = {
  title: 'Coaches Portal',
  role: 'Coach',
  intro:
    'The Coaches Portal is your free home base for the teams you coach — your roster, schedule, team fees, and parent announcements in one place, year-round and between tournaments. Turn on only the tools you need. Coaches Portal Premium adds the serious-operator extras on top.',
  searchPlaceholder: 'Search coach help — roster, schedule, fees, announcements…',
  sections: [
    {
      id: 'overview',
      group: 'Getting started',
      heading: 'What the Coaches Portal is',
      summary: 'A free, year-round team home that grows from a single tournament into your full-season workspace.',
      keywords: ['coaches portal', 'free', 'team home', 'what is', 'overview', 'coach'],
      searchText: 'coaches portal free team home tournament participant year round roster schedule fees announcements premium upgrade what is overview',
      content: (
        <>
          <p>The Coaches Portal is free. It often starts when you register a team for a tournament, but it&apos;s built to stay useful between events — a year-round home for your roster, schedule, team fees, and parent announcements.</p>
          <p>The portal opens with two sections always available:</p>
          <ul>
            <li><strong>Overview</strong> — your team at a glance: roster size, your next event, unpaid fees, how many parents you can reach, and your tournament history.</li>
            <li><strong>Tournaments</strong> — every tournament you&apos;ve registered the team for, with status and schedule.</li>
          </ul>
          <p>Four more tools — <strong>Roster</strong>, <strong>Schedule</strong>, <strong>Fees</strong>, and <strong>Announcements</strong> — are free too, but stay hidden until you turn them on from <strong>Explore</strong>. That keeps the portal simple if all you need is your tournament record.</p>
          <p><strong>Coaches Portal Premium</strong> is the paid upgrade. It adds game-day tools (positions, attendance, lineups), recurring scheduling and calendar sync, dues automation and a season budget, and document storage. Each tool below notes what Premium adds.</p>
        </>
      ),
    },
    {
      id: 'recipe-first-login',
      group: 'Getting started',
      heading: 'How to get into your portal',
      summary: 'Claim a team an organizer registered, or start a free team home from scratch.',
      keywords: ['coach login', 'first login', 'claim team', 'start free team home', 'coach portal', 'get started'],
      searchText: 'coach first login sign in coaches portal claim your team registered email start free team home organizer invited tournament registration get started access',
      content: (
        <>
          <p>There are two ways your team shows up in the portal. Sign in with the email address you use for coaching, then look for one of these.</p>
          <p><strong>Claim a team an organizer registered.</strong> If a tournament organizer registered your team using your email, a <strong>Claim your team</strong> prompt appears on your portal home. Click <strong>Claim team</strong> to link it to your account — then its status, schedule, and updates show up in your portal.</p>
          <p><strong>Start a free team home.</strong> If you don&apos;t have a team yet, click <strong>Start free team home</strong>. You don&apos;t need an organization or an invite — it&apos;s free and yours to run.</p>
          <p>A brand-new team home opens with a short three-step starter: add your first player, add practices and games, and send your first announcement. You can do them in any order, or skip straight to the tool you need.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-coach-no-team',
          question: 'Why don’t I see my team?',
          answerText: 'Make sure you signed in with the same email the organizer used to register the team. If a team was registered with your email, a "Claim your team" prompt appears on your portal home — claim it to link it. If no one registered a team for you, use "Start free team home" to create one.',
          keywords: ['missing team', 'claim team', 'no team', 'wrong email'],
          popular: true,
          answer: (
            <p>Make sure you signed in with the same email the organizer used to register the team. If a team was registered with your email, a <strong>Claim your team</strong> prompt appears on your portal home — claim it to link it. If no one registered a team for you, use <strong>Start free team home</strong> to create your own.</p>
          ),
        },
      ],
    },
    {
      id: 'explore',
      group: 'Getting started',
      heading: 'How to turn on the tools you need',
      summary: 'Roster, Schedule, Fees, and Announcements are free but off by default — turn them on from Explore.',
      keywords: ['explore', 'turn on', 'activate', 'enable tools', 'roster schedule fees announcements', 'sections missing'],
      searchText: 'explore turn on activate enable team tools roster schedule fees announcements free progressive disclosure where is my roster tab missing section',
      content: (
        <>
          <p>To keep things uncluttered, the four team tools start switched off. Open <strong>Explore</strong> (always in the menu) to see them:</p>
          <ul>
            <li><strong>Roster</strong> — enter your team once and reuse it for your next tournament registration.</li>
            <li><strong>Schedule</strong> — your tournament games plus your own practices, in one calendar.</li>
            <li><strong>Fees</strong> — track who has paid their team fees, no spreadsheet.</li>
            <li><strong>Announcements</strong> — send a note to your whole team at once.</li>
          </ul>
          <p>Each shows a <strong>Free</strong> tag. Click <strong>Turn on</strong> and the tool appears in your menu and opens for you. Ignore the ones you don&apos;t need — nothing is forced on you, and you can turn a tool on any time from Explore.</p>
          <p>If you can&apos;t find your Roster or Schedule tab, it&apos;s almost always because it hasn&apos;t been turned on yet. Open Explore and turn it on.</p>
        </>
      ),
    },
    {
      id: 'recipe-add-player',
      group: 'Your team tools',
      heading: 'How to build your roster',
      summary: 'Add players, reorder them, and store optional ages and parent contacts.',
      keywords: ['add player', 'roster', 'jersey number', 'parent contact', 'date of birth', 'reorder'],
      searchText: 'add player roster jersey number date of birth age guardian parent contact email phone reorder drag remove player edit player walk-on',
      content: (
        <>
          <p>Turn on <strong>Roster</strong> from Explore, then click <strong>Add player</strong>.</p>
          <ol>
            <li>Enter the player&apos;s name (required). Add a jersey number if you want.</li>
            <li>Optionally add a <strong>date of birth</strong> — useful when a tournament checks ages for division eligibility. Adding one asks you to confirm you have the parent&apos;s consent to store it.</li>
            <li>Optionally add a <strong>parent/guardian contact</strong> (name, email, phone) and a private note. The contact email is what your Announcements go to, so add it for any parent you&apos;ll want to message.</li>
            <li>Drag the handle to reorder players. Use the pencil to edit and the trash icon to remove.</li>
          </ol>
          <p>Your roster is yours — build it once and reuse it for every tournament you join.</p>
          <p><strong>Coaches Portal Premium adds:</strong> player positions, attendance at every practice and game, and game-day lineups and batting orders.</p>
        </>
      ),
    },
    {
      id: 'recipe-build-coach-schedule',
      group: 'Your team tools',
      heading: 'How to build your team schedule',
      summary: 'Add practices, games, and team events to one calendar.',
      keywords: ['coach schedule', 'practice', 'game', 'team event', 'opponent', 'calendar'],
      searchText: 'coach schedule add practice game team event opponent location start end time calendar list edit remove event recurring premium',
      content: (
        <>
          <p>Turn on <strong>Schedule</strong> from Explore, then click <strong>Add event</strong>.</p>
          <ol>
            <li>Choose the type: <strong>Practice</strong>, <strong>Game</strong>, or <strong>Event</strong>.</li>
            <li>Give it a title and a start time. An end time is suggested automatically and you can adjust it.</li>
            <li>Open <strong>Add location / details</strong> to set a location, a note for the team, and — for games — the opponent.</li>
            <li>Edit or remove any event with the pencil and trash icons.</li>
          </ol>
          <p>Events list in date order so your whole season reads top to bottom.</p>
          <p><strong>Coaches Portal Premium adds:</strong> recurring events (set repeating practices once), attendance taken straight from each event, and syncing your schedule to your phone&apos;s calendar.</p>
        </>
      ),
    },
    {
      id: 'recipe-track-dues',
      group: 'Your team tools',
      heading: 'How to track team fees',
      summary: 'Charge everyone or one player, then mark each fee paid as money comes in.',
      keywords: ['fees', 'team fees', 'dues', 'charge everyone', 'one player', 'mark paid', 'payment tracking'],
      searchText: 'fees team fees dues charge everyone all players one player bulk mark paid unpaid owed payment tracking ledger no online payment collection installments reminders budget premium',
      content: (
        <>
          <p>Turn on <strong>Fees</strong> from Explore. Fees is a simple way to track who has paid — it records what each player owes and what they&apos;ve paid; it does not collect money online.</p>
          <ol>
            <li>To add a fee, choose a scope: <strong>Everyone</strong> charges every player on your roster the same amount in one step, or <strong>One player</strong> charges a single player.</li>
            <li>Give the fee a label (for example, &quot;Spring registration&quot;) and an amount.</li>
            <li>As money comes in, click <strong>Mark paid</strong> on each fee. You can mark it back to unpaid if needed.</li>
          </ol>
          <p>The summary at the top shows totals for <strong>Owed</strong>, <strong>Paid</strong>, and <strong>Unpaid</strong> so you can see at a glance where collection stands.</p>
          <p><strong>Coaches Portal Premium adds:</strong> installment schedules with due dates per player, automatic overdue reminder emails, and a season budget that tracks fees, expenses, and fundraiser credits.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-fees-collect-online',
          question: 'Can players pay their fees online through the portal?',
          answerText: 'Not in the free Fees tool. It tracks who owes and who has paid — you collect payment your usual way (e-transfer, cash, cheque) and mark each fee paid. Charge everyone at once or one player at a time.',
          keywords: ['online payment', 'collect fees', 'pay online', 'e-transfer'],
          answer: (
            <p>Not in the free Fees tool. It tracks who owes and who has paid — you collect payment your usual way (e-transfer, cash, cheque) and click <strong>Mark paid</strong>. You can charge everyone at once or one player at a time.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-announcements',
      group: 'Your team tools',
      heading: 'How to message your team',
      summary: 'Email every parent with a contact email on your roster in one send.',
      keywords: ['announcements', 'email parents', 'message team', 'send announcement', 'contact parents'],
      searchText: 'announcements email parents message whole team send announcement subject body recipients contact email roster missing email recent announcements log delivery premium',
      content: (
        <>
          <p>Turn on <strong>Announcements</strong> from Explore to email your whole team at once.</p>
          <ol>
            <li>Write a <strong>subject</strong> and your <strong>message</strong>.</li>
            <li>The recipient count shows how many parents will get it — everyone on your Roster who has a contact email.</li>
            <li>Click <strong>Send announcement</strong>.</li>
          </ol>
          <p>If a player has no contact email, the page warns you and won&apos;t reach them — add an email on your Roster and use <strong>Refresh</strong> to include them. Every send is saved to a <strong>Recent announcements</strong> log showing whether it sent fully, partly, or failed.</p>
          <p><strong>Coaches Portal Premium adds:</strong> scheduling announcements ahead of time, automatic dues and event reminders, and seeing who has received each message.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-announcement-no-recipients',
          question: 'Why does it say there’s no one to email?',
          answerText: 'Announcements only reach players who have a contact email on your Roster. Add a parent/guardian email to each player on the Roster page, then use Refresh on the Announcements page to pick them up.',
          keywords: ['no recipients', 'no one to email', 'contact email', 'announcement'],
          answer: (
            <p>Announcements only reach players who have a contact email on your Roster. Add a parent/guardian email to each player on the <strong>Roster</strong> page, then use <strong>Refresh</strong> on the Announcements page to pick them up.</p>
          ),
        },
      ],
    },
    {
      id: 'tournaments',
      group: 'Tournaments',
      heading: 'Your tournament records',
      summary: 'See every tournament you’ve entered, with status and schedule, across organizations.',
      keywords: ['tournaments', 'registration', 'tournament records', 'status', 'schedule', 'history', 'accepted', 'payment', 'how to pay', 'entry fee'],
      searchText: 'tournaments tournament records registrations status schedule history across organizations bracket standings my registrations accepted what happens next payment how to pay entry fee deposit instructions pay the organizer e-transfer schedule published',
      content: (
        <>
          <p>The <strong>Tournaments</strong> section lists every tournament you&apos;ve registered the team for — across any organization — with its registration status and schedule. Your team&apos;s tournament history also appears on the Overview.</p>
          <p>Open a tournament record to see where your team stands and when it plays. The organizer running that tournament controls its schedule, brackets, and standings; your portal shows you the live view.</p>
          <p>Once the organizer <strong>accepts</strong> your team, the record adds a <strong>What&apos;s next</strong> checklist and a <strong>Payment</strong> section. If there&apos;s an entry fee to pay, the organizer&apos;s instructions — how and where to send it — appear right there under <strong>How to pay</strong>, so you don&apos;t have to dig back through your acceptance email. Your games appear automatically once the organizer publishes the schedule.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-pay-entry-fee',
          question: 'How do I pay the tournament entry fee?',
          answerText: 'You pay the organizer directly — there is no online payment through the portal. When the organizer accepts your team, open the tournament record: if a fee is owed, their payment instructions appear under "How to pay" in the Payment section (and in your acceptance email). Follow those instructions; the organizer marks your fee paid once they receive it.',
          keywords: ['pay entry fee', 'how to pay', 'payment instructions', 'tournament fee', 'deposit', 'e-transfer'],
          answer: (
            <p>You pay the organizer directly — there&apos;s no online payment through the portal. When the organizer accepts your team, open the tournament record: if a fee is owed, their payment instructions appear under <strong>How to pay</strong> in the <strong>Payment</strong> section (and in your acceptance email). Follow those instructions; the organizer marks your fee paid once they receive it.</p>
          ),
        },
      ],
    },
    {
      id: 'premium',
      group: 'Coaches Portal Premium',
      heading: 'What Coaches Portal Premium adds',
      summary: 'The serious-operator upgrade — game-day tools, automation, budget, and documents.',
      keywords: ['coaches portal premium', 'upgrade', 'premium', 'paid coaches portal'],
      searchText: 'coaches portal premium upgrade paid lineup builder attendance dues automation team budget document storage carries over organization joins start next season new season division team settings multi season year over year',
      content: (
        <>
          <p><strong>Coaches Portal Premium</strong> keeps everything in your free portal and adds the tools for running a full competitive season:</p>
          <ul>
            <li>Player positions, attendance, and game-day lineups and batting orders.</li>
            <li>Recurring schedule events and calendar sync.</li>
            <li>Dues automation — installment schedules, due dates, and overdue reminders — plus a season budget with expenses and fundraiser credits.</li>
            <li>Document storage for waivers and team forms (see below).</li>
            <li>A <strong>Settings</strong> area to start your next season yourself and set your team&apos;s division (see below).</li>
          </ul>
          <p>If your organization later joins FieldLogicHQ, your team and its history carry over automatically.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-premium-cancel',
          question: 'What happens to my data if my team is no longer on Premium?',
          answerText: 'Your free portal and tournament records stay available. Premium tools switch off, and Premium-only data is retained for a window so it can be restored where possible rather than starting over.',
          keywords: ['premium ends', 'retention', 'reactivate', 'data'],
          answer: (
            <p>Your free portal and tournament records stay available. Premium tools switch off, and Premium-only data is retained for a window so it can be restored where possible instead of starting over.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-start-next-season',
      group: 'Coaches Portal Premium',
      heading: 'How to start your next season & set your division (Premium)',
      summary: 'Roll your team into a new season yourself — your roster comes with you, the schedule starts fresh, and last year becomes read-only history.',
      keywords: ['start next season', 'new season', 'next season', 'roll over season', 'season rollover', 'team settings', 'division', 'edit division', 'past seasons', 'premium'],
      searchText: 'start next season new season next year roll over rollover carry roster forward fee plan fee template planned budget schedule starts fresh previous season read only past seasons history team settings edit change division head coach year end premium club owned admin manages seasons',
      content: (
        <>
          <p>In the <strong>Premium</strong> portal, a new <strong>Settings</strong> area lets you run your team from one year to the next yourself — without waiting on an organization admin.</p>
          <p><strong>Start next season.</strong> When a season wraps, open <strong>Settings</strong> and choose <strong>Start next season</strong>. Confirm the new season&apos;s name and year, then pick what to bring over:</p>
          <ul>
            <li>Your <strong>active roster carries forward automatically</strong> — trim or add players from there.</li>
            <li>Optionally bring over your <strong>fee plan</strong> (amounts and installments; due dates shift forward a year) and your <strong>planned budget</strong> (your projected buckets).</li>
            <li>The <strong>schedule starts fresh</strong>, and last season&apos;s money — payments, spending, and paid history — stays behind with that season.</li>
          </ul>
          <p>The previous season then becomes <strong>read-only history</strong> under <strong>Past Seasons</strong>, and you land in the new season with a short summary of what carried over and anything worth a second look — for example, confirming the carried-over fee due dates or re-collecting waivers for the new season.</p>
          <p><strong>Set your division.</strong> Settings is also where you set your team&apos;s <strong>division</strong> (for example, &quot;U13 Tier 1&quot;); it shows on your team overview.</p>
          <p>If your team is <strong>owned by a club or league</strong> (an organization adopted it), your club admin manages seasons and division for you — you&apos;ll see those as read-only.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-start-next-season',
          question: 'How do I start a new season without an admin?',
          answerText: 'On a standalone Premium team, the head coach can do it directly: open Settings and choose Start next season. Your active roster carries forward, you can optionally bring over your fee plan and planned budget, the schedule starts fresh, and last season moves to read-only Past Seasons. If your team is owned by a club or league, the club admin starts seasons for you.',
          keywords: ['start new season', 'next season', 'no admin', 'rollover', 'head coach'],
          popular: true,
          answer: (
            <p>On a standalone Premium team, the <strong>head coach</strong> can do it directly: open <strong>Settings</strong> and choose <strong>Start next season</strong>. Your active roster carries forward, you can optionally bring over your fee plan and planned budget, the schedule starts fresh, and last season moves to read-only <strong>Past Seasons</strong>. If your team is owned by a club or league, the club admin starts seasons for you.</p>
          ),
        },
        {
          id: 'faq-change-division',
          question: 'Can I change my team’s division?',
          answerText: 'Yes, on a standalone Premium team. Open Settings and edit the Division field (for example, "U13 Tier 1"); it shows on your team overview. For club-owned teams, the club admin manages the division.',
          keywords: ['change division', 'edit division', 'division', 'team settings'],
          answer: (
            <p>Yes, on a standalone Premium team. Open <strong>Settings</strong> and edit the <strong>Division</strong> field (for example, &quot;U13 Tier 1&quot;); it shows on your team overview. For club-owned teams, the club admin manages the division.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-track-documents',
      group: 'Coaches Portal Premium',
      heading: 'Player documents (Premium)',
      summary: 'Track waivers and forms with org-wide and team templates — available in the Premium team workspace.',
      keywords: ['documents', 'waiver', 'medical form', 'templates', 'completion', 'premium'],
      searchText: 'documents player documents waiver medical consent code of conduct org templates team templates track completion upload premium team workspace organization',
      content: (
        <>
          <p>Document tracking is part of the <strong>Premium team workspace</strong> (the richer workspace coaches get when their team runs under a FieldLogicHQ organization). The free standalone portal doesn&apos;t include a Documents area.</p>
          <p>In the Premium workspace, the Documents page has two parts:</p>
          <ul>
            <li><strong>Org-wide templates</strong> — waivers, medical consent, and codes of conduct published by your organization. You can download these to share with families.</li>
            <li><strong>Team templates</strong> — forms you add yourself for your own team.</li>
          </ul>
          <p>If you expect an organization form and don&apos;t see it, ask your org admin — they decide which org-wide templates exist.</p>
        </>
      ),
    },
    {
      id: 'recipe-link-parent-org',
      group: 'Coaches Portal Premium',
      heading: 'Linking your team to a parent organization (Premium)',
      summary: 'Connect a Premium team to a club or league for recognition, or hand it over entirely.',
      keywords: ['link organization', 'parent org', 'club', 'basic visibility', 'ownership transfer', 'premium'],
      searchText: 'link organization parent org club league association basic visibility link ownership transfer team becomes org owned premium workspace',
      content: (
        <>
          <p>If your team runs in the <strong>Premium team workspace</strong> and belongs to a parent club, league, or association, use <strong>Link Organization</strong> in that workspace to connect them. (The free standalone portal doesn&apos;t have this; it applies once your team is on Premium.)</p>
          <p>There are two levels, from lighter to stronger:</p>
          <ul>
            <li><strong>Basic visibility</strong> — records the association only. It does not change who runs the team or give the organization access to your roster, documents, or accounting.</li>
            <li><strong>Ownership transfer</strong> — the team becomes fully org-owned. After both sides approve, roster, schedule, documents, budget, and accounting move under the organization.</li>
          </ul>
          <p>If an organization invites your team first, review the invitation on the same page and accept or decline it.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-link-billing-vs-ownership',
          question: 'Does linking to an organization hand over my team?',
          answerText: 'Not by itself. A Basic visibility link only records the association and does not change who runs the team. Only an ownership transfer makes the team org-owned, and it requires approval from both sides.',
          keywords: ['link org', 'visibility', 'ownership', 'org owned'],
          popular: true,
          answer: (
            <p>Not by itself. A <strong>Basic visibility</strong> link only records the association and does not change who runs the team. Only an <strong>ownership transfer</strong> makes the team org-owned, and it requires approval from both sides.</p>
          ),
        },
      ],
    },
  ],
};

export default coachesHelp;
