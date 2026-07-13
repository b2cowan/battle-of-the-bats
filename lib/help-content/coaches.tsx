import type { HelpPageContent } from './index';

const coachesHelp: HelpPageContent = {
  title: 'Coaches Portal',
  role: 'Coach',
  intro:
    'The Coaches Portal is your free home base for the teams you coach — your roster, schedule, team fees, and parent announcements in one place, year-round and between tournaments. Turn on only the tools you need. Premium Coaches Portal adds the serious-operator extras on top.',
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
          <p><strong>Premium Coaches Portal</strong> is the paid upgrade. It adds game-day tools (positions, attendance, lineups), recurring scheduling and calendar sync, dues automation and a season budget, and document storage. Each tool below notes what Premium adds. On Premium, <strong>every tool is already in your sidebar</strong> — there&apos;s no Explore step; the four-tools-off model just above applies to the free portal. See <strong>Getting around your Premium portal</strong> below for the tour.</p>
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
      searchText: 'explore turn on activate enable team tools roster schedule fees announcements free progressive disclosure where is my roster tab missing section premium all tools already on no explore step sidebar',
      content: (
        <>
          <p><em>This applies to the free portal.</em> On <strong>Premium Coaches Portal</strong> every tool is already in your sidebar, so there&apos;s nothing to turn on — you can skip this section.</p>
          <p>To keep the free portal uncluttered, the four team tools start switched off. Open <strong>Explore</strong> (always in the menu) to see them:</p>
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
      searchText: 'add player roster jersey number date of birth age guardian parent contact email phone reorder drag remove player edit player walk-on positions handedness jersey size medical allergies emergency contact attendance player profile premium awards mvp best hitter hustle award give an award season awards',
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
          <p><strong>Premium Coaches Portal adds:</strong> a full player profile (positions, handedness, jersey size, allergies/medical notes and an emergency contact), season awards like MVP given out after games, attendance at every practice and game, game-day lineups and batting orders, and roster export to Excel, CSV, or PDF.</p>
        </>
      ),
    },
    {
      id: 'recipe-build-coach-schedule',
      group: 'Your team tools',
      heading: 'How to build your team schedule',
      summary: 'Add practices, games, and team events to one calendar.',
      keywords: ['coach schedule', 'practice', 'game', 'team event', 'opponent', 'calendar'],
      searchText: 'coach schedule add practice game team event opponent location address start end time calendar list edit remove event recurring premium tournament multi day week month view event types arrival call time field diamond number uniform map link recent locations',
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
          <p><strong>Premium Coaches Portal adds:</strong> more event types (league and tournament games, scrimmages, team events, and multi-day tournaments), <strong>List / Week / Month</strong> calendar views, game-day details (arrival/call time, field/diamond #, uniform) with a tap-to-open map link, recurring events (set repeating practices once), attendance taken straight from each event, and syncing your schedule to your phone&apos;s calendar. See <strong>Tournaments, games &amp; calendar views</strong> and <strong>Game-day details</strong> below.</p>
        </>
      ),
    },
    {
      id: 'recipe-run-tryouts',
      group: 'Your team tools',
      heading: 'How to run tryout day',
      summary: 'Run the whole tryout from your phone: sessions, scorecard, check-in, helper scoring, a live ranked scoreboard, Offer/Waitlist decisions, branded family offer emails with no-login Accept/Decline, and one-tap accept onto your roster with fees — kept fair with blind evaluation.',
      keywords: ['tryouts', 'tryout day', 'check-in', 'bib numbers', 'blind evaluation', 'walk-up', 'scorecard', 'evaluators', 'scoreboard', 'ranking', 'decision board', 'offer', 'waitlist', 'reveal names', 'lock scoring', 'accept', 'add to roster', 'fees', 'dues'],
      searchText: 'tryouts tryout day sessions dates times location field check in check-in bib number auto assign blind evaluation names hidden anonymous walk up walk-up add candidate print roster sheet paper backup provincial window OBA softball ontario schedule marker premium run tryouts evaluate players scorecard rubric categories skills weight rating scale 1-5 1-10 hitting fielding throwing speed attitude evaluators assistant helper no login link score scoring rate players live scoreboard ranked ranking composite weighted average bias runs hot runs cold consensus lock scoring freeze reopen reveal names unblind one-way decision board offer waitlist not this season cut pass pick selections roster accept add to roster onboard finalize fees dues standard fee schedule installments prefilled optional no card charge',
      content: (
        <>
          <p>Open the <strong>Tryouts</strong> tab for your team to run the whole day from your phone — set up, check-in, scoring, a live ranked scoreboard, and your final picks all live here.</p>
          <ol>
            <li><strong>Add your sessions.</strong> On the <strong>Tryout Day</strong> card, add each date and time (and location/field). They appear on your <strong>team schedule</strong> as read-only tryout markers.</li>
            <li><strong>Build your scorecard.</strong> On the <strong>Evaluation scorecard</strong> card, list what you&apos;re rating — for example Hitting, Fielding, Throwing, Speed — each with a weight, on a 1–5 or 1–10 scale. A starter set is filled in for you; adjust it to how you evaluate.</li>
            <li><strong>Keep it fair with Blind evaluation.</strong> It&apos;s on by default: players show as <strong>bib numbers only</strong>, with names hidden until you deliberately reveal them (step 8).</li>
            <li><strong>Open day-of check-in.</strong> Every candidate gets an <strong>auto-assigned bib number</strong>. Tap a player to check them in — a live &quot;X of Y checked in&quot; count keeps you oriented, and an <strong>Undo</strong> appears if you tap the wrong one. You can also <strong>print a paper backup sheet</strong> for spotty cell service (bib numbers only when blind).</li>
            <li><strong>Add walk-ups.</strong> If a player shows up without registering, add them with just their name (guardian details can wait) — they&apos;re checked in on the spot.</li>
            <li><strong>Invite evaluators to score.</strong> On the <strong>Evaluators</strong> card, add a helper by name to get them a private scoring link — <strong>no login, no app</strong>. It works for 48 hours and you can turn it off any time. They rate each player on your scorecard from their own phone (bib numbers only while Blind evaluation is on).</li>
            <li><strong>Watch the live scoreboard.</strong> The <strong>Live scoreboard</strong> ranks players by their weighted average across everyone scoring, and updates on its own as scores come in. If an evaluator&apos;s scores drift from the group, they&apos;re gently flagged &quot;runs hot/cold&quot; so you can weigh their input.</li>
            <li><strong>Lock scoring when you&apos;re done.</strong> Use <strong>Lock scoring</strong> on the scoreboard to freeze all evaluator input — their links stop accepting scores. You can reopen it any time if you need another look.</li>
            <li><strong>Reveal names when you&apos;re ready to decide.</strong> On the Tryout Day card, <strong>Reveal names</strong> turns off blind mode so names show on the scoreboard and decision board. It&apos;s <strong>one-way</strong> — once revealed you can&apos;t switch back to bib-only for this tryout, so you&apos;ll be asked to confirm.</li>
            <li><strong>Make your picks.</strong> On the <strong>Decision board</strong>, players are listed top-to-bottom by score; for each one tap <strong>Offer</strong>, <strong>Waitlist</strong>, or <strong>Not this season</strong>. A running tally shows where you stand.</li>
            <li><strong>Families hear from you automatically.</strong> When you <strong>Offer</strong> a player, their family gets a club-branded email with <strong>Accept</strong> and <strong>Decline</strong> buttons — a simple, no-login page, good for <strong>7 days</strong>. <strong>Waitlist</strong> sends a &quot;you&apos;re on the waitlist&quot; note; <strong>Not this season</strong> sends a warm &quot;not this time.&quot; Each offer row shows where the family stands — <em>awaiting</em>, <em>family accepted</em>, <em>declined</em>, or <em>expired</em> — and if a spot opens the board nudges you to offer a waitlisted player (it never emails a family on its own).</li>
            <li><strong>Accept them onto your roster.</strong> When a family accepts (or any time you&apos;re ready), tap <strong>Accept → add to roster</strong> — the family&apos;s response doesn&apos;t roster the player on its own; you always confirm. A quick drawer opens with their details already filled in from their registration (name, birthdate, guardian) — add an optional number, position, and jersey size. If your team already charges dues, their <strong>standard fee schedule is pre-filled</strong> and editable; leave it on to set them up with fees, or flip it off to add them now and set fees later. Confirm and they land on your roster in one step (the player and their fees are saved together — nothing half-finishes). Fees only <strong>record what&apos;s owed</strong> — no card is charged.</li>
          </ol>
          <p>Pick a tryout date outside the standard provincial tryout window and you&apos;ll get a friendly heads-up — safe to ignore if your team isn&apos;t affiliated.</p>
          <p>You run tryouts for your own team whether you coach independently or as part of a club. If you coach a club team, accepting a player also finalizes them in the org&apos;s Rep Teams area, where your club admin can manage applicants and fees too.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tryout-blind',
          question: 'Why do I only see bib numbers, not names, at tryouts?',
          answerText: 'Blind evaluation is on by default so tryouts stay fair — players show as bib numbers with names hidden. When you are ready to make decisions, use Reveal names on the Tryout Day card. Revealing is one-way: once names are shown you cannot switch back to bib-only for that tryout, so you will be asked to confirm.',
          keywords: ['blind', 'bib numbers', 'names hidden', 'anonymous', 'fair', 'reveal names', 'one-way'],
          answer: (
            <p><strong>Blind evaluation</strong> is on by default so tryouts stay fair — players show as bib numbers with names hidden. When you&apos;re ready to decide, use <strong>Reveal names</strong> on the <strong>Tryout Day</strong> card. Revealing is <strong>one-way</strong>: once names are shown you can&apos;t switch back to bib-only for that tryout, so you&apos;ll be asked to confirm first.</p>
          ),
        },
        {
          id: 'faq-tryout-lock',
          question: 'How do I stop evaluators from changing scores?',
          answerText: 'Use Lock scoring on the Live scoreboard to freeze all evaluator input — their links stop accepting scores and show a "scoring is closed" message. It is reversible: choose Reopen scoring if you need another look. Locking is a clean cutoff before you make your picks.',
          keywords: ['lock', 'lock scoring', 'freeze', 'close', 'reopen', 'evaluators'],
          answer: (
            <p>Use <strong>Lock scoring</strong> on the Live scoreboard to freeze all evaluator input — their links stop accepting scores and show a &quot;scoring is closed&quot; message. It&apos;s reversible: choose <strong>Reopen scoring</strong> if you need another look. A clean cutoff before you make your picks.</p>
          ),
        },
        {
          id: 'faq-tryout-waitlist',
          question: 'What’s the difference between Waitlist and Not this season?',
          answerText: 'On the decision board, Offer means you want the player on the team (their family gets a branded email with no-login Accept/Decline buttons, good for 7 days), Waitlist holds them as a backup and sends a waitlist note, and Not this season passes on them with a warm note. When a family accepts, you confirm with Accept → add to roster (with their fees) — the family response never rosters a player on its own.',
          keywords: ['waitlist', 'offer', 'not this season', 'cut', 'pass', 'decision', 'pick', 'accept', 'roster', 'email', 'accept decline', 'deadline'],
          answer: (
            <p>On the <strong>Decision board</strong>: <strong>Offer</strong> means you want the player on the team — their family gets a club-branded email with no-login <strong>Accept/Decline</strong> buttons (good for 7 days). <strong>Waitlist</strong> holds them as a backup and sends a waitlist note; <strong>Not this season</strong> passes with a warm note. When a family accepts, you confirm with <strong>Accept → add to roster</strong> (with their fees) — a family&apos;s response never rosters a player on its own.</p>
          ),
        },
        {
          id: 'faq-tryout-vs-admin',
          question: 'Where do families register for tryouts, and who accepts players?',
          answerText: 'Families register through the public tryout form. You run tryout day and make your picks on the Tryouts tab, and you can accept an offered player straight onto your roster (with their fees) from the Decision board. If you coach a club team, your club admin can also review and finalize applicants in the org Rep Teams area — you share the same applicant list.',
          keywords: ['registration', 'applicants', 'accept', 'offer', 'sign up', 'admin', 'roster', 'fees'],
          answer: (
            <p>Families register through the public tryout form. You run tryout <em>day</em> and make your picks on the <strong>Tryouts</strong> tab, and you can <strong>accept</strong> an offered player straight onto your roster (with their fees) from the <strong>Decision board</strong>. If you coach a club team, your club admin can also review and finalize applicants in the org&apos;s <strong>Rep Teams</strong> area — you share the same applicant list.</p>
          ),
        },
        {
          id: 'faq-tryout-evaluators',
          question: 'Can someone help me score players without an account?',
          answerText: 'Yes. On the Evaluators card, add a helper by name and you get a private scoring link to text or email them — no login and no app. The link works for 48 hours and you can turn it off any time. They rate players on your scorecard from their own phone, and their scores flow into your live scoreboard. While Blind evaluation is on they only see bib numbers, not names.',
          keywords: ['evaluators', 'evaluator', 'assistant', 'helper', 'scoring link', 'no login', 'no account', 'score', 'invite'],
          answer: (
            <>
              <p>Yes. On the <strong>Evaluators</strong> card, add a helper by name and you get a <strong>private scoring link</strong> to text or email them — no login and no app. The link works for <strong>48 hours</strong> and you can turn it off any time.</p>
              <p>They rate players on your scorecard from their own phone, and their scores flow into your <strong>Live scoreboard</strong>. While Blind evaluation is on they only see <strong>bib numbers</strong>, not names.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-bias',
          question: 'What does “runs hot” or “runs cold” mean on the scoreboard?',
          answerText: 'It is a neutral heads-up that one evaluator tends to score higher (runs hot) or lower (runs cold) than the group overall. It does not change anyone’s scores or the ranking — it just helps you weigh that person’s input. It only appears once an evaluator has scored enough players to be meaningful, so a small panel won’t trip false flags.',
          keywords: ['runs hot', 'runs cold', 'bias', 'evaluator', 'consensus', 'scoreboard', 'fair'],
          answer: (
            <p>It&apos;s a neutral heads-up that one evaluator tends to score <strong>higher (runs hot)</strong> or <strong>lower (runs cold)</strong> than the group overall. It doesn&apos;t change anyone&apos;s scores or the ranking — it just helps you weigh that person&apos;s input. It only shows once an evaluator has scored enough players to be meaningful, so a small panel won&apos;t trip false flags.</p>
          ),
        },
        {
          id: 'faq-tryout-scorecard-edit',
          question: 'Can I change my scorecard after scoring has started?',
          answerText: 'You can rename a category and change its weight any time. To protect scores already given, you can’t remove a category that players have been scored on — keep it (renaming is fine) or start a fresh tryout. Adding new categories is always allowed.',
          keywords: ['scorecard', 'rubric', 'edit', 'change', 'category', 'weight', 'delete'],
          answer: (
            <p>You can <strong>rename</strong> a category and change its <strong>weight</strong> any time. To protect scores already given, you can&apos;t <strong>remove</strong> a category that players have been scored on — keep it (renaming is fine). Adding new categories is always allowed.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-track-dues',
      group: 'Your team tools',
      heading: 'How to track team fees',
      summary: 'Charge everyone or one player, then mark each fee paid as money comes in.',
      keywords: ['fees', 'team fees', 'dues', 'charge everyone', 'one player', 'mark paid', 'payment tracking'],
      searchText: 'fees team fees dues charge everyone all players one player bulk mark paid unpaid owed payment tracking ledger no online payment collection installments reminders budget premium haven\'t paid anything yet who hasn\'t paid never paid chase unpaid list remind remind all send reminder nudge families first payment generate installments from budget plan automatic dues reminders toggle 30 day 7 day',
      content: (
        <>
          <p>Turn on <strong>Fees</strong> from Explore. Fees is a simple way to track who has paid — it records what each player owes and what they&apos;ve paid; it does not collect money online.</p>
          <ol>
            <li>To add a fee, choose a scope: <strong>Everyone</strong> charges every player on your roster the same amount in one step, or <strong>One player</strong> charges a single player.</li>
            <li>Give the fee a label (for example, &quot;Spring registration&quot;) and an amount.</li>
            <li>As money comes in, click <strong>Mark paid</strong> on each fee. You can mark it back to unpaid if needed.</li>
          </ol>
          <p>The summary at the top shows totals for <strong>Owed</strong>, <strong>Paid</strong>, and <strong>Unpaid</strong> so you can see at a glance where collection stands.</p>
          <p><strong>Premium Coaches Portal adds:</strong> installment schedules with due dates per player — build a <strong>Season Budget Plan</strong> and <strong>Generate installments</strong> creates every player&apos;s schedule in one click — automatic overdue reminder emails (the <strong>Automatic Dues Reminders</strong> toggle sits at the bottom of Player Dues), a <strong>&ldquo;Haven&rsquo;t paid anything yet&rdquo;</strong> list at the top of Player Dues that names everyone who owes but has paid nothing — with a one-tap reminder for each family, or <strong>Remind all</strong> at once — and a season budget that tracks fees, expenses, and fundraiser credits.</p>
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
        {
          id: 'faq-who-hasnt-paid',
          question: "How do I see who hasn't paid anything and remind them?",
          answerText: "In the Premium Coaches Portal, open Money then Player Dues. If anyone owes dues and has paid nothing yet, a 'Haven't paid anything yet' list appears at the top with each player and the amount they owe. Send one family a reminder with Remind, or nudge them all with Remind all. The count always matches the unpaid number on your Overview. Sending reminders needs money-write access.",
          keywords: ["who hasn't paid", 'unpaid list', 'remind', 'remind all', 'chase dues', 'never paid', "haven't paid anything", 'nudge'],
          answer: (
            <p>In the Premium Coaches Portal, open <strong>Money → Player Dues</strong>. If anyone owes dues and has paid nothing yet, a <strong>&ldquo;Haven&rsquo;t paid anything yet&rdquo;</strong> list appears at the top with each player and the amount they owe. Send one family a reminder with <strong>Remind</strong>, or nudge them all with <strong>Remind all</strong>. The count always matches the <strong>unpaid</strong> number on your Overview. Sending reminders needs money-write access.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-announcements',
      group: 'Your team tools',
      heading: 'How to message your team',
      summary: 'Email every parent with a contact email on your roster in one send.',
      keywords: ['announcements', 'email parents', 'message team', 'send announcement', 'contact parents', 'reuse announcement', 'resend', 'confirm send'],
      searchText: 'announcements email parents message whole team send announcement subject body recipients contact email roster missing email recent announcements log delivery premium confirm before sending irreversible cannot unsend reuse resend duplicate past announcement send again recipient count updates automatically no refresh unsaved changes draft warning read full message expand',
      content: (
        <>
          <p>Turn on <strong>Announcements</strong> from Explore to email your whole team at once.</p>
          <ol>
            <li>Write a <strong>subject</strong> and your <strong>message</strong>.</li>
            <li>The recipient count shows how many parents will get it — everyone on your Roster who has a contact email.</li>
            <li>Click <strong>Send announcement</strong>.</li>
          </ol>
          <p>If a player has no contact email, the page warns you and won&apos;t reach them — add an email on your Roster to include them. Every send is saved to a <strong>Recent announcements</strong> log showing whether it sent fully, partly, or failed.</p>
          <p><strong>Premium Coaches Portal adds:</strong> a quick <strong>confirm</strong> before an announcement emails families (it can&apos;t be unsent), a recipient count that <strong>updates on its own</strong> as you add contacts, the ability to reopen a past announcement to <strong>read it in full and reuse it</strong>, and automatic dues and event reminders.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-announcement-no-recipients',
          question: 'Why does it say there’s no one to email?',
          answerText: 'Announcements only reach players who have a contact email on your Roster. Add a parent/guardian email to each player on the Roster page; the recipient count picks them up when you return to Announcements (or use Refresh contacts on the empty screen).',
          keywords: ['no recipients', 'no one to email', 'contact email', 'announcement'],
          answer: (
            <p>Announcements only reach players who have a contact email on your <strong>Roster</strong>. Add a parent/guardian email to each player; the recipient count picks them up when you return to Announcements (or use <strong>Refresh contacts</strong> on the empty screen).</p>
          ),
        },
        {
          id: 'faq-announcement-reuse',
          question: 'Can I resend or reuse a past announcement?',
          answerText: 'On Premium Coaches Portal, open any message in the Recent announcements list to read it in full, then choose Reuse to drop its subject and body back into the compose box — edit and send again in seconds. Premium also asks you to confirm before an announcement emails families (it cannot be unsent) and warns you before you leave a half-written message.',
          keywords: ['reuse', 'resend', 'duplicate announcement', 'send again', 'confirm before sending', 'unsaved changes', 'read full message'],
          answer: (
            <>
              <p>On <strong>Premium Coaches Portal</strong>, open any message in the <strong>Recent announcements</strong> list to read it in full, then choose <strong>Reuse</strong> to drop its subject and body back into the compose box — edit and send again in seconds.</p>
              <p>Premium also asks you to <strong>confirm</strong> before an announcement emails families (it can&apos;t be unsent), and warns you before you leave a half-written message.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'tournaments',
      group: 'Tournaments',
      heading: 'Your tournament records',
      summary: 'See every tournament you’ve entered, with status and schedule, across organizations.',
      keywords: ['tournaments', 'registration', 'tournament records', 'status', 'schedule', 'history', 'accepted', 'payment', 'how to pay', 'entry fee', 'live', 'premium tournaments'],
      searchText: 'tournaments tournament records registrations status schedule history across organizations bracket standings my registrations accepted what happens next payment how to pay entry fee deposit instructions pay the organizer e-transfer schedule published premium tournaments sidebar section live status today scores full record inside portal never leave free portal',
      content: (
        <>
          <p>The <strong>Tournaments</strong> section lists every tournament you&apos;ve registered the team for — across any organization — with its registration status and schedule.</p>
          <p><strong>On Premium Coaches Portal</strong>, Tournaments is its own item in your sidebar: a list of your events with live status — an event that&apos;s underway shows <strong>Live</strong> or <strong>Today</strong>, otherwise it shows where your registration stands. Open one and the <strong>full record opens right inside your Premium portal</strong> — the live schedule and scores, your status, how to pay, roster submission, and the organizer&apos;s announcements. You don&apos;t leave your portal to follow a tournament.</p>
          <p>Open a tournament record to see where your team stands and when it plays. The organizer running that tournament controls its schedule, brackets, and standings; your portal shows you the live view.</p>
          <p>Once the organizer <strong>accepts</strong> your team, the record adds a <strong>What&apos;s next</strong> checklist and a <strong>Payment</strong> section. If there&apos;s an entry fee to pay, the organizer&apos;s instructions — how and where to send it — appear right there under <strong>How to pay</strong>, so you don&apos;t have to dig back through your acceptance email. Your games appear automatically once the organizer publishes the schedule.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-premium-tournaments-where',
          question: 'Where are my tournaments in the Premium portal?',
          answerText: 'On Premium Coaches Portal, open the Tournaments item in your sidebar. It lists every tournament your team is entered in with live status (a live event shows Live or Today). Open one to see the full record inside your portal — live schedule and scores, your status, how to pay, roster submission, and the organizer’s announcements. You never get sent back to the free portal.',
          keywords: ['premium tournaments', 'where tournaments', 'tournaments sidebar', 'live tournament', 'tournament record premium'],
          popular: true,
          answer: (
            <p>On <strong>Premium Coaches Portal</strong>, open the <strong>Tournaments</strong> item in your sidebar. It lists every tournament your team is entered in with live status (a live event shows <strong>Live</strong> or <strong>Today</strong>). Open one to see the full record inside your portal — live schedule and scores, your status, how to pay, roster submission, and the organizer&apos;s announcements. You&apos;re never sent back to the free portal.</p>
          ),
        },
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
      id: 'recipe-tournament-chat',
      group: 'Tournaments',
      heading: 'How to chat with your tournament organizer',
      summary: 'A live group chat with the organizer and the other coaches in each tournament you’re in.',
      keywords: ['chat', 'tournament chat', 'message organizer', 'group chat', 'unread', 'push notification', 'coach chat', 'rooms', 'division room', 'all coaches', 'channels', 'reply', 'quote', 'mention', '@mention', 'emoji', 'react', 'search', 'search messages', 'delete message', 'delete own message', 'message removed', 'read by', 'read receipt', 'pinned', 'pinned messages', 'last seen'],
      searchText: 'tournament chat group chat with organizer and other coaches live chat unread badge multiple rooms all coaches room division room channels switch rooms tournament name label reply quote a message jump to original message push notification phone alert no email last seen read receipts read by sent read by everyone join automatically muted closed read only free or paid mention @mention tag a coach mention reaches you even if muted emoji smiley react with emoji search recent messages magnifier delete your own message message removed pinned messages pin schedule field map rules banner jump to message see pinned only organizer can pin',
      content: (
        <>
          <p>When an organizer runs a chat for a tournament your team is in, a <strong>Chat</strong> item appears in your portal with an <strong>unread badge</strong>. Open it to read and reply in real time alongside the organizer and the other coaches in that tournament.</p>
          <ol>
            <li>Open <strong>Chat</strong> and pick a conversation. You&rsquo;re always in the <strong>All coaches</strong> room, and on a bigger event you may also see a room for your division — each is labelled with the tournament name so they&rsquo;re easy to tell apart. (If you only have one, it opens straight away.)</li>
            <li>Type your message and send — everyone in that room sees it right away.</li>
          </ol>
          <p>You&rsquo;re placed into the right rooms automatically based on your team&rsquo;s division — there&rsquo;s nothing to join or manage.</p>
          <p><strong>It works like any chat app.</strong> Add an <strong>emoji</strong> from the smiley in the box, <strong>reply</strong> to a specific message (your reply shows the quote — tap it to jump to the original), and type <strong>@</strong> to <strong>mention</strong> a coach or the organizer by name. You can <strong>delete a message you sent</strong> — it then reads &ldquo;Message removed&rdquo; for everyone. The <strong>magnifier</strong> at the top <strong>searches</strong> the recent messages. Under your latest message, a small note shows when it&rsquo;s been read (<strong>Sent</strong> &rarr; <strong>Read by everyone</strong>). If the organizer has <strong>pinned</strong> anything — the schedule, a field map, the rules — it sits in a banner at the top; tap it to jump there. Only the organizer can pin.</p>
          <p>You get a <strong>phone notification</strong> for new messages, and the <strong>Chat</strong> tab shows an <strong>unread badge</strong> — no email. (Chat lives on the Chat tab, not in the notification bell.) An <strong>@mention</strong> always reaches you directly, even if you&rsquo;ve turned general chat notifications off. The chat shows a &ldquo;last seen&rdquo; marker per person rather than a tick on every message. If the organizer <strong>mutes</strong> you, you can still read but can&rsquo;t post for a while; if they <strong>close</strong> the room, it becomes read-only. There&rsquo;s nothing to set up — you join automatically once you&rsquo;ve signed in with your team&rsquo;s email.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tournament-chat-join',
          question: 'How do I join a tournament’s chat?',
          answerText: 'You join automatically. When an organizer opens chat for a tournament your team is in, a Chat item appears in your coaches portal with an unread badge. There is nothing to accept — just sign in with the email on your team registration and the conversation shows up. It works the same whether your team is free or paid.',
          keywords: ['join chat', 'tournament chat', 'no chat showing', 'where is chat', 'unread'],
          popular: true,
          answer: (
            <>
              <p>You join automatically. When an organizer opens chat for a tournament your team is in, a <strong>Chat</strong> item appears in your portal with an unread badge — there&rsquo;s nothing to accept.</p>
              <p>If you don&rsquo;t see it yet, make sure you&rsquo;ve signed in with the email on your team registration. It works the same whether your team is free or paid.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-notify',
          question: 'Will I be notified of new chat messages?',
          answerText: 'Yes — new chat messages send a phone push notification and show an unread badge on the Chat tab. Chat lives on the Chat tab, not in the notification bell. Chat does not email you. If someone @mentions you, that reaches you directly even if you have turned general chat notifications off. The chat shows a last seen marker per person, not a read tick on each message.',
          keywords: ['chat notification', 'push notification', 'new message alert', 'no email', 'unread', 'unread badge', 'chat tab', 'not in bell', 'mention', '@mention', 'mentioned'],
          answer: (
            <>
              <p>Yes — a new chat message sends a <strong>phone push notification</strong> and shows an <strong>unread badge on the Chat tab</strong>. Chat lives on the Chat tab, not in the notification bell. Chat doesn&rsquo;t email you.</p>
              <p>If another coach or the organizer <strong>@mentions</strong> you, that reaches you directly — even if you&rsquo;ve turned general chat notifications off. The conversation shows a &ldquo;last seen&rdquo; marker per person rather than a read tick on every message.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-tools',
          question: 'Can I reply, mention a coach, add emoji, or delete my own messages?',
          answerText: 'Yes. You can reply to a specific message so your answer quotes it (tap the quote to jump to the original), type @ to mention a coach or the organizer, and add an emoji from the smiley in the message box. You can delete a message you sent — it then reads Message removed for everyone. The magnifier at the top searches the recent messages. Under your latest message a small Sent or Read by everyone note shows when it has been read. If the organizer has pinned the schedule, a field map, or the rules, they show in a banner at the top you can tap to jump to — only the organizer can pin.',
          keywords: ['reply', 'quote', 'mention', '@mention', 'emoji', 'react', 'search messages', 'delete message', 'delete own message', 'message removed', 'read by', 'read receipt', 'pinned messages', 'pin'],
          answer: (
            <>
              <p>Yes. <strong>Reply</strong> to a specific message so your answer quotes it (tap the quote to jump to the original), type <strong>@</strong> to <strong>mention</strong> a coach or the organizer, and add an <strong>emoji</strong> from the smiley in the message box. You can <strong>delete a message you sent</strong> — it then reads &ldquo;Message removed&rdquo; for everyone.</p>
              <p>The <strong>magnifier</strong> at the top <strong>searches</strong> the recent messages, and under your latest message a small <strong>Sent</strong> / <strong>Read by everyone</strong> note shows when it&rsquo;s been read. If the organizer has <strong>pinned</strong> the schedule, a field map, or the rules, they show in a banner at the top you can tap to jump to — only the organizer can pin.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium',
      group: 'Premium Coaches Portal',
      heading: 'What Premium Coaches Portal adds',
      summary: 'The serious-operator upgrade — game-day tools, automation, budget, and documents.',
      keywords: ['coaches portal premium', 'upgrade', 'premium', 'paid coaches portal'],
      searchText: 'coaches portal premium upgrade paid lineup builder attendance dues automation team budget document storage carries over organization joins start next season new season division team settings multi season year over year player profile positions best okay never ranked positions never play position preferences pitcher pitching depth chart ace pitcher rank max innings arm care innings cap this player pitches medical allergies emergency contact handedness bats throws jersey size attendance snapshot per player dues roster export pdf excel csv awards mvp best hitter hustle award season awards player awards',
      content: (
        <>
          <p><strong>Premium Coaches Portal</strong> keeps everything in your free portal and adds the tools for running a full competitive season:</p>
          <ul>
            <li>A full <strong>player profile</strong> for everyone on your roster — positions, handedness and jersey size, allergies/medical notes and an emergency contact, plus that player&apos;s attendance, dues, and awards at a glance.</li>
            <li>Attendance at every practice and game, and game-day lineups and batting orders.</li>
            <li>Recurring schedule events and calendar sync.</li>
            <li>Dues automation — installment schedules, due dates, and overdue reminders — plus a season budget with expenses and fundraiser credits.</li>
            <li>Export your roster to Excel, CSV, or a print-ready PDF.</li>
            <li>Document storage for waivers and team forms (see below).</li>
            <li>A <strong>Settings</strong> area to start your next season yourself and set your team&apos;s division (see below).</li>
          </ul>
          <p>If your organization later joins FieldLogicHQ, your team and its history carry over automatically.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-premium-player-profile',
          question: 'What can I keep on each player?',
          answerText: 'On Premium, open any player from your Roster to see their full profile. You set their fielding positions with one Positions picker — tap a position to cycle it through Best, Okay, or Never, and rank your Best spots in priority order (reorder with the arrows). Best are their go-to spots, Okay are fill-in spots, and Never is a hard block the game-day auto-fill will never assign. Pitchers are set separately in a Pitching section — turn on "This player pitches" and set their rank (Ace, #2, #3…) and an optional max-innings-per-game arm-care cap; pitching is not one of the fielding chips. You can also mark a player as an A-squad ("gold-medal starter") with the gold star. Alongside name, date of birth and jersey number you can also record handedness (bats/throws), jersey size, allergies or medical notes, and an emergency contact. When medical notes are present, a flag shows at the top so it is not missed on game day. The profile also shows that player’s attendance this season, their dues balance, and any awards they have earned this season (like "2× MVP") at a glance, plus any documents on file. If you set Primary/Secondary positions before, they carry over automatically as that player’s top two Best. To set positions, pitchers, and A-squad for your whole team at once, use the Depth chart view of your Roster (the List / Depth chart toggle) — it edits the same profiles.',
          keywords: ['player profile', 'positions', 'best okay never', 'never play', 'ranked positions', 'position preferences', 'primary secondary position', 'pitcher', 'pitching', 'ace', 'pitcher rank', 'max innings', 'arm care', 'innings cap', 'this player pitches', 'a-squad', 'gold medal', 'gold-medal starter', 'depth chart', 'medical', 'allergies', 'emergency contact', 'handedness', 'bats', 'throws', 'jersey size', 'attendance', 'dues', 'player details', 'awards', 'mvp', 'season awards'],
          answer: (
            <>
              <p>On Premium, open any player from your <strong>Roster</strong> to see their full profile. Set their <strong>fielding positions</strong> with one <strong>Positions</strong> picker — tap a position to cycle it through <strong>Best</strong>, <strong>Okay</strong>, or <strong>Never</strong>, and rank your Best spots in priority order (reorder with the arrows). <strong>Best</strong> are their go-to spots, <strong>Okay</strong> are fill-in spots, and <strong>Never</strong> is a hard block the game-day auto-fill will never assign.</p>
              <p><strong>Pitchers are set separately</strong> in a <strong>Pitching</strong> section — turn on <strong>&ldquo;This player pitches&rdquo;</strong> and set their <strong>rank</strong> (Ace, #2, #3…) and an optional <strong>max innings per game</strong> arm-care cap. Pitching is handled here, not as one of the fielding chips. You can also mark a player as an <strong>A-squad</strong> (&ldquo;gold-medal starter&rdquo;) with the gold star — in competitive games they get their best positions and are protected from the bench.</p>
              <p>Alongside name, date of birth and jersey number you can also record <strong>handedness</strong> (bats/throws), <strong>jersey size</strong>, <strong>allergies or medical notes</strong>, and an <strong>emergency contact</strong>. When a player has medical notes, a flag appears at the top of their profile so it&apos;s never missed on game day. The profile also shows that player&apos;s <strong>attendance</strong> this season, their <strong>dues balance</strong>, and any <strong>awards</strong> they&apos;ve earned this season (like &ldquo;2&times; MVP&rdquo;) at a glance, plus any documents on file.</p>
              <p>If you set <strong>Primary</strong>/<strong>Secondary</strong> positions before, they carry over automatically as that player&apos;s top two <strong>Best</strong> — nothing to re-enter. To set positions, pitchers, and A-squad for your <strong>whole team at once</strong>, use the <strong>Depth chart</strong> view of your Roster (see below).</p>
            </>
          ),
        },
        {
          id: 'faq-premium-depth-chart',
          question: 'Can I set positions for my whole team at once? (the depth chart)',
          popular: true,
          answerText: 'Yes — that is the Depth chart. Open your Roster and use the List / Depth chart toggle at the top. The depth chart is a whole-team grid: one row per player, a column for each field position, plus a Pitcher column and an A-squad column. Tap a cell to cycle that player’s fit for the spot — Best (ranked 1, 2, 3… in the order you pick), Okay, Never, or not set — exactly like the Positions picker on a player’s page. Set pitchers (rank + arm-care cap) in the Pitcher column and mark gold-medal starters (A-squad) in the A-squad column. It saves automatically as you go (there is no Save button; Undo and Redo are there if you mis-tap), and it writes the same profiles as each player’s page, so the two always stay in sync. Your season Lineup rules show along the top with an Edit in Settings link. On a phone the grid becomes a tap-a-player list. The depth chart is not a separate menu item — it lives inside Roster. Anyone who can see the roster can view it; the head coach makes the changes.',
          keywords: ['depth chart', 'depth chart board', 'whole team positions', 'set positions fast', 'team positions grid', 'positions grid', 'roster depth chart', 'list depth chart toggle', 'where is depth chart', 'a-squad', 'gold medal', 'gold-medal starter', 'pitcher column', 'set everyone positions', 'bulk positions', 'ranked positions'],
          answer: (
            <>
              <p>Yes — that&apos;s the <strong>Depth chart</strong>. Open your <strong>Roster</strong> and use the <strong>List / Depth chart</strong> toggle at the top. (It&apos;s not a separate menu item — it lives inside Roster.)</p>
              <p>The depth chart is a <strong>whole-team grid</strong>: one row per player, a column for each field position, plus a <strong>Pitcher</strong> column and an <strong>A-squad</strong> column. Tap a cell to cycle that player&apos;s fit for the spot — <strong>Best</strong> (ranked 1, 2, 3… in the order you pick), <strong>Okay</strong>, <strong>Never</strong>, or not set — exactly like the <strong>Positions</strong> picker on a player&apos;s page. Set pitchers (rank + arm-care cap) in the <strong>Pitcher</strong> column and mark <strong>gold-medal starters</strong> in the <strong>A-squad</strong> column.</p>
              <p>It <strong>saves automatically</strong> as you go — there&apos;s no Save button, and <strong>Undo/Redo</strong> are there if you mis-tap. Because it writes the <em>same</em> profiles as each player&apos;s page, the two always stay in sync. Your season <strong>Lineup rules</strong> show along the top with an <strong>Edit in Settings</strong> link, and on a phone the grid becomes a <strong>tap-a-player</strong> list. Anyone who can see the roster can view the depth chart; the <strong>head coach</strong> makes the changes.</p>
            </>
          ),
        },
        {
          id: 'faq-premium-pitching',
          question: 'How do I set up my pitchers?',
          answerText: 'On a player’s profile, open the Pitching section and turn on "This player pitches." Then set their rank — Ace, #2, #3 and so on — and, if you want, a max innings per game (an arm-care cap; leave it blank for no limit). The game-day Auto-fill uses this: competitive games lead with your ace, balanced and development games spread innings down your pitcher order, and it never puts a pitcher on the mound past their max-innings cap. If the mound genuinely cannot be covered (for example everyone available is at their cap), Auto-fill leaves it blank and warns you rather than overworking an arm. The mound is not one of the Best/Okay/Never fielding chips — pitching is set only with this toggle. A player who only pitches in a pinch can be flagged as a pitcher with a low rank. Note: if you previously set a player’s position to "Pitcher," flag them here to make them a pitcher again.',
          keywords: ['pitcher', 'pitchers', 'pitching', 'ace', 'pitcher rank', 'depth chart', 'max innings', 'innings cap', 'arm care', 'this player pitches', 'mound', 'rotation', 'lineup pitcher'],
          answer: (
            <>
              <p>On a player&apos;s profile, open the <strong>Pitching</strong> section and turn on <strong>&ldquo;This player pitches.&rdquo;</strong> Then set their <strong>rank</strong> — Ace, #2, #3, and so on — and, if you want, a <strong>max innings per game</strong> (an arm-care cap; leave it blank for no limit).</p>
              <p>The game-day <strong>Auto-fill</strong> uses this: <strong>competitive</strong> games lead with your <strong>ace</strong>, <strong>balanced</strong> and <strong>development</strong> games spread innings down your pitcher order, and it <strong>never</strong> puts a pitcher on the mound past their max-innings cap. If the mound genuinely can&apos;t be covered (for example everyone available is at their cap), Auto-fill leaves it blank and warns you rather than overworking an arm.</p>
              <p>The mound isn&apos;t one of the Best/Okay/Never fielding chips — pitching is set <em>only</em> with this toggle. A player who only pitches in a pinch can be flagged as a pitcher with a low rank. <strong>If you previously set a player&apos;s position to &ldquo;Pitcher,&rdquo;</strong> flag them here to make them a pitcher again.</p>
            </>
          ),
        },
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
      id: 'premium-portal-tour',
      group: 'Premium Coaches Portal',
      heading: 'Getting around your Premium portal',
      summary: 'Where everything lives on Premium: the sidebar sections, the notification bell, the setup dashboard, and the at-a-glance snapshot.',
      keywords: ['premium portal', 'sidebar', 'navigation', 'dashboard', 'overview', 'season setup', 'at a glance', 'snapshot', 'tooltips', 'help button', 'where is', 'required', 'optional', 'skip', 'skip step', 'progress bar', 'depth chart', 'squad', 'grouped menu', 'staff', 'tryouts', 'menu sections', 'money', 'season review', 'lineups', 'find lineups', 'where are lineups', 'explore', 'team admin', 'last season', 'accounting renamed', 'history renamed', 'notifications', 'notification bell', 'bell', 'needs attention', 'activity feed', 'unread', 'see all notifications', 'notification centre', 'insights', 'season insights', 'where is season review', 'season review renamed', 'reports', 'stats', 'team stats', 'analytics hub', 'games tab', 'templates tab', 'filter games', 'needs lineup', 'what stands out', 'findings', 'scoreboard', 'close games', 'is playing time fair', 'who shows up', 'week in review', 'weekly digest', 'weekly summary', 'sunday summary', 'weekly insights', 'notification settings', 'turn off notifications', 'turn off digest', 'turn off weekly summary', 'stop weekly notification', 'manage notifications', 'change notifications', 'my notification settings', 'notification preferences', 'push settings', 'opt out'],
      searchText: 'premium portal layout sidebar navigation sections grouped menu squad season money communication team admin explore overview roster lineups tryouts schedule tournaments chat announcements money accounting documents season review history staff settings where are my lineups find lineups build lineup lineup front door menu where is accounting renamed money where is history now season review hide tryouts tournaments until used explore heading last season tile depth chart inside roster list depth chart toggle season setup checklist onboarding dashboard your team at a glance snapshot roster size next event dues outstanding budget spent remaining set tile who is coming next game headcount in out no reply attendance lineup ready not set nudge missing guardian email flag season record recent form scored allowed differential current streak won lost win loss this week what is coming up birthdays next game question mark tooltips help button getting around find required optional skip skip step mark complete progress bar status only required step is roster optional jerseys positions schedule lineups budget skip the ones you wont use done or skipped open the setup guide drawer notification bell notifications centre needs attention activity feed today yesterday earlier unread all see all full notifications page bundled repeats chat tab unread badge not in bell your week in review weekly digest sunday evening summary push phone top findings quiet week nothing sent insights hub season insights where is season review now renamed insights season menu results playing time attendance past seasons reports stats analytics one place lineups games templates tabs filter games league tournament scrimmage needs lineup toggle count notification settings turn off notifications turn off the weekly digest weekly summary off switch change how i am notified manage notifications my notification settings notification preferences push settings bell push email one page for every team and organization you are part of coach card weekly summary at the top opt out',
      content: (
        <>
          <p>On Premium, every tool is in the left sidebar — no turning anything on. It&apos;s <strong>grouped</strong> so related tools sit together: <strong>Overview</strong> at the top, then <strong>Squad</strong> (Roster and <strong>Lineups</strong>), <strong>Season</strong> (Schedule and <strong>Insights</strong> — a season scoreboard, a &ldquo;What stands out&rdquo; list that flags what&apos;s worth your attention, and reports on results, playing time and attendance; this was called <em>Season Review</em>, and <em>History</em> before that), <strong>Money</strong> (your budget, dues, and expenses — this was called <em>Accounting</em>; it opens with a guide card showing your next step and your four money numbers), <strong>Communication</strong> (Chat, Announcements), and <strong>Team&nbsp;admin</strong> (Staff, Documents, and Settings). Your <strong>Depth chart</strong> isn&apos;t a separate item — it&apos;s a view inside <strong>Roster</strong> (a <strong>List&nbsp;/&nbsp;Depth chart</strong> toggle at the top).</p>
          <p><strong>Lineups</strong> has its own spot under Squad and opens on a <strong>Games</strong> tab — your upcoming and recent games, each flagged <strong>Lineup set / Not set</strong>, with a filter row (<strong>All / League / Tournament / Scrimmage</strong>, plus a <strong>⚠ Needs lineup</strong> toggle with a live count) and the bright <strong>Build lineup</strong> button on the next game that needs one. The <strong>Templates</strong> tab beside it manages your reusable lineups (you can still open a game straight from the Schedule too). Tools you aren&apos;t using yet stay out of the way: <strong>Tryouts</strong> and <strong>Tournaments</strong> wait under a small <strong>Explore</strong> heading and move up into Squad and Season automatically once your team runs a tryout or registers for a tournament.</p>
          <p>Up in the sidebar header, the <strong>bell</strong> is your notification centre. Anything that needs you — like a schedule change or an assistant-coach request — is pinned at the top under <strong>Needs attention</strong> and clears as you handle it; everything else sits below as an <strong>Activity</strong> feed grouped by <strong>Today</strong>, <strong>Yesterday</strong>, and <strong>Earlier</strong>, with repeats bundled into a single line you can open in a tap. The bell opens on <strong>Unread</strong>, so reading something clears it from view — flip to <strong>All</strong> to see everything, or tap <strong>See all</strong> for your full notifications page. Team <strong>chat</strong> stays on the <strong>Chat</strong> tab with its own unread badge, not in the bell. Once your season is rolling, the bell — and your phone, if you&apos;ve allowed notifications — also brings a weekly <strong>&ldquo;Your week in review&rdquo;</strong>: your team&apos;s top Insights findings in one short note, sent only when something actually stood out (a quiet week sends nothing). Tap it to open <strong>Insights</strong>. To change how you&apos;re notified — or switch that weekly review off — open <strong>Notification settings</strong> from the bell (or the link at the top of your notifications page): it opens <strong>one page for every team and organization you&apos;re part of</strong>, with the weekly review right at the top of your coach card.</p>
          <p>Your <strong>Overview</strong> is built to get you going:</p>
          <ul>
            <li><strong>Season setup</strong> — a checklist that shows your progress at a glance. Adding your <strong>roster</strong> is the only required step; everything else (jersey numbers and positions, your schedule, game lineups, and a budget) is <strong>optional</strong>. For each optional step you can either set it up or hit <strong>Skip</strong> if you won&apos;t use it — both tick it off, so the progress bar fills as you decide. The whole panel disappears once every step is either done or skipped, leaving you with the run-mode view below.</li>
            <li><strong>Your team at a glance</strong> — quick tiles for your <strong>roster</strong>, <strong>next event</strong>, <strong>dues</strong>, <strong>budget</strong> (spent vs set), <strong>tournaments</strong> (next date, plus any <strong>entry fees due</strong>), and — once you&apos;ve wrapped a season — a <strong>Last season</strong> summary (record, dues, and expenses that opens <strong>Insights</strong>), each linking straight to that section. It also surfaces what needs attention: <strong>who&apos;s coming</strong> to the next game (in / out / no-reply), a <strong>Lineup ready / not set</strong> nudge, players <strong>missing a guardian email</strong>, your season record with <strong>recent form, scoring, and current streak</strong>, plus a <strong>This week</strong> line of upcoming events and player <strong>birthdays</strong>.</li>
          </ul>
          <p>Stuck on a term? Look for the small <strong>?</strong> icons next to items for a one-line explanation, or the <strong>Help</strong> button in the page header — or <strong>Open the setup guide</strong> in the season-setup panel — to open this guide right beside what you&apos;re doing.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-find-lineups',
          question: 'Where do I build game lineups on Premium?',
          answer: (
            <>
              <p>Open <strong>Lineups</strong> in the left sidebar (under <strong>Squad</strong>). It opens on the <strong>Games</strong> tab — your upcoming and recent games, each flagged <strong>Lineup set / Not set</strong>, with the bright <strong>Build&nbsp;lineup</strong> button on the next game that needs one. A filter row cuts the list down: <strong>All / League / Tournament / Scrimmage</strong>, plus a <strong>⚠ Needs lineup</strong> toggle with a live count that stacks with the type filter (for example, tournament games still missing a lineup).</p>
              <p>The <strong>Templates</strong> tab beside it holds your reusable lineups. Your <strong>season analytics</strong> moved to <strong>Insights</strong> (in the <strong>Season</strong> menu) — the quiet <strong>Season insights</strong> link at the bottom of the Games tab jumps there.</p>
              <p>You can still open a game from the <strong>Schedule</strong> — its <strong>Lineup</strong> tab shows a quick <strong>read-only preview</strong> (batting order and inning-1 field) with an <strong>Edit in Lineups&nbsp;→</strong> link that jumps straight to the builder.</p>
            </>
          ),
          answerText: 'Open Lineups in the left sidebar (under Squad). It opens on the Games tab — your upcoming and recent games, each flagged Lineup set or Not set, with the bright Build lineup button on the next game that needs one. A filter row cuts the list down: All, League, Tournament, Scrimmage, plus a "Needs lineup" toggle with a live count that stacks with the type filter (for example, tournament games still missing a lineup). The Templates tab beside it holds your reusable lineups. Season analytics moved to Insights in the Season menu — the quiet "Season insights" link at the bottom of the Games tab jumps there. You can still open a game on the Schedule; its Lineup tab shows a quick read-only preview with an "Edit in Lineups" link that jumps to the builder.',
          keywords: ['where are lineups', 'find lineups', 'build lineup', 'game lineup', 'batting order', 'lineup menu', 'lineups tab', 'where do i set the lineup', 'lineup front door', 'edit in lineups', 'read-only lineup', 'lineup preview', 'lineup templates', 'season analytics', 'games tab', 'templates tab', 'filter games', 'needs lineup', 'tournament games only', 'lineup filters'],
          popular: true,
        },
        {
          id: 'faq-weekly-week-in-review',
          question: 'What is the “Your week in review” notification?',
          answer: (
            <>
              <p>It&apos;s your team&apos;s week, read for you. Once a week (Sunday evening), each coach on a Premium team gets a short <strong>&ldquo;Your week in review&rdquo;</strong> note in the <strong>bell</strong> — and as a push on your phone if you&apos;ve allowed notifications — with the top items from <strong>Insights</strong>: good news first (a milestone win, a hot stretch), then anything that needs an eye (a dues deadline coming up, attendance slipping). Tap it to open Insights and see the full picture.</p>
              <p>Two things it never does: it <strong>never invents a summary on a quiet week</strong> — if nothing stood out, nothing is sent — and it <strong>only mentions what you can already see</strong>. An assistant coach without money access, for example, never gets dues items in theirs, so two coaches on the same team can get different notes (or none at all).</p>
              <p><strong>Don&apos;t want it?</strong> Open <strong>Notification settings</strong> from the bell (or the link at the top of your notifications page). Your coach card leads with <strong>Weekly summary</strong> — switch off the <strong>phone push</strong> there to stop the Sunday alert (or the <strong>bell</strong> note too). It stays off until you turn it back on.</p>
            </>
          ),
          answerText: 'Once a week (Sunday evening), each coach on a Premium team gets a short "Your week in review" note in the notification bell — and as a push on your phone if you have allowed notifications — with the top items from Insights: good news first (a milestone win, a hot stretch), then anything that needs an eye (a dues deadline coming up, attendance slipping). Tap it to open Insights. On a quiet week nothing is sent, and the note only ever mentions what you can already see — an assistant coach without money access never gets dues items, so two coaches on the same team can get different notes or none at all. To turn it off, open Notification settings from the bell (or the link at the top of your notifications page): your coach card leads with the Weekly summary, where you switch off the phone push (or the bell note) — it stays off until you turn it back on.',
          keywords: ['week in review', 'weekly digest', 'weekly summary', 'sunday notification', 'weekly insights', 'team summary push', 'why did i get a notification', 'why did my assistant not get it', 'turn off weekly digest', 'stop the weekly notification', 'turn off sunday summary', 'how do i turn off the digest', 'unsubscribe weekly', 'notification settings'],
        },
        {
          id: 'faq-coach-notification-settings',
          question: 'How do I change or turn off my notifications?',
          popular: true,
          answer: (
            <>
              <p>Open <strong>Notification settings</strong> — it&apos;s a link in the <strong>bell</strong> menu, and there&apos;s one at the top of your full notifications page too. It opens <strong>one page for everything you&apos;re part of</strong>: a card for each team and organization, each with its own switches for the <strong>bell</strong>, <strong>phone push</strong>, and <strong>email</strong>. Your phones are managed once at the top, with a <strong>test</strong> button to confirm push is actually reaching a device.</p>
              <p>Your coach card leads with <strong>Weekly summary</strong> (the Sunday review), so it&apos;s the first thing you can switch off, followed by team activity like tryout responses. <strong>Chat</strong> notifications aren&apos;t here — they live on the <strong>Chat</strong> tab — and an <strong>@mention</strong> always reaches you.</p>
            </>
          ),
          answerText: 'Open Notification settings — the link in the bell menu, and one at the top of your full notifications page. It opens one page for everything you are part of: a card for each team and organization, each with its own switches for the bell, phone push, and email. Your phones are managed once at the top, with a test button to confirm push reaches a device. Your coach card leads with the Weekly summary (the Sunday review) so it is the first thing you can switch off, then team activity like tryout responses. Chat notifications are not here — they live on the Chat tab — and an @mention always reaches you.',
          keywords: ['notification settings', 'change notifications', 'turn off notifications', 'manage notifications', 'notification preferences', 'push settings', 'email notifications', 'bell settings', 'my devices', 'test push', 'where are notification settings', 'account notifications', 'all your notification settings', 'opt out', 'stop emails'],
        },
        {
          id: 'faq-setup-required-optional',
          question: 'Do I have to finish every setup step on Premium?',
          answer: (
            <p>No. Only <strong>adding your roster</strong> is required. The rest — jersey numbers and positions, your schedule, game lineups, and a budget — are <strong>optional</strong>. Set up the ones you want, and hit <strong>Skip</strong> on any you won&apos;t use. Skipping ticks the step off just like finishing it, so once every step is done or skipped the setup panel disappears on its own. You can always come back to a skipped step later from the sidebar.</p>
          ),
          answerText: 'No. Only adding your roster is required on Premium. The other steps — jersey numbers and positions, your schedule, game lineups, and a budget — are optional. Set up the ones you want and hit Skip on any you will not use; skipping ticks the step off just like finishing it, so once every step is done or skipped the setup panel disappears. You can return to a skipped step later from the sidebar.',
          keywords: ['skip setup step', 'required step', 'optional step', 'finish setup', 'do i have to', 'budget optional', 'positions optional', 'schedule optional', 'mark complete'],
          popular: true,
        },
      ],
    },
    {
      id: 'premium-money',
      group: 'Premium Coaches Portal',
      heading: 'Managing your team’s money (Premium)',
      summary: 'Money opens with your next step and four honest numbers — plan the budget, collect dues, log spending, and see how you’re tracking.',
      keywords: ['money', 'money hub', 'budget', 'season budget', 'dues', 'expenses', 'money in', 'money out', 'on hand', 'headroom', 'budget headroom', 'season total', 'non-itemized buffer', 'generate installments', 'split evenly', 'percent split', 'custom category', 'budget categories', 'unbudgeted', 'recategorize', 'export budget', 'treasurer', 'money tags', 'tag an expense', 'tag expenses', 'filter expenses by tag', 'spend by tag', 'expense tag', 'manage money tags'],
      searchText: 'money hub budget dues expenses where do i start money in money out on hand budget headroom cash treasurer team accountant plan collect spend review guide card next step season budget plan season total one number itemize line items non itemized buffer categories items custom category create category picker split by period percent split evenly installments generate installments every player same schedule preview player dues fundraisers expenses tournament payables deposits balances org allocations payment requests club owned budget vs actual variance monthly trend export excel csv pdf unbudgeted recategorize fix category automatic dues reminders toggle 30 days 7 days back to money read only assistant money access money tags tag an expense tag expenses label spending winter dome fundraiser search box tag picker create tag filter expenses by tag vs tag spend by tag across categories manage money tags rename merge delete money tag shared org tag blue chip organization shared tag',
      content: (
        <>
          <p>On Premium, <strong>Money</strong> opens with a guide card that reads your team&apos;s books and leads with your <strong>next step</strong> — a brand-new team sees <em>&ldquo;Start with your season budget&rdquo;</em>; once a budget exists it offers to <strong>turn the plan into player dues in one click</strong>; and once dues are out it switches to collection mode (who&apos;s overdue, who hasn&apos;t paid at all, or simply &ldquo;you&apos;re on track&rdquo;).</p>
          <p>Four numbers sit at the top: <strong>Money In</strong> (dues collected plus fundraising), <strong>Money Out</strong> (everything actually paid — expenses, and for club-owned teams, payments to your organization), <strong>On Hand</strong> (in minus out), and <strong>Budget Headroom</strong> (what&apos;s left of your budget). Only money that has <em>actually moved</em> counts — an unpaid bill doesn&apos;t change your numbers until you mark it paid — so these always agree with the Budget vs. Actual report.</p>
          <p>The sections below the numbers follow the treasurer&apos;s workflow: <strong>Plan</strong> (Season Budget Plan) → <strong>Collect</strong> (Player Dues, Fundraisers) → <strong>Spend</strong> (Expenses &amp; Tournament Payables — plus Org Allocations and Payment Requests when a club or league runs your team) → <strong>Review</strong> (Budget vs. Actual). Every card shows live figures, and every page has a <strong>&larr; Back to Money</strong> link.</p>
          <p><strong>Budget your way.</strong> Set one <strong>Season Total</strong>, itemize line by line, or both — if your total is bigger than your line items, the difference shows as a <strong>&ldquo;Non-itemized buffer&rdquo;</strong> so the two never silently disagree. Pick categories and items from the library, or create your own <strong>custom items and categories</strong> right in the picker (they&apos;re saved for reuse). Any line can be <strong>split by period</strong> — enter dollars or percentages, or tap <strong>Split evenly</strong>.</p>
          <p><strong>Spending that counts against your plan.</strong> When you log an expense, pick its category from the same list your budget uses — anything that won&apos;t match warns you right on the form and lands under <strong>Unbudgeted</strong> in Budget vs. Actual, where a <strong>Recategorize</strong> button lets you fix it. The report also exports to <strong>Excel, CSV, or PDF</strong>.</p>
          <p><strong>Tag your spending.</strong> Every expense and payable has an optional <strong>Tags</strong> box — your own labels for grouping spending, like &ldquo;Winter dome,&rdquo; &ldquo;Spring tournament,&rdquo; or &ldquo;Fundraiser.&rdquo; Start typing to find a tag you&apos;ve used or tap <strong>+ Create</strong> for a new one; only the tags you&apos;ve picked show as chips, so a long list never clutters the form. On the <strong>Expenses</strong> list you can filter by a tag (and tap the chips on any row to re-tag it), and <strong>Budget vs. Actual</strong> gains the same filter — pick a tag to see just that spending with a &ldquo;vs {'{tag}'}&rdquo; total <em>across</em> every category it touches (tags cut across categories, so &ldquo;Winter dome&rdquo; can span a facility rental and an officials fee). Money tags are separate from game tags. Use <strong>Manage tags</strong> on the Expenses page to rename, merge, or delete your money tags. Some tags may be <strong>shared by your whole organization</strong> (a club or league sets them up) — those show in <strong>blue</strong>; you can apply them, but only an org admin renames or removes them.</p>
          <p>Assistant coaches need <strong>money access</strong> from the head coach: with read access they see every number but no action buttons; with it off, Money doesn&apos;t appear for them at all. Applying or editing a money tag needs <strong>money edit</strong> access, the same as logging an expense.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-money-where-start',
          question: 'Where do I start with my team’s money?',
          popular: true,
          answer: (
            <p>Follow the guide card at the top of <strong>Money</strong> — it always shows your next step. The fastest path: build your <strong>Season Budget Plan</strong> (estimate costs by category), then tap <strong>Generate installments</strong> to turn it into every player&apos;s dues schedule in one click, then log expenses as the season runs. The section groups read in order — <strong>Plan → Collect → Spend → Review</strong> — so working top to bottom is working in the right order.</p>
          ),
          answerText: 'Follow the guide card at the top of Money — it always shows your next step. The fastest path: build your Season Budget Plan (estimate costs by category), then tap Generate installments to turn it into every player’s dues schedule in one click, then log expenses as the season runs. The section groups read in order — Plan, Collect, Spend, Review — so working top to bottom is working in the right order.',
          keywords: ['where do i start', 'money first step', 'set up budget', 'new treasurer', 'guide card'],
        },
        {
          id: 'faq-money-numbers',
          question: 'What do Money In, Money Out, On Hand, and Budget Headroom mean?',
          answer: (
            <p><strong>Money In</strong> is dues families have actually paid plus fundraising raised (plus anything your org reimbursed, on club-owned teams). <strong>Money Out</strong> is everything actually paid out — expenses, tournament deposits and balances, and payments to your org. <strong>On Hand</strong> is simply in minus out. <strong>Budget Headroom</strong> compares your paid spending to your budget — green means room left, red means over. Unpaid bills and unpaid dues don&apos;t move these numbers until they&apos;re marked paid, which is why Money and the Budget vs. Actual report always agree.</p>
          ),
          answerText: 'Money In is dues families have actually paid plus fundraising raised (plus anything your org reimbursed, on club-owned teams). Money Out is everything actually paid out — expenses, tournament deposits and balances, and payments to your org. On Hand is in minus out. Budget Headroom compares your paid spending to your budget — green means room left, red means over. Unpaid bills and unpaid dues do not move these numbers until marked paid, which is why Money and the Budget vs. Actual report always agree.',
          keywords: ['money in', 'money out', 'on hand', 'headroom', 'budget headroom', 'what do the numbers mean', 'net balance'],
        },
        {
          id: 'faq-money-generate-installments',
          question: 'How do I set every player’s dues at once?',
          popular: true,
          answer: (
            <p>Build your <strong>Season Budget Plan</strong> first, then tap <strong>Generate installments</strong> (the guide card and the Player Dues page both offer it). You choose the due dates and per-player amounts, <strong>preview</strong> the result for the whole roster, and confirm — every active player gets the same schedule. Prefer to skip the budget? <strong>Set dues for all players</strong> on the Player Dues page does it manually, and you can always adjust any single player afterward.</p>
          ),
          answerText: 'Build your Season Budget Plan first, then tap Generate installments (the guide card and the Player Dues page both offer it). You choose the due dates and per-player amounts, preview the result for the whole roster, and confirm — every active player gets the same schedule. Prefer to skip the budget? Set dues for all players on the Player Dues page does it manually, and you can adjust any single player afterward. The Automatic Dues Reminders toggle at the bottom of Player Dues controls the 30-day and 7-day reminder emails.',
          keywords: ['generate installments', 'dues for all players', 'installment schedule', 'same schedule every player', 'bulk dues', 'set dues at once'],
        },
        {
          id: 'faq-money-unbudgeted',
          question: 'Why does an expense show as “Unbudgeted”?',
          answer: (
            <p>Its category doesn&apos;t match any line in your budget plan — so it still reduces your headroom, but the report can&apos;t say <em>which</em> budget line it hit. Use the <strong>Recategorize</strong> button next to it in Budget vs. Actual and pick a category marked <strong>(in budget)</strong>. When you log new expenses, the form warns you before saving if your category won&apos;t match the plan.</p>
          ),
          answerText: 'Its category does not match any line in your budget plan — it still reduces your headroom, but the report cannot say which budget line it hit. Use the Recategorize button next to it in Budget vs. Actual and pick a category marked (in budget). When you log new expenses, the form warns you before saving if the category will not match the plan.',
          keywords: ['unbudgeted', 'recategorize', 'expense not counting', 'wrong category', 'category mismatch', 'fix category'],
        },
        {
          id: 'faq-money-tags',
          question: 'Can I tag my expenses to slice spending my own way?',
          answer: (
            <p>Yes. Every expense and payable has a <strong>Tags</strong> box — start typing to find a label you&apos;ve used or tap <strong>+ Create</strong> for a new one (like &ldquo;Winter dome&rdquo; or &ldquo;Fundraiser&rdquo;). Only the tags you&apos;ve picked show as chips. On the <strong>Expenses</strong> list, a tag row up top lets you filter to one tag and see its total, and you can tap the chips on any row to re-tag it later. <strong>Budget vs. Actual</strong> gets the same filter — choose a tag to see just that spending, totalled across every category it touches. Money tags are their own list (separate from game tags) and need <strong>money edit</strong> access to add or change. A club or league can also share tags org-wide — those appear in <strong>blue</strong> and you can apply them, but only an org admin edits them.</p>
          ),
          answerText: 'Yes. Every expense and payable has a Tags box — start typing to find a label you have used or tap + Create for a new one (like Winter dome or Fundraiser). Only the tags you picked show as chips. On the Expenses list, a tag row up top lets you filter to one tag and see its total, and you can tap the chips on any row to re-tag it later. Budget vs. Actual gets the same filter — choose a tag to see just that spending, totalled across every category it touches. Money tags are their own list, separate from game tags, and need money edit access to add or change. A club or league can also share tags org-wide — those appear in blue and you can apply them, but only an org admin edits them. Use Manage tags on the Expenses page to rename, merge, or delete your own money tags.',
          keywords: ['money tags', 'tag an expense', 'tag expenses', 'filter expenses by tag', 'spend by tag', 'expense tag', 'winter dome', 'manage money tags', 'shared tag', 'org tag'],
        },
      ],
    },
    {
      id: 'recipe-premium-schedule',
      group: 'Premium Coaches Portal',
      heading: 'Tournaments, games & calendar views (Premium)',
      summary: 'On Premium your schedule handles every event type, spreads multi-day tournaments across all their days, and keeps tournament games grouped under their tournament.',
      keywords: ['premium schedule', 'tournament', 'multi-day tournament', 'tournament game', 'calendar view', 'week view', 'month view', 'game slot', 'event types'],
      searchText: 'premium schedule calendar list week month view multi day tournament spans every day date range day 1 of 3 add event types league game tournament game scrimmage practice team event tournament which tournament attach group game slot orphaned loose all day event sorts first nested add game phone mobile month view colored strips plus more N more day list tap open',
      content: (
        <>
          <p>On <strong>Premium Coaches Portal</strong>, your <strong>Schedule</strong> grows from the free practice/game/event list into a full team calendar with <strong>List</strong>, <strong>Week</strong>, and <strong>Month</strong> views and more event types: league games, tournament games, scrimmages, practices, team events, and multi-day tournaments.</p>
          <p>On a phone, the <strong>Month</strong> view shows each day&apos;s events as small colored strips (up to three); if a day has more, tap <strong>&ldquo;+ N more&rdquo;</strong> to open that day&apos;s full list.</p>
          <p><strong>Multi-day tournaments span the calendar.</strong> Give a <strong>Tournament</strong> a start and end date and it shows on <em>every</em> day it runs — each day in the week view is labelled &ldquo;Day 1/3&rdquo;, &ldquo;Day 2/3&rdquo;, and the month view shows it as one connected run (later days carry a small &ldquo;&rsaquo;&rdquo; marker). In the list it reads as a date range (e.g. &ldquo;Jul 1–3&rdquo;). All-day tournaments sort to the top of each day, above your timed games and practices.</p>
          <p><strong>Tournament games stay grouped under their tournament.</strong> When you add an event, <strong>Game (Tournament)</strong> sits tucked under <strong>Tournament</strong> in the picker. Adding one asks <strong>which tournament</strong> it belongs to and files it there, so you never end up with a loose game tied to nothing. You can also open a tournament and use <strong>+ Add game</strong> to drop a game straight onto its days. If you haven&apos;t created a tournament yet, the form points you to add one first.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-premium-tournament-spans',
          question: 'Why does my tournament only show on its first day?',
          answerText: 'Give the tournament an end date as well as a start date. On the Premium schedule a tournament with a date range shows on every day it runs — in the week view each day is labelled Day 1/3, Day 2/3, and the month view shows it as one connected run. In the list it reads as a date range like Jul 1 to 3.',
          keywords: ['tournament one day', 'multi-day tournament', 'tournament not spanning', 'end date', 'date range'],
          popular: true,
          answer: (
            <p>Give the tournament an <strong>end date</strong> as well as a start date. On the Premium schedule a tournament with a date range shows on <strong>every</strong> day it runs — in the week view each day is labelled &ldquo;Day 1/3&rdquo;, &ldquo;Day 2/3&rdquo;, and the month view shows it as one connected run. In the list it reads as a date range like &ldquo;Jul 1–3&rdquo;.</p>
          ),
        },
        {
          id: 'faq-premium-add-tournament-game',
          question: 'How do I add games to a tournament?',
          answerText: 'Two ways. From the Add Event menu pick Game (Tournament) — it sits nested under Tournament — and choose which tournament it belongs to. Or open the tournament and use + Add game, which files the game under it automatically and drops it on the tournament’s days. Either way the game stays grouped under its tournament rather than floating loose. If you have not created a tournament yet, the form prompts you to add one first.',
          keywords: ['add tournament game', 'game tournament', 'attach game', 'which tournament', 'group games'],
          answer: (
            <>
              <p>Two ways. From the <strong>Add Event</strong> menu pick <strong>Game (Tournament)</strong> — it sits nested under <strong>Tournament</strong> — and choose <strong>which tournament</strong> it belongs to. Or open the tournament and use <strong>+ Add game</strong>, which files the game under it and drops it on the tournament&apos;s days.</p>
              <p>Either way the game stays grouped under its tournament instead of floating loose. If you haven&apos;t created a tournament yet, the form points you to add one first.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-game-day-details',
      group: 'Premium Coaches Portal',
      heading: 'Game-day details: arrival, field, uniform, tags, awards, links & the map (Premium)',
      summary: 'Add an arrival/call time, diamond/field number, uniform, your own game tags, player awards, and resource links to an event — and split the place name from a street address that powers a tap-to-open map.',
      keywords: ['arrival time', 'call time', 'be there by', 'field number', 'diamond number', 'uniform', 'jersey', 'location', 'address', 'google maps', 'map link', 'recent locations', 'links', 'attach link', 'resources', 'tags', 'tag a game', 'game tags', 'manage tags', 'merge tags', 'rename tag', 'filter by tag', 'record by tag', 'awards', 'give an award', 'mvp', 'best hitter', 'hustle award', 'award types', 'manage awards', 'retire award'],
      searchText: 'arrival call time be there by field diamond number uniform jersey what to wear home whites location place name street address google maps open in maps map link recent locations chips tap to fill calendar export ics spreadsheet excel csv arrival field uniform columns game day details premium links attach link resource drill video rules page field map flyer youtube google doc url open in new tab tags tag a game rivalry top team autocomplete create new tag chip picker manage tags rename merge delete tag library filter by tag vs tag record how are we doing insights awards give an award mvp best hitter hustle award award icon emoji picker manage award types retire award restore award who is earning it leaderboard',
      content: (
        <>
          <p>When you add or edit an event on the <strong>Premium</strong> schedule, a few optional details make game day smoother. Leave any of them blank if you don&apos;t need them.</p>
          <ul>
            <li><strong>Arrival / call time</strong> — a &ldquo;be there by&rdquo; time separate from the start (e.g. arrive 5:15 for a 6:00 game). Shows on the event and travels with the calendar export.</li>
            <li><strong>Field / Diamond #</strong> — which specific diamond or field at the venue (e.g. &ldquo;Diamond 2&rdquo;), shown right beside the location.</li>
            <li><strong>Uniform</strong> (games only) — what to wear, e.g. &ldquo;Home whites.&rdquo;</li>
          </ul>
          <p><strong>Location, name vs. address.</strong> <em>Location</em> is the place name a coach recognizes (&ldquo;Sherwood Park&rdquo;) — it&apos;s what shows on the schedule. <em>Address</em> is an optional street address that powers the map. On the event, the location becomes a tappable <strong>open-in-Google-Maps</strong> link that uses the address when you&apos;ve added one (and searches the name if you haven&apos;t).</p>
          <p><strong>Recent locations.</strong> Under the location box, a row of <strong>Recent</strong> chips shows places your team has already used — tap one to fill in both the name and its saved address in a single tap.</p>
          <p>Arrival time, field/diamond, and uniform also flow into your exports: they appear in the spreadsheet download and ride along in the calendar (.ics) export, so a synced phone calendar shows them too.</p>
          <p><strong>Tags</strong> (games only) — your own vocabulary for grouping games, e.g. &ldquo;Rivalry&rdquo; or &ldquo;Top in the province.&rdquo; Type in the Tags box: if a tag you&apos;ve used before matches, tap it to apply it; if it&apos;s new, tap <strong>+ Create</strong> to add it to your team&apos;s tag list and apply it in one step. A game can carry as many tags as you like. Use the <strong>Manage tags</strong> link on the same screen to rename a tag, delete one you don&apos;t need, or <strong>merge</strong> two into one (merging keeps all the game history under whichever tag you keep — handy if &ldquo;top team&rdquo; and &ldquo;top in province&rdquo; both crept in for the same idea). Tags are visible to any coach with schedule access on your team. Once you&apos;ve tagged a few games, open <strong>Insights → &ldquo;How are we doing?&rdquo;</strong> to filter the season&apos;s results by tag and see your record just for that group. If your club or league has set up <strong>shared</strong> tags, they appear in <strong>blue</strong> alongside your own — you can apply them, but only an org admin renames or removes them.</p>
          <p><strong>Awards</strong> (games only, once a final score is entered) — a quick way to recognize a player right after the game. Open the game and tap <strong>Give an award</strong>: pick a player, pick an award from your team&apos;s list — seeded with <strong>MVP</strong>, <strong>Best Hitter</strong>, and <strong>Hustle Award</strong> to start, fully yours to edit — add an optional note, and save. The form clears right away so you can hand out another for the same game without reopening anything. To edit your award list — change an award&apos;s name and icon, retire one you don&apos;t use (past awards keep it, it just drops off the picker for new ones), or bring a retired one back — open <strong>Insights → &ldquo;Who&apos;s earning it?&rdquo;</strong> and tap <strong>Manage award types</strong> there. Awards also show on the player&apos;s profile, and once you&apos;ve given a few, open <strong>Insights → &ldquo;Who&apos;s earning it?&rdquo;</strong> for a season leaderboard. A club or league can also share award types across every team — those show up in your picker to hand out, but only an org admin edits or retires them.</p>
          <p><strong>Links.</strong> Every event has a <strong>Links</strong> section where you can attach labelled web links — a drill video, a rules page, a field map, a practice-plan doc, a flyer. Give each a short label and paste the address; the form hints what fits each event type. On the event they show as tappable rows with a matching icon (video / map / doc) and open in a new tab. You can add up to 10. (Links are for you and your staff right now; a player/parent view may come later.)</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tag-a-game',
          question: 'How do I tag a game?',
          answerText: 'Open the game and edit it (or add a new one). In the Tags section, type a word or two — if it matches a tag you have already used, tap the chip to apply it; if it is new, tap "+ Create" to add it to your team\'s tag library and apply it at the same time. A game can carry several tags. Tags are only available on games (league games, tournament games, scrimmages), not practices or team events.',
          keywords: ['tag a game', 'add tag', 'create tag', 'game tags', 'rivalry', 'top team'],
          popular: true,
          answer: (
            <p>Open the game and edit it (or add a new one). In the <strong>Tags</strong> section, type a word or two — if it matches a tag you&apos;ve already used, tap the chip to apply it; if it&apos;s new, tap <strong>+ Create</strong> to add it to your team&apos;s tag library and apply it at the same time. A game can carry several tags. Tags are only available on <strong>games</strong> (league games, tournament games, scrimmages) — not practices or team events.</p>
          ),
        },
        {
          id: 'faq-manage-tags',
          question: 'Can I rename, merge, or delete a tag?',
          answerText: 'Yes, for your own tags. From the Tags section on any game\'s edit screen, tap "Manage tags" to open the tag manager. Rename a tag to fix a typo, delete one you no longer use, or merge two tags into one (merging keeps every game\'s history under whichever tag you choose as the survivor, and removes the other) — useful if near-duplicate tags like "top team" and "top in province" crept in for the same idea. Deleting a tag (instead of merging it) just removes the tag itself; the games it was on keep the rest of their details. Tags shared by your club or league (shown in blue) are not listed here to edit — only an org admin manages those in the Shared Library.',
          keywords: ['manage tags', 'rename tag', 'merge tags', 'delete tag', 'duplicate tags', 'tag library', 'shared tag', 'org tag'],
          answer: (
            <p>Yes, for your own tags. From the <strong>Tags</strong> section on any game&apos;s edit screen, tap <strong>Manage tags</strong> to open the tag manager. <strong>Rename</strong> a tag to fix a typo, <strong>delete</strong> one you no longer use, or <strong>merge</strong> two tags into one — merging keeps every game&apos;s history under whichever tag you choose as the survivor, useful if near-duplicate tags (&ldquo;top team&rdquo; vs. &ldquo;top in province&rdquo;) crept in for the same idea. Deleting a tag (instead of merging it) just removes the tag itself — the games it was on keep the rest of their details. Tags <strong>shared by your club or league</strong> (shown in blue) aren&apos;t listed here to edit — only an org admin manages those.</p>
          ),
        },
        {
          id: 'faq-give-award',
          question: 'How do I give a player an award?',
          answerText: 'Open a game that already has a final score entered, and tap "Give an award" in the Awards section. Pick a player, pick an award from your team\'s list — MVP, Best Hitter, and Hustle Award to start, fully editable — add an optional note, and save. The form clears right away so you can give another award for the same game without reopening anything. You can also give an award that isn\'t tied to one game — for a tournament, or a general season recognition — from the "Who\'s earning it?" report page in Insights.',
          keywords: ['give an award', 'award a player', 'mvp', 'best hitter', 'hustle award', 'game awards', 'season award'],
          popular: true,
          answer: (
            <p>Open a game that already has a <strong>final score</strong> entered, and tap <strong>Give an award</strong> in the Awards section. Pick a player, pick an award from your team&apos;s list — <strong>MVP</strong>, <strong>Best Hitter</strong>, and <strong>Hustle Award</strong> to start, fully editable — add an optional note, and save. The form clears right away so you can give another award for the same game without reopening anything. You can also give an award that isn&apos;t tied to one game — for a tournament, or a general season recognition — from the <strong>&ldquo;Who&apos;s earning it?&rdquo;</strong> report page in Insights.</p>
          ),
        },
        {
          id: 'faq-manage-awards',
          question: 'Can I rename or retire an award?',
          answerText: 'Yes, for your team\'s own awards. From the "Who\'s earning it?" report in Insights, tap Manage award types. Edit changes an award\'s name and icon together. Retire removes it from the picker for new awards without touching any award a player already has — those keep showing exactly as given. A retired award can be brought back with Restore. Award types shared across your club or league appear in your picker to hand out, but aren\'t editable here — an org admin manages those in the Shared Library.',
          keywords: ['manage awards', 'rename award', 'retire award', 'edit award icon', 'restore award', 'award types', 'delete award', 'shared award', 'org award type'],
          answer: (
            <p>Yes, for your team&apos;s own awards. From the <strong>&ldquo;Who&apos;s earning it?&rdquo;</strong> report in Insights, tap <strong>Manage award types</strong>. <strong>Edit</strong> changes an award&apos;s name and icon together. <strong>Retire</strong> removes it from the picker for new awards without touching any award a player already has — those keep showing exactly as given. A retired award can be brought back with <strong>Restore</strong>. Award types <strong>shared across your club or league</strong> appear in your picker to hand out, but aren&apos;t editable here — an org admin manages those.</p>
          ),
        },
        {
          id: 'faq-game-day-map',
          question: 'How do I get the map link to open the right place?',
          answerText: 'Fill in the Address field on the event (a street address), not just the Location name. The open-in-Google-Maps link on the event uses the address when one is present, and falls back to searching the location name when it is blank. Tapping a Recent location chip fills both the name and its saved address for you.',
          keywords: ['map link', 'google maps', 'address', 'wrong location', 'open in maps', 'directions'],
          popular: true,
          answer: (
            <p>Fill in the <strong>Address</strong> field on the event (a street address), not just the <strong>Location</strong> name. The open-in-Google-Maps link uses the address when one is present, and falls back to searching the location name when it&apos;s blank. Tapping a <strong>Recent</strong> location chip fills both the name and its saved address for you.</p>
          ),
        },
        {
          id: 'faq-attach-links',
          question: 'Can I attach a link (drill video, rules, field map) to an event?',
          answerText: 'Yes, on Premium. Every event has a Links section — give each link a short label and paste its web address (a YouTube drill, a Google Doc plan, a rules page, a field map, a flyer). They show on the event as tappable rows and open in a new tab; you can add up to 10. The address has to be a real web link. Links are coach/staff-facing for now.',
          keywords: ['attach link', 'add link', 'links', 'resources', 'drill video', 'rules', 'field map', 'flyer', 'youtube', 'google doc'],
          answer: (
            <p>Yes, on Premium. Every event has a <strong>Links</strong> section — give each link a short <strong>label</strong> and paste its web <strong>address</strong> (a YouTube drill, a Google Doc plan, a rules page, a field map, a flyer). They show on the event as tappable rows and open in a new tab; you can add up to 10. The address must be a real web link. Links are coach/staff-facing for now.</p>
          ),
        },
        {
          id: 'faq-arrival-vs-start',
          question: 'What’s the difference between arrival time and start time?',
          answerText: 'Start (and end) is when the game or practice actually runs. Arrival / call time is an optional earlier "be there by" time for warm-up or check-in. Both show on the event, and the arrival time is included in the calendar export so families see it.',
          keywords: ['arrival time', 'call time', 'start time', 'be there by', 'warm up'],
          answer: (
            <p><strong>Start</strong> (and end) is when the game or practice actually runs. <strong>Arrival / call time</strong> is an optional earlier &ldquo;be there by&rdquo; time for warm-up or check-in. Both show on the event, and the arrival time rides along in the calendar export so families see it.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-attendance',
      group: 'Premium Coaches Portal',
      heading: 'Taking attendance (Premium)',
      summary: 'Open an event to set each player to In, Late, Out, or No reply with an RSVP button — at-a-glance status symbols, quick filters, and an optional note. Anyone marked Out drops out of that game’s lineup.',
      keywords: ['attendance', 'who is coming', 'in out late', 'no reply', 'mark attendance', 'rsvp', 'edit rsvp', 'status symbol', 'roster check', 'attendance note', 'all in', 'not playing', 'season attendance', 'who shows up', 'attendance reliability'],
      searchText: 'attendance mark who is coming going not going in out late no reply unknown counts filter chips status symbol rsvp button edit rsvp open choices set status note per player note icon all in reset bulk premium event attendance roster headcount available not playing drops out of lineup remove from lineup add back single source auto save auto-fill auto fill generate lineup who plays where best okay never position preferences ranked positions cant fill position lineup warning fair playing time season attendance reliability roster attendance view who shows up over the season games practices attended totals drifting away not a ranking any coach roster access not tracked yet',
      content: (
        <>
          <p>On <strong>Premium</strong>, open any event and pick the <strong>Attendance</strong> tab to track who&apos;s coming. Each player is one of four states: <strong>In</strong>, <strong>Late</strong>, <strong>Out</strong>, or <strong>No reply</strong> (not marked yet).</p>
          <p>At the top, a <strong>color-coded count bar</strong> shows the totals at a glance — All, In, Late, Out, and No reply. <strong>Tap any count to filter</strong> the list to just those players (tap it again to show everyone); great for working through the &ldquo;No reply&rdquo; pile until it&apos;s empty.</p>
          <p>Each player shows their <strong>current status as a small colored symbol</strong> — the same icons as the count bar — next to an <strong>RSVP</strong> button. Tap <strong>RSVP</strong> (or <strong>Edit RSVP</strong> once a status is set) to open the four choices and an optional <strong>note</strong> (&ldquo;leaving early&rdquo;, &ldquo;ride needed&rdquo;); pick one and the status symbol updates right away. Only one player&apos;s chooser is open at a time, so a long roster stays tidy. Use <strong>All in</strong> to mark everyone present at once, or <strong>Reset</strong> to clear back to No reply. Your changes <strong>save automatically</strong>.</p>
          <p><strong>See the season picture.</strong> Over time, open <strong>Roster → Attendance</strong> for a season-long read of who&apos;s been making it out — each player&apos;s <strong>games</strong> and <strong>practices</strong> attended (for example, &ldquo;Games 9/10 · Practices 12/15&rdquo;). It&apos;s meant to support fair playing-time and to spot when someone&apos;s drifting — not a ranking — and events with <strong>no reply aren&apos;t counted against anyone</strong>. Any coach with roster access can see it.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-attendance-filter',
          question: 'How do I see just who hasn’t replied (or just who’s out)?',
          answerText: 'On the Attendance tab, tap a count in the top bar — All, In, Late, Out, or No reply — to filter the list to that group; tap it again to show everyone. Each player still has a one-tap In/Late/Out/No-reply control, so you can clear the No reply group quickly.',
          keywords: ['filter attendance', 'no reply', 'who is out', 'attendance counts', 'going not going'],
          answer: (
            <p>On the Attendance tab, tap a count in the top bar — <strong>All</strong>, <strong>In</strong>, <strong>Late</strong>, <strong>Out</strong>, or <strong>No reply</strong> — to filter to that group; tap it again to show everyone. Each player keeps a one-tap status control, so you can clear the <strong>No reply</strong> pile fast.</p>
          ),
        },
        {
          id: 'faq-attendance-season',
          question: 'How do I see who shows up over the whole season?',
          answerText: "Open Insights (in the Season menu) and tap 'Who shows up?' — or go Roster, then Attendance; it's the same season-long view. Each player shows games and practices attended (for example, 'Games 9/10 · Practices 12/15'). 'Present' means marked In or Late; events with no reply aren't counted against anyone, and a player with nothing recorded shows 'not tracked yet'. It's a supportive read for fair playing-time and spotting a kid drifting away — not a ranking. Any coach with roster access can see it.",
          keywords: ['who shows up', 'season attendance', 'attendance reliability', 'games practices attended', 'playing time', 'drifting', 'over the season', 'insights', 'attendance report'],
          answer: (
            <p>Open <strong>Insights</strong> (in the <strong>Season</strong> menu) and tap <strong>&ldquo;Who shows up?&rdquo;</strong> — or go <strong>Roster → Attendance</strong>; it&apos;s the same season-long view. Each player shows <strong>games</strong> and <strong>practices</strong> attended (for example, &ldquo;Games 9/10 · Practices 12/15&rdquo;). &ldquo;Present&rdquo; means marked <strong>In</strong> or <strong>Late</strong>; events with <strong>no reply aren&apos;t counted against anyone</strong>, and a player with nothing recorded shows &ldquo;not tracked yet.&rdquo; It&apos;s a supportive read for fair playing-time and spotting a kid drifting away — not a ranking. Any coach with roster access can see it.</p>
          ),
        },
        {
          id: 'faq-attendance-note',
          question: 'How do I add a note to a player’s attendance?',
          answerText: 'Tap RSVP (or Edit RSVP) on that player and type in the note field there (e.g. leaving early, ride needed). Players who already have a note show a small note icon on their row; open their RSVP to read or change it. Notes save automatically with the rest of the attendance.',
          keywords: ['attendance note', 'player note', 'leaving early', 'note icon', 'rsvp note'],
          answer: (
            <p>Tap <strong>RSVP</strong> (or <strong>Edit RSVP</strong>) on that player and type in the <strong>note</strong> field there (e.g. &ldquo;leaving early&rdquo;). Players who already have a note show a small <strong>note icon</strong> on their row; open their RSVP to read or change it. Notes <strong>save automatically</strong> with the rest of the attendance.</p>
          ),
        },
        {
          id: 'faq-attendance-lineup',
          question: 'What happens to my lineup when a player&apos;s attendance changes?',
          answerText: 'Attendance and the lineup are kept separate on purpose — neither one silently rewrites the other, because sometimes it is the attendance that is wrong, not the lineup, and you should decide. When they disagree (a player marked coming who is not in the lineup, or a player in the lineup marked Out), you get a warning: a small warning symbol on that game in the Schedule list, a note in the game detail, and — on the builder — an "Add coming players" / "Remove Out players" button so you can reconcile the lineup in one tap. Nothing changes until you tap it, or until you fix the attendance on the Schedule if that is what is off. On the builder you add or remove players yourself: use the x on a row to take someone out of the lineup, or the "Not in the lineup" list below to add anyone in — this only changes the lineup, not their attendance.',
          keywords: ['remove from lineup', 'not in the lineup', 'out of lineup', 'mark out', 'add to lineup', 'attendance lineup mismatch', 'lineup warning', 'marked in but not in lineup', 'reconcile lineup', 'attendance and lineup', 'who is playing'],
          answer: (
            <>
              <p><strong>Attendance and the lineup are kept separate on purpose</strong> — neither one silently rewrites the other. Sometimes it&apos;s the attendance that&apos;s wrong, not the lineup, so you get to decide.</p>
              <p>When they disagree — a player marked <strong>coming</strong> who isn&apos;t in the lineup, or a player <strong>in the lineup</strong> marked <strong>Out</strong> — you&apos;re warned: a small <strong>⚠</strong> on that game in the Schedule list, a note in the game detail, and, on the builder, an <strong>&ldquo;Add coming players&rdquo; / &ldquo;Remove Out players&rdquo;</strong> button. Nothing changes until you tap it (or fix the attendance on the Schedule if <em>that&apos;s</em> what&apos;s off).</p>
              <p>On the builder you set the lineup yourself: the <strong>&times;</strong> on a row takes a player out of the lineup, and the <strong>&ldquo;Not in the lineup&rdquo;</strong> list below adds anyone in. This changes only the lineup — not their attendance.</p>
            </>
          ),
        },
        {
          id: 'faq-lineup-autofill-positions',
          question: 'How does Auto-fill decide who plays where?',
          answerText: 'Auto-fill uses the positions you set on each player’s profile and a game Mode you pick in the Auto-fill menu (Competitive, Balanced, or Development — pre-picked from the game type). It never puts a player at a position you marked Never, and it favors each player’s Best positions in the order you ranked them (Okay spots are used as fill-ins). For the mound, it uses your pitchers: competitive games lead with your ace, balanced and development games spread innings down the pitcher order, and it never works a pitcher past their max-innings cap. In Competitive mode your A-squad (gold-medal starters) get their best positions and can be protected from the bench. It also follows your team Lineup rules — caps on innings at one position, a pitching innings ceiling, and a minimum innings per player. It still shares playing time fairly. If a spot genuinely can’t be filled — for example everyone available has it set to Never, or a cap leaves no one eligible — Auto-fill leaves that cell blank and shows a warning instead of forcing a bad fit, so you can adjust it by hand. Auto-fill always gives you a starting point you can edit before the game. You can re-run it any time: the Reshuffle button gives a fresh fair arrangement with your current settings, and the "Innings to fill" range lets you auto-fill only some innings (say 1–3) and leave the rest as you set them — it still counts what you have already done toward the caps and bench balance.',
          keywords: ['auto-fill', 'auto fill', 'generate lineup', 'fill lineup', 'mode', 'competitive', 'balanced', 'development', 'a-squad', 'never position', 'best position', 'ranked positions', 'position preferences', 'pitcher', 'ace', 'max innings', 'arm care', 'lineup rules', 'innings cap', 'minimum innings', 'cant fill position', 'blank position', 'lineup warning', 'who plays where', 'reshuffle', 'shuffle lineup', 'innings to fill', 'inning range', 'fill some innings', 'regenerate'],
          answer: (
            <>
              <p><strong>Auto-fill</strong> uses the positions you set on each player&apos;s profile plus a game <strong>Mode</strong> you pick in the Auto-fill menu (see below). It <strong>never</strong> puts a player at a position you marked <strong>Never</strong>, and it favors each player&apos;s <strong>Best</strong> positions in the order you ranked them (<strong>Okay</strong> spots are used as fill-ins). For the <strong>mound</strong>, it uses your pitchers: competitive games lead with your <strong>ace</strong>, balanced and development games spread innings down the pitcher order, and it never works a pitcher past their <strong>max-innings cap</strong>. It also follows your team <strong>Lineup rules</strong> (below). It still shares playing time fairly.</p>
              <p>If a spot genuinely can&apos;t be filled — for example everyone available has it set to <strong>Never</strong>, or a cap leaves no one eligible — Auto-fill leaves that cell blank and shows a <strong>warning</strong> instead of forcing a bad fit, so you can set it by hand. Auto-fill always gives you a starting point you can edit before the game.</p>
              <p><strong>Re-run it any time.</strong> The <strong>Reshuffle</strong> button hands you a fresh fair arrangement with your current settings (tap again for another). And <strong>&ldquo;Innings to fill&rdquo;</strong> lets you auto-fill just a range of innings — say <strong>1–3</strong> — and leave the rest exactly as you set them; it still counts what&apos;s already in the other innings toward your caps and bench balance.</p>
            </>
          ),
        },
        {
          id: 'faq-lineup-rules-caps',
          question: 'Can I set innings limits — rotation, pitching, and minimum play?',
          answerText: 'Yes. On your team Settings page, the Lineup rules card sets three season defaults the game-day Auto-fill follows: Max innings at one position (forces rotation so more players get a turn at each spot), a Pitching innings cap (a team arm-care ceiling — a player’s own pitcher cap still applies, and the stricter one wins), and Minimum innings per player (so everyone gets on the field). Leave a field blank to turn that rule off. Any assigned coach can set them. For a single game that plays by different rules — say a tournament — open the Auto-fill menu and expand Game rules: each cap shows your Season default and you can override it just for that game. The override sticks to that game and does not change your season defaults. Auto-fill treats all of these as hard limits and never crosses them.',
          keywords: ['lineup rules', 'innings cap', 'innings limit', 'max innings', 'rotation', 'pitching cap', 'arm care', 'minimum innings', 'min play', 'playing time rule', 'game rules', 'tournament rules', 'season default', 'override caps'],
          answer: (
            <>
              <p>Yes. On your team <strong>Settings</strong> page, the <strong>Lineup rules</strong> card sets three season defaults the game-day <strong>Auto-fill</strong> follows:</p>
              <ul>
                <li><strong>Max innings at one position</strong> — forces rotation so more players get a turn at each spot.</li>
                <li><strong>Pitching innings cap</strong> — a team arm-care ceiling. A player&apos;s own pitcher cap still applies, and the <strong>stricter</strong> one wins.</li>
                <li><strong>Minimum innings per player</strong> — so everyone gets on the field.</li>
              </ul>
              <p>Leave a field blank to turn that rule off. Any assigned coach can set them.</p>
              <p>For a <strong>single game</strong> that plays by different rules — say a tournament — open the <strong>Auto-fill</strong> menu and expand <strong>Game rules</strong>: each cap shows your <em>Season default</em>, and you can override it just for that game. The override sticks to that game and doesn&apos;t change your season defaults. Auto-fill treats all of these as <strong>hard limits</strong> and never crosses them.</p>
            </>
          ),
        },
        {
          id: 'faq-lineup-modes-asquad',
          question: 'What are the Competitive / Balanced / Development modes, and what is the A-squad?',
          answerText: 'When you Auto-fill a lineup you pick a Mode, and it starts on the right one for the game type — tournament games open on Competitive, scrimmages on Development, and league games on Balanced. You can change it. Balanced gives players their preferred spots while rotating everyone fairly. Development rotates everyone through lots of positions for variety. Competitive puts your best on the field: it leans on Best positions and your ace, and it uses your A-squad. Your A-squad is your gold-medal starters — turn on "Gold-medal starter" on a player’s profile to mark them. In Competitive games A-squad players get their best positions and can be protected from the bench; it has no effect on Balanced or Development games. When you choose Competitive, two extra dials appear: A-squad emphasis — "Play key spots, bench rotates evenly" keeps the bench fair, or "Stay on field, others cover the bench" leans harder on your best — and a "Nobody sits two innings in a row" switch so the bottom of the roster keeps rotating. Your minimum-innings rule always comes first (everyone still gets their floor), then no back-to-back sits, then A-squad protection. These mode dials apply to that one game and are not saved.',
          keywords: ['mode', 'competitive', 'balanced', 'development', 'game mode', 'a-squad', 'gold medal', 'starters', 'best players', 'prioritize', 'bench rotation', 'no back to back', 'tournament lineup', 'scrimmage lineup'],
          answer: (
            <>
              <p>When you <strong>Auto-fill</strong> a lineup you pick a <strong>Mode</strong>, and it starts on the right one for the game type — <strong>tournament</strong> games open on <strong>Competitive</strong>, <strong>scrimmages</strong> on <strong>Development</strong>, and <strong>league</strong> games on <strong>Balanced</strong>. You can always change it.</p>
              <ul>
                <li><strong>Balanced</strong> — players get their preferred spots while everyone rotates fairly.</li>
                <li><strong>Development</strong> — rotates everyone through lots of positions for variety.</li>
                <li><strong>Competitive</strong> — puts your best on the field: leans on Best positions, your ace, and your A-squad.</li>
              </ul>
              <p>Your <strong>A-squad</strong> is your gold-medal starters — turn on <strong>&ldquo;Gold-medal starter&rdquo;</strong> on a player&apos;s profile to mark them. In Competitive games, A-squad players get their best positions and can be protected from the bench; it has <strong>no effect</strong> on Balanced or Development games.</p>
              <p>When you choose <strong>Competitive</strong>, two dials appear:</p>
              <ul>
                <li><strong>A-squad emphasis</strong> — <em>Play key spots, bench rotates evenly</em> keeps the bench fair, or <em>Stay on field, others cover the bench</em> leans harder on your best.</li>
                <li><strong>Nobody sits two innings in a row</strong> — so the bottom of the roster keeps rotating even when you prioritize your best.</li>
              </ul>
              <p>Your <strong>minimum-innings</strong> rule always comes first (everyone still gets their floor), then no back-to-back sits, then A-squad protection. These mode dials apply to that one game and aren&apos;t saved.</p>
            </>
          ),
        },
        {
          id: 'faq-lineup-templates',
          question: 'Can I save and reuse lineups (templates)?',
          answerText: 'Yes. On your Lineups page, the Templates tab holds reusable "base" lineups — a gold-medal batting order, a rain-day rotation, whatever you run often. Build one two ways: on a game builder, open Templates and Save current lineup as a template; or on the Templates tab tap New template to build one from scratch with no game attached. Each template remembers your batting order and field positions for this season\'s players. From the Templates list you can rename it, delete it, open it to edit, or Apply it to a game: pick the game, and if that game already has a lineup you are asked before overwriting. Applying maps the template onto that game\'s current roster and quietly skips anyone no longer on the team. Templates use your current-season roster.',
          keywords: ['template', 'templates', 'save lineup', 'reuse lineup', 'new template', 'apply template', 'base lineup', 'gold medal lineup', 'rain day lineup', 'lineup template', 'rename template', 'edit template', 'saved lineup'],
          answer: (
            <>
              <p>Yes. On your <strong>Lineups</strong> page, the <strong>Templates</strong> tab holds reusable &ldquo;base&rdquo; lineups — a gold-medal batting order, a rain-day rotation, whatever you run often.</p>
              <p><strong>Build one two ways:</strong> on a game&apos;s builder, open <strong>Templates</strong> and <strong>Save current lineup as a template</strong>; or on the <strong>Templates</strong> tab tap <strong>New template</strong> to build one from scratch with no game attached.</p>
              <p>From the Templates list you can <strong>rename</strong> it, <strong>delete</strong> it, open it to <strong>edit</strong>, or <strong>Apply</strong> it to a game. When you apply, pick the game — if that game <strong>already has a lineup, you&apos;re asked before overwriting</strong> — and the template maps onto that game&apos;s current roster, quietly skipping anyone no longer on the team. Templates use your current-season roster.</p>
            </>
          ),
        },
        {
          id: 'faq-lineup-season-analytics',
          question: 'What does “Is playing time fair?” in Insights show?',
          answerText: 'Open Insights (in the Season menu) and tap "Is playing time fair?" — a report with one row per player, built from the lineups you have actually saved: innings on the field vs on the bench, back-to-back bench games, every position they have played, and pitching innings against their arm-care cap with a flag on any game over it. Below the table, "Which lineup wins?" lists each batting order you have reused with its win-loss record, counting only games with a score entered. Every number comes only from saved lineups — nothing is invented, and honest empty states show until you have saved a few. The Insights page itself also flags standouts for you under "What stands out" (like a pitcher over their cap, or who has sat the bench most). These read-outs used to sit at the bottom of the Lineups page; the Lineups Games tab keeps a quiet Season insights link that jumps there.',
          keywords: ['season analytics', 'analytics', 'fair playing time', 'bench balance', 'position variety', 'arm care', 'pitching load', 'records by lineup', 'lineup record', 'win loss lineup', 'playing time report', 'who sits most', 'reused lineup', 'lineup trends', 'insights', 'is playing time fair', 'which lineup wins', 'what stands out', 'where did season analytics go', 'lineups page analytics'],
          answer: (
            <>
              <p>Open <strong>Insights</strong> (in the <strong>Season</strong> menu) and tap <strong>&ldquo;Is playing time fair?&rdquo;</strong> — a report with <strong>one row per player</strong>, built from the lineups you&apos;ve saved: innings <strong>on the field vs. on the bench</strong>, <strong>back-to-back</strong> bench games, every <strong>position</strong> they&apos;ve played, and <strong>pitching</strong> innings against their arm-care cap, with a ⚠ flag on any game over it.</p>
              <p>Below the table, <strong>&ldquo;Which lineup wins?&rdquo;</strong> lists each batting order you&apos;ve reused with its win-loss record — counting only games with a score entered.</p>
              <p><strong>Every figure comes only from saved lineups</strong> — nothing is invented, and honest empty states show until you&apos;ve saved a few. The Insights page also flags standouts for you under <strong>&ldquo;What stands out&rdquo;</strong> (a pitcher over their cap, who&apos;s sat the bench most), so you don&apos;t have to go digging.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-start-next-season',
      group: 'Premium Coaches Portal',
      heading: 'How to start your next season & set your division (Premium)',
      summary: 'Roll your team into a new season yourself — your roster comes with you, the schedule starts fresh, and last year becomes read-only history.',
      keywords: ['start next season', 'new season', 'next season', 'roll over season', 'season rollover', 'team settings', 'division', 'edit division', 'past seasons', 'premium'],
      searchText: 'start next season new season next year roll over rollover carry roster forward fee plan fee template planned budget schedule starts fresh previous season read only past seasons history season review insights team settings edit change division head coach year end premium club owned admin manages seasons lineup rules innings cap rotation pitching cap minimum innings min play playing time auto-fill caps this season vs last comparison winning percentage record roster size trend up down improving better than last year are we improving dues collected expenses assistant coaches can see who is earning it awards leaderboard season awards mvp leaderboard award history',
      content: (
        <>
          <p>In the <strong>Premium</strong> portal, a new <strong>Settings</strong> area lets you run your team from one year to the next yourself — without waiting on an organization admin.</p>
          <p><strong>Start next season.</strong> When a season wraps, open <strong>Settings</strong> and choose <strong>Start next season</strong>. Confirm the new season&apos;s name and year, then pick what to bring over:</p>
          <ul>
            <li>Your <strong>active roster carries forward automatically</strong> — trim or add players from there.</li>
            <li>Optionally bring over your <strong>fee plan</strong> (amounts and installments; due dates shift forward a year) and your <strong>planned budget</strong> (your projected buckets).</li>
            <li>The <strong>schedule starts fresh</strong>, and last season&apos;s money — payments, spending, and paid history — stays behind with that season.</li>
          </ul>
          <p>The previous season then becomes <strong>read-only history</strong> under <strong>Insights</strong> (in the <strong>Season</strong> menu — this page was called <em>Season Review</em>). Insights keeps every past season as a <strong>plain archive</strong> — open <strong>&ldquo;How are we doing?&rdquo;</strong> there to see each year&apos;s record, roster size and (with money access) its dues and expenses. There&apos;s no season-to-season comparison on purpose: teams move up divisions and face new competition each year, so the years sit side by side as a scrapbook, not a scoreboard. You also land in the new season with a short summary of what carried over and anything worth a second look — for example, confirming the carried-over fee due dates or re-collecting waivers for the new season.</p>
          <p><strong>Set your division.</strong> Settings is also where you set your team&apos;s <strong>division</strong> (for example, &quot;U13 Tier 1&quot;); it shows on your team overview.</p>
          <p>If your team is <strong>owned by a club or league</strong> (an organization adopted it), your club admin manages seasons and division for you — you&apos;ll see those as read-only.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-start-next-season',
          question: 'How do I start a new season without an admin?',
          answerText: 'On a standalone Premium team, the head coach can do it directly: open Settings and choose Start next season. Your active roster carries forward, you can optionally bring over your fee plan and planned budget, the schedule starts fresh, and last season moves to read-only history under Insights in the Season menu (this page was called Season Review). If your team is owned by a club or league, the club admin starts seasons for you.',
          keywords: ['start new season', 'next season', 'no admin', 'rollover', 'head coach'],
          popular: true,
          answer: (
            <p>On a standalone Premium team, the <strong>head coach</strong> can do it directly: open <strong>Settings</strong> and choose <strong>Start next season</strong>. Your active roster carries forward, you can optionally bring over your fee plan and planned budget, the schedule starts fresh, and last season moves to read-only history under <strong>Insights</strong> (in the <strong>Season</strong> menu). If your team is owned by a club or league, the club admin starts seasons for you.</p>
          ),
        },
        {
          id: 'faq-season-review-comparison',
          question: 'How do I see if my team is improving year over year?',
          answerText: "Open Insights (in the Season menu). The scoreboard across the top shows the honest ways to read this season: your record, recent form, streak, run difference, and your record in one-run games. On purpose, Insights does NOT compare seasons against each other — youth teams move up divisions and face different competition each year, so a 'better or worse than last year' arrow would mislead more than it tells. Your past seasons are still kept: open 'How are we doing?' to see every year's record, roster size and (with money access) dues and expenses as a plain archive — a scrapbook, not a scoreboard.",
          keywords: ['improving', 'better than last year', 'this season vs last', 'season comparison', 'winning percentage', 'trend', 'year over year', 'season review', 'insights', 'scoreboard', 'close games', 'form', 'streak', 'past seasons'],
          answer: (
            <>
              <p>Open <strong>Insights</strong> (in the <strong>Season</strong> menu). The <strong>scoreboard</strong> across the top shows the honest ways to read this season: your record, recent form, streak, run difference, and your record in <strong>one-run games</strong>.</p>
              <p>On purpose, Insights <strong>doesn&apos;t compare seasons against each other</strong> — youth teams move up divisions and face different competition each year, so a &ldquo;better or worse than last year&rdquo; arrow would mislead more than it tells. Your past seasons are still kept: open <strong>&ldquo;How are we doing?&rdquo;</strong> to see every year&apos;s record as a plain archive — a scrapbook, not a scoreboard.</p>
            </>
          ),
        },
        {
          id: 'faq-results-tag-filter',
          question: 'Can I see my record against just the games I tagged?',
          answerText: 'Yes. Open Insights, then "How are we doing?" Above the game list, a row of tag chips shows every tag you have used this season, each with how many finished games carry it. Tap one to filter the list down to just those games and see the record for that tag — wins, losses, ties, and runs for/against — in place of the season-wide line. Tap "All" to go back. A tag only gets a chip once it has at least one finished game; if your team has not tagged anything yet, this row does not show at all. See "How do I tag a game?" to start tagging.',
          keywords: ['filter by tag', 'record by tag', 'vs tag', 'tag chips', 'rivalry record', 'top in the province', 'tag filter', 'how are we doing tags'],
          answer: (
            <>
              <p>Yes. Open <strong>Insights</strong>, then <strong>&ldquo;How are we doing?&rdquo;</strong> Above the game list, a row of <strong>tag chips</strong> shows every tag you&apos;ve used this season, each with how many finished games carry it.</p>
              <p>Tap one to filter the list down to just those games and see the record for that tag — wins, losses, ties, and runs for/against — in place of the season-wide line. Tap <strong>All</strong> to go back.</p>
              <p>A tag only gets a chip once it has at least one finished game; if your team hasn&apos;t tagged anything yet, this row doesn&apos;t show at all. See <strong>&ldquo;How do I tag a game?&rdquo;</strong> to start tagging.</p>
            </>
          ),
        },
        {
          id: 'faq-awards-leaderboard',
          question: "How do I see who's earned the most awards this season?",
          answerText: 'Open Insights, then "Who\'s earning it?" — a leaderboard ranked by total awards, with a breakdown per player (like "2× MVP · 1× Hustle Award"). Tap an award-type chip above it to see just that award\'s winners, and a full history below lists every award given this season with its note and a link back to the game where there is one. Give an award from a scored game\'s detail screen, or use the "Give an award" button on this page for anything not tied to one game. See "How do I give a player an award?" to get started.',
          keywords: ['who is earning it', 'awards leaderboard', 'season awards', 'mvp leaderboard', 'award history', 'insights awards'],
          answer: (
            <>
              <p>Open <strong>Insights</strong>, then <strong>&ldquo;Who&apos;s earning it?&rdquo;</strong> — a leaderboard ranked by total awards, with a breakdown per player (like &ldquo;2&times; MVP &middot; 1&times; Hustle Award&rdquo;).</p>
              <p>Tap an <strong>award-type chip</strong> above it to see just that award&apos;s winners, and a full <strong>history</strong> below lists every award given this season with its note and a link back to the game where there is one.</p>
              <p>Give an award from a scored game&apos;s detail screen, or use the <strong>&ldquo;Give an award&rdquo;</strong> button on this page for anything not tied to one game. See <strong>&ldquo;How do I give a player an award?&rdquo;</strong> to get started.</p>
            </>
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
      group: 'Premium Coaches Portal',
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
      group: 'Premium Coaches Portal',
      heading: 'Linking your team to a parent organization (Premium)',
      summary: 'Connect a Premium team to a club or league for recognition, or hand it over entirely.',
      keywords: ['link organization', 'parent org', 'club', 'basic visibility', 'ownership transfer', 'premium', 'settings', 'invite'],
      searchText: 'link organization parent org club league association basic visibility link ownership transfer team becomes org owned premium workspace settings organization invite banner overview org invited my team review accept decline where to link',
      content: (
        <>
          <p>If your team runs in the <strong>Premium team workspace</strong> and belongs to a parent club, league, or association, open <strong>Settings → Organization</strong> to connect them. (The free standalone portal doesn&apos;t have this; it applies once your team is on Premium.)</p>
          <p>There are two levels, from lighter to stronger:</p>
          <ul>
            <li><strong>Basic visibility</strong> — records the association only. It does not change who runs the team or give the organization access to your roster, documents, or accounting.</li>
            <li><strong>Ownership transfer</strong> — the team becomes fully org-owned. After both sides approve, roster, schedule, documents, budget, and accounting move under the organization.</li>
          </ul>
          <p>Usually the organization starts this — if a club or league <strong>invites your team</strong>, a banner appears on your <strong>Overview</strong> to review the invitation and accept or decline. You don&apos;t need to go looking for it.</p>
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
