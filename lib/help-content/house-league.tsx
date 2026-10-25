/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef, HelpSteps, HelpNote } from '@/components/help/HelpBlocks';

const houseLeagueHelp: HelpPageContent = {
  title: 'House league',
  role: 'Owner, Admin, League admin, League registrar',
  intro: 'House league manages the full seasonal workflow for recreational leagues — from opening registration to recording final scores. Each season runs independently with its own registrations, teams, schedule, and standings, and a club can run several at once. The free League plan runs one capped season; League Plus and Club remove the caps and add exports.',
  searchPlaceholder: 'Search House league help',
  sections: [
    {
      id: 'lifecycle',
      group: 'Getting started',
      heading: 'Understanding the season lifecycle',
      summary: 'A season is Getting ready, Registration open, Registration closed, Playing now, then Finished. You move it yourself, and every change asks first.',
      keywords: ['season lifecycle', 'status', 'draft', 'getting ready', 'registration open', 'registration closed', 'playing now', 'finished', 'start season', 'complete season', 'archive season', 'reopen season', 'close registration', 'reopen registration', 'reopen until', 'closed by date'],
      searchText: 'opens closed aug 1 you closed registration reopen until the dates run the form season lifecycle status draft getting ready registration open registration closed active playing now starts ended finished completed archived start season activate season complete the season archive the season reopen the season reopen registration close registration open registration transition advance manually every change asks window what changes families not emailed warns never blocks',
      content: (
        <>
          <p>A pill beside the season&apos;s name says what is happening. The pill reads:</p>
          <ul>
            <li><strong>Getting ready</strong> — setup. Nothing is visible to families yet, and the season has no public page.</li>
            <li><strong>Registration open</strong> — the sign-up form is live. Families can register for any division. If you gave the form an open date that is still ahead, the pill reads <strong>Opens</strong> and the date until then.</li>
            <li><strong>Registration closed</strong> — the form no longer takes new sign-ups, either because you closed it or because its close date passed (then the pill reads <strong>Closed</strong> and the date). Use this phase to review registrations, build teams and prepare the schedule.</li>
            <li><strong>Playing now</strong> — you started the season and it is inside its dates. Before its first day the pill reads <strong>Starts</strong> and the date. Once its last day has passed it turns amber and reads <strong>Ended</strong> and the date, until you complete it.</li>
            <li><strong>Finished</strong> — the season is completed or archived. It reads in place, locked (see <em>Closing out a season</em>).</li>
          </ul>
          <p>You move a season along yourself, with one exception: once registration is open, the registration dates run the form. It waits for the open date, and it closes by itself after the close date (see <em>How to open, pause, or close registration</em>). <strong>Open registration</strong> and <strong>Start season</strong> are the next-step buttons at the top of the season&apos;s page. <strong>Close registration</strong> and <strong>Reopen until&hellip;</strong> sit on the Registration block. <strong>Complete the season</strong>, <strong>Archive the season</strong> and <strong>Reopen the season</strong> are links at the very end of the page.</p>
          <p>Every change asks first, in a window that says what changes for families. It warns, but never blocks, when registrations are waiting for review, families are on the waitlist, or players still owe fees. A status change never emails families.</p>
        </>
      ),
    },
    {
      id: 'season-home',
      group: 'Getting started',
      heading: 'The House league page and moving between seasons',
      summary: 'Seasons are grouped by what is happening; inside a season, the menu and the phone strip list its pages and switch seasons.',
      keywords: ['seasons page', 'running now', 'getting ready', 'past seasons', 'switch season', 'season menu', 'phone strip', 'registrations to review', 'amber count'],
      searchText: 'house league home seasons page running now getting ready past seasons shelf row opens the season amber number registrations to review switch season switcher finished marked season menu rail sidebar overview registrations teams and draft schedule standings money email families phone season header strip of pills sideways create season',
      content: (
        <>
          <p>The <strong>House league</strong> page groups your seasons by what is happening, not by when they were made.</p>
          <ul>
            <li><strong>Running now</strong> — every season that is taking registrations, closed to sign-ups, or under way.</li>
            <li><strong>Getting ready</strong> — seasons still being set up. The group only appears when there is one.</li>
            <li><strong>Past seasons</strong> — finished seasons, on a closed shelf with a count. Open it to see them.</li>
          </ul>
          <p>A whole row is one link to that season. An amber number on a row is the registrations waiting for your review. Status buttons are not on this page; they live on the season itself.</p>
          <p>Inside a season, the menu&apos;s <strong>Season</strong> block lists <strong>Overview</strong>, <strong>Registrations</strong>, <strong>Teams &amp; draft</strong>, <strong>Schedule</strong>, <strong>Standings</strong>, <strong>Money</strong> and <strong>Email families</strong>. A season switcher above them opens another season on the same page, and marks finished seasons <strong>· Finished</strong>. On a phone, every season page starts with a season header (its name, its pill and a switch button) and a strip of page pills that scrolls sideways.</p>
        </>
      ),
    },
    {
      id: 'who-can-do-what',
      group: 'Getting started',
      heading: 'Who can do what in house league',
      summary: 'Owners, club admins and league admins run the season; the league registrar works registrations, fees and Email families and reads the rest.',
      keywords: ['permissions', 'who can', 'club admin', 'league admin', 'league registrar', 'treasurer', 'read only', 'roles', 'access', 'move a child between divisions', 'who can take fees', 'who can end a registration'],
      searchText: 'who can do what house league permissions owner admin club admin league admin league registrar registrar treasurer read only edit seasons divisions teams schedule approve decline withdraw release the spot add registration by hand fees received mark received undo correct the price refund move to another division email families money page read cannot see button absent not greyed registrar cannot move a child between divisions',
      content: (
        <>
          <ul>
            <li><strong>Owner, club admin and league admin</strong> — everything: create and edit seasons and divisions, build teams, run the schedule, move a season between states, work registrations and fees, move a child to another division, and email families.</li>
            <li><strong>League registrar</strong> — works the registrations (approve, waitlist, decline, withdraw, release a spot, add one by hand), takes fees (<strong>Mark received</strong>, <strong>Undo</strong>, <strong>Correct the price</strong>), and uses Email families. <strong>Move to another division</strong> is not theirs: only the owner, a club admin and a league admin see it. Reads the rest of the season, with no edit controls and no status buttons.</li>
            <li><strong>Treasurer</strong> — reads a season&apos;s <strong>Money</strong> page, through the club&apos;s Accounting. Nothing else in house league.</li>
          </ul>
          <p>A control you can&apos;t use is not shown at all, rather than shown greyed. A member whose House league access is switched off, or whose plan doesn&apos;t carry it, can&apos;t open any of it.</p>
        </>
      ),
    },
    {
      id: 'plans-limits',
      group: 'Getting started',
      heading: 'Plans and limits — free League vs. League Plus',
      summary: 'The free League plan runs one capped season; League Plus and Club lift the caps and add exports.',
      keywords: ['free league', 'league plus', 'club', 'limits', 'caps', 'upgrade', 'team limit'],
      searchText: 'free league plan league plus club limits caps one season one division eight teams 8 teams upgrade unlimited exports league exports plan gating',
      content: (
        <>
          <p>House league is available on the free <strong>League</strong> plan, on <strong>League Plus</strong>, and on <strong>Club</strong>. The free League plan is a real product, not a trial — it just has caps so it fits a small house league:</p>
          <ul>
            <li><strong>One active season</strong> at a time.</li>
            <li><strong>One division</strong> per season.</li>
            <li><strong>Up to eight teams</strong> per season.</li>
            <li><strong>Limited exports</strong> — schedule and registration exports are part of League Plus.</li>
          </ul>
          <p>When you hit a cap, the product tells you which one and points to <strong>League Plus</strong>, which removes all three caps and turns on exports. Club includes everything in League Plus plus the rest of the platform.</p>
        </>
      ),
    },
    {
      id: 'create-season',
      group: 'Getting started',
      heading: 'Creating and configuring a season',
      summary: 'Creating a season asks three things: name, sport and dates. Age groups, prices, registration dates, the waiver and how families pay are set on the season’s own page.',
      keywords: ['create season', 'season setup', 'age groups', 'add age groups', 'divisions', 'capacity', 'spots', 'price', 'prices', 'early bird', 'early bird discount', 'save', 'early-bird date', 'how to pay', 'how families pay', 'note for families', 'registration fee', 'waiver', 'email consent', 'new registrations', 'hold for review', 'birth years', 'birth year', 'born', 'age', 'cut-off', 'birthday', 'add division', 'edit division', 'remove division', 'delete division', 'pencil', 'edit season', 'edit registration', 'delete season', 'delete a season', 'remove season', 'made by mistake', 'test season', 'owing turns amber', 'amber after days', 'owing threshold', 'how many days before owing turns amber'],
      searchText: 'create season name sport dates three questions web address made from the name season page add age groups U6 U18 chips type a name each becomes a division born in birth years the club picks size players price free early bird early amount early-bird date one date per season through last day second division U10 A U10 B tap again gap overlap warning partial overlap identical years no warning cut-off birthdays count from settings edit division pencil whole record autosave saves as you go tick note for families fits two divisions changing birth years never moves a registered child no longer fit lowering players never removes anyone remove this division only while nobody is in it accepted received waitlisted price recorded when they sign up never changes price change applies to new sign-ups only families see the early bird before they register save $20 shown on the season page and the club rows registration block registration dates form opens form closes waiver text email consent line asked on the form unticked how families pay required when any price is above $0 shown once a child is accepted and in their email new registrations approve while a division has room hold for review a child waiting for review holds a spot waitlist moves up on its own when a spot frees checklist before you open registration delete season delete the season remove a season made by mistake test season shell not yet open nothing attached archive instead fee received accounting books owing turns amber after 14 days counted from the day the child was accepted whole number of days 1 to 365 free season has no owing row correct the price a child keeps the price fixed at sign-up',
      content: (
        <>
          <p>Creating a season asks three things: its <strong>name</strong>, its <strong>sport</strong> and its <strong>season dates</strong>. Everything else is set on the season&apos;s own page, which opens as soon as you create it.</p>
        </>
      ),
      subtopics: [
        {
          id: 'create-season-create',
          title: 'Create a season',
          content: (
            <>
              <HelpSteps>
                <li>On the House league page, click <strong>Create season</strong>.</li>
                <li>Type a <strong>Name</strong>, such as <em>Summer 2027</em>, and pick the <strong>Sport</strong>.</li>
                <li>Set the <strong>Season dates</strong>, the first and last day of play. A season can&apos;t end before it starts.</li>
                <li>Click <strong>Create season</strong>. The season starts as <strong>Getting ready</strong>, on its own page.</li>
              </HelpSteps>
              <p>The season&apos;s web address is made from its name, so there is no address to type. A name another of your seasons already uses, or one that can&apos;t make an address, is refused with a line saying so; give it a different name.</p>
            </>
          ),
        },
        {
          id: 'create-season-age-groups',
          title: 'Add age groups',
          content: (
            <>
              <p>Age groups are the season&apos;s divisions. On the season&apos;s page, <strong>Add age groups</strong> (in the Divisions block) opens a window where you tap the groups you run, from <strong>U6</strong> to <strong>U18</strong>, or type your own name with <strong>Type a name</strong>. Each becomes a division with its own birth years, size and price. Tap a ticked group again to take it back off.</p>
              <ul>
                <li><strong>U12 or 12U</strong> — the switch beside the opening line sets how the names are written. Changing it renames every row you have not typed over. A season whose divisions are already written one way opens in that style; otherwise it starts from the last style you picked on this device.</li>
                <li><strong>Odd ages</strong> — <strong>More ages</strong> opens a second line with U7, U9, U11, U13, U15 and U17. It stays open while one of them is ticked.</li>
                <li><strong>Born in</strong> — you pick the first and last birth year for each group. They start blank on purpose: the product never guesses them from a name like U13. A box still to fill in has an amber edge, and the line at the foot says which groups are still waiting for their years.</li>
                <li><strong>Players it holds</strong> and <strong>Price</strong> — start from the season&apos;s values and can be changed per group. Enter 0 for a free group.</li>
                <li><strong>A second division for one age group</strong> — tap the <strong>+</strong> at the end of its row to add U10 B under U10. The group&apos;s chip then reads <strong>U10 ×2</strong>; tapping it takes off the newest one.</li>
                <li><strong>Gaps and overlaps</strong> — an amber line points out a birth year no division takes, or two groups whose years partly overlap. It never blocks. Two groups with exactly the same years raise no warning, because that is how two divisions for one age group are set up.</li>
              </ul>
              <p>The button at the foot reads <strong>Add 3 divisions</strong> and names the first thing still missing, such as a group that needs its birth years. A line in the window says when the club&apos;s birthdays count from; the owner sets that in <strong>Settings</strong>. The free League plan includes one division.</p>
            </>
          ),
        },
        {
          id: 'create-season-division',
          title: 'Edit a division',
          content: (
            <>
              <p>A division reads first, in a table with <strong>Born in</strong>, <strong>Players</strong>, <strong>Price</strong> and <strong>Early bird</strong>. Click a division&apos;s row to open it in a window. It reads first; click the pencil in the window to change any of it, and the tick to go back to reading. Every change saves as you go. <strong>Previous</strong> and <strong>Next</strong> step through the season&apos;s divisions.</p>
              <ul>
                <li><strong>Name</strong>, <strong>Born in</strong>, <strong>Players it holds</strong> (its size), <strong>Price</strong> and <strong>Early bird</strong> are fields on the record.</li>
                <li><strong>Note for families</strong> — a short line, such as <em>Tuesday nights</em>. Families see it on the sign-up form only when a child fits two divisions, to help them choose.</li>
                <li><strong>Changing birth years never moves a child who is already registered.</strong> The record says how many registered children no longer fit the new years; they stay where they are.</li>
                <li><strong>Lowering Players it holds</strong> never removes anyone.</li>
                <li><strong>Remove this division</strong> ends the window, and is there only while nobody is in it (accepted, received or on the waitlist). It asks first, and you can add the division again later.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'create-season-prices',
          title: 'Prices and early bird',
          content: (
            <>
              <p>Each division has its own <strong>Price</strong> (0 reads <strong>Free</strong>) and, if you like, its own early-bird amount. The early-bird <em>date</em> is one date for the whole season, set in the <strong>Registration</strong> block, and it is the last day the early amount applies: a child who signs up on or before it pays the early amount.</p>
              <ul>
                <li>An early amount can&apos;t be more than the price. An early amount with no season early-bird date does nothing, and the division says it needs a date.</li>
                <li><strong>Families see the early bird before they register.</strong> While it runs, each division on the season&apos;s public page shows the price and what it saves (<em>$145 · Save $20</em>), with the date and the regular price under it, and your club&apos;s pages carry a line such as <em>Save $20 · early bird through Oct 31</em> on the season, counting down in its last week. The day after the early-bird date, families see the regular price only.</li>
                <li><strong>A child&apos;s price is recorded when they sign up.</strong> Editing prices later changes new sign-ups only; each registration keeps the price it signed up at.</li>
                <li>To change one child&apos;s price afterward, use <strong>Correct the price</strong> on Registrations (see <em>Managing registrations day to day</em>).</li>
                <li>Fees reach your accounting books only when a registration&apos;s fee is marked received, not when you approve it (see <em>The season&apos;s Money page</em>).</li>
              </ul>
            </>
          ),
        },
        {
          id: 'create-season-registration',
          title: 'The Registration block',
          content: (
            <>
              <p>The <strong>Registration</strong> block reads first. Click the pencil in its heading to edit it and the tick to go back; changes save as you go. A season&apos;s form can&apos;t close before it opens, and the page holds that change until the dates are fixed.</p>
              <HelpDefs>
                <HelpDef term="Registration dates">When the form opens and closes. Once registration is open, the dates run the form.</HelpDef>
                <HelpDef term="Early-bird date">The last day each division&apos;s early amount applies.</HelpDef>
                <HelpDef term="Waiver">Text families tick a box to agree to. Leave it empty if you don&apos;t need one.</HelpDef>
                <HelpDef term="Email consent">A line the sign-up form always asks, unticked, beside the waiver: whether the club may email about future seasons and club news. Emails about the sign-up itself are sent either way.</HelpDef>
                <HelpDef term="How families pay">Your own words, such as an e-Transfer address and a deadline. Families see them once a child is accepted, and in their email. It is required when any division has a price above $0, and can&apos;t be emptied while registration is open and a division charges. A free season doesn&apos;t need it.</HelpDef>
                <HelpDef term="New registrations">Either approved while a division has room, with a full division starting a waitlist, or held for your review. A child waiting for review holds a spot, so once accepted and waiting children fill a division, the next child goes to the waitlist.</HelpDef>
                <HelpDef term="Waitlist">Moves up on its own when a spot frees, or you move it up yourself.</HelpDef>
                <HelpDef term="Owing turns amber">After how many days an accepted player who has not paid turns amber on Registrations. It starts at 14, counted from the day the child was accepted, and takes a whole number of days from 1 to 365. A free season has no such row.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'create-season-delete',
          title: 'Delete a season made by mistake',
          content: (
            <p>A season that is still <strong>Getting ready</strong> can be deleted: at the very end of its page, click <strong>Delete the season&hellip;</strong>. The window says what goes with it (its divisions and setup) and asks first. Deleting frees the season&apos;s web address, so you can use it again. The link is there only while nothing real is attached: once you open registration, or a family, a team, a game, an email or an entry on the season&apos;s Money page is attached, it isn&apos;t offered, and the season ends by being <strong>archived</strong> instead (see <em>Closing out a season</em>).</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-launch-season',
      group: 'How-to recipes',
      heading: 'How to launch a house league season',
      summary: 'Create the season, finish the checklist (age groups, prices, registration dates and how to pay), and open registration.',
      keywords: ['launch season', 'season setup', 'registration open', 'age groups', 'prices', 'how to pay', 'divisions', 'capacity', 'spots', 'checklist', 'before you open registration', 'open registration button'],
      searchText: 'launch season create season setup age groups divisions spots capacity prices birth years registration dates how to pay how families pay waiver optional free checklist before you open registration open registration button appears public form new registrations approve hold for review schedule teams view public page',
      links: [
        { label: 'House league', href: '../house-league' },
      ],
      content: (
        <>
          <p>Use this checklist when starting a new recreational season.</p>
          <ol>
            <li>Click <strong>Create season</strong> on the House league page, give it a name, sport and dates. The season starts as <strong>Getting ready</strong>, on its own page.</li>
            <li>Work through <strong>Before you open registration</strong>. Each line shows a tick when it is done: <strong>Age groups</strong> (each with birth years and a size); <strong>Prices</strong> (a price for each age group, 0 if it is free); <strong>Registration dates</strong> (when the form opens and closes); <strong>How to pay</strong>; and <strong>Waiver</strong>, which is optional.</li>
            <li>Check the <strong>Registration</strong> block: the early-bird date, the waiver, and whether new registrations are approved while a division has room or held for your review.</li>
            <li>When the required lines are done, <strong>Open registration</strong> appears beside the checklist. Click it and read the window, then confirm. It does not email families.</li>
            <li>Click <strong>View public page</strong> and share its link from your website, email list or social media once the form is live.</li>
          </ol>
          <p>The button isn&apos;t there until the required lines are done, so a season can&apos;t open half-built. <strong>How to pay</strong> appears on the checklist only when some price is above $0, and a free season skips it. A line that isn&apos;t done has a door to the place that fixes it, and the line under the checklist says what is still missing. Changing divisions or spots after families start registering can make the review queue harder to manage.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-house-league-before-opening',
          question: 'What should be done before I open house league registration?',
          answerText: 'Finish the checklist on the season page: add age groups with birth years and a size, set a price for each (0 if it is free), set when the form opens and closes, and add how families pay when any price is above $0. The waiver is optional. Open registration appears once the required lines are done.',
          keywords: ['open registration', 'launch checklist', 'division capacity', 'open registration missing', 'no open registration button', 'age groups', 'how to pay', 'prices', 'registration dates'],
          popular: true,
          answer: (
            <p>Finish the lines under <strong>Before you open registration</strong> on the season&apos;s page: <strong>Age groups</strong> with birth years and a size, a <strong>Price</strong> for each (0 if it&apos;s free), the <strong>Registration dates</strong>, and <strong>How to pay</strong> when any price is above $0. The waiver is optional. <strong>Open registration</strong> appears once the required lines are done.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-open-close-registration',
      group: 'How-to recipes',
      heading: 'How to open, pause, or close registration',
      summary: 'Open registration, let the dates run the form, close it early, reopen it until a new date, and start the season when you are ready.',
      keywords: ['open registration', 'close registration', 'close registration early', 'reopen registration', 'reopen until', 'pause registration', 'new close date', 'registration dates', 'opens', 'closed', 'you closed registration', 'start season', 'public form', 'season status'],
      searchText: 'open registration close registration close early reopen registration reopen until new close date pause public form season status registration open closed getting ready the dates run the form opens jun 1 closed aug 1 closes by itself close date passed you closed registration on form opens form closes start season activate season waitlist keeps its place capacity registration block window what changes families not emailed warns waiting registrations',
      links: [
        { label: 'House league', href: '../house-league' },
      ],
      content: (
        <>
          <p>Registration follows the season&apos;s state and its registration dates together, and the Registration block always says whether the date or you closed it. Every change you make asks first, in a window that says what changes for families.</p>
          <ol>
            <li>Open the season&apos;s page. When the checklist is done, click <strong>Open registration</strong> to put the form live. If the form&apos;s open date is still ahead, the page says <strong>Opens</strong> and the date, and families can sign up from that day.</li>
            <li>To stop new sign-ups now, click <strong>Close registration</strong> on the <strong>Registration</strong> block. The window warns, but doesn&apos;t block, if registrations are waiting for review or families are on the waitlist. Families already on the waitlist keep their place, and you can still approve, waitlist and add registrations by hand. The block then reads <strong>You closed registration on</strong> the day you did.</li>
            <li>To take sign-ups again, click <strong>Reopen until&hellip;</strong> on the same block and pick a new close date. The form opens again now and runs to the end of that day. Families are not emailed. It is offered until the season is under way; add late players by hand after that.</li>
            <li>When teams and the schedule are ready, click <strong>Start season</strong> at the top of the page. Teams and the schedule can still change while it is running.</li>
          </ol>
          <p><strong>The close date closes the form by itself.</strong> Once the date passes, the block reads <strong>Closed</strong> and the date, for example <em>Closed Aug 1</em>, and the form takes no more sign-ups. You don&apos;t have to press anything: you can go straight to <strong>Start season</strong>, or choose <strong>Reopen until&hellip;</strong> to take late sign-ups. The season&apos;s public page shows the same state to families.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-house-league-registration-closed-itself',
          question: 'Registration closed and I did not press anything. Why?',
          answerText: 'The registration close date passed, so the form closed by itself. The Registration block reads Closed with the date, for example Closed Aug 1. To take late sign-ups, click Reopen until and pick a new close date. To carry on, click Start season. When you close registration yourself, the block reads You closed registration on the day you did.',
          keywords: ['registration closed itself', 'closed automatically', 'close date passed', 'closed aug 1', 'reopen until', 'reopen registration', 'late sign-ups', 'form closed'],
          answer: (
            <p>The registration <strong>close date</strong> passed, so the form closed by itself. The Registration block reads <strong>Closed</strong> and the date. To take late sign-ups, click <strong>Reopen until&hellip;</strong> and pick a new close date; to carry on, click <strong>Start season</strong>. When you close registration yourself, the block reads <strong>You closed registration on</strong> the day you did.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-build-teams',
      group: 'How-to recipes',
      heading: 'How to build teams and run a draft',
      summary: 'Create team slots in bulk, assign players manually or by draft, and finalize once everyone is picked.',
      keywords: ['build teams', 'create teams', 'draft', 'assign players', 'randomize', 'finalize'],
      searchText: 'build teams create teams bulk count names team colour coach edit team player pool approved active draft randomize confirm finalize resume draft clear all assignments unassigned',
      content: (
        <>
          <p>Build teams after most registrations are reviewed and the division player pool is clean. Only <strong>Active</strong> registrations appear in the pool — pending, declined, waitlisted, and withdrawn players are excluded.</p>
          <ol>
            <li>Open the season, go to <strong>Teams &amp; draft</strong>, and select a division.</li>
            <li>Click <strong>Create teams</strong>. You choose how many teams to create and type their names in one step (on the free League plan you can create up to eight). Set each team&apos;s <strong>colour</strong> and <strong>coach name</strong> afterward with <strong>Edit team</strong>.</li>
            <li>Assign players from the pool by dragging them onto a team — or use <strong>Randomize</strong> to spread all unassigned players evenly (it asks you to confirm first, and won&apos;t move already-assigned players).</li>
            <li>For a structured draft, click <strong>Start draft</strong>. Teams take turns picking from the pool; picks can be undone one at a time. If you leave mid-draft, a <strong>Resume draft</strong> button picks it back up.</li>
            <li>Click <strong>Finalize draft</strong> to apply the assignments. Finalize stays disabled until every player has been picked.</li>
          </ol>
          <p>You can re-assign players any time by dragging them to a different team or back to the pool, and <strong>Clear all assignments</strong> wipes assignments (and any in-progress draft) to start over.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-player-missing-from-house-league-team-pool',
          question: 'Why is a player missing from the team builder?',
          answerText: 'Only Active registrations appear in the team assignment pool. Pending, waitlisted, declined, and withdrawn players are excluded — move the player to Active first.',
          keywords: ['missing player', 'team builder', 'active registration'],
          popular: true,
          answer: (
            <p>Check the player&apos;s registration status. Only <strong>Active</strong> registrations appear in the team assignment pool — move the player to Active first.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-generate-house-league-schedule',
      group: 'How-to recipes',
      heading: 'How to generate a schedule and add practices',
      summary: 'Generate a round-robin after teams exist, pick fields from your Venue library, and let the schedule catch double-bookings.',
      keywords: ['generate schedule', 'round robin', 'games', 'preview', 'practices', 'recurring', 'field', 'venue', 'double-booked'],
      searchText: 'generate schedule house league round robin games preview teams divisions location field diamond court venue library pick a field time end time rounds per week add game practices recurring practice start end time cancel a game status cancelled call off a game delete a game remove a game cancel series double booking double-booked conflict clash overlap somewhere else off-site not inside the club’s permit outside the permit grey line permit',
      content: (
        <>
          <p>Generate a schedule only after the division&apos;s teams are created.</p>
          <ol>
            <li>Open the season, go to <strong>Schedule</strong>, and select the division.</li>
            <li>Click <strong>Generate schedule</strong> to build a round-robin (every team plays every other team once).</li>
            <li>Enter the first game date, default time, <strong>rounds per week</strong>, and a default field.</li>
            <li>Preview the generated games and look for date, field, or matchup problems.</li>
            <li>Save the schedule. Edit individual games afterward for exceptions, or use <strong>Add game</strong> for one-off games. A game can carry an optional <strong>end time</strong>; without one, the schedule assumes 90 minutes when checking for overlaps. To call a game off, open it, set <strong>Status</strong> to <strong>Cancelled</strong> and <strong>Save</strong>; it stays on the schedule, marked cancelled, and frees its diamond. To remove a game that should never have been on the schedule, open it and choose <strong>Delete this game</strong> at the end of the window; it asks first, then leaves the schedule and the public page for good, and a played game&apos;s score comes out of the standings.</li>
          </ol>
          <p><strong>Where games are played.</strong> Every game and practice window asks <strong>Venue</strong>, then the diamond beside it. For one of your club&apos;s venues the label is what the Venue library says its facilities are (for example <strong>Diamond</strong> or <strong>Field</strong>), or <strong>Facility</strong> where a venue has more than one kind; for a typed venue it&apos;s your season&apos;s sport&apos;s own word. Type to find one of your club&apos;s venues from the <strong>Venue library</strong> (under Organization), set up once for every season, then pick its diamond. An archived venue leaves this list; the games already on it keep it. <strong>Not set</strong> means anywhere at that venue. A venue you just type, for an away facility, saves as plain text, but typed venues can only be matched against identically typed text, so picking from the library is what makes clash checking reliable.</p>
          <p><strong>Double-booking protection.</strong> The schedule treats games and practices as one pool of bookings. When the date, time and diamond are set, the window checks before you press <strong>Create</strong>: another league game or practice on that diamond at that time shows in <strong>red</strong> under the field, naming it, and <strong>Create</strong> stays greyed until you change the time or the diamond. A recurring practice series names the date it clashes on. The schedule page also shows a warning strip listing any existing clashes, and a count of bookings with no diamond set (those can&apos;t be checked at all). The generator is the one exception: it saves and <em>warns</em> instead of blocking, because a generated round places several games at the same default time on purpose. Spread them across times or diamonds afterward.</p>
          <p><strong>Your club&apos;s other teams and tournaments.</strong> If one of the club&apos;s rep teams or tournaments holds the diamond, an <strong>amber</strong> line says so under the field, for example <em>&ldquo;Diamond B is booked by 11U AA practice, 6:00–7:30 p.m.&rdquo;</em> That one never blocks: the game or practice still saves, because a diamond shared between two programs is for the club to settle, not for either form to refuse. The generator&apos;s after-save summary counts these too.</p>
          <p><strong>Practices</strong> are tracked on their own tab. Add a single or recurring practice per team with a start and end time and a field. When you cancel a recurring practice, you choose whether to cancel just that one, this and the rest of the series, or the whole series.</p>
          <p>Exporting the schedule (Excel, CSV, or calendar file) is part of League Plus.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-house-league-double-booked',
          question: 'Why is Create greyed out — the line under the diamond is red?',
          answer: (
            <p>Another <strong>league</strong> game or practice holds that diamond at an overlapping time, and the red line under the field names it. Pick a different time or diamond, or move the other booking first. If the game genuinely shares the facility (say, two mini-games on one surface), record the second one with a typed venue instead of the picked diamond. An <strong>amber</strong> line is different: one of your club&apos;s rep teams or tournaments holds the diamond, and you can still save. A quiet <strong>grey</strong> line (&ldquo;Outside the club&rsquo;s permit for Diamond B&rdquo;) means the time falls outside the club&rsquo;s permit there; it never stops you saving, and the schedule generator says after saving how many games fall outside. Entering scores on an existing game is never blocked. Only changes to where or when it&apos;s played are checked.</p>
          ),
          answerText: 'A red line under the diamond means another league game or practice holds it at an overlapping time: pick a different time or diamond, or move the other booking. An amber line means one of your club’s rep teams or tournaments holds it, and the game still saves. A quiet grey line — “Outside the club’s permit for Diamond B” — means the time is outside the club’s permit there; it never blocks, and the generator says after saving how many games fall outside. Entering scores is never blocked — only changes to where or when a game is played are checked against double-bookings.',
          keywords: ['double-booked', 'field already booked', 'diamond already booked', 'already booked', 'conflict', 'cannot save game', 'create greyed out', 'overlap', 'red line', 'amber line', 'rep team practice', 'clash', 'location', 'venue', 'grey line', 'permit', 'outside the permit'],
        },
      ],
    },
    {
      id: 'recipe-record-house-league-scores',
      group: 'How-to recipes',
      heading: 'How to record scores and read standings',
      summary: 'Complete games, enter results, and understand the points-based standings.',
      keywords: ['scores', 'standings', 'completed games', 'points', 'tiebreaker'],
      searchText: 'record scores update standings completed games home score away score points win two tie one loss zero differential GF GA standings page tiebreaker',
      content: (
        <>
          <p>Standings are based on completed games, so score entry and game status matter.</p>
          <ol>
            <li>Open the season schedule and click the game that has been played.</li>
            <li>Set its status to <strong>Completed</strong> — the score fields appear.</li>
            <li>Enter the home and away scores and save.</li>
            <li>Open <strong>Standings</strong> (its own page, reached from the division) to see the updated table.</li>
          </ol>
          <p>Standings rank teams by <strong>points</strong> — a win is worth 2, a tie 1, and a loss 0. Ties in points are broken by score differential, then by total scored (the GF/GA columns). If standings look wrong, check for games still scheduled, postponed, or missing scores — only completed games count.</p>
        </>
      ),
    },
    {
      id: 'family-signup',
      group: 'Running the season',
      heading: 'What families see when they sign up',
      summary: 'Families sign up one child or several in one go, see each child’s outcome before they send, get one reference and one email, and check their status with their email and reference.',
      keywords: ['sign up several children', 'sign up more than one child', 'siblings', 'reference', 'accepted', 'received', 'waitlist', 'status page', 'check your registration', 'date of birth', 'no division fits', 'family email', 'how to pay', 'early bird', 'ask to withdraw', 'ask to withdraw a child', 'family wants to withdraw', 'refund on the status page', 'kept by the club', 'withdrawn', 'declined', 'price to pay'],
      searchText: 'family sign up form sign up several children in one go siblings add another child up to eight children date of birth picks the division born in birth year club cut-off each child outcome before sign up spot and price early bird applied early bird ended waitlist nothing to pay unless a spot opens two divisions for one age group family picks note for families no division fits contact the club child left out others still sign up one reference for the sign-up one email lists every child total to pay how to pay accepted received waitlist 1st status page check your registration email and reference find everything parent or guardian email waiver email consent unticked payable separately the form does not take payment approve means accepted pending review means received status page declined withdrawn spot released reads withdrawn refunded on kept by the club reason the club is keeping to pay part of the price still to pay price rose ask to withdraw a child request sent the child keeps their place until the club acts you asked to withdraw the club will confirm by email note for the club 300 characters asked once too many tries needs attention house league withdrawal request clears itself when the registration ends',
      content: (
        <>
          <p>This is what a family sees on your season&apos;s sign-up form, after it and in their email. Knowing it helps when a parent phones to ask what a screen meant.</p>
        </>
      ),
      subtopics: [
        {
          id: 'family-signup-form',
          title: 'Signing up one child or several',
          content: (
            <>
              <p>One form signs up one child or several. <strong>+ Add another child</strong> adds a block for each, up to eight at once, and a family signs up again for more. Each child&apos;s <strong>date of birth</strong> finds their division from the birth years you set, under your club&apos;s cut-off, so the family doesn&apos;t choose.</p>
              <ul>
                <li><strong>Each child&apos;s outcome shows before Sign up.</strong> A line under the child says the division, how many spots are left and the price, with the early-bird price applied or a note that it ended. A full division says the child joins the waitlist and pays nothing unless a spot opens.</li>
                <li><strong>A spot one child takes counts against the next</strong> child in the same sign-up. A child never jumps an existing waitlist: if the division has a waitlist, the child joins it.</li>
                <li><strong>Two divisions for one age group</strong> — the family picks, seeing each division&apos;s <strong>Note for families</strong> and how much room it has.</li>
                <li><strong>A season that doesn&apos;t sort by age</strong> shows a Division list instead, with the spots left in each.</li>
                <li>The waiver, if you set one, and the unticked email-consent line sit before the button. The button reads <strong>Sign up 2 children</strong> when there are several.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'family-signup-nofit',
          title: 'A child no division fits',
          content: (
            <p>When no division takes a child&apos;s birth year, the form says so in a card with your club&apos;s contact details, and that child is left out: nothing is signed up for them. The other children in the same sign-up still go through. If you want that child in, add an age group or change a division&apos;s birth years first.</p>
          ),
        },
        {
          id: 'family-signup-after',
          title: 'The reference, the email and the status page',
          content: (
            <>
              <p>One sign-up gets one <strong>reference</strong>, shown on the confirmation and in the one email the family receives. The email lists every child with their division, outcome and price, the total to pay, and, once a child is accepted, your <strong>How families pay</strong> words. The form doesn&apos;t take payment; families pay you the way you describe.</p>
              <ul>
                <li><strong>Accepted</strong> — the child has a spot. This is what you set by clicking Approve, or what an automatic season does while a division has room.</li>
                <li><strong>Received</strong> — the child is waiting for your review. Nothing is due yet. This is Pending review on your side.</li>
                <li><strong>Waitlist</strong>, with their place, such as <em>Waitlist &middot; 1st</em>.</li>
              </ul>
              <p>On the season&apos;s <strong>Check your registration</strong> page, a family enters their parent or guardian email and their reference to find every child in the sign-up, with each child&apos;s status, division, fee and how to pay. Both the email and the reference are needed.</p>
            </>
          ),
        },
        {
          id: 'family-signup-status-after',
          title: 'What the status page says once money or an ending is involved',
          content: (
            <>
              <p>The status page follows the registration after the family signs up, so it also carries the money.</p>
              <ul>
                <li><strong>Declined</strong> or <strong>Withdrawn</strong> — an ended child reads one of these two words. A spot the club released reads <strong>Withdrawn</strong> too. An ended child has no amount to pay, no pay card and no way to ask to withdraw.</li>
                <li><strong>A refund</strong> — an ended child whose fee went back reads <em>$150 refunded on Oct 24 (E-Transfer)</em>. The brackets are left off when the way was <strong>Other</strong> or not recorded.</li>
                <li><strong>A kept fee</strong> — when the club keeps the fee, the child reads <em>The club is keeping the $150</em> followed by the reason you gave, so write it for the family to read.</li>
                <li><strong>A price that rose</strong> — a child who has part-paid reads the amount still to pay in amber, with a line saying what the price is now and what was received.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'family-signup-ask-withdraw',
          title: 'A family asks to withdraw a child',
          content: (
            <>
              <p><strong>Ask to withdraw a child</strong> sits below the children on the status page (<strong>Ask to withdraw</strong> and the child&apos;s name when there is only one). It is there for any child who has not ended.</p>
              <HelpSteps>
                <li>The family picks <strong>Which child?</strong> when there is more than one.</li>
                <li>They can add a <strong>Note for the club</strong>, up to 300 characters, such as why. It is not required.</li>
                <li>They press <strong>Send request</strong>.</li>
              </HelpSteps>
              <ul>
                <li><strong>Nothing changes until you act.</strong> The child keeps their place and still reads <strong>Accepted</strong>, with a line under it saying the family asked on that day and the club will confirm by email.</li>
                <li><strong>The desk is told.</strong> The owner, club admins, league admins and league registrars get a <strong>House league withdrawal request</strong> under <strong>Needs attention</strong>. It opens Registrations on that child, and the <strong>Withdraw</strong> window leads with the family&apos;s request and note.</li>
                <li><strong>It clears itself</strong> once the registration ends, whoever ends it.</li>
                <li>A family can ask once for each child. Asking again, or for a child who has already ended, says so instead of sending a second request.</li>
              </ul>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-house-league-family-lost-reference',
          question: 'A family lost their reference. How do they check their registration?',
          answerText: 'The reference is in the confirmation email, which lists every child in the sign-up. They enter that reference and the parent or guardian email they signed up with on the season’s Check your registration page. If they cannot find the email, ask them to check spam, or find the registration by name or parent email on the Registrations page.',
          keywords: ['lost reference', 'reference', 'check registration', 'status page', 'confirmation email', 'sign up status', 'find sign-up'],
          answer: (
            <p>The reference is in their confirmation email. They enter it with the parent or guardian email they signed up with on the season&apos;s <strong>Check your registration</strong> page. If they can&apos;t find the email, ask them to check their spam folder, or search by player name or parent email on the Registrations page.</p>
          ),
        },
      ],
    },
    {
      id: 'registrations',
      group: 'Running the season',
      heading: 'Managing registrations day to day',
      summary: 'Four tabs (To review, Active, Waitlist, Ended) with the fee on every row, and the actions that approve, take a fee, end a registration, correct a price or move a child.',
      keywords: ['registrations', 'to review', 'active', 'waitlist', 'ended', 'approve', 'promote', 'decline', 'withdraw', 'release the spot', 'mark received', 'undo', 'correct the price', 'move to another division', 'move division', 'fee column', 'owing', 'refunded', 'kept by the club', 'bulk', 'select several', 'email families', 'add registration', 'registrar', 'division full', 'add to the waitlist instead', 'needs attention', 'sign-up', 'reference', 'finished season'],
      searchText: 'registrations screen tabs to review active waitlist ended declined withdrawn spot released amber count search players or parents filter fee owing received refunded tools export email families add registration by hand walk-in division full add to the waitlist instead approve refused hand-add refused moving a child into a full division nobody jumps the waitlist a child waiting for review holds a spot one needs attention notice per sign-up several children one reference accepted received no email address guardian fee column owing n days accepted today accepted amber after the club’s number of days 14 received date how e-transfer cash cheque card other not recorded received in part price rose refunded kept by the club price corrected nothing owed yet free mark received amount shown not typed no partial amount date received how undo marked received by mistake not a refund voided line closed fiscal year correct the price reason a lower price records a refund of the difference a higher price leaves the difference owing family not emailed move to another division move division full division joins the waitlist keep price use the new price a child who has paid keeps their price owner club admin league admin only the registrar cannot move a child decline withdraw release the spot one window what happened to the money refunded date how kept by the club reason the family reads note to the family withdraw emails only when money was refunded or kept the waitlist moves up in the same step decline and withdraw one at a time bulk bar approve promote waitlist mark received move division email clear partial result stays until dismissed rows that stayed are still selected finished season locked mark received undo correct the price stay open',
      links: [
        { label: 'Registrations guide', href: '../help/registrations' },
      ],
      content: (
        <>
          <p>Registrations arrive through the public form while a season is in <strong>Registration open</strong>. Each lands under <strong>To review</strong> unless the season approves automatically while a division has room, and a child waiting for review holds a spot. Several children signed up together arrive as separate rows sharing one reference, with one <strong>Needs attention</strong> notice for the whole sign-up. The owner, club admin, league admin and league registrar all work this page.</p>
        </>
      ),
      subtopics: [
        {
          id: 'registrations-tabs',
          title: 'The tabs, search and filter',
          content: (
            <>
              <ul>
                <li><strong>To review</strong> — new sign-ups that need your answer. The count is an amber number on the tab.</li>
                <li><strong>Active</strong> — accepted players, with the fee on each row.</li>
                <li><strong>Waitlist</strong> — children waiting for a spot, in order.</li>
                <li><strong>Ended</strong> — declined, withdrawn and released registrations, with what happened to any money.</li>
              </ul>
              <p>The division pill narrows the list to one division, and <strong>Search players or parents</strong> finds a child or a guardian across the tab. <strong>Filter</strong> narrows by <strong>Fee</strong>: <strong>Owing</strong> and <strong>Received</strong>, plus <strong>Refunded</strong> on the Ended tab. A season where no division has a price has no Fee column and no Fee filter. <strong>Tools</strong> holds <strong>Export</strong> (Excel first) and <strong>Email families</strong>; exports are part of League Plus. <strong>Add registration</strong> enters a player by hand, outside the public form, and a full division refuses it the same way it refuses Approve.</p>
              <p>A division cell shows the team underneath, or <strong>Not placed</strong>. A guardian cell shows the email address, or <strong>No email address</strong> in amber, so you see it before an Email press skips that family.</p>
            </>
          ),
        },
        {
          id: 'registrations-actions',
          title: 'Approve, Waitlist, Promote and the row menu',
          content: (
            <>
              <ul>
                <li><strong>Approve</strong> — the one button on a To review row. It moves the player to Active and emails the family, who read it as <strong>Accepted</strong>. A full division refuses it with <em>Add to the waitlist instead</em>, and a <strong>Waitlist</strong> link beside the line does that for you.</li>
                <li><strong>Waitlist</strong> — holds the registration in queue and emails the family their position. If the season moves the waitlist up on its own, the next waitlisted player advances when a spot opens. A new sign-up never jumps the waitlist.</li>
                <li><strong>Promote</strong> — the one button on a Waitlist row. It accepts the child into the division and emails the family. If the division is still full, the child stays on the waitlist and the line says so.</li>
                <li><strong>Mark received</strong> — the one button on an Active row that is owing (see <em>Fees on the Registrations screen</em>).</li>
              </ul>
              <p>Everything else sits behind the <strong>&hellip;</strong> on the row, each with a line saying what it does: <strong>Move to another division</strong>, <strong>Correct the price</strong>, <strong>Release the spot</strong>, <strong>Withdraw</strong>, <strong>Decline</strong>, <strong>Email this family</strong> and <strong>Undo: marked received by mistake</strong>. An item the row can&apos;t use isn&apos;t drawn at all.</p>
            </>
          ),
        },
        {
          id: 'registrations-fee',
          title: 'Fees on the Registrations screen',
          content: (
            <>
              <p>The <strong>Fee</strong> column shows the price fixed on each registration when the family signed up, and where that stands:</p>
              <HelpDefs>
                <HelpDef term="Nothing owed yet">A child under To review or on the waitlist. Nothing is due until they are accepted.</HelpDef>
                <HelpDef term="$150 owing · 9 days">An accepted child who has not paid. The line under it says <em>Accepted Oct 16</em> or <em>Accepted today</em>, and the days are counted from that day. The pill turns amber after the number of days set on the season&apos;s <strong>Registration</strong> block (<em>Owing turns amber</em>, starting at 14). A child accepted before the day was recorded shows the amount owing with no day count and never turns amber.</HelpDef>
                <HelpDef term="$150 received">Paid in full, with the date and how: <strong>E-Transfer</strong>, <strong>Cash</strong>, <strong>Cheque</strong>, <strong>Card</strong>, <strong>Other</strong>, or <strong>Not recorded</strong>.</HelpDef>
                <HelpDef term="$120 received · $30 owing">The price rose after the family paid. The row shows what came in and what is still owing, with no day count.</HelpDef>
                <HelpDef term="$150 refunded">The fee went back to the family when the registration ended.</HelpDef>
                <HelpDef term="$150 kept by the club">The club kept the fee when the registration ended. The row shows the reason you gave, shortened; the whole of it is in the child&apos;s record.</HelpDef>
                <HelpDef term="Price corrected">A third line under the fee, with the reason. Hover or tap it to read what it was and what it is now.</HelpDef>
              </HelpDefs>
              <p>A free division reads <strong>Free</strong>. On a phone the same fee words sit in the row&apos;s detail line.</p>
            </>
          ),
        },
        {
          id: 'registrations-mark-received',
          title: 'Mark received, and Undo',
          content: (
            <>
              <HelpSteps>
                <li>On an owing row, click <strong>Mark received</strong>.</li>
                <li>Read the <strong>Amount</strong>. It is shown, never typed: it is the whole amount still owing, so there are no partial amounts.</li>
                <li>Set <strong>Date received</strong> (today unless you change it, never after today) and <strong>How</strong>. <strong>How</strong> can stay <strong>Not recorded</strong>.</li>
                <li>Click <strong>Mark received</strong>. One income line goes into the season&apos;s book (see <em>The season&apos;s Money page</em>).</li>
              </HelpSteps>
              <p><strong>Undo: marked received by mistake</strong>, in the row&apos;s menu, takes a payment back when the money never arrived. The child shows as owing again and the line stays in the season&apos;s history, marked voided. On the Club plan, a payment dated in a closed fiscal year can&apos;t be undone until that year is reopened.</p>
              <HelpNote variant="warning" title="Undo is not a refund">
                If the money did arrive and is going back to the family, decline or withdraw the registration instead, and record the refund there.
              </HelpNote>
            </>
          ),
        },
        {
          id: 'registrations-end',
          title: 'Decline, Withdraw and Release the spot',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Decline">The club says no. Available on a To review, Waitlist or Active row.</HelpDef>
                <HelpDef term="Withdraw">The child leaves. Available on an Active row.</HelpDef>
                <HelpDef term="Release the spot">An accepted family that hasn&apos;t paid. The spot goes back to the division. The family reads <strong>Withdrawn</strong>.</HelpDef>
              </HelpDefs>
              <p>Each opens one window. When money was received, it asks what happened to it, and nothing is picked until you choose; the button isn&apos;t there until you do:</p>
              <ul>
                <li><strong>Refunded</strong> — give the date and how. It is recorded as money going back, beside the payment, on the season&apos;s Money page.</li>
                <li><strong>Kept by the club</strong> — give a reason. The family reads it in their email.</li>
              </ul>
              <p><strong>Who is emailed:</strong> Decline and Release the spot always email the family, and carry your note and the money line. Withdraw emails only when money was refunded or kept; a withdrawal with no money moved sends nothing, and the window says so. If the season moves the waitlist up on its own, the next child moves up in the same step and the window names them; otherwise it says the spot stays open for you to fill.</p>
              <p>Decline and Withdraw are one at a time, because each asks what happened to that family&apos;s money. When the family asked to withdraw, the window leads with their request and note.</p>
            </>
          ),
        },
        {
          id: 'registrations-price-move',
          title: 'Correct a price, and move a child to another division',
          content: (
            <>
              <p><strong>Correct the price</strong> is for an Active child, owing or received. The window shows what they signed up at, takes a <strong>New price</strong> and a required <strong>Reason</strong>, and says what will happen before you save:</p>
              <ul>
                <li><strong>Not paid</strong> — the new price is what the family owes.</li>
                <li><strong>Paid, and the price goes up</strong> — the difference shows as still owing.</li>
                <li><strong>Paid, and the price goes down</strong> — the difference is recorded as a refund, and the window asks the date and how.</li>
              </ul>
              <p>The family is not emailed. The correction is kept with the old price, the new price, your reason, who and when; it moves no money by itself.</p>
              <p><strong>Move to another division</strong> is for the owner, club admins and league admins only. It checks the room first. A full division is not refused: the child joins its waitlist, and the window says their place in line. When the destination charges a different price and nothing has been received, it asks once whether to keep the child&apos;s price or use the new division&apos;s (an early bird still applies for the day they signed up). A child who has paid keeps their price, and the window says so and points to Correct the price. The family is not emailed.</p>
            </>
          ),
        },
        {
          id: 'registrations-bulk',
          title: 'Working several at once',
          content: (
            <>
              <p>Tick rows and a bar appears with only the actions that tab can use: <strong>Approve</strong> (To review), <strong>Promote</strong> (Waitlist), <strong>Waitlist</strong> (To review and Active), <strong>Mark received</strong> (Active), <strong>Move division</strong> and <strong>Email</strong>, with <strong>Clear</strong> to drop the selection. <strong>Decline</strong> and <strong>Withdraw</strong> are one at a time.</p>
              <ul>
                <li><strong>Anything that tells families asks first</strong> and says so in the button, for example <em>Approve 6</em>.</li>
                <li><strong>Mark received</strong> shows the total and takes one date and one way for all of them.</li>
                <li><strong>Move division</strong> asks the price question once for the batch. Children who have paid keep their price and are named.</li>
                <li><strong>Email</strong> says how many families have no email address and are skipped.</li>
              </ul>
              <p>The result is said plainly, with what stayed and why: <em>3 promoted; 2 stay on the waitlist: Division A is full.</em> A clean result fades. A partial one stays until you dismiss it, and the rows that stayed are still selected. A batch of fees dated into a closed fiscal year records nothing and says why.</p>
            </>
          ),
        },
        {
          id: 'registrations-who-finished',
          title: 'Who can do what, and a finished season',
          content: (
            <>
              <ul>
                <li>The owner, club admins, league admins and league registrars take fees (<strong>Mark received</strong>, <strong>Undo</strong>, <strong>Correct the price</strong>) and end registrations.</li>
                <li>Only the owner, club admins and league admins move a child between divisions.</li>
                <li>The treasurer reads the season&apos;s <strong>Money</strong> page and nothing else here.</li>
              </ul>
              <p>Once a season is finished, its registrations are locked: Approve, Waitlist, Promote, Decline, Withdraw, Release, Move and <strong>Add registration</strong> are gone, and a line at the top says so. <strong>Mark received</strong>, <strong>Undo</strong>, <strong>Correct the price</strong> and <strong>Email families</strong> stay, because fees still arrive after the last game.</p>
              <p>For the full registration workflow, see the <a href="../help/registrations">Registrations guide</a>.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'ledger-notifications',
      group: 'Running the season',
      heading: 'Money and Email families',
      summary: 'Money is the season’s page of registration fees owed, received and refunded. Email families sends season-wide email and logs what was sent.',
      keywords: ['money', 'ledger', 'email families', 'notifications', 'email log', 'fees', 'accounting', 'owed', 'received', 'still owing', 'refunds', 'every line', 'overview tiles', 'budget vs actual', 'house league registration fees', 'starting budget', 'email the season', 'broadcast', 'unsubscribe', 'opted out'],
      searchText: 'season money page season ledger renamed money season book owed received after refunds still owing every line still owing refunds tabs nobody types money on the page written only by marking a fee received recording a refund or correcting a price voided line struck through price corrected history line kept by the club history line owing since accepted days not known export finished season overview owed still owing tiles open money league plus the season’s book club plan fees also file on budget vs actual house league registration fees one row with each season under it a fee counts in the fiscal year it was received a refund lowers the row never counts as spending starting budget each division’s size times price planned once when registration opens in the fiscal year sign-ups open treasurer changes it or splits it across years on the budget page a line in the other year under the same word treasurer reads money email families notifications renamed email log sent emails approval waitlist decline confirmation history email the whole season broadcast message all registrants message registrants unsubscribe link opted out not sent skipped no email on file delivered count why did fewer families get it finished season stays open',
      content: (
        <>
          <p>Two pages sit beside Registrations, Teams &amp; draft, Schedule and Standings in a season&apos;s menu: <strong>Money</strong>, the season&apos;s registration fees, and <strong>Email families</strong>. Both stay open on a finished season: fees still arrive after the last game, and families still need a late word.</p>
        </>
      ),
      subtopics: [
        {
          id: 'money-page',
          title: 'The season’s Money page',
          content: (
            <>
              <p><strong>Money</strong> (it used to be called Ledger) is the season&apos;s fees: what is owed, what has come in and what is still to collect. Nobody types money onto this page. It is written only when you mark a fee received, record a refund while ending a registration, or correct a price, all on Registrations.</p>
              <HelpDefs>
                <HelpDef term="Owed">The price fixed on each accepted registration, added up, with the number of players.</HelpDef>
                <HelpDef term="Received">What has come in, after any refunds. The line under it says how much was refunded.</HelpDef>
                <HelpDef term="Still owing">Owed less received, amber while above zero.</HelpDef>
              </HelpDefs>
              <p>Three tabs sit under the figures. <strong>Every line</strong> lists fees in, refunds out in red, and the history lines that move no money (a corrected price, a fee the club kept); a payment taken back with Undo stays, struck through and never counted. <strong>Still owing</strong> lists players, with the day each was accepted and how many days since, and <strong>Not known</strong> where the day was never recorded. <strong>Refunds</strong> lists the money that went back. <strong>Export</strong> downloads the page. A free season has no figures and reads <em>This season is free</em>.</p>
              <p>The season&apos;s Overview shows <strong>Owed</strong> and <strong>Still owing</strong> tiles that open this page. Everyone who opens house league can read Money, and so can the club&apos;s treasurer.</p>
              <p>On League Plus this page is the season&apos;s book. On the Club plan the fees also file on the club&apos;s Budget vs. Actual (see <em>Budget vs. Actual and house league fees</em>). The club&apos;s Cash on hand counts the book either way.</p>
            </>
          ),
        },
        {
          id: 'money-statement',
          title: 'Budget vs. Actual and house league fees',
          content: (
            <>
              <p>On the Club plan, house league fees appear on <strong>Budget vs. Actual</strong> as one <strong>House league registration fees</strong> row with each season underneath it.</p>
              <ul>
                <li><strong>A fee counts in the fiscal year it was received</strong>, by its date, not by the season it belongs to.</li>
                <li><strong>A refund lowers the row.</strong> It never counts as spending.</li>
                <li><strong>The starting budget</strong> is each division&apos;s size times its price, planned once when registration opens, in the fiscal year sign-ups open. The treasurer can change it on the Budget page, or plan part of it in another fiscal year as a line in that year under the same word.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'email-families',
          title: 'Email families',
          content: (
            <>
              <p><strong>Email families</strong> (it used to be called Notifications) is where you email the season, with a log of what it has already sent (approvals, waitlist notices, declines), so you can confirm a family was contacted if they say they didn&apos;t receive something. The owner, club admin, league admin and league registrar can use it.</p>
              <p>On the Email families page you can address everyone active, the waitlist, or registrations waiting for review. The <strong>Email families</strong> item in the Registrations tools menu also lets you pick one division, one team, or one status. Every email carries your club&apos;s name and an <strong>unsubscribe link</strong>, and a family who has opted out is left out, including one who unsubscribed under an older email address and has since given you a new one.</p>
              <p>After sending, the confirmation accounts for everyone you addressed:</p>
              <ul>
                <li><strong>Delivered</strong> — the email went out.</li>
                <li><strong>Not sent (unsubscribed)</strong> — the family has opted out of club email. You see how many, never which ones; reaching them has to be a direct conversation.</li>
                <li><strong>Skipped (no email on file)</strong> — the registration has no usable address. Add one on the registration to include them next time.</li>
              </ul>
            </>
          ),
        },
      ],
    },
    {
      id: 'public-page',
      group: 'Running the season',
      heading: 'Sharing the public season page',
      summary: 'Once a season leaves Getting ready it gets a public page, and your club’s pages list every live season.',
      keywords: ['public page', 'public url', 'share', 'registration link', 'opens', 'closed', 'price range', 'early bird', 'early bird discount', 'early bird ends', 'save', 'discount', 'running now', 'playing now', 'final standings', 'past seasons'],
      searchText: 'public season page url share registration link schedule standings view public page getting ready no public page league page running now registration open registration closed starts playing now final standings past seasons club home open now every live season early bird shown to families save $20 discount line on the season row ends in days countdown last week price today regular price after the early-bird date save up to',
      content: (
        <>
          <p>A season has no public page while it&apos;s <strong>Getting ready</strong>. Once you open registration, a <strong>View public page</strong> button appears at the top of the season&apos;s page. That page is where families register and, later, follow the schedule and standings; share its link directly.</p>
          <p>Your club&apos;s house league page lists <strong>every</strong> live season under <strong>Running now</strong>, newest first, each labelled by what is happening: <strong>Opens</strong> and its date, <strong>Registration open</strong>, <strong>Closed</strong> and its date (when the close date has passed) or <strong>Registration closed</strong> (when you closed it), <strong>Starts</strong> and its first day, <strong>Playing now</strong>, or <strong>Final standings</strong> once the season&apos;s dates have passed but it isn&apos;t completed yet. Each row has its own links (<strong>Register</strong>, <strong>Schedule</strong>, <strong>Standings</strong>, <strong>Season page</strong>). Finished seasons sit below under <strong>Past seasons</strong>. The season&apos;s own page shows families the price range and each division&apos;s note for families, and never says who closed registration. Your club&apos;s home page lists every live season too, and a season that is taking registrations also shows under <strong>Open now</strong>.</p>
          <p>While a season&apos;s early bird is running, families see it before they register. Its row on your club&apos;s pages carries one line, such as <strong>Save $20 · early bird through Oct 31</strong>, which counts down (<strong>ends in 6 days</strong>, <strong>ends tomorrow</strong>, <strong>ends today</strong>) in its last week. On the season&apos;s own page, the price at the top leads with what a child pays today, and each division with an early amount shows <strong>$145 · Save $20</strong> with the date and the regular price under it. It says <strong>Save up to</strong> when the saving differs by division or a division has no early amount. The day after the early-bird date, all of it goes back to the regular prices.</p>
        </>
      ),
    },
    {
      id: 'closing',
      group: 'Running the season',
      heading: 'Closing out a season',
      summary: 'Complete the season when games end, then Archive it if you wish; a finished season reads in place, locked, and can be reopened.',
      keywords: ['close season', 'complete season', 'completed', 'archive season', 'archived', 'finished', 'reopen season', 'season end', 'locked', 'past seasons'],
      searchText: 'closing season complete the season archive the season reopen the season finished completed archived retire preserve data house league locked read only past seasons shelf money stays open fees received mark received undo correct the price email families stays open no seal step ended pill complete it',
      content: (
        <>
          <p>When the games are done, click <strong>Complete the season</strong> at the end of the season&apos;s page. The window says what changes, and warns, but never blocks, if registrations are waiting, families are on the waitlist, players still owe fees, or the season&apos;s last day is still ahead. A season past its last day shows an amber <strong>Ended</strong> pill until you do. Completing moves it to <strong>Past seasons</strong> and does not email anyone.</p>
          <ul>
            <li><strong>Locked</strong> — registrations, teams, the schedule and the season&apos;s settings can no longer be changed, and every edit control is gone. The pages still read, and a line at the top says the page is locked.</li>
            <li><strong>Still open</strong> — fees on Registrations (<strong>Mark received</strong>, <strong>Undo</strong> and <strong>Correct the price</strong>), the season&apos;s <strong>Money</strong> page, and <strong>Email families</strong>.</li>
            <li><strong>Archive the season</strong> — an extra step for a completed season. Its public page says it has been archived. It stays under Past seasons, and its schedule and standings stay up. Nothing else changes.</li>
            <li><strong>Reopen the season</strong> — at the end of a finished season&apos;s page, it brings the season back to <strong>Running now</strong> so you can change things again.</li>
          </ul>
          <p>There is no seal step for house league seasons (sealing is a tournament-specific concept).</p>
        </>
      ),
    },
  ],
};

export default houseLeagueHelp;
