/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

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
      keywords: ['season lifecycle', 'status', 'draft', 'getting ready', 'registration open', 'registration closed', 'playing now', 'finished', 'start season', 'complete season', 'archive season', 'reopen season'],
      searchText: 'season lifecycle status draft getting ready registration open registration closed active playing now starts ended finished completed archived start season activate season complete the season archive the season reopen the season reopen registration close registration open registration transition advance manually every change asks window what changes families not emailed warns never blocks',
      content: (
        <>
          <p>A pill beside the season&apos;s name says what is happening. The pill reads:</p>
          <ul>
            <li><strong>Getting ready</strong> — setup. Nothing is visible to families yet, and the season has no public page.</li>
            <li><strong>Registration open</strong> — the sign-up form is live. Families can register for any division.</li>
            <li><strong>Registration closed</strong> — the form no longer takes new sign-ups. Use this phase to review registrations, build teams and prepare the schedule.</li>
            <li><strong>Playing now</strong> — you started the season and it is inside its dates. Before its first day the pill reads <strong>Starts</strong> and the date. Once its last day has passed it turns amber and reads <strong>Ended</strong> and the date, until you complete it.</li>
            <li><strong>Finished</strong> — the season is completed or archived. It reads in place, locked (see <em>Closing out a season</em>).</li>
          </ul>
          <p>You move a season along yourself; nothing advances on its own, and the season&apos;s dates don&apos;t open or close the form. <strong>Open registration</strong> and <strong>Start season</strong> are the next-step buttons at the top of the season&apos;s page. <strong>Close registration</strong> and <strong>Reopen registration</strong> sit on the Registration block. <strong>Complete the season</strong>, <strong>Archive the season</strong> and <strong>Reopen the season</strong> are links at the very end of the page.</p>
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
      keywords: ['permissions', 'who can', 'club admin', 'league admin', 'league registrar', 'treasurer', 'read only', 'roles', 'access'],
      searchText: 'who can do what house league permissions owner admin club admin league admin league registrar registrar treasurer read only edit seasons divisions teams schedule approve decline withdraw add registration by hand fees received email families money page read cannot see button absent not greyed',
      content: (
        <>
          <ul>
            <li><strong>Owner, club admin and league admin</strong> — everything: create and edit seasons and divisions, build teams, run the schedule, move a season between states, work registrations and fees, and email families.</li>
            <li><strong>League registrar</strong> — works the registrations (approve, waitlist, decline, withdraw, add one by hand), marks fees received, and uses Email families. Reads the rest of the season, with no edit controls and no status buttons.</li>
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
      summary: 'Create the season, then set its divisions, dates and fee on its own page.',
      keywords: ['create season', 'season setup', 'divisions', 'capacity', 'spots', 'automation', 'registration fee', 'waiver', 'birth years', 'birth year', 'born', 'age', 'cut-off', 'birthday', 'add division', 'edit division', 'delete division', 'pencil', 'edit season', 'edit registration'],
      searchText: 'create season setup name slug sport division registration opens closes fee waiver automation auto approve waitlist accounting divisions capacity spots public url add division edit division delete this division birth years born 2014–2015 families see born beside this division empty box no limit on that side birthdays count from age group season block registration block pencil tick saves as you go checklist before you open registration',
      content: (
        <>
          <p>From the House league page, click <strong>Create season</strong>. The window asks for the season basics (name, URL slug, sport, a division label) and lets you set the season&apos;s dates, the registration dates, a <strong>registration fee</strong>, <strong>waiver text</strong> and the two automation switches right away. The slug appears in public URLs. Creating it opens the season&apos;s own page.</p>
          <p>That page is where you finish setting up. A season that is still getting ready leads with a <strong>Before you open registration</strong> checklist (see <em>How to launch a house league season</em>). Below it, <strong>Divisions</strong> is a table with <strong>Add division</strong> and a pencil on each row. Each division (for example &ldquo;U11&rdquo;) has its own registrations, teams, schedule and standings. Give each its number of spots, and a full division starts a waitlist. (The free League plan includes one division.)</p>
          <p>The <strong>Season</strong> block (name, dates, description) and the <strong>Registration</strong> block (registration dates, fee, waiver, and how new registrations are taken) read first. Click the pencil in a block&apos;s heading to edit it; the tick in the same spot goes back to reading. A change saves as you go. <strong>Auto-approve under capacity</strong> approves a registration while its division has room, and <strong>Auto-promote from waitlist</strong> moves the next player up when a spot opens.</p>
          <p>In <strong>Add division</strong> and <strong>Edit division</strong>, <strong>Birth years</strong> has two year boxes. Families read them beside the division on your public House league page as <strong>Born 2014&ndash;2015</strong>. An empty box means no limit on that side, and with both empty families see no birth years for the division. A year that isn&apos;t four digits, is in the future or is the wrong way round is held, with the reason under the boxes, until it&apos;s fixed. A line there says when your sport&apos;s birthdays count from; the owner sets that in <strong>Settings</strong>. At the end of the Edit window, <strong>Delete this division</strong> asks first; a division that has registrations can&apos;t be deleted.</p>
          <p>Fees reach your accounting books only when a registration&apos;s fee is marked received, not when you approve it (see <em>Money and Email families</em>). There is no switch for it.</p>
        </>
      ),
    },
    {
      id: 'recipe-launch-season',
      group: 'How-to recipes',
      heading: 'How to launch a house league season',
      summary: 'Create the season, finish its three-step checklist, and open registration.',
      keywords: ['launch season', 'season setup', 'registration open', 'divisions', 'capacity', 'spots', 'checklist', 'before you open registration', 'open registration button'],
      searchText: 'launch season create season setup divisions spots capacity dates fee free checklist before you open registration open registration button appears public form automation auto approve waitlist schedule teams view public page',
      links: [
        { label: 'House league', href: '../house-league' },
      ],
      content: (
        <>
          <p>Use this checklist when starting a new recreational season.</p>
          <ol>
            <li>Click <strong>Create season</strong> on the House league page. The season starts as <strong>Getting ready</strong>, on its own page.</li>
            <li>Work through <strong>Before you open registration</strong>. Each line shows a tick when it is done: <strong>Add a division, and give each one its number of spots</strong>; <strong>Set the first and last day of the season</strong>; <strong>Set the registration fee</strong> (enter 0 if it is free).</li>
            <li>Check the <strong>Registration</strong> block: the waiver, and whether new registrations are approved while a division has room or wait for your review.</li>
            <li>When all three lines are done, <strong>Open registration</strong> appears beside the checklist. Click it and read the window, then confirm. It does not email families.</li>
            <li>Click <strong>View public page</strong> and share its link from your website, email list or social media once the form is live.</li>
          </ol>
          <p>The button isn&apos;t there until the three steps are done, so a season can&apos;t open half-built. Changing divisions or spots after families start registering can make the review queue harder to manage.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-house-league-before-opening',
          question: 'What should be done before I open house league registration?',
          answerText: 'Finish the three-step checklist on the season page: at least one division with its number of spots, the season’s first and last day, and a registration fee (0 if it is free). Open registration appears once all three are done.',
          keywords: ['open registration', 'launch checklist', 'division capacity', 'open registration missing', 'no open registration button'],
          popular: true,
          answer: (
            <p>Finish the three lines under <strong>Before you open registration</strong> on the season&apos;s page: a division with its number of spots, the season&apos;s first and last day, and a registration fee (0 if it&apos;s free). <strong>Open registration</strong> appears once all three are done.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-open-close-registration',
      group: 'How-to recipes',
      heading: 'How to open, pause, or close registration',
      summary: 'Control whether families can submit new house league registrations, and start the season when you are ready.',
      keywords: ['open registration', 'close registration', 'reopen registration', 'pause registration', 'start season', 'public form', 'season status'],
      searchText: 'open registration close registration reopen registration pause public form season status registration open closed getting ready start season activate season waitlist capacity registration block window what changes families not emailed warns waiting registrations',
      links: [
        { label: 'House league', href: '../house-league' },
      ],
      content: (
        <>
          <p>Registration availability follows the season&apos;s state. Every change asks in a window that says what changes for families.</p>
          <ol>
            <li>Open the season&apos;s page. When the checklist is done, click <strong>Open registration</strong> to put the form live.</li>
            <li>To stop new sign-ups, click <strong>Close registration</strong> on the <strong>Registration</strong> block. The window warns, but doesn&apos;t block, if registrations are waiting for review or families are on the waitlist. Families already on the waitlist keep their place, and you can still approve, waitlist and add registrations by hand.</li>
            <li>To take sign-ups again, click <strong>Reopen registration</strong> on the same block. It is offered while the season is <strong>Registration closed</strong>, not once the season is under way; add late players by hand.</li>
            <li>When teams and the schedule are ready, click <strong>Start season</strong> at the top of the page. Teams and the schedule can still change while it is running.</li>
          </ol>
          <p>If you need a short pause, closing registration is safer than deleting divisions or lowering spots. The form follows the state you set, not the registration dates: a close date that has passed does not close it for you.</p>
        </>
      ),
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
      id: 'registrations',
      group: 'Running the season',
      heading: 'Managing registrations day to day',
      summary: 'Review the queue, approve/waitlist/decline (each emails the family), track fee status, add players by hand, and email families.',
      keywords: ['registrations', 'approve', 'waitlist', 'decline', 'fee paid', 'fee received', 'email families', 'withdrawn', 'add registration', 'registrar'],
      searchText: 'manage registrations pending review active waitlist declined withdrawn approve decline confirm email guardian fee paid checkbox fee received email families email blast add registration by hand walk-in tabs league registrar finished season locked registrations locked',
      links: [
        { label: 'Registrations guide', href: '../help/registrations' },
      ],
      content: (
        <>
          <p>Registrations arrive via the public form while a season is in <strong>Registration open</strong>. Each lands in <strong>Pending review</strong> unless the season approves automatically while a division has room. On the Registrations page, the tabs (Pending review, Active, Waitlist, Declined / withdrawn) and the search box help you work a large list. The owner, club admin, league admin and league registrar all work this page.</p>
          <ul>
            <li><strong>Approve</strong> — moves the player to Active and emails the family. They&apos;re eligible for team assignment.</li>
            <li><strong>Waitlist</strong> — holds the registration in queue and emails the family their position. If auto-promote is on, the next waitlisted player advances when a spot opens.</li>
            <li><strong>Decline</strong> — asks you to confirm, then emails a decline notice to the family.</li>
          </ul>
          <p>Each row has a <strong>Fee paid</strong> toggle so you can track payment alongside status. Ticking it marks the fee received and records it as one income line in the season&apos;s accounting book; unticking it voids that line, and declining or withdrawing a registration whose fee was paid voids it too. Approving a registration does not create a fee line. <strong>Add registration</strong> enters a player by hand, outside the public form (walk-ins or carry-overs). <strong>Email families</strong> emails a group: everyone active, or filtered by division, team, or status.</p>
          <p>Once a season is finished, its registrations are locked: Approve, Waitlist, Decline, withdraw and <strong>Add registration</strong> are gone. The <strong>Fee paid</strong> toggle and <strong>Email families</strong> stay.</p>
          <p>For the full registration workflow, see the <a href="../help/registrations">Registrations guide</a>.</p>
        </>
      ),
    },
    {
      id: 'ledger-notifications',
      group: 'Running the season',
      heading: 'Money and Email families',
      summary: 'Money is the season’s book of registration fees (a line appears when you tick Fee paid). Email families sends season-wide email and logs what was sent.',
      keywords: ['money', 'ledger', 'email families', 'notifications', 'email log', 'fees', 'accounting', 'fee paid', 'fee received', 'void', 'email the season', 'broadcast', 'unsubscribe', 'opted out'],
      searchText: 'season money page season ledger renamed money season book fee paid fee received tick untick void declined withdrawn posted line statement not counted fees accounting email families notifications renamed email log sent emails approval waitlist decline confirmation history email the whole season broadcast message all registrants message registrants unsubscribe link opted out not sent skipped no email on file delivered count why did fewer families get it auto-generate fee entries removed no setting treasurer reads money finished season stays open',
      content: (
        <>
          <p>Two pages sit beside Registrations, Teams &amp; draft, Schedule and Standings in a season&apos;s menu:</p>
          <ul>
            <li><strong>Money</strong> (it used to be called Ledger) — the season&apos;s book of registration fees. Ticking <strong>Fee paid</strong> on a registration writes one income line here; unticking it, declining, or withdrawing the registration voids that line, and ticking it again writes a new one. Fees reach the books only this way: there is no setting to create them on approval. The club&apos;s Cash on hand counts this book, but its Statement does not yet. Everyone who opens house league can read Money, and so can the club&apos;s treasurer.</li>
            <li><strong>Email families</strong> (it used to be called Notifications) — where you email the season, and a log of what it has already sent (approvals, waitlist notices, declines), so you can confirm a family was contacted if they say they didn&apos;t receive something. The owner, club admin, league admin and league registrar can use it.</li>
          </ul>
          <p>Both stay open on a finished season: fees still arrive after the last game, and families still need a late word. On the Email families page you can address everyone active, the waitlist, or registrations waiting for review. The <strong>Email families</strong> button on the Registrations page also lets you pick one division, one team, or one status. Every email carries your club&apos;s name and an <strong>unsubscribe link</strong>, and a family who has opted out is left out, including one who unsubscribed under an older email address and has since given you a new one.</p>
          <p>After sending, the confirmation accounts for everyone you addressed:</p>
          <ul>
            <li><strong>Delivered</strong> — the email went out.</li>
            <li><strong>Not sent (unsubscribed)</strong> — the family has opted out of club email. You see how many, never which ones; reaching them has to be a direct conversation.</li>
            <li><strong>Skipped (no email on file)</strong> — the registration has no usable address. Add one on the registration to include them next time.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'public-page',
      group: 'Running the season',
      heading: 'Sharing the public season page',
      summary: 'Once a season leaves Getting ready it gets a public page, and your club’s pages list every live season.',
      keywords: ['public page', 'public url', 'share', 'registration link', 'running now', 'playing now', 'final standings', 'past seasons'],
      searchText: 'public season page url share registration link schedule standings view public page getting ready no public page league page running now registration open registration closed starts playing now final standings past seasons club home open now every live season',
      content: (
        <>
          <p>A season has no public page while it&apos;s <strong>Getting ready</strong>. Once you open registration, a <strong>View public page</strong> button appears at the top of the season&apos;s page. That page is where families register and, later, follow the schedule and standings; share its link directly.</p>
          <p>Your club&apos;s house league page lists <strong>every</strong> live season under <strong>Running now</strong>, newest first, each labelled by what is happening: <strong>Registration open</strong>, <strong>Registration closed</strong>, <strong>Starts</strong> and its first day, <strong>Playing now</strong>, or <strong>Final standings</strong> once the season&apos;s dates have passed but it isn&apos;t completed yet. Each row has its own links (<strong>Register</strong>, <strong>Schedule</strong>, <strong>Standings</strong>, <strong>Season page</strong>). Finished seasons sit below under <strong>Past seasons</strong>. Your club&apos;s home page lists every live season too, and a season that is taking registrations also shows under <strong>Open now</strong>.</p>
        </>
      ),
    },
    {
      id: 'closing',
      group: 'Running the season',
      heading: 'Closing out a season',
      summary: 'Complete the season when games end, then Archive it if you wish; a finished season reads in place, locked, and can be reopened.',
      keywords: ['close season', 'complete season', 'completed', 'archive season', 'archived', 'finished', 'reopen season', 'season end', 'locked', 'past seasons'],
      searchText: 'closing season complete the season archive the season reopen the season finished completed archived retire preserve data house league locked read only past seasons shelf money stays open fees received email families stays open no seal step ended pill complete it',
      content: (
        <>
          <p>When the games are done, click <strong>Complete the season</strong> at the end of the season&apos;s page. The window says what changes, and warns, but never blocks, if registrations are waiting, families are on the waitlist, players still owe fees, or the season&apos;s last day is still ahead. A season past its last day shows an amber <strong>Ended</strong> pill until you do. Completing moves it to <strong>Past seasons</strong> and does not email anyone.</p>
          <ul>
            <li><strong>Locked</strong> — registrations, teams, the schedule and the season&apos;s settings can no longer be changed, and every edit control is gone. The pages still read, and a line at the top says the page is locked.</li>
            <li><strong>Still open</strong> — <strong>Money</strong> (you can still mark fees received) and <strong>Email families</strong>.</li>
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
