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
      keywords: ['permissions', 'who can', 'club admin', 'league admin', 'league registrar', 'treasurer', 'read only', 'roles', 'access', 'move a child between divisions', 'who can take fees', 'who can end a registration', 'who can refund', 'refund to card', 'pay link'],
      searchText: 'who can do what house league permissions owner admin club admin league admin league registrar registrar treasurer read only edit seasons divisions teams schedule approve decline withdraw release the spot add registration by hand fees received mark received undo correct the price refund move to another division email families money page read cannot see button absent not greyed registrar cannot move a child between divisions who can refund a card payment owner club admin league admin registrar email the pay link',
      content: (
        <>
          <ul>
            <li><strong>Owner, club admin and league admin</strong> — everything: create and edit seasons and divisions, build teams, run the schedule, move a season between states, work registrations and fees, move a child to another division, and email families.</li>
            <li><strong>League registrar</strong> — works the registrations (approve, waitlist, decline, withdraw, release a spot, add one by hand), takes fees (<strong>Mark received</strong>, <strong>Undo</strong>, <strong>Correct the price</strong>), refunds a card payment, emails a family their pay link, and uses Email families. <strong>Move to another division</strong> is not theirs: only the owner, a club admin and a league admin see it. Reads the rest of the season, with no edit controls and no status buttons.</li>
            <li><strong>Treasurer</strong> — reads a season&apos;s <strong>Money</strong> page, through the club&apos;s Accounting, and sees where the club&apos;s payouts stand. Nothing else in house league: refunds are the desk&apos;s.</li>
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
          <p>The button isn&apos;t there until the required lines are done, so a season can&apos;t open half-built. <strong>How to pay</strong> appears on the checklist only when some price is above $0, and a free season skips it. Write it even if your club takes card payments: families see it when card payment isn&apos;t on, and beside <strong>Pay now</strong> when it is. A line that isn&apos;t done has a door to the place that fixes it, and the line under the checklist says what is still missing. Changing divisions or spots after families start registering can make the review queue harder to manage.</p>
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
      summary: 'Make the teams, rate the players, run a balanced draft, adjust by hand, then publish one division at a time. Each family gets one email and each coach an invite.',
      keywords: ['build teams', 'create teams', 'teams and draft', 'draft', 'run the draft', 'draft again', 'assign players', 'rating', 'rate players', 'rated', 'not rated', 'lock', 'lock a player', 'locked', 'moved by you', 'put back', 'move to', 'not on a team', 'take all players off teams', 'publish teams', 'publish a division', 'placement email', 'coach invite', 'move after publishing', 'send the emails again', 'team colour', 'team coaches', 'search players', 'filter', 'sort', 'family', 'siblings', 'brothers and sisters', 'keep families together', 'player notes', 'allergy', 'owing', 'hide steps', 'show steps'],
      searchText: 'build teams create teams bulk count names team colour coach email edit team window teams and draft step rate players rating 1 to 5 only owner club admin league admin see ratings registrar never sees ratings erased when a registration ends or the season finishes not rated counts as a 3 lock to this team locked unlock coach child run the draft balanced strongest first order reverses each round locked players stay and count toward the average sizes kept even ties drawn at random draft again replaces the current teams to review waitlisted not drafted not on a team drag a player move to phone sheet more menu moved by you put back on tools take all players off teams before publishing publish teams one division at a time one email per family names every child in that division sent even to families who unsubscribed from club news service message status page shows team and coach coach invited to team page no unpublish send the emails again some emails could not be sent move after publishing asks first emails the family accepted later appears under not on a team placing emails the family ending a registration takes the child off the team search players or parents filter show only has player notes owing has a sibling in this division sort last name rating strongest first age youngest first family family mark brothers and sisters one parent email lights up go to a name note from the family sign-up note allergy medical owing amount record a payment on registrations everyone is on a team pool folds hide steps show steps next step steps drawer keep families together families first evens out the averages 120 players large division',
      content: (
        <>
          <p>A division&apos;s teams are made in five moves on <strong>Teams &amp; draft</strong>: make the teams, rate the players, run the draft, adjust by hand, then publish. Nothing reaches a family until you publish.</p>
          <p>The board is built for a full division: the players not yet on a team stay in view while you work through the teams, and you can search, filter and sort them.</p>
        </>
      ),
      subtopics: [
        {
          id: 'build-teams-make',
          title: 'Make the teams and add coaches',
          content: (
            <>
              <HelpSteps>
                <li>Open the season, go to <strong>Teams &amp; draft</strong>, and pick a division.</li>
                <li>Click <strong>Create teams</strong>, choose how many, and click <strong>Create</strong> (on the free League plan you can make up to eight).</li>
                <li>Click the pencil on a team&apos;s card to change it. The tick saves your changes and shows the team as it now reads.</li>
                <li>Set the team&apos;s <strong>Name</strong> and <strong>Colour</strong>, and add each <strong>Coach</strong> with a first name, a last name and an email address. <strong>+ Add another coach</strong> adds a second.</li>
              </HelpSteps>
              <p>You can name the teams now and add coaches any time before you publish. A team with no coach shows an amber <strong>No coach yet</strong>; click it to open the team window at the coach fields. A coach is invited to their team page when you publish (see <em>How coaches get their team page</em>).</p>
            </>
          ),
        },
        {
          id: 'build-teams-board',
          title: 'Find players on the board',
          content: (
            <>
              <p>On a desk, <strong>Not on a team</strong> is its own column on the left. Once you scroll past the steps it stays in view, its list scrolls inside it, and every team beside it is a place to drop a player. On a phone, open <strong>Not on a team</strong> from the list of groups.</p>
              <HelpDefs>
                <HelpDef term="A player's line">Rating, name, marks, age and the <strong>&hellip;</strong> menu. <strong>Locked</strong>, <strong>Moved by you</strong> and <strong>Asked to withdraw</strong> sit on a second line under the name.</HelpDef>
                <HelpDef term="Search">Finds a player, or a family by a parent&apos;s name (<em>Search players or parents</em>).</HelpDef>
                <HelpDef term="Filter">Show only <strong>Not rated</strong>, <strong>Has player notes</strong>, <strong>Owing</strong> or <strong>Has a sibling in this division</strong>, each with its count.</HelpDef>
                <HelpDef term="Sort">Last name, Rating (strongest first), Age (youngest first) or Family (brothers and sisters together).</HelpDef>
                <HelpDef term="Family mark">Shows how many brothers and sisters are in this division. A family is one parent email, not a last name. Click it to see where each child is; they light up on the board, and clicking a name goes to it.</HelpDef>
                <HelpDef term="Note mark">Opens what the family wrote at sign-up, such as an allergy. Anyone who can open Registrations sees it, the registrar too.</HelpDef>
                <HelpDef term="Amber $">The amount still owing. Payments are recorded on Registrations.</HelpDef>
              </HelpDefs>
              <p>Each team&apos;s card says how many players it has, and, for people who see ratings, its average (<em>12 players · avg 3.1</em>). <strong>Hide steps</strong> folds the steps into one line that keeps the progress and the next step, with <strong>Rate players</strong> or <strong>Create teams</strong> when that is next. It stays closed for that division in that browser until you click <strong>Show steps</strong>.</p>
            </>
          ),
        },
        {
          id: 'build-teams-rate',
          title: 'Rate players 1 to 5',
          content: (
            <>
              <p>Click <strong>Rate players</strong> (on a phone, <strong>Rate</strong>) to rate every accepted player in the division. <strong>1</strong> is newest to the sport and <strong>5</strong> is among the strongest in the age group. On a keyboard, type 1 to 5 to rate a player and move to the next; tap a chosen number again to clear it. To rate several at once, tick them and pick one number.</p>
              <ul>
                <li><strong>Only the owner, club admins and league admins see ratings.</strong> The league registrar never does, and neither do coaches or families. The registrar&apos;s board has no Rating column, Rating sort, average, lock or Moved by you, and their export has no rating column.</li>
                <li><strong>A player who is not rated counts as a 3</strong> in the draft. The chip shows a dashed dash, and the Ratings step says how many are not rated.</li>
                <li><strong>Ratings are erased</strong> when a player&apos;s registration ends and when the season finishes.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'build-teams-draft',
          title: 'Lock a coach’s child, then run the draft',
          content: (
            <>
              <p>If a coach&apos;s own child should be on their team, lock the child first. On a player on a team, open the <strong>&hellip;</strong> menu and choose <strong>Lock to this team</strong>; <strong>Unlock</strong> takes it back. A locked player stays on that team when you run the draft and still counts toward its average. Locks end when you publish.</p>
              <HelpSteps>
                <li>Click <strong>Run the draft</strong> (on a phone, <strong>Run</strong>). The window lists the players, the teams and their sizes, how many are locked, and how many are rated.</li>
                <li>Leave <strong>Keep families together</strong> on, or turn it off (it shows when the division has brothers and sisters).</li>
                <li>Click <strong>Run the draft</strong> in the window. Nothing is sent.</li>
              </HelpSteps>
              <HelpDefs>
                <HelpDef term="How it deals">Strongest first, and the order reverses each round, so the teams come out balanced. Ties and the first pick are drawn at random. Team sizes are kept even.</HelpDef>
                <HelpDef term="Keep families together">Brothers and sisters signed up under one parent email go to the same team. Families are dealt first, then everyone else; then single players swap teams where that evens out the averages. A locked child&apos;s brothers and sisters follow onto that team. Off, each child is dealt on their own. Your choice holds for the visit, so Draft again uses it too.</HelpDef>
                <HelpDef term="Who is drafted">Every accepted player holds their spot. A player still to review, or on the waitlist, is not drafted; the window names them and links to Registrations.</HelpDef>
                <HelpDef term="Nobody rated">The draft still runs and deals the players at random, evenly.</HelpDef>
                <HelpDef term="Draft again">Deals every player again and replaces the current teams, including any move you made by hand. Locked players stay where they are. It is offered until you publish.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'build-teams-adjust',
          title: 'Adjust by hand before you publish',
          content: (
            <>
              <p>On a desk, drag a player onto another team, or back to <strong>Not on a team</strong>. On a phone, or from a desk, open the <strong>&hellip;</strong> on a player and choose <strong>Move to&hellip;</strong>; the sheet shows each team&apos;s size and what its average would become. A move before you publish is immediate and tells nobody.</p>
              <ul>
                <li><strong>Moved by you</strong> marks a player placed by hand after a draft. Click it to <strong>Put back</strong> on the team the draft chose. It is offered until you publish.</li>
                <li>Each team card&apos;s head shows its size and average; the line above the board counts how many were <strong>Moved by hand</strong>. Moving a child by hand never moves a brother or sister with them.</li>
                <li>When everyone is on a team, <strong>Not on a team</strong> folds to one line, <em>Everyone is on a team</em>, that stays at the top as you scroll. Drop a player on it to take them off a team.</li>
                <li><strong>Take all players off teams</strong> is in <strong>Tools</strong> (the &hellip; button), before you publish. It asks first, and it clears locks and moves by hand too. Nothing is sent.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'build-teams-publish',
          title: 'Publish a division’s teams',
          content: (
            <>
              <p>Click <strong>Publish teams</strong> to tell families. You publish one division at a time. The window warns, but does not block, if accepted players are not on a team, a team has no coach, or a player is still to review.</p>
              <ul>
                <li><strong>Each family gets one email</strong> naming every child of theirs in that division, with each team and coach. You can preview it first. It is sent even to a family who unsubscribed from club news, because it is about their own child.</li>
                <li><strong>Each child&apos;s team shows</strong> on the family&apos;s status page.</li>
                <li><strong>Each coach is invited</strong> to their team page.</li>
                <li><strong>There is no unpublish.</strong> Families already have the email.</li>
              </ul>
              <p>If some emails could not be sent, the division says so, for example <em>2 of 3 emails couldn&apos;t be sent</em>. The teams are published and the status pages show them; click <strong>Send the 2 again</strong> to retry just those. An email that bounced names the family and links to the child&apos;s registration.</p>
            </>
          ),
        },
        {
          id: 'build-teams-after',
          title: 'After you publish: moves and late arrivals',
          content: (
            <>
              <ul>
                <li><strong>A move now asks first.</strong> Moving a player to another team opens a window saying the family will be emailed the new team and coach. Choose <strong>Move and email</strong>. Taking a player off a team emails nobody; they go back to <strong>Not on a team</strong> until you place them.</li>
                <li><strong>A child accepted later</strong> appears under <strong>Not on a team</strong>, with an amber count. Place them, and the family is emailed their team and coach (<strong>Place and email</strong>).</li>
                <li><strong>Ending a registration</strong> on Registrations takes the child off their team. The team card keeps one quiet line saying who left and when.</li>
                <li><strong>Locks, Draft again and Moved by you</strong> are gone once a division is published.</li>
              </ul>
              <HelpNote variant="info" title="Once a season is finished, teams are locked">Teams, drafts and moves can no longer be changed.</HelpNote>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-player-missing-from-house-league-team-pool',
          question: 'Why is a player missing from the team builder?',
          answerText: 'Only accepted players are on the board and in the draft. A player still to review, on the waitlist, declined or withdrawn is not drafted. The line under the steps says how many are still to review or on the waitlist, with a link to Registrations. A player who gets a spot after you publish appears under Not on a team.',
          keywords: ['missing player', 'team builder', 'accepted', 'to review', 'waitlist', 'not on a team', 'not drafted'],
          popular: true,
          answer: (
            <p>Only <strong>accepted</strong> players are on the board and in the draft. A player still to review, on the waitlist, declined or withdrawn is not drafted. The line under the steps says how many are waiting and links to <strong>Registrations</strong>. A player who gets a spot after you publish appears under <strong>Not on a team</strong>.</p>
          ),
        },
        {
          id: 'faq-house-league-team-ratings-who-sees',
          question: 'Who can see player ratings?',
          answerText: 'Only the owner, club admins and league admins. The league registrar, coaches and families never see ratings. Ratings are erased when a player’s registration ends or the season finishes, and a player who is not rated counts as a 3 in the draft.',
          keywords: ['ratings', 'who sees ratings', 'rating privacy', 'registrar ratings', 'not rated'],
          answer: (
            <p>Only the owner, club admins and league admins. The league registrar, coaches and families never see them. Ratings are erased when a player&apos;s registration ends or the season finishes, and a player who is not rated counts as a 3 in the draft.</p>
          ),
        },
        {
          id: 'faq-house-league-draft-siblings-together',
          question: 'Why did the draft put brothers and sisters on the same team?',
          answerText: 'Keep families together is on by default in the Run the draft window. Brothers and sisters signed up under one parent email go to the same team; a family is one parent email, not a last name. Turn the switch off to deal each child on their own, then Draft again. Moving a child by hand never moves a sibling.',
          keywords: ['siblings', 'brothers and sisters', 'same team', 'keep families together', 'family', 'draft'],
          answer: (
            <p><strong>Keep families together</strong> is on by default in the <strong>Run the draft</strong> window. Brothers and sisters signed up under one parent email go to the same team; a family is one parent email, not a last name. Turn the switch off to deal each child on their own, then <strong>Draft again</strong>. Moving a child by hand never moves a sibling.</p>
          ),
        },
        {
          id: 'faq-house-league-board-notes-who-sees',
          question: 'Who sees the notes families wrote at sign-up on the board?',
          answerText: 'Anyone who can open Registrations: the owner, club admins, league admins and the league registrar. The note mark on a player opens the note, for example an allergy. Coaches and families never see it on this board.',
          keywords: ['notes', 'player notes', 'allergy', 'note mark', 'who sees notes', 'medical'],
          answer: (
            <p>Anyone who can open <strong>Registrations</strong>: the owner, club admins, league admins and the league registrar. The note mark on a player opens the note, for example an allergy. Coaches and families never see it on this board.</p>
          ),
        },
      ],
    },
    {
      id: 'coach-team-page',
      group: 'How-to recipes',
      heading: 'How coaches get their team page',
      summary: 'A coach is added in a team’s window with their email, invited when you publish, and sees one page: their players and each family’s contact details.',
      keywords: ['coach', 'house league coach', 'coach invite', 'invite coach', 'team page', 'coach team page', 'send again', 'invite expired', 'invite didn’t send', 'remove a coach', 'coach email', 'fix a coach', 'edit a coach', 'change coach email', 'change coach name', 'coach typo', 'copy emails', 'coach sign in', 'coach access', 'my team', 'my teams', 'find my team', 'back to my team', 'where is my team page'],
      searchText: 'how coaches get their team page house league coach added in a team window with an email invited when you publish or at once after you confirm if added later invite link works 7 days signs in only with that email one page their players each family name email and phone copy emails link to the season schedule the club enters scores never ratings fees or other teams never the coaches portal invited when you publish invited signed in invite expired invite didn’t send fix the email send again removing a coach takes the page away at once families are not told coach who is a registrar or admin keeps their club role page stays 30 days after the season finishes back to the team page my team at the top right of the club site my teams lists each team on a phone the first row of the account menu',
      content: (
        <>
          <p>A house league coach never needs the Coaches Portal. They get one page for their team, by an emailed link, and it shows only what they need to reach their families.</p>
        </>
      ),
      subtopics: [
        {
          id: 'coach-page-invite',
          title: 'Add a coach and send the invite',
          content: (
            <>
              <HelpSteps>
                <li>On <strong>Teams &amp; draft</strong>, click the pencil on the team&apos;s card.</li>
                <li>Under <strong>Coach</strong>, type their <strong>First name</strong>, <strong>Last name</strong> and the <strong>Coach&apos;s email</strong>. The invite&apos;s sign-up page opens with the names filled in, and they can change them. <strong>+ Add another coach</strong> adds a second. A team can have more than one. To fix a typo later, click the pencil on the team&apos;s card and change their names or email. A name fix saves at once. After you publish, a new email asks first, then sends a fresh invite, and the old link stops working.</li>
                <li>Click the tick. Before you publish, the coach reads <strong>Invited when you publish</strong>.</li>
                <li>Publish the division. Each coach is emailed a link, <strong>Accept and open your team</strong>.</li>
              </HelpSteps>
              <ul>
                <li><strong>A coach added after you publish</strong> is held until you confirm: <strong>Send invite</strong> sends the email at once.</li>
                <li><strong>The link works for 7 days</strong> and signs in only with the email address you gave. A coach without a FieldLogicHQ account sets one up first.</li>
                <li><strong>A coach of a team who is also a registrar or admin</strong> keeps their club role. Coaching does not change it.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'coach-page-sees',
          title: 'What a coach sees',
          content: (
            <>
              <ul>
                <li>The team&apos;s name, division and coaches.</li>
                <li><strong>Players</strong>, each with the family&apos;s name, email and phone (a missing phone is left out), and <strong>Copy emails</strong> to copy every family&apos;s address at once.</li>
                <li>A link to <strong>the season&apos;s schedule</strong>. Games aren&apos;t listed on the page itself. A line says the club enters scores.</li>
                <li>A coach of two teams switches between them.</li>
              </ul>
              <p>To get back to it, a coach signs in on the club&apos;s site and clicks <strong>My team</strong> at the top right. A coach of two or more teams clicks <strong>My teams</strong> and picks one. On a phone, tap the person icon: the team is the first row of the menu.</p>
              <p>They never see ratings, fees or other teams, and never the Coaches Portal. The sign-up form tells families that their child&apos;s coach sees their name, email and phone.</p>
              <p>The page stays for 30 days after the season finishes, then it is gone.</p>
            </>
          ),
        },
        {
          id: 'coach-page-states',
          title: 'A coach’s state, and removing a coach',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Invited when you publish">Added, and the division isn&apos;t published yet.</HelpDef>
                <HelpDef term="Invited Oct 25">The email went out on that date.</HelpDef>
                <HelpDef term="Signed in">The coach has opened their page.</HelpDef>
                <HelpDef term="Invite expired · Send again">The 7 days passed. Click <strong>Send again</strong> for a fresh link.</HelpDef>
                <HelpDef term="Invite didn’t send · Send again">The email didn&apos;t arrive. Click the pencil and correct the email if the address is wrong, or click <strong>Send again</strong>.</HelpDef>
              </HelpDefs>
              <p>A coach who has signed in keeps their email. You can still fix their name, but to use another address, remove them and add them again.</p>
              <p>To remove a coach, click the &times; on their row in the team window. After you publish it asks first. They lose the team page at once, and families aren&apos;t told. They see a line saying they are no longer a coach of the team.</p>
            </>
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
      keywords: ['sign up several children', 'sign up more than one child', 'siblings', 'reference', 'accepted', 'received', 'waitlist', 'status page', 'check your registration', 'date of birth', 'no division fits', 'family email', 'how to pay', 'early bird', 'ask to withdraw', 'ask to withdraw a child', 'family wants to withdraw', 'refund on the status page', 'kept by the club', 'withdrawn', 'declined', 'team', 'coach', 'not set yet', 'to be announced', 'moved from', 'coach sees my phone', 'price to pay', 'pay by card', 'pay now', 'pay link', 'processing fee', 'pay online', 'card payment', 'receipt', 'one checkout', 'waitlist nothing to pay', 'pay by bank debit', 'bank debit', 'bank debit clearing', 'clearing', 'bank debit returned', 'returned by the bank', 'takes up to 5 business days'],
      searchText: 'family sign up form sign up several children in one go siblings add another child up to eight children date of birth picks the division born in birth year club cut-off each child outcome before sign up spot and price early bird applied early bird ended waitlist nothing to pay unless a spot opens two divisions for one age group family picks note for families no division fits contact the club child left out others still sign up one reference for the sign-up one email lists every child total to pay how to pay accepted received waitlist 1st status page team row coach row not set yet to be announced moved from the coach sees your name email and phone check your registration email and reference find everything pay by card pay now pay link one checkout processing fee waitlist nothing to pay parent or guardian email waiver email consent unticked payable separately the form does not take payment approve means accepted pending review means received status page declined withdrawn spot released reads withdrawn refunded on kept by the club reason the club is keeping to pay part of the price still to pay price rose ask to withdraw a child request sent the child keeps their place until the club acts you asked to withdraw the club will confirm by email note for the club 300 characters asked once too many tries needs attention house league withdrawal request clears itself when the registration ends pay by bank debit pay by card two buttons bank debit clearing fee clearing started up to 5 business days we will email you when it clears your spot is held the bank debit did not go through nothing was taken a bank payment was returned returned by the bank receipt no longer counts refund to the bank account about 3 business days',
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
                <li>Under the parent or guardian fields, a short note tells families that their child&apos;s coach will see their name, email and phone to reach them about the team.</li>
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
              <p>One sign-up gets one <strong>reference</strong>, shown on the confirmation and in the one email the family receives. The email lists every child with their division, outcome and price, the total to pay, and, once a child is accepted, your <strong>How families pay</strong> words. The sign-up form itself takes no payment. Families pay after a child is accepted, by card when your club takes card payments (see <em>Paying by card</em>) and the way you describe otherwise.</p>
              <ul>
                <li><strong>Accepted</strong> — the child has a spot. This is what you set by clicking Approve, or what an automatic season does while a division has room.</li>
                <li><strong>Received</strong> — the child is waiting for your review. Nothing is due yet. This is Pending review on your side.</li>
                <li><strong>Waitlist</strong>, with their place, such as <em>Waitlist &middot; 1st</em>.</li>
              </ul>
              <p>On the season&apos;s <strong>Check your registration</strong> page, a family enters their parent or guardian email and their reference to find every child in the sign-up, with each child&apos;s status, division, fee and how to pay. Both the email and the reference are needed. A family who opens the status page from their pay link needs neither (see <em>Paying by card</em>).</p>
            </>
          ),
        },
        {
          id: 'family-signup-pay-card',
          title: 'Paying by card',
          content: (
            <>
              <p>Once the club takes card payments, a child who has been accepted shows <strong>Pay now</strong> on the sign-up confirmation, on the status page, and in the sign-up, approval and waitlist-promotion emails. It applies only after the club owner has set up payouts (see <em>Settings and your web address</em>); until then families see your <strong>How to pay</strong> words and no button.</p>
              <ul>
                <li><strong>One checkout for the family.</strong> Brothers and sisters signed up together pay in a single checkout, for every child still owing.</li>
                <li><strong>The processing fee is shown before they pay</strong> when families pay it. That is the club-wide choice on the Payouts card, <strong>Families and teams pay it</strong> or <strong>The club pays it</strong>.</li>
                <li><strong>A child on the waitlist, or waiting for your review, has nothing to pay.</strong> The page says so; the child gets a button once accepted.</li>
                <li><strong>The pay link</strong> is the family&apos;s own link to their status page, already unlocked. It never expires and covers one sign-up. <strong>Ask to withdraw a child</strong> works from it too.</li>
                <li><strong>A receipt</strong> shows on the status page once the payment is recorded.</li>
              </ul>
              <p>Where your Stripe account is approved for it, the pay block has a second button, <strong>Pay $X by bank debit</strong>. See <em>Paying by bank debit</em>.</p>
              <HelpNote variant="info" title="Money paid by hand still works">A family who pays by cheque, cash or e-transfer is marked received as before; <strong>Pay now</strong> is an extra door, not a replacement.</HelpNote>
            </>
          ),
        },
        {
          id: 'family-signup-pay-bank',
          title: 'Paying by bank debit',
          content: (
            <>
              <p>A family can pay by bank debit as well as by card, once your Stripe account is approved for it. Until then families see the card button alone and nothing here appears.</p>
              <HelpDefs>
                <HelpDef term="Two buttons">The pay block shows <strong>Pay $X by card</strong> and <strong>Pay $X by bank debit</strong>, the second outlined with a bank icon. Each button is one row, with its note under it: <em>Includes a $X processing fee.</em> when families pay the fee, and on the bank button <em>Takes up to 5 business days.</em> When the club pays the fee, both buttons show the registration fee and only the bank button carries a note.</HelpDef>
                <HelpDef term="Why it takes days">A bank debit is not instant. The bank takes up to 5 business days to settle it, so the fee is not received until it clears.</HelpDef>
                <HelpDef term="While it clears">The block reads <strong>Bank debit clearing</strong>: the amount, the account it comes from and the day it started, <em>Banks take up to 5 business days. We&rsquo;ll email you when it clears.</em> The child&rsquo;s spot is held, and the block gives the club&rsquo;s contact for a wrong account or a question. There is no pay button, so nothing is paid twice. An email goes out when the debit starts, and says it isn&rsquo;t the receipt. The status page&rsquo;s child line reads <em>Fee $150.00 &middot; clearing</em>.</HelpDef>
                <HelpDef term="When it clears">The family is emailed the receipt, and the status page reads <strong>Paid, thank you</strong> with <em>Bank debit, account ending 1234 &middot; started Oct 26, cleared Oct 29 &middot; receipt 1043</em>. The receipt number is given then, not at the start.</HelpDef>
                <HelpDef term="Brothers and sisters">Children signed up together pay in one checkout, so one debit covers them all. They clear, or come back, together.</HelpDef>
              </HelpDefs>
              <p><strong>If the bank sends it back</strong> while it is clearing, the block reads <em>The bank debit didn&rsquo;t go through</em>: your bank returned it on the day, with its reason when we can name one, and nothing was taken. The spot is still held and both buttons are back. The family is also emailed, with a <strong>Pay now</strong> button. <strong>If the bank reverses it after it cleared</strong>, the block reads <em>A bank payment was returned</em> and says the old receipt no longer counts, so the fee is owing again, the buttons come back, and the old receipt page reads <strong>Returned by the bank</strong>.</p>
            </>
          ),
        },
        {
          id: 'family-signup-status-team',
          title: 'Their child’s team and coach',
          content: (
            <>
              <p>For an accepted child, the status page has a <strong>Team</strong> row and, once the division&apos;s teams are published, a <strong>Coach</strong> row.</p>
              <ul>
                <li><strong>Before you publish</strong> — Team reads <strong>Not set yet</strong>, with a line saying the club will email when the teams are set.</li>
                <li><strong>After you publish</strong> — Team shows the team and Coach shows the coach, or <strong>To be announced</strong> when the team has none.</li>
                <li><strong>After a move</strong> — a line under the rows reads <em>Moved from Jays on Nov 2</em>.</li>
              </ul>
              <p>A child to review, on the waitlist, declined or withdrawn has no Team or Coach row. The family is also emailed when the teams are published (see <em>How to build teams and run a draft</em>).</p>
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
                <li><strong>A refund</strong> — an ended child whose fee went back reads <em>$150 refunded on Oct 24 (E-Transfer)</em>. A refund to the card reads the same and arrives in 5 to 10 business days; a refund to a bank account arrives in about 3 business days. The brackets are left off when the way was <strong>Other</strong> or not recorded.</li>
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
      keywords: ['registrations', 'to review', 'active', 'waitlist', 'ended', 'approve', 'promote', 'decline', 'withdraw', 'release the spot', 'mark received', 'undo', 'correct the price', 'move to another division', 'move division', 'fee column', 'owing', 'refunded', 'kept by the club', 'bulk', 'select several', 'email families', 'add registration', 'registrar', 'division full', 'add to the waitlist instead', 'needs attention', 'sign-up', 'reference', 'finished season', 'pay by card', 'card payment', 'online, card', 'receipt', 'pay link', 'email the pay link', 'pay link sent', 'refund to the card', 'refund part of it', 'partial refund', 'processing fee', 'refunded another way', 'payment couldn’t be recorded', 'refund didn’t reach the card', 'who can refund', 'record the refund sent another way', 'sent another way', 'made in Stripe', 'whose was it', 'still enrolled', 'to the card', 'to the bank account', 'bank debit', 'pay by bank debit', 'clearing', 'bank debit clearing', 'bank debit returned', 'returned by the bank', 'send it back to the bank account', 'keep it', 'view the payment', 'refund email', 'refund visible'],
      searchText: 'registrations screen card payment online card receipt pay link sent email the pay link owing row bulk bar one email per family undo not offered on a card payment comes off only by a refund refund to the card refund part of it kept by the club processing fee box declined family asked to leave payment processing refunded another way lower price refunds the difference higher price emails a pay link 5 to 10 business days a card payment couldn’t be recorded refund didn’t reach the card needs attention registrar refunds tabs to review active waitlist ended declined withdrawn spot released amber count search players or parents filter fee owing received refunded tools export email families add registration by hand walk-in division full add to the waitlist instead approve refused hand-add refused moving a child into a full division nobody jumps the waitlist a child waiting for review holds a spot one needs attention notice per sign-up several children one reference accepted received no email address guardian fee column owing n days accepted today accepted amber after the club’s number of days 14 received date how e-transfer cash cheque card other not recorded received in part price rose refunded kept by the club price corrected nothing owed yet free mark received amount shown not typed no partial amount date received how undo marked received by mistake not a refund voided line closed fiscal year correct the price reason a lower price records a refund of the difference a higher price leaves the difference owing family not emailed move to another division move division full division joins the waitlist keep price use the new price a child who has paid keeps their price owner club admin league admin only the registrar cannot move a child decline withdraw release the spot one window what happened to the money refunded date how kept by the club reason the family reads note to the family withdraw emails only when money was refunded or kept the waitlist moves up in the same step decline and withdraw one at a time bulk bar approve promote waitlist mark received move division email clear partial result stays until dismissed rows that stayed are still selected finished season locked mark received undo correct the price stay open record the refund sent another way sent another way to the card to the bank account pending made in stripe refund recorded by itself whose was it choose the child split it between them still enrolled withdraw email the pay link keep enrolled a refund in stripe matches no payment we recorded paid after the registration ended view the payment fee section history refund email bank debit pay by bank debit clearing fee clearing chip bank debit returned returned by the bank bank debit reversed mark received not offered while a debit clears email the pay link not offered while a debit clears the bars email the pay link skips a bank debit is clearing decline or withdraw while a debit clears send it back to the bank account keep it say why the club keeps it payouts disconnected only keep it the debit is carried out when it clears paid after it cleared receipt number about 3 business days up to 5 business days',
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
                <HelpDef term="Online, card · receipt 1043">The family paid by card from their status page. The payment is recorded by itself, with its receipt number, and has no <strong>Undo</strong>.</HelpDef>
                <HelpDef term="Online, bank debit · receipt 1043">The family paid by bank debit and it has cleared. The same rules as a card payment: recorded by itself, no <strong>Undo</strong>.</HelpDef>
                <HelpDef term="$150.00 clearing">A bank debit is on its way. The first line keeps the fee in an info chip; the second reads <em>Bank debit &middot; $154.75 &middot; started Oct 26</em>, or <em>Part of one $309.50 bank debit with Lily Grant &middot; started Oct 26</em> for brothers and sisters. Tap it for the detail. It is not received yet, so it is not in the season&rsquo;s book. See <em>Bank debit on Registrations</em>.</HelpDef>
                <HelpDef term="Bank debit returned Oct 29 · account closed">Under the owing line, after a debit came back while it was clearing. The reason is there only when the bank gave one we can name.</HelpDef>
                <HelpDef term="Returned by the bank Nov 2 · receipt 1043">Under the owing line, after a debit that had cleared was reversed by the bank. The fee is owing again.</HelpDef>
                <HelpDef term="Pay link sent Oct 20">Under an owing row: you have emailed the family their pay link, and the day.</HelpDef>
                <HelpDef term="$120 received · $30 owing">The price rose after the family paid. The row shows what came in and what is still owing, with no day count.</HelpDef>
                <HelpDef term="$150 refunded">The fee went back to the family when the registration ended. The line under it says where: <em>Oct 12 &middot; Cheque</em> for money sent by hand, or <em>Oct 26 &middot; $156.75 to the card</em> for a card refund, with <em>pending</em> while Stripe works on it and <em>made in Stripe</em> when it was made in the club&rsquo;s Stripe dashboard. A refund to a bank account reads <em>to the bank account</em>. The first line is always the fee; the card total is on the second.</HelpDef>
                <HelpDef term="Refund didn&rsquo;t reach the card">An amber pill in place of the fee: the card&rsquo;s bank sent the refund back. Under it, the amount and the day it came back. Press it to open <strong>Record the refund sent another way</strong>. Once you have, the second line reads <em>sent another way</em>.</HelpDef>
                <HelpDef term="$150 kept by the club">The club kept the fee when the registration ended. The row shows the reason you gave, shortened; the whole of it is in the child&apos;s record.</HelpDef>
                <HelpDef term="$100.00 kept by the club · $50.00 refunded">A part refund with the rest kept. The reason leaves the cell and lives in the child&rsquo;s record.</HelpDef>
                <HelpDef term="Price corrected">A third line under the fee, with the reason. Hover or tap it to read what it was and what it is now. When the difference went back to the card it reads <em>Price corrected &middot; $15.00 back to the card</em>.</HelpDef>
                <HelpDef term="Paid after the registration ended">A third line when a card payment couldn&rsquo;t go on the registration (it had ended, was already received, was more than owed or hadn&rsquo;t been accepted) and was refunded to the card. Tap it for the day and the reason. Other cases read <em>Card payment not on this registration</em>.</HelpDef>
              </HelpDefs>
              <p>A free division reads <strong>Free</strong>. On a phone the same fee words sit in the row&apos;s detail line.</p>
            </>
          ),
        },
        {
          id: 'registrations-card',
          title: 'Card payments and the pay link',
          content: (
            <>
              <p>When the club takes card payments, a family can pay from the confirmation or status page, so you often have nothing to record. A card payment appears in the <strong>Fee</strong> cell as <strong>Online, card &middot; receipt 1043</strong> and counts toward what the child has paid. <strong>Mark received</strong> works exactly as before for money that arrives another way.</p>
              <HelpSteps>
                <li>On an owing row, open the <strong>&hellip;</strong> menu and choose <strong>Email the pay link</strong>. The family gets an email with their link; the row then reads <strong>Pay link sent</strong> and the day.</li>
                <li>To send several, tick the owing rows and press <strong>Email the pay link</strong> in the bar. Each family gets one email, however many of their children are ticked.</li>
              </HelpSteps>
              <ul>
                <li><strong>Undo isn&apos;t offered on a card payment.</strong> The money is already in your bank account, so it comes off only by a refund (see <em>Refunding to the card</em>).</li>
                <li><strong>View the payment</strong> is in the row&apos;s <strong>&hellip;</strong> when the latest payment came online (for example <em>Oct 24 &middot; Online, card &middot; receipt 1043</em>). It opens the child&apos;s record at its <strong>Fee</strong> section, where the payment and its refunds read together.</li>
                <li><strong>Needs attention</strong> tells you when a card payment couldn&apos;t be recorded, for example one declined while the family was paying, so refund it to the card; and when a refund didn&apos;t reach the card, so send it another way with <strong>Record the refund sent another way</strong>.</li>
              </ul>
              <p>A family can also pay by bank debit, which takes days to clear. While one is on its way, <strong>Mark received</strong> and <strong>Email the pay link</strong> are not offered for that row, and the bar&apos;s <strong>Email the pay link</strong> skips it, saying <em>a bank debit is clearing</em>. See <em>Bank debit on Registrations</em>.</p>
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
              <p>For a child who paid by card, the window offers different choices; see <em>Refunding to the card</em>. For a child whose bank debit is still clearing, it asks what happens to the money when the debit clears; see <em>Bank debit on Registrations</em>.</p>
              <p><strong>Who is emailed:</strong> Decline and Release the spot always email the family, and carry your note and the money line. Withdraw emails only when money was refunded or kept; a withdrawal with no money moved sends nothing, and the window says so. If the season moves the waitlist up on its own, the next child moves up in the same step and the window names them; otherwise it says the spot stays open for you to fill.</p>
              <p>Decline and Withdraw are one at a time, because each asks what happened to that family&apos;s money. When the family asked to withdraw, the window leads with their request and note.</p>
            </>
          ),
        },
        {
          id: 'registrations-refund-card',
          title: 'Refunding to the card',
          content: (
            <>
              <p>When you decline or withdraw a child who paid by card, the window offers three answers. The refund and the ending are one step: both happen when you press the button, or neither does.</p>
              <HelpDefs>
                <HelpDef term="Refund to the card">All of it goes back to the family&apos;s card. A box lets you include the processing fee: it is on when the club is declining and off when the family asked to leave. When it is ticked the club pays that fee back, and it shows on the Money page as <strong>Payment processing</strong>.</HelpDef>
                <HelpDef term="Refund part of it">Enter an amount and a reason. A part refund never includes the processing fee.</HelpDef>
                <HelpDef term="Kept by the club">Give a reason. The family reads it in their email.</HelpDef>
              </HelpDefs>
              <p><strong>Correct the price</strong> on a child who paid by card works the same way: a lower price refunds the difference to the card, or you can choose <strong>Refunded another way</strong>; a higher price emails the family a pay link for the rest.</p>
              <p>A refund arrives on the family&apos;s card in 5 to 10 business days. A payment made by bank debit goes back to the bank account instead, and arrives in about 3 business days. FieldLogicHQ&apos;s own fee is never refunded. The owner, club admins, league admins and league registrars can refund. The treasurer doesn&apos;t refund, but reads every refund line.</p>
            </>
          ),
        },
        {
          id: 'registrations-refund-seen',
          title: 'Seeing a refund: the Fee cell, the record and the family’s email',
          content: (
            <>
              <p>A refund to the card or the bank account is visible on the registration itself, not only in the book.</p>
              <HelpDefs>
                <HelpDef term="The Fee cell">The second line names where the money went, for example <em>Oct 26 &middot; $156.75 to the card</em>, with <em>pending</em> until Stripe has finished and <em>made in Stripe</em> when the club refunded in its Stripe dashboard. A refund that came back shows the amber pill <em>Refund didn&apos;t reach the card</em>.</HelpDef>
                <HelpDef term="The record">Open the child&apos;s record at its <strong>Fee</strong> section. A <strong>To the card</strong> block (<strong>To the bank account</strong> for a bank debit) shows each refund with a status pill (<em>Refunded</em>, <em>Pending</em>, or <em>Refund didn&apos;t reach the card</em>), the amount, the processing fee and whether it went back, who refunded it and when, the day it reached the card, the Stripe reference with a <strong>Copy</strong> link, the receipt it was paid with, the reason for a part refund, and whether the family was emailed. A refund that came back has the button <strong>Record the refund sent another way</strong>. The History line carries the card amount beside the booked one.</HelpDef>
                <HelpDef term="The family&apos;s email">Every refund email, in the club&apos;s name, has the same block: <em>Refunded</em>, <em>To</em>, <em>On</em>, <em>Refund reference</em> and <em>Your receipt</em>, then whether the processing fee was included, and how long it takes to appear. A part refund carries the club&apos;s reason. A payment for two or more children names each child with their part.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'registrations-stripe-refund',
          title: 'A refund made in Stripe',
          content: (
            <>
              <p>A refund you make in the club&apos;s Stripe dashboard records itself, tagged <em>made in Stripe</em>, so the registration and the season&apos;s book match. Most need nothing from you. Three cases raise a Needs attention item, and each clears itself.</p>
              <HelpDefs>
                <HelpDef term="Whose was it?">A part refund in Stripe on a payment that covered two or more children. Press <strong>Choose the child</strong>, pick the child or <strong>Split it between them</strong> (the amounts must add up to the refund), and give a reason. The refund goes on that registration and the family is emailed. Until then it is not in the season&apos;s book, and the Fee cells say <em>not matched yet</em>.</HelpDef>
                <HelpDef term="Still enrolled">A child&apos;s fee went back in Stripe and the child is still registered. The money is recorded at once; you choose what happens to the registration: <strong>Withdraw Henry</strong>, <strong>Email the pay link</strong> for what is owing again, or <strong>Keep Henry enrolled</strong> (the buttons name the child). The family is emailed once you choose, and gets one email, with the refund block in it.</HelpDef>
                <HelpDef term="A refund in Stripe matches no payment we recorded">Rare, because Stripe&apos;s messages can arrive out of order. The refund goes on the registration as soon as its payment arrives. If it is still here tomorrow, the club&apos;s owner can check the payment in Stripe.</HelpDef>
              </HelpDefs>
              <p>A refund made by hand, as cash or a cheque, reads as it always did.</p>
            </>
          ),
        },
        {
          id: 'registrations-bank-debit',
          title: 'Bank debit on Registrations',
          content: (
            <>
              <p>A bank debit takes up to 5 business days to clear, so the Registrations screen shows the in-between state and keeps you from doing anything that would count the money twice.</p>
              <HelpDefs>
                <HelpDef term="Clearing">The Fee cell shows <em>$150.00 clearing</em> in an info chip, with the debit&apos;s total and start day on the second line. It is not received, and it is not in the season&apos;s book, until it clears. Then the row reads <em>Online, bank debit &middot; receipt 1043</em>.</HelpDef>
                <HelpDef term="What is absent while it clears">Mark received and Email the pay link are not offered for that row, and the bar&apos;s Email the pay link skips it. A stale window that tries anyway is refused in words: a bank debit for the child is clearing, so there is nothing to mark received yet. If the family also paid another way, record it after the debit clears or comes back.</HelpDef>
                <HelpDef term="The Money band">A fourth figure, <strong>Clearing</strong>, appears while a debit is on its way, so the band still adds up. See <em>The season&apos;s Money page</em>.</HelpDef>
              </HelpDefs>
              <p><strong>Decline or Withdraw while it clears.</strong> The ending happens now, and the window asks up front what happens to the money when the debit clears. Nothing is picked until you choose:</p>
              <ul>
                <li><strong>Send it back to the bank account.</strong> It goes back by itself when it clears, in your name. A box lets you include the processing fee: on when the club is declining, off when the family asked to leave. The family is emailed that the money goes back to their account if the debit clears.</li>
                <li><strong>Keep it.</strong> Say why. It goes in the book as kept by the club when it clears, and the family reads the reason.</li>
                <li>If the debit covered brothers and sisters, only the child&apos;s own share is sent back; the rest stays with the others.</li>
                <li>Once payouts are disconnected, only <strong>Keep it</strong> is offered; refund it in Stripe when it clears.</li>
                <li>If the debit comes back instead, nothing happens: nothing was taken. If the send-back fails when it is made, <strong>Refund didn&apos;t reach the bank account</strong> raises a Needs attention item.</li>
              </ul>
              <p><strong>A returned debit.</strong> The bank can send it back while it clears. The Fee cell reads <em>$150.00 owing</em> with <em>Bank debit returned Oct 29 &middot; account closed</em> under it, a Needs attention item names the child and the amount, and the family is emailed a way to pay. <strong>A reversed debit.</strong> If the bank reverses it after it cleared, the line reads <em>Returned by the bank Nov 2 &middot; receipt 1043</em> and the fee is owing again. The item clears when the family pays in full, or when you end the registration. Stripe charges a fee when a debit comes back: it is billed to the club as a <em>Returned bank debit</em> line on its next FieldLogicHQ invoice, and a club on a complimentary plan isn&apos;t billed.</p>
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
                <li><strong>Paid, and the price goes up</strong> — the difference shows as still owing. If they paid by card, the family is emailed a pay link for the rest.</li>
                <li><strong>Paid, and the price goes down</strong> — the difference is recorded as a refund, and the window asks the date and how. If they paid by card, the difference can go back to the card (see <em>Refunding to the card</em>).</li>
              </ul>
              <p>The family is not emailed, except by a card refund or a pay link as above. The correction is kept with the old price, the new price, your reason, who and when; it moves no money by itself.</p>
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
                <li>The owner, club admins, league admins and league registrars take fees (<strong>Mark received</strong>, <strong>Undo</strong>, <strong>Correct the price</strong>) and end registrations, including refunding a card payment and emailing the pay link.</li>
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
      summary: 'Money is the season’s page of registration fees owed, received and refunded. Email families lists what the season emailed its families and opens the club’s email window, set to the season.',
      keywords: ['money', 'ledger', 'email families', 'notifications', 'email log', 'card payments', 'by card', 'payment processing', 'let them pay online', 'payouts status', 'fees', 'accounting', 'owed', 'received', 'still owing', 'refunds', 'every line', 'overview tiles', 'budget vs actual', 'house league registration fees', 'starting budget', 'email the season', 'broadcast', 'unsubscribe', 'opted out', 'email a division', 'email a team', 'email the waitlist', 'three emails', '3 emails', 'in any 24 hours', 'allowance', 'message this family', 'automatic', 'earlier emails', 'send to the ones it missed', 'copy the team’s coaches', 'siblings one email', 'sent history', 'clearing', 'bank debit', 'bank debit clearing', 'returned by the bank', 'to the card', 'to the bank account', 'made in Stripe', 'sent another way', 'after refunded', 'by bank debit'],
      searchText: 'season money page of it by card payment processing child cost let them pay online payouts status treasurer season ledger renamed money season book owed received after refunds still owing every line still owing refunds tabs nobody types money on the page written only by marking a fee received recording a refund or correcting a price voided line struck through price corrected history line kept by the club history line owing since accepted days not known export finished season overview owed still owing tiles open money league plus the season’s book club plan fees also file on budget vs actual house league registration fees one row with each season under it a fee counts in the fiscal year it was received a refund lowers the row never counts as spending starting budget each division’s size times price planned once when registration opens in the fiscal year sign-ups open treasurer changes it or splits it across years on the budget page a line in the other year under the same word treasurer reads money email families notifications renamed sent history email log email the whole season everyone in the season families with an active child a division a team published division by status active to review waitlist ended ticked families bulk bar one family message this family siblings one email each family once children counted beside families opted out unsubscribe link three emails in any 24 hours each season its own 3 not the club’s the next can go spent allowance a message to one family never counts automatic notices publish teams never count tagged automatic earlier emails counted per child old composer stopped partway send to the 1 it missed does not count copy the team’s coaches as colleagues not counted league registrar no families access treasurer cannot finished season stays open why did fewer families get it clearing tile fourth figure owed received clearing still owing 4 players bank debits counts the registration fees only before processing fees moves to received as each bank debit clears note under the band came by card came by bank debit online bank debit receipt returned by the bank line out of the book never in refunds to the card to the bank account pending made in stripe sent another way refund didnt reach the card card refund not in this book',
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
                <HelpDef term="Received">What has come in, after any refunds. The line under it says how much was refunded (<em>after $515 refunded</em>).</HelpDef>
                <HelpDef term="Clearing">Only while a bank debit is on its way, so the band still adds up (owed = received + clearing + still owing). The caption says how many players (<em>4 players &middot; bank debits</em>). It counts the registration fees only, before processing fees, and moves to Received as each debit clears.</HelpDef>
                <HelpDef term="Still owing">Owed less received (and less what is clearing), amber while above zero.</HelpDef>
              </HelpDefs>
              <p>A note under the band says how much of what&apos;s received came by card, by bank debit, or by both (<em>$900 of what&apos;s received came by card and $300 by bank debit</em>).</p>
              <p>Three tabs sit under the figures. <strong>Every line</strong> lists fees in, refunds out in red, and the history lines that move no money (a corrected price, a fee the club kept); a payment taken back with Undo stays, struck through and never counted. <strong>Still owing</strong> lists players, with the day each was accepted and how many days since, and <strong>Not known</strong> where the day was never recorded. <strong>Refunds</strong> lists the money that went back; a card refund reads <em>To the card</em> in the How column (<em>pending</em> until Stripe finishes), a refund to a bank account <em>To the bank account</em>, one made in the club&apos;s Stripe dashboard <em>Refund &middot; made in Stripe</em>, and one that came back <em>Refund didn&apos;t reach the card</em> until it is recorded as <em>Sent another way</em>. A closing line names any card refund whose payment never went on a registration, because it is in no book line. A bank debit that cleared reads <em>Online, bank debit &middot; receipt 1043</em>. If the bank reverses it, a <em>Returned by the bank</em> line takes it out of the book on <strong>Every line</strong> and <strong>Still owing</strong>, and never appears in <strong>Refunds</strong>, because the bank did it, not the club. A debit still clearing is not in the book yet. <strong>Export</strong> downloads the page. A free season has no figures and reads <em>This season is free</em>.</p>
              <p>A processing fee the club pays, including one refunded with a child&apos;s payment, is a cost on <strong>Every line</strong> named <strong>Payment processing</strong> and the child. While payouts aren&apos;t set up, the owner sees a quiet line, <em>Let them pay online</em>, that opens the Payouts card; the treasurer sees where payouts stand.</p>
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
              <p><strong>Email families</strong>, in a season&apos;s menu, lists what the season has emailed its families, and its <strong>Email families</strong> button opens the club&apos;s email window, already set to the season. On Registrations, <strong>Tools &rsaquo; Email families</strong> opens the same window; tick rows and click <strong>Email</strong> to write to just those families; a row&apos;s <strong>&#8943;</strong> &rsaquo; <strong>Email this family</strong> writes to one. The owner, club admin, league admin and league registrar can use it on any season, finished ones included. The registrar needs no Families access.</p>
              <HelpDefs>
                <HelpDef term="Everyone in the season">Families with an active child (on a finished season, the children active when it finished).</HelpDef>
                <HelpDef term="A division, a team">One or more. Only teams in a published division are listed; the window says which divisions aren&apos;t published yet.</HelpDef>
                <HelpDef term="By status">Active, To review, Waitlist or Ended, the Registrations tabs.</HelpDef>
              </HelpDefs>
              <p>The window counts families, with their children beside them, so siblings get one email. A family that opted out of club email is counted, named in the foot, and skipped.</p>
              <ul>
                <li><strong>Each season can send 3 emails in any 24 hours</strong>, its own, apart from the club&apos;s. The page&apos;s first line and the window&apos;s foot say how many it has sent in the last 24 hours; once all 3 are sent, the window says when the next can go.</li>
                <li><strong>A message to one family never counts.</strong> That family can get 3 a day of its own. Two ticked children of one family are one family.</li>
                <li><strong>Automatic emails never count</strong>, like the ones Publish teams sends.</li>
              </ul>
              <p>The list shows each email with who sent it and how many families it reached; a message to one family (its date and sender, never its words); the Publish teams emails, tagged <strong>Automatic</strong>; and, under <strong>Earlier emails &middot; counted per child</strong>, anything sent from the old Email families page. Open an email to see what it said and which families it missed. One that stopped partway offers <strong>Send to the 1 it missed</strong>, which doesn&apos;t count.</p>
              <HelpNote variant="tip" title="Copy the team’s coaches">Emailing a team offers to copy its coaches, unticked. They get it as colleagues and aren&apos;t counted as families.</HelpNote>
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
