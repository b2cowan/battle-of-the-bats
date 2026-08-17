import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef, HelpSteps, HelpNote } from '@/components/help/HelpBlocks';
import HelpScreenshot from '@/components/help/HelpScreenshot';

const coachesHelp: HelpPageContent = {
  title: 'Coaches Portal',
  role: 'Coach',
  intro:
    'The Coaches Portal is your free home base for the teams you coach — your roster, schedule, team fees, and parent announcements in one place, year-round and between tournaments. Turn on only the tools you need. Premium Coaches Portal adds the serious-operator extras on top.',
  // Placeholders name the guide and stop. The examples that used to trail this one
  // ("— roster, schedule, fees…") were cut off mid-word in the 272px search column,
  // which reads as a bug rather than as a hint. The guide's own contents list sits
  // directly beneath the box and does that job properly.
  searchPlaceholder: 'Search coach help',
  sections: [
    {
      id: 'overview',
      group: 'Getting started',
      heading: 'What the Coaches Portal is',
      summary: 'A free, year-round team home that grows from a single tournament into your full-season workspace.',
      keywords: ['coaches portal', 'free', 'team home', 'what is', 'overview', 'coach', 'your tournament', 'your tournaments', 'tournament history', 'team tools', 'schedule tile', 'next game', 'fan view', 'tabs', 'navigation', 'bottom bar', 'see all', 'only one tournament', 'where are my other tournaments', 'tiles two across', 'not on'],
      searchText: 'coaches portal free team home tournament participant year round roster schedule fees announcements premium upgrade what is overview page order your tournament singular one tournament only one event shown where did my tournament list go missing tournaments see all tournaments tile link full list on the tournaments tab tournament history team tools beyond this tournament divider at a glance stat strip tiles two across two columns on a phone schedule tile next game live tournament game live score fan view public site flip public schedule badge live game day in 5 days complete finished event tabs tab row navigation getting around bottom bar home scores chat account team header where is the menu back to your coaches portal return from chat not on tile tool not switched on tile says not on instead of zero',
      content: (
        <>
          <p>The Coaches Portal is free. It often starts when you register a team for a tournament, but it&apos;s built to stay useful between events — a year-round home for your roster, schedule, team fees, and parent announcements.</p>
          <p>The portal opens with two sections always available:</p>
          <HelpDefs>
            <HelpDef term="Overview">Your team&apos;s home page, in the order a coach actually needs it.</HelpDef>
            <HelpDef term="Tournaments">Every tournament you&apos;ve registered the team for, with status and schedule.</HelpDef>
          </HelpDefs>
        </>
      ),
      subtopics: [
        {
          id: 'overview-whats-on-it',
          title: 'What’s on your Overview, top to bottom',
          content: (
            <>
              <p><strong>Your tournament</strong> comes first — one card naming the event that matters right now, since that&apos;s usually why you&apos;re here. Below it sits a divider, <em>&ldquo;Your team — beyond this tournament&rdquo;</em>, and everything under it belongs to your team rather than to any one event: <strong>At a glance</strong> (roster size, unpaid fees, how many parents you can reach, your next practice or game, and how many tournaments you&apos;re in) and the free team tools. Nothing below that divider is homework an organizer is waiting on — it&apos;s yours to use whenever you like, and it carries over to every event you enter.</p>
              <p>The Overview names <strong>one</strong> tournament, not all of them: whichever event is being played, or else the next one coming up, or else the most recent one you finished. Your full list — every entry, including ones you weren&apos;t accepted into — lives on the <strong>Tournaments</strong> tab, and the <strong>Tournaments</strong> tile has a <strong>See all &rarr;</strong> link straight to it. On a phone the At-a-glance tiles sit two across so more of your team&apos;s numbers fit on the first screen.</p>
              <p>The <strong>Schedule</strong> tile shows your own next practice or game once you&apos;ve added events. Haven&apos;t added any? If your team is in a tournament with a published schedule, the tile borrows your next tournament game instead — and during a game it shows the <strong>live score</strong> — so game day is never a blank &ldquo;None.&rdquo; The tournament card at the top carries a badge for where the event stands (<strong>Live</strong>, <strong>Game Day</strong>, a countdown like <em>In 5 days</em>, or <strong>Complete</strong>) and, once the organizer has published the event, a <strong>⇄ Fan view</strong> link that opens its public site — the schedule, live scores, and standings exactly as families see them.</p>
            </>
          ),
        },
        {
          id: 'overview-getting-around',
          title: 'Getting around',
          content: (
            <p>Your team&apos;s name sits in a header at the top of every portal page, and the portal&apos;s sections run as a row of <strong>tabs</strong> beneath it (on a computer they&apos;re a list on the left instead). The FieldLogicHQ bar — <strong>Home · Scores · Chat · Account</strong> — stays at the bottom of your phone the whole time, so live scores and your tournament chat are always one tap away. When you tap <strong>Chat</strong> from inside your portal, the chat screen shows a <strong>← Back to your Coaches Portal</strong> link at the top that returns you to the exact page you left.</p>
          ),
        },
        {
          id: 'overview-free-and-premium',
          title: 'What’s free, and what Premium adds',
          content: (
            <>
              <p>Four more tools — <strong>Roster</strong>, <strong>Schedule</strong>, <strong>Fees</strong>, and <strong>Announcements</strong> — are free too, but stay hidden until you turn them on from <strong>Explore</strong>. That keeps the portal simple if all you need is your tournament record.</p>
              <p><strong>Premium Coaches Portal</strong> is the paid upgrade. It adds game-day tools (positions, attendance, lineups), recurring scheduling and calendar sync, dues automation and a season budget, and document storage. Each tool below notes what Premium adds. On Premium, <strong>every tool is already in your sidebar</strong> — there&apos;s no Explore step; the four-tools-off model just above applies to the free portal. See <strong>Getting around your Premium portal</strong> below for the tour.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-overview-one-tournament',
          popular: true,
          question: 'My Overview only shows one tournament — where are the others?',
          answerText: 'Nothing is missing. The Overview names one tournament: the one being played right now, or else the next one coming up, or else the most recent one you finished. Your full list is on the Tournaments tab, and the Tournaments tile on the Overview has a See all link straight to it. The tab shows every entry in the order that matters — live and upcoming first, finished ones after — including any you were not accepted into, because that is still your record. The Overview used to list them all, which meant the same event appeared twice on one screen before you got to your team\'s own numbers. One exception worth knowing: if you were turned away from an event that is running this weekend but you are accepted into one later, the Overview names the one you are actually in, not the one you are not.',
          keywords: ['only one tournament', 'one tournament', 'where are my tournaments', 'missing tournaments', 'tournament list gone', 'see all', 'tournament list', 'other events', 'my other tournament', 'overview shows one', 'which tournament is shown', 'wrong tournament', 'rejected tournament showing'],
          answer: (
            <>
              <p><strong>Nothing is missing.</strong> The Overview names <strong>one</strong> tournament: the one being played right now, or else the next one coming up, or else the most recent one you finished.</p>
              <p>Your full list lives on the <strong>Tournaments</strong> tab, and the <strong>Tournaments</strong> tile on the Overview has a <strong>See all &rarr;</strong> link straight to it. That tab shows every entry in the order that matters — live and upcoming first, finished ones after — including any you weren&rsquo;t accepted into, because that&rsquo;s still your record.</p>
              <p>The Overview used to list them all, which meant the same event appeared twice on one screen before you reached your team&rsquo;s own numbers.</p>
              <p>One exception worth knowing: if you were <strong>turned away</strong> from an event running this weekend but you&rsquo;re accepted into one later, the Overview names the one you&rsquo;re actually in — not the one you&rsquo;re not.</p>
            </>
          ),
        },
        {
          id: 'faq-overview-tile-not-on',
          question: 'Why does a tile say “Not on” instead of a number?',
          answerText: 'Because that tool has not been switched on yet and there is nothing in it. Roster, Schedule, Fees and Announcements are free but start switched off, so instead of reporting a meaningless zero the tile tells you what the tool would give you — for example "Keep your team list, reuse it every event." Turn the tool on from Explore (or from a step on the Let us set up your team card) and the tile starts showing your real number. If you already have something in a tool — players on your roster, an event on your schedule — the tile always shows that real number, even while the tool is switched off. A tournament entry fee owed to the organizer always shows on the Fees tile too, whether or not you use the fees tool, because that is the organizer\'s money rather than your own records.',
          keywords: ['not on', 'tile says not on', 'no number', 'zero tiles', 'empty tiles', 'at a glance empty', 'why does it say not on', 'tile blank', 'turn on tool', 'roster not on', 'schedule not on'],
          answer: (
            <>
              <p>Because that tool hasn&rsquo;t been switched on yet <em>and</em> there&rsquo;s nothing in it. Roster, Schedule, Fees and Announcements are free but start switched off, so rather than report a meaningless zero the tile tells you what the tool would give you — for example <em>&ldquo;Keep your team list, reuse it every event.&rdquo;</em></p>
              <p>Turn the tool on from <strong>Explore</strong> (or from a step on the <strong>Let&rsquo;s set up your team</strong> card) and the tile starts showing your real number.</p>
              <p>If you already have something in a tool — players on your roster, an event on your schedule — the tile <strong>always</strong> shows that real number, even while the tool is switched off. And a tournament <strong>entry fee</strong> owed to the organizer always shows on the Fees tile, whether or not you use the fees tool: that&rsquo;s the organizer&rsquo;s money, not your own records.</p>
            </>
          ),
        },
        {
          id: 'faq-coach-nav-moved',
          question: 'Where did the portal’s menu go? I can’t find sign out.',
          answerText: 'The free portal now uses the same navigation as the rest of the FieldLogicHQ app. Your team sections (Overview, Tournaments, any tools you have turned on, and Explore) are a row of tabs under your team name — a list on the left on a computer. The old More menu is gone: sign out, appearance, feedback, and this help guide now live on the Account tab in the app bar at the bottom of your phone; team chat lives on the Chat tab. On a computer, Account is a settings screen with sections down the left — Profile, Notifications, Appearance, Get the app, and Help: sign out is under Profile, and feedback plus this help guide are under Help. Tapping Chat from your portal shows a "Back to your Coaches Portal" link at the top of the chat screen, so you can get straight back to where you were. If you have more than one team, tap your team name in the header to switch.',
          keywords: ['menu gone', 'more menu', 'where is sign out', 'sign out', 'log out', 'feedback', 'account tab', 'account sections', 'profile', 'settings screen', 'where is feedback', 'help section', 'switch team', 'navigation changed', 'new layout', 'back to portal', 'get back from chat', 'lost in chat'],
          answer: (
            <>
              <p>The free portal now uses the <strong>same navigation as the rest of the FieldLogicHQ app</strong>. Your team sections — Overview, Tournaments, any tools you&rsquo;ve turned on, and Explore — are a row of <strong>tabs under your team name</strong> (a list on the left on a computer).</p>
              <p>The old <strong>More</strong> menu is gone: <strong>sign out, appearance, feedback, and this help guide</strong> now live on the <strong>Account</strong> tab in the app bar at the bottom of your phone, and team chat lives on the <strong>Chat</strong> tab. On a computer, Account is a <strong>settings screen with sections down the left</strong> — Profile, Notifications, Appearance, Get the app, and Help: <strong>sign out</strong> is under <strong>Profile</strong>, and <strong>feedback</strong> plus this help guide are under <strong>Help</strong>. Worried about getting back? Tapping <strong>Chat</strong> from your portal puts a <strong>← Back to your Coaches Portal</strong> link at the top of the chat screen that returns you to the page you left.</p>
              <p>If you coach more than one team, tap your <strong>team name</strong> in the header to switch.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-first-login',
      group: 'Getting started',
      heading: 'How to get into your portal',
      summary: 'Claim a team an organizer registered, or start a free team home from scratch.',
      keywords: ['coach login', 'first login', 'claim team', 'start free team home', 'coach portal', 'get started', 'skip setup', 'hide welcome', 'subscription has ended', 'subscription ended', 'lost access', 'locked out', 'portal stopped working', 'cannot get in', 'club stopped paying'],
      searchText: 'coach first login sign in coaches portal claim your team registered email start free team home organizer invited tournament registration get started access three step starter set up your team let us set up your team welcome card comes first above the tiles above at a glance first screen skip all this skip setup hide the welcome card dismiss getting started steps turn on schedule from the steps turn on announcements from the welcome tick off checkmark completed step why is my step not ticked step still offers turn on after i used the tool new team empty tiles not on nothing to report yet subscription has ended club subscription ended cancelled canceled lost access locked out portal stopped working cannot get in no access did i lose my team is my roster gone nothing has been deleted club stopped paying talk to your club administrator free team home unaffected',
      content: (
        <>
          <p>There are two ways your team shows up in the portal. Sign in with the email address you use for coaching, then look for one of these.</p>
          <p><strong>Claim a team an organizer registered.</strong> If a tournament organizer registered your team using your email, a <strong>Claim your team</strong> prompt appears on your portal home. Click <strong>Claim team</strong> to link it to your account — then its status, schedule, and updates show up in your portal.</p>
          <p><strong>Start a free team home.</strong> If you don&apos;t have a team yet, click <strong>Start free team home</strong>. You don&apos;t need an organization or an invite — it&apos;s free and yours to run.</p>
          <p>A team home you started yourself opens with a short <strong>Let&rsquo;s set up your team</strong> card of three steps: add your players, add practices and games, and send a note to parents. It sits near the top — <strong>above</strong> your team&rsquo;s At-a-glance tiles, which have nothing to report yet and read <strong>&ldquo;Not on&rdquo;</strong> until you switch a tool on. Each step has its own button. Two of those tools start switched off (see <em>How to turn on the tools you need</em>) — where that&apos;s the case the button reads <strong>Turn on Schedule</strong> or <strong>Turn on Announcements</strong>, and pressing it switches the tool on <em>and</em> opens it, so it&apos;s also a new tab from then on. Once a tool is on and you&rsquo;ve done that step, it shows a <strong>checkmark</strong> and stops asking. If a tool isn&apos;t on yet, its step keeps offering to turn it on — even if you&rsquo;ve already put something in it — so there is always a way back to it.</p>
          <p>Don&apos;t want any of it? <strong>Just here to enter a tournament? Skip all this</strong> at the bottom of the card clears it in one click. It leaves a single faint line back to <strong>Explore</strong>, and Explore stays in your tabs, so nothing is lost — you can set these up whenever you like. The card also goes away on its own once all three steps are done.</p>
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
        {
          id: 'faq-coach-subscription-ended',
          question: 'My portal says the club’s subscription has ended — what happened to my team?',
          answerText: 'Your club stopped subscribing, so the coaching tools are closed for now. Nothing has been deleted. Your roster, schedule, attendance, lineups and season history are all kept exactly as you left them, and they come back the moment the club subscribes again. There is nothing for you to do and nothing to save or export in a hurry — this is a billing matter between your club and FieldLogicHQ, so the person to talk to is your club administrator, not support. If you also run your own free team home, that is completely unaffected: it belongs to you rather than to the club, so it keeps working exactly as before.',
          keywords: ['subscription has ended', 'subscription ended', 'club subscription', 'cancelled', 'canceled', 'lost access', 'locked out', 'portal stopped working', 'cannot get in', 'no access', 'did i lose my team', 'is my roster gone', 'club stopped paying'],
          popular: true,
          answer: (
            <>
              <p>Your club stopped subscribing, so the coaching tools are closed for now. <strong>Nothing has been deleted.</strong> Your roster, schedule, attendance, lineups and season history are all kept exactly as you left them, and they come back the moment the club subscribes again.</p>
              <p>There&rsquo;s nothing for you to do, and nothing to save or export in a hurry. This is a billing matter between your club and FieldLogicHQ, so the person to ask is <strong>your club administrator</strong>.</p>
              <p>If you also run <strong>your own free team home</strong>, that&rsquo;s completely unaffected — it belongs to you rather than to the club, so it keeps working exactly as before.</p>
            </>
          ),
        },
        {
          id: 'faq-coach-appearance',
          question: 'Can I change how my portal looks (light or dark)?',
          answerText: "Yes. Under Account then Appearance you can switch FieldLogicHQ between a Warm (light) look and a Dark look. Warm is the default. It's one setting for your whole account — not one per area — so it applies to your coaches workspace and the rest of the app together, and follows you across your devices when you're signed in. The one thing it doesn't change: an organizer's public tournament pages, which always show that organizer's own branding and colours.",
          keywords: ['dark mode', 'light mode', 'warm', 'appearance', 'theme', 'change portal colour', 'change portal color', 'coaches portal look', 'portal too dark', 'portal too bright', 'default theme'],
          answer: (
            <>
              <p>Yes — under <strong>Account &rarr; Appearance</strong> you can switch FieldLogicHQ between a <strong>Warm</strong> (light) look and a <strong>Dark</strong> look. <strong>Warm is the default.</strong></p>
              <p>It&rsquo;s <strong>one setting for your whole account</strong>, not one per area — so it applies to your <strong>coaches workspace</strong> and the rest of the app together, and follows you across your devices when you&rsquo;re signed in. The one thing it doesn&rsquo;t change is an organizer&rsquo;s public <strong>tournament pages</strong> — those always show that organizer&rsquo;s own branding and colours.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'explore',
      group: 'Getting started',
      heading: 'How to turn on the tools you need',
      summary: 'Roster, Schedule, Fees, and Announcements are free but off by default — turn them on from Explore.',
      keywords: ['explore', 'turn on', 'activate', 'enable tools', 'roster schedule fees announcements', 'sections missing', 'what premium adds', 'assistant coaches', 'turn on from the welcome steps'],
      searchText: 'explore turn on activate enable team tools roster schedule fees announcements free progressive disclosure where is my roster tab missing section premium all tools already on no explore step sidebar what does premium add list of premium tools assistant coaches with their own sign in second coach help running the team lineups attendance documents dues automation season budget carry roster into next season see what upgrading gets you turn on from the setup card welcome steps two ways to turn a tool on new tab appears after turning on bookmark old link saved link opens a tool that is switched off used it but no tab appears data still there nothing lost step still says turn on instead of checkmark',
      content: (
        <>
          <p><em>This applies to the free portal.</em> On <strong>Premium Coaches Portal</strong> every tool is already in your sidebar, so there&apos;s nothing to turn on — you can skip this section.</p>
          <p>To keep the free portal uncluttered, the four team tools start switched off. Open <strong>Explore</strong> — always the <em>last tab</em> in your team&apos;s tab row (the last item in the left-hand list on a computer) — to see them:</p>
          <HelpDefs>
            <HelpDef term="Roster">Enter your team once and reuse it for your next tournament registration.</HelpDef>
            <HelpDef term="Schedule">Your tournament games plus your own practices, in one calendar.</HelpDef>
            <HelpDef term="Fees">Track who has paid their team fees, no spreadsheet.</HelpDef>
            <HelpDef term="Announcements">Send a note to your whole team at once.</HelpDef>
          </HelpDefs>
        </>
      ),
      subtopics: [
        {
          id: 'explore-turning-on',
          title: 'Turning one on — two ways',
          content: (
            <>
              <p>Each shows a <strong>Free</strong> tag. Click <strong>Turn on</strong> and the tool appears as a new tab and opens for you. Ignore the ones you don&apos;t need — nothing is forced on you, and you can turn a tool on any time from Explore.</p>
              <p><strong>There&apos;s a second way in.</strong> On a brand-new team you started yourself, the <strong>Let&rsquo;s set up your team</strong> card on your Overview has a <strong>Turn on</strong> button on each step, which does exactly the same thing — switches the tool on and opens it. Explore is still the place to browse all four and to turn one on later; the card is just a shortcut for the three it names.</p>
            </>
          ),
        },
        {
          id: 'explore-missing-tab',
          title: 'Can’t find your Roster or Schedule tab?',
          content: (
            <>
              <p>It&apos;s almost always because it hasn&apos;t been turned on yet. Open Explore and turn it on.</p>
              <p>A saved link or an old bookmark to one of these tools still opens and still works, even when the tool is switched off — but it stays out of your tabs until you turn it on. If you find yourself back in a tool you can&apos;t otherwise see, turn it on from Explore (or from its step on the setup card) so it&apos;s there next time.</p>
            </>
          ),
        },
        {
          id: 'explore-premium-list',
          title: 'Where to see what Premium adds',
          content: (
            <p>Explore is also the one place that lists it, if you ever want to look: game lineups, attendance tracking, <strong>assistant coaches with their own sign-in</strong> (a free team is a single login — there&apos;s no way to give another coach their own access), team documents, dues schedules with automatic reminders, a season budget, and carrying your roster into next season. Everything above stays free either way.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-tool-used-but-no-tab',
          question: 'I added things to my Schedule, so why isn’t there a Schedule tab?',
          answerText: 'Because the tool itself is still switched off. A saved link or bookmark opens a tool and lets you use it even when it has never been turned on — but a tool only joins your tabs once you turn it on. Nothing you entered is lost or hidden; it is all waiting there. Open Explore (always the last tab) and press Turn on for that tool, or use its step on the Let us set up your team card, and it appears in your tabs from then on. If you have used a tool this way, its setup step keeps offering Turn on rather than showing a checkmark, precisely so you always have a way back to it.',
          keywords: ['no schedule tab', 'no roster tab', 'tab missing', 'used it but no tab', 'bookmark', 'old link', 'saved link', 'cant find it again', 'where did my schedule go', 'entered data but tab gone', 'step still says turn on'],
          answer: (
            <>
              <p>Because the tool itself is still switched off. A saved link or bookmark <strong>opens</strong> a tool and lets you use it even when it has never been turned on — but a tool only joins your <strong>tabs</strong> once you turn it on.</p>
              <p><strong>Nothing you entered is lost or hidden</strong> — it&apos;s all waiting there. Open <strong>Explore</strong> (always the last tab) and press <strong>Turn on</strong> for that tool, or use its step on the <strong>Let&rsquo;s set up your team</strong> card. It appears in your tabs from then on.</p>
              <p>That&rsquo;s also why, if you&rsquo;ve used a tool this way, its setup step keeps offering <strong>Turn on</strong> instead of showing a checkmark — so you always have a way back to it.</p>
            </>
          ),
        },
      ],
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
          <p><strong>Premium Coaches Portal adds:</strong> more event types (league and tournament games, scrimmages, team events, and multi-day tournaments), <strong>List / Week / Month</strong> calendar views, game-day details (arrival/call time, field/diamond #, uniform) with a tap-to-open map link, <strong>Repeat weekly</strong> (see every date before you create it, and give each game its own opponent), <strong>Import</strong> (bring a whole season in from a spreadsheet or a league email), attendance taken straight from each event, and syncing your schedule to your phone&apos;s calendar. See <strong>Set up a repeating practice or league schedule</strong> and <strong>Bring a schedule in from a spreadsheet</strong> below.</p>
        </>
      ),
    },
    {
      id: 'recipe-run-tryouts',
      group: 'Your team tools',
      heading: 'How to run tryout day',
      summary: 'Run the whole tryout from your phone: sessions, scorecard, check-in, scoring it yourself (plus helpers if you like), a live ranked scoreboard, Offer/Waitlist decisions with family emails you switch on only if you want them, last season’s score beside this one for verified returning players, one-tap accept onto your roster with fees, a Tryout report you can hand to your club board — and a walkthrough that turns the tryout into each new player’s development starting point. Kept fair with blind evaluation.',
      keywords: ['tryouts', 'tryout day', 'check-in', 'bib numbers', 'blind evaluation', 'walk-up', 'scorecard', 'evaluators', 'scoreboard', 'ranking', 'decision board', 'offer', 'waitlist', 'reveal names', 'lock scoring', 'accept', 'add to roster', 'fees', 'dues', 'score players', 'score yourself', 'email families', 'family emails', 'email this offer', 'new link', 'tryout report', 'board summary', 'fairness receipt', 'export tryouts', 'start development from tryouts', 'development baseline', 'tryout snapshot', 'suggested focus areas', 'seed development', 'what to work on first', 'returning player', 'memory strip', 'last season score', 'year over year', 'compare categories', 'verify returning player', 'offers extended'],
      searchText: 'tryouts tryout day sessions dates times location field check in check-in bib number auto assign blind evaluation names hidden anonymous walk up walk-up add candidate print roster sheet paper backup provincial window OBA softball ontario schedule marker premium run tryouts evaluate players scorecard rubric categories skills weight rating scale 1-5 1-10 hitting fielding throwing speed attitude evaluators assistant helper no login link score scoring rate players score players myself score as yourself signed in live scoreboard ranked ranking composite weighted average bias runs hot runs cold consensus lock scoring freeze reopen reveal names unblind one-way decision board offer waitlist not this season cut pass pick selections roster accept add to roster onboard finalize fees dues standard fee schedule installments prefilled optional no card charge email families my decisions switch off by default record only reach out yourself email this offer resend new link fresh link expired lost link scores kept no email on file notify by phone didn’t check in family’s note tryout report board summary pdf export excel xlsx full detail funnel turnout vs last season class profile strong thin category averages fairness receipt independent evaluators shared scorecard blind until revealed final every candidate has a decision share with board parents print start development from tryouts begin 12 players development baseline seed set each new player baseline pick what to work on first tryout snapshot suggested focus you decide two lowest categories below the middle of your scale don’t add dont add nothing is created silently skip this player save baseline and next no snapshot set focus manually baseline set once per season never overwritten already done skipped where the season started coach eyes only families never see tryout evaluations never counts as a measurable or a trend possible returning player verify confirm identity memory strip last year last season previous tryout year over year came back cut last year came back better improved plus 0.7 delta change since last tryout compare categories matched categories different scorecards different scales 1-10 vs 1-5 side by side no arithmetic unverified match shows no scores returning candidates improved on average three comparable pairs offers extended ever offered versus currently offered rescinded offer prior season score never shown to families blind surfaces show no history',
      content: (
        <>
          <p>Open the <strong>Tryouts</strong> tab for your team to run the whole day from your phone — set up, check-in, scoring, a live ranked scoreboard, and your final picks all live here.</p>
          <p>You run tryouts for your own team whether you coach independently or as part of a club. If you coach a club team, accepting a player also finalizes them in the org&apos;s Rep Teams area, where your club admin can manage applicants and fees too.</p>
        </>
      ),
      subtopics: [
        {
          id: 'recipe-run-tryouts-setup',
          title: 'Before the day: sessions, scorecard, blind evaluation',
          content: (
            <>
              <HelpSteps>
                <li><strong>Add your sessions.</strong> On the <strong>Tryout Day</strong> card, add each date and time (and location/field). They appear on your <strong>team schedule</strong> as read-only tryout markers.</li>
                <li><strong>Build your scorecard.</strong> On the <strong>Evaluation scorecard</strong> card, list what you&apos;re rating — for example Hitting, Fielding, Throwing, Speed — each with a weight, on a 1–5 or 1–10 scale. A starter set is filled in for you; adjust it to how you evaluate.</li>
                <li><strong>Keep it fair with Blind evaluation.</strong> It&apos;s on by default: players show as <strong>bib numbers only</strong>, with names hidden until you deliberately reveal them (see <em>Making your picks</em> below).</li>
              </HelpSteps>
              <HelpNote variant="info" title="A date outside the usual window">Pick a tryout date outside the standard provincial tryout window and you&apos;ll get a friendly heads-up — safe to ignore if your team isn&apos;t affiliated.</HelpNote>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-checkin',
          title: 'On the day: check-in and walk-ups',
          content: (
            <>
              <p><strong>Open day-of check-in.</strong> Every candidate gets an <strong>auto-assigned bib number</strong>. Tap a player to check them in — a live &quot;X of Y checked in&quot; count keeps you oriented, and an <strong>Undo</strong> appears if you tap the wrong one. You can also <strong>print a paper backup sheet</strong> for spotty cell service (bib numbers only when blind).</p>
              <p><strong>Add walk-ups.</strong> If a player shows up without registering, add them with just their name (guardian details can wait) — they&apos;re checked in on the spot.</p>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-scoring',
          title: 'Scoring: you, your helpers, and the live board',
          content: (
            <>
              <p><strong>Score players yourself.</strong> On the <strong>Tryout day</strong> tab, tap <strong>Score players</strong> — you&apos;re straight into the field scorecard, signed in as you, with checked-in players listed first. Your scores count like anyone&apos;s and show on the scoreboard marked <strong>(you)</strong>.</p>
              <p><strong>Invite helpers to score too (optional).</strong> On the <strong>Evaluators</strong> card, add a helper by name to get them a private scoring link — <strong>no login, no app</strong>. It works for 48 hours (the link says until when) and you can turn it off any time — you&apos;ll be asked first. Lost or expired link? <strong>New link</strong> on their row issues a fresh one and <strong>keeps all their scores</strong>.</p>
              <p><strong>Watch the live scoreboard.</strong> The <strong>Live scoreboard</strong> ranks players by their weighted average across everyone scoring, and updates on its own as scores come in. A player who never checked in is marked, so a no-show never reads as a low scorer. If an evaluator&apos;s scores drift from the group, they&apos;re gently flagged &quot;runs hot/cold&quot; so you can weigh their input.</p>
              <p><strong>Lock scoring when you&apos;re done.</strong> Use <strong>Lock scoring</strong> on the scoreboard to freeze all evaluator input — their links stop accepting scores. You can reopen it any time if you need another look.</p>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-decide',
          title: 'Making your picks',
          content: (
            <>
              <p><strong>Reveal names when you&apos;re ready to decide.</strong> On the Tryout Day card, <strong>Reveal names</strong> turns off blind mode so names show on the scoreboard and decision board. It&apos;s <strong>one-way</strong> — once revealed you can&apos;t switch back to bib-only for this tryout, so you&apos;ll be asked to confirm.</p>
              <p><strong>Make your picks.</strong> On the <strong>Decision board</strong>, players are listed top-to-bottom by score; for each one tap <strong>Offer</strong>, <strong>Waitlist</strong>, or <strong>Not this season</strong>. A running tally shows where you stand.</p>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-returning',
          title: 'The player who has been here before',
          content: (
            <>
              <p>If someone looks like a player from a past season, their row shows <strong>Possible returning player — verify</strong>. Open it, check the details side by side, and confirm it&apos;s the same child. Once you do, their row gains a <strong>memory strip</strong>: last season&apos;s tryout score beside this one, so the kid you cut last year who came back stronger is visible at the moment you decide.</p>
              <p>When both years used the same scoring scale you also get the change (<strong>▲ +0.7</strong>), and you can open <strong>Compare categories</strong> to see it skill by skill. If the two years used different scales, both are shown side by side with <strong>no</strong> arithmetic — a 7.1 out of 10 and a 3.6 out of 5 aren&apos;t the same measurement, and pretending otherwise would mislead you.</p>
              <HelpNote variant="info" title="Nothing leaks into a blind tryout">Unverified matches show <strong>no scores at all</strong>, and none of this appears anywhere while names are still hidden.</HelpNote>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-families',
          title: 'How families hear from you',
          content: (
            <>
              <p>Out of the box, decisions are <strong>only recorded</strong> — no emails go anywhere, and you deliver the news your way (most coaches call their picks). Flip <strong>Email families my decisions</strong> (the switch right above the buttons) and each choice emails the family for you: an <strong>Offer</strong> lands as a club-branded email with no-login <strong>Accept/Decline</strong> buttons good for <strong>7 days</strong>, <strong>Waitlist</strong> sends a &quot;you&apos;re on the waitlist&quot; note, and <strong>Not this season</strong> sends a warm &quot;not this time&quot; — that one asks you to confirm first, because an email can&apos;t be unsent.</p>
              <p>With the switch off, any offered player still has <strong>✉ Email this offer</strong> for sending just that family the self-serve link. Emailed offers show where the family stands — <em>awaiting</em>, <em>family accepted</em>, <em>declined</em>, or <em>expired</em> — a family with <strong>no email on file</strong> is flagged so you know to phone, and the note the family wrote at registration is one tap away on their row.</p>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-accept',
          title: 'Accepting a player onto your roster',
          content: (
            <>
              <p>When a family accepts (or any time you&apos;re ready), tap <strong>Accept → add to roster</strong> — the family&apos;s response doesn&apos;t roster the player on its own; you always confirm. A quick drawer opens with their details already filled in from their registration (name, birthdate, guardian, and the family&apos;s note) — add an optional number, position, and jersey size.</p>
              <p>If your team already charges dues, their <strong>standard fee schedule is pre-filled</strong> and editable — that&apos;s whatever your roster is already paying, or, if you haven&apos;t set dues yet, your budget&apos;s per-player figure (net of any expected funding you&apos;ve budgeted). Leave it on to set them up with fees, or flip it off to add them now and set fees later. Confirm and they land on your roster in one step (the player and their fees are saved together — nothing half-finishes).</p>
              <HelpNote variant="info" title="Recording, not charging">Fees only <strong>record what&apos;s owed</strong> — no card is charged. The &quot;Welcome to the Team&quot; email follows the same email switch — off means you welcome them yourself.</HelpNote>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-report',
          title: 'Your Tryout report, and what you can share',
          content: (
            <>
              <p>The <strong>Build team</strong> tab writes the story of your tryout as it happens: the path from signup to roster (with honest drop-off notes like &quot;3 never checked in&quot;), turnout compared to last season, where the incoming class is strong and thin by scorecard category, and a <strong>fairness receipt</strong> — a plain statement that players were scored by independent evaluators on one shared scorecard before names were revealed.</p>
              <p>If at least three verified returning candidates can be compared on the same scale, it also says how that group moved — <em>&quot;6 returning candidates improved +0.6 on average since their last tryout&quot;</em> — and below three it stays quiet rather than draw a conclusion from one or two players. The funnel row reads <strong>Offers extended</strong> because it counts every offer you ever made, including any you later took back; the Decide tab&apos;s tally counts who is offered <em>right now</em>, so the two can differ. It marks itself <strong>Final</strong> once every candidate has a decision.</p>
              <p><strong>Export</strong> gives you a <strong>Board summary (PDF)</strong> — totals and roster names only, safe to hand to your club board or a curious parent — and, behind a deliberate confirmation, a <strong>Full detail</strong> PDF or Excel of every candidate with scores and decisions, for coaching staff only. Full detail can&apos;t be exported while names are still hidden.</p>
            </>
          ),
        },
        {
          id: 'recipe-run-tryouts-development',
          title: 'Turning the tryout into each player’s starting point',
          content: (
            <>
              <p>Once you&apos;ve accepted anyone, a card under the report offers to turn the tryout you just ran into the start of their season. <strong>Begin</strong> walks you through your new players one at a time: their <strong>tryout snapshot</strong> on screen, and — for anyone who scored below the middle of your scale — up to <strong>two suggested focus areas</strong> taken from their weakest categories, weakest first.</p>
              <p>Each suggestion is a picker against your team&apos;s existing focus words: match one, deliberately create a new one, or answer <strong>Don&apos;t add</strong>. <strong>Nothing is saved without you</strong>, and <strong>Skip this player</strong> works at every step. A player nobody scored simply says so and lets you set their focus by hand. Ten minutes here and your development hub starts the season populated instead of empty.</p>
              <HelpNote variant="info" title="Set once a season">A baseline is set <strong>once per season and never overwritten</strong>, so re-opening the walkthrough skips anyone already done.</HelpNote>
            </>
          ),
        },
      ],
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
          answerText: 'On the decision board, Offer means you want the player on the team, Waitlist holds them as a backup, and Not this season passes on them. With the Email families my decisions switch on, each choice also emails the family — an offer with no-login Accept/Decline buttons good for 7 days, a waitlist note, or a warm not-this-time note; with it off (the default), decisions are just recorded and you deliver the news yourself. When a family accepts an emailed offer, you confirm with Accept → add to roster (with their fees) — the family response never rosters a player on its own.',
          keywords: ['waitlist', 'offer', 'not this season', 'cut', 'pass', 'decision', 'pick', 'accept', 'roster', 'email', 'accept decline', 'deadline'],
          answer: (
            <p>On the <strong>Decision board</strong>: <strong>Offer</strong> means you want the player on the team, <strong>Waitlist</strong> holds them as a backup, and <strong>Not this season</strong> passes. With <strong>Email families my decisions</strong> switched on, each choice also emails the family — an offer with no-login <strong>Accept/Decline</strong> buttons (good for 7 days), a waitlist note, or a warm not-this-time note; with it off (the default), decisions are just recorded and you deliver the news yourself. When a family accepts an emailed offer, you confirm with <strong>Accept → add to roster</strong> (with their fees) — a family&apos;s response never rosters a player on its own.</p>
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
          answerText: 'Yes. On the Evaluators card, add a helper by name and you get a private scoring link to text or email them — no login and no app. The link works for 48 hours (their scoring page shows until when) and you can turn it off any time — you are asked to confirm first. If they lose the link, it expires mid-tryout, or your tryout spans two weekends, use New link on their row: a fresh link for the same helper that keeps all their scores. While Blind evaluation is on they only see bib numbers, not names.',
          keywords: ['evaluators', 'evaluator', 'assistant', 'helper', 'scoring link', 'no login', 'no account', 'score', 'invite', 'new link', 'lost link', 'expired link', 'reissue', 'fresh link', 'turn off link'],
          answer: (
            <>
              <p>Yes. On the <strong>Evaluators</strong> card, add a helper by name and you get a <strong>private scoring link</strong> to text or email them — no login and no app. The link works for <strong>48 hours</strong> (their scoring page shows until when) and you can turn it off any time — you&apos;re asked to confirm first.</p>
              <p>Lost link, expired mid-tryout, or a tryout that spans two weekends? Tap <strong>New link</strong> on their row — a fresh link for the <strong>same helper</strong> that <strong>keeps all their scores</strong>. Never add them as a second evaluator; that would count their opinion twice on the scoreboard.</p>
              <p>They rate players on your scorecard from their own phone, and their scores flow into your <strong>Live scoreboard</strong>. While Blind evaluation is on they only see <strong>bib numbers</strong>, not names.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-emails',
          question: 'Do families get emailed when I make my picks?',
          answerText: 'Only if you want them to. The Email families my decisions switch on the Decide tab is off by default — decisions are just recorded and you reach out yourself. Switch it on and each choice emails the family right away: an offer with no-login Accept/Decline buttons, a waitlist update, or a respectful release note on Not this season (that one asks you to confirm first, because an email cannot be unsent). With the switch off you can still send just one family the offer email with Email this offer on their row. A family with no email on file is flagged so you know to phone them. The Welcome to the Team email on accept follows the same switch.',
          popular: true,
          keywords: ['email', 'emails', 'families', 'notify', 'notification', 'switch', 'off by default', 'record only', 'email this offer', 'decline email', 'release note', 'welcome email', 'no email on file'],
          answer: (
            <>
              <p>Only if you want them to. <strong>Email families my decisions</strong> — the switch right above the decision buttons — is <strong>off by default</strong>: decisions are just recorded on your board, and you deliver the news your way.</p>
              <p>Switch it on and each choice emails the family right away: an <strong>Offer</strong> with no-login Accept/Decline buttons, a <strong>Waitlist</strong> update, or a respectful release note on <strong>Not this season</strong> — that one asks you to confirm first, because an email can&apos;t be unsent. With it off, <strong>✉ Email this offer</strong> on any offered row sends just that family the self-serve link.</p>
              <p>A family with <strong>no email on file</strong> (a walk-up, usually) is flagged on their row so you know to phone. The &quot;Welcome to the Team&quot; email on accept follows the same switch.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-report-share',
          question: 'Can I share tryout results with my club board or parents?',
          answerText: 'Yes — the safe way is built in. On the Build team tab, the Tryout report shows your funnel from signup to roster, turnout vs last season, where the incoming class is strong and thin, and a fairness receipt stating players were scored by independent evaluators on one shared scorecard before names were revealed. Export gives you a Board summary PDF with totals and roster names only — no child’s scores or cut decisions — which is the version to share. A Full detail export (every candidate with scores and decisions, PDF or Excel) exists for coaching staff only, behind a confirmation, and cannot be exported while blind evaluation is still on. Evaluation scores never appear on any family-facing screen.',
          popular: true,
          keywords: ['tryout report', 'board summary', 'share', 'board', 'parents', 'export', 'pdf', 'excel', 'full detail', 'fairness receipt', 'funnel', 'turnout', 'class profile', 'privacy', 'scores'],
          answer: (
            <>
              <p>Yes — the safe way is built in. On the <strong>Build team</strong> tab, the <strong>Tryout report</strong> shows your funnel from signup to roster, turnout vs last season, where the incoming class is strong and thin, and a <strong>fairness receipt</strong> — a plain statement that players were scored by independent evaluators on one shared scorecard before names were revealed.</p>
              <p><strong>Export</strong> gives you a <strong>Board summary (PDF)</strong> with totals and roster names only — no child&apos;s scores or cut decisions — which is the version to share. A <strong>Full detail</strong> export (every candidate with scores and decisions, PDF or Excel) exists for coaching staff only, behind a confirmation, and can&apos;t be exported while blind evaluation is still on.</p>
              <p>Evaluation scores never appear on any family-facing screen — that&apos;s a hard rule, not a setting.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-candidate-memory',
          question: 'Can I see how a returning player did at last year’s tryout?',
          answerText: 'Yes, once you have confirmed it is the same child. On the Decide tab a candidate who looks like someone from a past season shows Possible returning player — verify. Open it, compare the details, and confirm. Their row then shows a memory strip: last season’s tryout score and what you decided then, beside this season’s score. If both tryouts used the same scale you also see the change, like plus 0.7, and Compare categories opens it skill by skill on the categories the two scorecards share. If the scales were different — say 1 to 10 last year and 1 to 5 this year — both are shown side by side with no arithmetic, because subtracting them would be meaningless. A suggested match you have not verified shows no scores at all, and nothing from a past season appears anywhere while blind evaluation is still on: not on the scorer, not on the live scoreboard, not at check-in. Prior scores are yours alone — they never reach families. If you were not granted tryouts access for that past season, you will not see its scores now either.',
          keywords: ['returning player', 'last year', 'last season', 'previous tryout', 'memory strip', 'year over year', 'came back', 'cut last year', 'improved', 'delta', 'compare categories', 'verify returning player', 'possible returning player', 'prior season score', 'history', 'different scorecards', 'different scale'],
          answer: (
            <>
              <p>Yes — once you&apos;ve confirmed it&apos;s the same child. On the <strong>Decide</strong> tab, a candidate who looks like someone from a past season shows <strong>Possible returning player — verify</strong>. Open it, compare the details, and confirm.</p>
              <p>Their row then gains a <strong>memory strip</strong>: last season&apos;s tryout score and what you decided then, beside this season&apos;s score. It&apos;s the honest version of a coach&apos;s gut feeling — the kid you passed on last year who put in the work is right there in front of you at the moment you&apos;re deciding.</p>
              <p>If both tryouts used the <strong>same scale</strong>, you also get the change (<strong>▲ +0.7</strong>), and <strong>Compare categories</strong> opens it skill by skill — only on the categories the two scorecards actually share. If the scales differed — say 1–10 last year and 1–5 this year — both are shown <strong>side by side with no arithmetic</strong>. Subtracting them would produce a confident-looking number that means nothing.</p>
              <p>Three things it deliberately won&apos;t do: a <strong>suggested</strong> match you haven&apos;t verified shows <strong>no scores at all</strong>; nothing from a past season appears anywhere while <strong>blind evaluation</strong> is still on — not on the scorer, not on the live scoreboard, not at check-in; and prior scores <strong>never reach families</strong>, exactly like this year&apos;s. If you weren&apos;t granted tryouts access for that past season, you won&apos;t see its scores now either.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-development-baseline',
          question: 'What does “Start development from tryouts” do?',
          answerText: 'It turns the tryout you just ran into the starting point of each new player’s season, so your development hub is not empty in week one. On the Build team tab, once you have accepted anyone, press Begin and you walk your new players one at a time. For each one you see their tryout snapshot, and — for anyone who scored below the middle of your scale — up to two suggested focus areas taken from their weakest categories, weakest first. Every suggestion is a picker against your team’s existing focus words: match one, deliberately create a new one, or answer Don’t add, which is a complete answer. Nothing is written without you confirming it, and no focus word is ever created silently. Skip this player works at every step, and a player nobody scored says so and lets you set their focus by hand rather than blocking. A baseline is set once per season and never overwritten, so re-opening the walkthrough skips anyone already done; if a scorecard or a score changes later it never rewrites a baseline you already chose focus areas from. Afterwards the snapshot sits on that player’s development page as a Tryout snapshot card.',
          popular: true,
          keywords: ['start development from tryouts', 'development baseline', 'baseline', 'seed development', 'tryout snapshot', 'suggested focus', 'what to work on first', 'begin', 'skip this player', 'don’t add', 'dont add', 'focus areas from tryouts', 'new players development'],
          answer: (
            <>
              <p>It turns the tryout you just ran into the <strong>starting point of each new player&apos;s season</strong>, so your development hub isn&apos;t empty in week one. On the <strong>Build team</strong> tab, once you&apos;ve accepted anyone, press <strong>Begin</strong> and you walk your new players one at a time.</p>
              <p>For each player you see their <strong>tryout snapshot</strong>, and — for anyone who scored below the middle of your scale — up to <strong>two suggested focus areas</strong> from their weakest categories, weakest first. Every suggestion is a picker against your team&apos;s existing focus words: match one, deliberately create a new one, or answer <strong>Don&apos;t add</strong>, which is a complete answer. Nothing is written without you, and no focus word is ever created silently.</p>
              <p><strong>Skip this player</strong> works at every step, and a player nobody scored says so and lets you set their focus by hand rather than blocking. A baseline is set <strong>once per season and never overwritten</strong> — re-opening the walkthrough skips anyone already done, and a later scorecard or score change never rewrites a baseline you already chose focus areas from.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-score-yourself',
          question: 'How do I score players myself?',
          answerText: 'Tap Score players on the Tryout day tab. You get the same field scorecard evaluators use — big tap targets, works one-handed — signed in as you, so there is no link to lose and nothing expires. Checked-in players are listed first. Your scores count like anyone else’s and show on the scoreboard marked (you).',
          keywords: ['score', 'score players', 'score myself', 'score yourself', 'rate players', 'head coach scoring', 'signed in'],
          answer: (
            <p>Tap <strong>Score players</strong> on the <strong>Tryout day</strong> tab. You get the same field scorecard evaluators use — big tap targets, works one-handed — <strong>signed in as you</strong>, so there&apos;s no link to lose and nothing expires. Checked-in players are listed first. Your scores count like anyone else&apos;s and show on the scoreboard marked <strong>(you)</strong>.</p>
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
      keywords: ['fees', 'team fees', 'dues', 'charge everyone', 'one player', 'mark paid', 'payment tracking', 'players still owe', 'unpaid count'],
      searchText: 'fees team fees dues charge everyone all players one player bulk mark paid unpaid owed payment tracking ledger no online payment collection installments reminders budget premium haven\'t paid anything yet who hasn\'t paid never paid chase unpaid list remind remind all send reminder nudge families first payment generate installments from budget plan automatic dues reminders toggle 30 day 7 day players still owe reminders to send by hand unpaid count different numbers counts people not fees why do the numbers differ two numbers unpaid fees across players',
      content: (
        <>
          <p>Turn on <strong>Fees</strong> from Explore. Fees is a simple way to track who has paid — it records what each player owes and what they&apos;ve paid; it does not collect money online.</p>
          <ol>
            <li>To add a fee, choose a scope: <strong>Everyone</strong> charges every player on your roster the same amount in one step, or <strong>One player</strong> charges a single player.</li>
            <li>Give the fee a label (for example, &quot;Spring registration&quot;) and an amount.</li>
            <li>As money comes in, click <strong>Mark paid</strong> on each fee. You can mark it back to unpaid if needed.</li>
          </ol>
          <p>The summary at the top shows totals for <strong>Owed</strong>, <strong>Paid</strong>, and <strong>Unpaid</strong> so you can see at a glance where collection stands.</p>
          <p><strong>Premium Coaches Portal adds:</strong> installment schedules with due dates per player — build a <strong>Season Budget Plan</strong> and <strong>Generate installments</strong> creates every player&apos;s schedule in one click — automatic overdue reminder emails (the <strong>Automatic Dues Reminders</strong> switch lives under <strong>Team settings → Money</strong>), a line at the top of Player Dues telling you how many families still owe — with <strong>Remind all</strong> to nudge them in one go — and a season budget that tracks fees, expenses, and fundraiser credits.</p>
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
          id: 'faq-fees-two-counts',
          question: 'Why does my Fees page show two different unpaid numbers?',
          answerText: 'Because they count different things, and both are right. The count beside the Fees heading counts unpaid FEES — every individual charge still outstanding. Once five or more people still owe you, a line lower down counts PEOPLE instead, because that is the number of families you actually have to chase: "9 players still owe — that is 9 reminders to send by hand." If one player is carrying more than one unpaid fee the two numbers will not match, and in that case the line spells out both, for example "12 unpaid fees across 9 players". The people line only appears once five or more players owe — with a couple of stragglers there is nothing worth pointing out.',
          keywords: ['two numbers', 'unpaid count', 'numbers do not match', 'players still owe', 'reminders to send by hand', 'why different', 'unpaid fees across players'],
          answer: (
            <>
              <p>Because they count different things, and both are right. The count beside the <strong>Fees</strong> heading counts unpaid <strong>fees</strong> — every individual charge still outstanding.</p>
              <p>Once five or more people still owe you, a line lower down counts <strong>people</strong> instead, because that&apos;s the number of families you actually have to chase: <em>&ldquo;9 players still owe — that&rsquo;s 9 reminders to send by hand.&rdquo;</em> If one player is carrying more than one unpaid fee the two numbers won&rsquo;t match, and the line spells out both — for example <em>&ldquo;12 unpaid fees across 9 players&rdquo;</em>.</p>
              <p>That line only appears once <strong>five or more</strong> players owe. With a couple of stragglers there&rsquo;s nothing worth pointing out.</p>
            </>
          ),
        },
        {
          id: 'faq-who-hasnt-paid',
          question: "How do I see who hasn't paid anything and remind them?",
          answerText: "In the Premium Coaches Portal, open Money then Player Dues. A line at the top tells you how many families still owe, and Remind all nudges every one of them in a single step. To chase one family, open that player from the table and use Remind in their panel. A family with ANY recorded payment — even a partial one — never appears in this list and never gets the paid-nothing nudge; reminders for them quote only what's left on an installment and thank them for what's arrived. That line only turns amber once someone is actually past their due date — before then it stays quiet and tells you when the first payment is due, so it isn't warning you about families who simply aren't late yet. The count always matches the unpaid number on your Overview. Sending reminders needs money-write access.",
          keywords: ["who hasn't paid", 'unpaid list', 'remind', 'remind all', 'chase dues', 'never paid', "haven't paid anything", 'nudge', 'partial payment reminder', 'reminder amount wrong'],
          answer: (
            <>
              <p>In the Premium Coaches Portal, open <strong>Money → Player Dues</strong>. A line at the top tells you how many families still owe, and <strong>Remind all</strong> nudges every one of them in a single step. To chase <em>one</em> family, open that player from the table and use <strong>Remind</strong> in their panel.</p>
              <p>A family with <strong>any recorded payment</strong> — even a partial one — never appears in this list and never gets the paid-nothing nudge. Reminders for them quote only <strong>what&apos;s left</strong> on an installment and thank them for what&apos;s arrived.</p>
              <p>That line only turns <strong>amber</strong> once someone is genuinely <strong>past their due date</strong>. Before then it stays quiet and tells you when the first payment is due — so it isn&rsquo;t warning you about families who simply haven&rsquo;t paid early. The count always matches the <strong>unpaid</strong> number on your Overview. Sending reminders needs money-write access.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-announcements',
      group: 'Your team tools',
      heading: 'How to message your team',
      summary: 'Email every parent with a contact email on your roster in one send.',
      // Search matches KEYWORDS, never body text — so the premium door's new name has to be listed
      // here explicitly or a coach who reads "Email families" in their nav can never find this page.
      // The old term stays: the FREE portal's door is still called Announcements, and premium
      // coaches have been reading that word since launch.
      keywords: ['announcements', 'email families', 'email parents', 'email my families', 'message team', 'send announcement', 'contact parents', 'reuse announcement', 'resend', 'confirm send', 'where is announcements', 'announcements renamed', 'announcements gone', 'cant find announcements', 'email everyone', 'unsubscribe', 'unsubscribed', 'opted out', 'opt out', 'family unsubscribed', 'not receiving emails', 'fewer families',
        // Chunk D Slice 3 — the postgame draft. A coach who saw the button on the Schedule
        // searches for the words ON the button, so they have to be listed here.
        'draft the family email', 'draft family email', 'draft email', 'postgame email',
        'post game email', 'after the game email', 'score email', 'result email',
        'email after a game', 'tell families the score', 'write the email for me', 'pre-written'],
      searchText: 'announcements email families email parents message whole team send announcement subject body recipients contact email roster missing email recent announcements log delivery premium confirm before sending irreversible cannot unsend reuse resend duplicate past announcement send again recipient count updates automatically no refresh unsaved changes draft warning read full message expand renamed email families premium nav door where did announcements go different from chat one way email audience families unsubscribe link footer family opted out casl count not names cannot re-subscribe them why did my recipient count drop draft the family email postgame draft after saving a final score result and next event pre-written nothing sends by itself you edit and press send never auto sends skipping it is fine',
      content: (
        <>
          <p>Turn on <strong>Announcements</strong> from Explore to email your whole team at once.</p>
          <HelpSteps>
            <li>Write a <strong>subject</strong> and your <strong>message</strong>.</li>
            <li>The recipient count shows how many parents will get it — everyone on your Roster who has a contact email.</li>
            <li>Click <strong>Send announcement</strong>.</li>
          </HelpSteps>
          <p>If a player has no contact email, the page warns you and won&apos;t reach them — add an email on your Roster to include them. Every send is saved to a <strong>Recent announcements</strong> log showing whether it sent fully, partly, or failed.</p>
        </>
      ),
      subtopics: [
        {
          id: 'announce-premium',
          title: 'What Premium adds, and why it’s called Email families',
          content: (
            <>
              <p><strong>Premium Coaches Portal adds:</strong> a quick <strong>confirm</strong> before an announcement emails families (it can&apos;t be unsent), a recipient count that <strong>updates on its own</strong> as you add contacts, the ability to reopen a past announcement to <strong>read it in full and reuse it</strong>, and automatic dues and event reminders.</p>
              <p><strong>In the Premium portal this is called &ldquo;Email families&rdquo;</strong> — same screen, clearer name. It sits next to <strong>Chat</strong> in your menu and the two do different jobs: Email families is a <strong>one-way email out to parents</strong>; Chat is a <strong>conversation</strong> with your own coaching staff, and with the organizer and other coaches while a tournament is running.</p>
            </>
          ),
        },
        {
          id: 'announce-unsubscribe',
          title: 'Families can unsubscribe',
          content: (
            <p>Every email you send carries an unsubscribe link, and we honour it on every send afterwards. If anyone has opted out you&apos;ll see it as a count beside your recipient number — you see <em>how many</em>, never <em>which families</em>, because that is the point of an opt-out. A family who has opted out can only be reached by talking to them directly.</p>
          ),
        },
        {
          id: 'announce-after-game',
          title: 'The after-the-game email, written for you',
          content: (
            <>
              <p>When you save a <strong>final score</strong> on the Schedule, a <strong>Draft the family email</strong> line appears under it. One tap opens this screen with the subject and message already written — the result, and what&apos;s next on your calendar. Change any of it, or delete it and write your own.</p>
              <HelpNote variant="info" title="Nothing sends by itself">
                <p>The draft just puts words in the box; it still takes your <strong>Send</strong> like any other message, and a note at the top of the compose box says so. If you never use it, nothing is missing — families are never told an after-game email is coming, so one you skip isn&apos;t one they notice.</p>
              </HelpNote>
            </>
          ),
        },
      ],
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
          id: 'faq-announcement-unsubscribed',
          question: 'Why is my recipient count lower than my roster?',
          answerText: 'Three reasons. A player with no contact email on the Roster is not reachable — add one to include them. An address that is not a valid email is skipped. And a family who has unsubscribed is excluded from every send afterwards; you will see that as a count beside your recipient number. You see how many families opted out, never which ones, so if you need to reach them it has to be a direct conversation. You cannot re-subscribe someone on their behalf.',
          keywords: ['recipient count', 'lower', 'fewer', 'unsubscribed', 'opted out', 'not receiving', 'missing families', 'why fewer'],
          answer: (
            <>
              <p>Three reasons, in the order they are most likely:</p>
              <ul>
                <li>A player has <strong>no contact email</strong> on the Roster — add one to include them.</li>
                <li>An address on file <strong>isn&apos;t a valid email</strong>, so it is skipped.</li>
                <li>A family has <strong>unsubscribed</strong>, and is left out of every send afterwards.</li>
              </ul>
              <p>You see <em>how many</em> families opted out, never <em>which</em> ones — so if you need to reach them, that has to be a direct conversation. You can&apos;t re-subscribe someone on their behalf.</p>
            </>
          ),
        },
        {
          id: 'faq-postgame-draft',
          question: 'What is “Draft the family email” after a game?',
          answerText: 'Save a final score on a game in your Schedule and a Draft the family email line appears under the score. Tapping it opens Email families with the subject and message already written — the result, plus the next thing on your calendar. You edit it and press Send yourself; nothing is ever sent automatically, and a note on the compose box says so. It appears only on games with a score, never on a cancelled game, never in a finished season, and only if you are allowed to send announcements. Skipping it costs nothing — families are never promised an after-game email, so one you do not send is not one they miss.',
          keywords: ['draft the family email', 'draft family email', 'postgame email', 'post game email', 'after the game', 'score email', 'result email', 'auto send', 'does it send automatically', 'pre-written email', 'where did this email come from'],
          popular: true,
          answer: (
            <>
              <p>Save a <strong>final score</strong> on a game in your Schedule and a <strong>Draft the family email</strong> line appears under it. Tapping it opens <strong>Email families</strong> with the subject and message already written — the result, plus the next thing on your calendar.</p>
              <p><strong>It never sends on its own.</strong> You edit it and press <strong>Send</strong> yourself, exactly like any other message, and a note on the compose box says where the words came from.</p>
              <p>You&apos;ll see it only on a game that has a score — never on a cancelled game, never in a finished season, and only if you&apos;re allowed to send announcements. <strong>Skipping it costs nothing:</strong> families are never told an after-game email is coming.</p>
            </>
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
      summary: 'Every tournament you’ve entered — and how each record reads: Status & Payment, Schedule, Your Team, From the Organizer.',
      keywords: ['tournaments', 'registration', 'tournament records', 'status & payment', 'schedule', 'your team', 'from the organizer', 'zones', 'accepted', 'payment', 'how to pay', 'entry fee', 'live', 'premium tournaments', 'score alerts', 'get alerts', 'highlight my team', 'fan view', 'flip', 'public site pill', 'final record', 'after the tournament', 'event complete', 'share your team', 'final standings', 'standalone team', 'org-owned team', 'ask your org admin', 'link registration', 'discover', 'browse public tournaments', 'nothing yet', 'help button', 'question mark', 'schedule change', 'schedule updated', 'game moved', 'game cancelled', 'field changed', 'event news', 'schedule alerts', 'was 2:00'],
      searchText: 'tournaments tournament records registrations status schedule history across organizations bracket standings my registrations accepted four zones sections status and payment your registration your games roster and coach news and resources from the organizer your team zone quick jump row jump links hop between sections what happens next checklist gone payment how to pay entry fee deposit due date instructions pay the organizer e-transfer schedule published announcements rules tournament home resource links premium tournaments sidebar section live status today scores full record inside portal never leave free portal score alerts own team push notification get alerts for your team highlight my team automatic pin public schedule scorebug fan view public site flip pill top right corner coaches portal back to coach view same tab after the tournament ends event over event complete final record won lost tied wins losses ties result card view final standings share your team share result what happens after my tournament wrap up standalone team register anywhere same account email appears automatically org-owned rep team organization links a registration to your team ask your org admin nothing here yet registered but nothing yet why do not my tournaments show up browse public tournaments discover public tournament directory find a tournament to enter question mark help button page header in-context help open this guide schedule change game moved my game moved organizer moved my game game time changed game cancelled cancelled game field changed diamond changed venue changed schedule updated amber bar was 2:00 pm at diamond 2 notified when the schedule changes alert when a game moves rain delay notification event news switch followed teams card account notifications no separate schedule switch one message not one per game batched few minutes imminent game sent straight away already played no alert free event does not send phone alerts knowing is free push is the paid part families get the same message parents told automatically already following your own team',
      content: (
        <>
          <p>The <strong>Tournaments</strong> section lists every tournament you&apos;ve registered the team for — across any organization — with its registration status and schedule. Open a tournament record to see where your team stands and when it plays: the organizer running that tournament controls its schedule, brackets, and standings, and your portal shows you the live view.</p>
          <p><strong>On Premium Coaches Portal</strong>, Tournaments is its own item in your sidebar: a list of your events with live status — an event that&apos;s underway shows <strong>Live</strong> or <strong>Today</strong>, otherwise it shows where your registration stands. Open one and the <strong>full record opens right inside your Premium portal</strong>, live schedule and scores included. You don&apos;t leave your portal to follow a tournament, and the tournament experience is identical on both tiers: Premium adds season tools, not a different event day. A <strong>?</strong> help button in the page header opens this guide right where you&apos;re looking.</p>
        </>
      ),
      subtopics: [
        {
          id: 'tournament-records-appear',
          title: 'How a tournament gets into this list',
          content: (
            <>
              <p>It depends on how your team is set up:</p>
              <HelpDefs>
                <HelpDef term="A standalone team">Registers directly on any organization&apos;s public tournament page — enter with the same account email you sign in with, and it appears here on its own, no linking step needed. While the list is empty, a <strong>Browse public tournaments</strong> link takes you to the platform&apos;s public tournament directory (<strong>/discover</strong>) to find one to enter.</HelpDef>
                <HelpDef term="An org-owned team">Entries show up once your organization registers the team for an event and links that registration to it. If you know your team is in a tournament but it isn&apos;t listed here yet, ask your org admin to link it rather than trying to add it yourself.</HelpDef>
              </HelpDefs>
              <p>Either way, if you&apos;ve registered and still see nothing, the record just hasn&apos;t arrived yet — it appears as soon as the organizer processes your entry.</p>
            </>
          ),
        },
        {
          id: 'tournament-records-sections',
          title: 'The four sections, always in this order',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Status &amp; Payment">Where your registration stands, and the money in one place: the entry fee, its due date, the organizer&apos;s <strong>How to pay</strong> instructions, and one contact address if you have a question. While you&apos;re still awaiting a decision it shows a fee preview instead, so you know the cost before you&apos;re committed.</HelpDef>
                <HelpDef term="Schedule">Your team&apos;s games. Before the organizer publishes, it says so; on game day it turns into your live schedule with scores.</HelpDef>
                <HelpDef term="Your Team">Your roster submission, your head-coach contact details, and the facts of your entry (division, when you registered) together in one card.</HelpDef>
                <HelpDef term="From the Organizer">Their announcements, plus quick links to the tournament&apos;s public home, schedule, and rules.</HelpDef>
              </HelpDefs>
              <p>In the free portal on a phone, a small row of <strong>jump links</strong> sits just under the tabs so you can hop straight to any of the four without scrolling. The record adapts as your event progresses — an accepted team picks up roster status, your check-in state appears once the event starts, and game day leads with your next game — but the four sections stay put, so what you learned before the event still applies during it. (A team the organizer couldn&apos;t fit in keeps a shorter record: your status and a note from the organizer.)</p>
              <p>Everything you need is stated <strong>once</strong>: the fee only in Status &amp; Payment, your games only in Schedule. Your games appear automatically once the organizer publishes the schedule; you don&apos;t have to dig back through your acceptance email for payment details.</p>
            </>
          ),
        },
        {
          id: 'tournament-records-changes',
          title: 'If the organizer moves or cancels one of your games',
          content: (
            <>
              <p>Two things happen, and you don&apos;t set up either one:</p>
              <HelpDefs>
                <HelpDef term="In the app, on every plan">While your event is under way, your Schedule raises an amber <strong>Schedule updated</strong> bar naming what changed — &ldquo;Your 2:00 p.m. vs Northside Thunder moved to 3:15 p.m. at Diamond 4&rdquo; — and the affected game keeps a <strong>was 2:00 p.m. at Diamond 2</strong> line underneath it. Tap the bar to dismiss it; the line on the game stays, because that&apos;s the bit you&apos;ll want to check twice. If more than one game changed, the bar gives you the count and marks the rows.</HelpDef>
                <HelpDef term="On your phone (Tournament Plus events)">A notification names the change the same way. Several changes in one sitting arrive as <strong>one</strong> message with a count rather than a string of buzzes, and a cancellation is always called out. Tapping it opens that game.</HelpDef>
              </HelpDefs>
              <p>You don&apos;t have to follow your own team to get this — <strong>coaches are followed to their own team automatically</strong>, from the moment the organizer accepts your entry. That means you&apos;re covered for the run-up too, when schedules are published and times get shuffled, not just on game day. The switch that controls it is <strong>Event news</strong> under <strong>Account → Notifications</strong> (on the <strong>Followed teams</strong> card, where your own team is named), and it&apos;s on unless you turn it off. There is no separate schedule-alerts switch to find.</p>
              <HelpNote variant="info" title="Knowing your game moved is never the paid part">
                <p>On a free event, nothing buzzes your phone — phone alerts are a Tournament Plus feature the organizer chooses. The change still reaches you: your Schedule updates, and the <strong>Schedule updated</strong> bar still appears during the event.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'tournament-records-after',
          title: 'Once the event is over',
          content: (
            <p>The top of the record becomes a single result card: <strong>Event complete</strong> with the tournament dates, your <strong>final record</strong> (wins&ndash;losses&ndash;ties from the games that were scored), a link to the <strong>final standings</strong> on the public site, and a <strong>Share your team</strong> button that sends a link anyone can open. If no scores were recorded for your team, it says so rather than showing a made-up 0&ndash;0. The four sections stay exactly where they were, so you can still look back at what you paid, who you played, and what the organizer told you. This is the same on both tiers.</p>
          ),
        },
        {
          id: 'tournament-records-flip',
          title: 'Hopping to the public site (and back)',
          content: (
            <p>Every tournament record carries a <strong>⇄ Public site</strong> pill in its top-right corner — one tap flips to that event&apos;s public site in the same tab, and the public page&apos;s own pill then reads <strong>⇄ Coaches Portal</strong> so the return trip is one tap too. <strong>If you also help run this event</strong> — you&apos;re on the organizer&apos;s staff, or you scorekeep — that pill reads <strong>Roles</strong> instead and opens a short list: the public site, plus a row for each of your other roles on this event. One tap takes you straight to your admin screens without going out through the public site first. If you only coach, nothing changes. A quiet <strong>⇄ Fan view</strong> link on each list entry (and on your team Overview while an event is live) makes the same jump to the event&apos;s public site.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-coach-own-team-alerts',
          question: 'How do I get score alerts for my own team?',
          answerText: 'The same way families do — on the tournament’s public site. Use the ⇄ Fan view link (or the ⇄ pill on your tournament record) to open the event, follow your team there — the follow strip under the event header or the Teams tab — and turn on score alerts when prompted: a push when your team’s game goes live and a Final when it ends (offered on Tournament Plus events and above). Manage alerts anytime under Account → Notifications, where Game alerts covers scores and Event news covers schedule changes, cancellations and announcements. Schedule changes are separate and need no setup at all — see "Will I know if the organizer moves or cancels one of my games?". Highlighting is a separate thing again and there is no button for it any more: once your event is under way your own team is pinned front-and-centre on the public schedule and scorebug for you automatically, on the device you are using. It is only a visual pin — it does not send alerts — and if you deliberately un-star your team on the public site it stays un-starred.',
          keywords: ['score alerts', 'own team alerts', 'get alerts for your team', 'coach alerts', 'push notification', 'highlight my team', 'highlight button gone', 'pin team', 'follow team', 'star my team', 'game alerts', 'event news', 'two switches', 'which switch'],
          popular: true,
          answer: (
            <>
              <p>The same way families do — on the tournament&apos;s <strong>public site</strong>. Use the <strong>⇄ Fan view</strong> link (or the ⇄ pill on your tournament record) to open the event, <strong>follow your team</strong> there — the follow strip under the event header or the <strong>Teams</strong> tab — and turn on <strong>score alerts</strong> when prompted: a push when your team&apos;s game goes live and a &ldquo;Final&rdquo; when it ends. (Alerts are offered on Tournament Plus events and above.) Manage them anytime under <strong>Account → Notifications</strong>, where <strong>Game alerts</strong> covers scores and <strong>Event news</strong> covers schedule changes, cancellations and announcements.</p>
              <p><strong>Schedule changes need no setup at all</strong> — you&apos;re already covered for those. See <em>&ldquo;Will I know if the organizer moves or cancels one of my games?&rdquo;</em> below.</p>
              <p><strong>Highlighting is a different thing, and there&apos;s no button for it any more.</strong> Once your event is under way, your own team is pinned front-and-centre on the public schedule and scorebug for you <em>automatically</em>, on the device you&apos;re using. It&apos;s only a visual pin — it does <strong>not</strong> send alerts — and if you deliberately un-star your team on the public site, it stays un-starred.</p>
            </>
          ),
        },
        {
          id: 'faq-schedule-change-alert',
          question: 'Will I know if the organizer moves or cancels one of my games?',
          answerText: 'Yes, and you do not have to set anything up. In the app, on every plan: while your event is under way your Schedule raises an amber "Schedule updated" bar naming the change — "Your 2:00 p.m. vs Northside Thunder moved to 3:15 p.m. at Diamond 4" — and the affected game keeps a "was 2:00 p.m. at Diamond 2" line underneath. Tapping the bar dismisses it; the line on the game stays. On your phone, when the organizer’s event is on Tournament Plus, you also get a notification saying the same thing, and tapping it opens that game. Several changes made in one sitting arrive as ONE message with a count, not one buzz per game, and a cancellation is always called out. Messages are held for a few minutes so a busy editing session does not buzz you repeatedly, but a change to a game starting shortly is sent straight away. A game that has already started or already been played never triggers an alert. You do not need to follow your own team first — coaches are followed to their own team automatically, from the moment the organizer accepts your entry, so you are covered during the run-up (when schedules are published and times shuffle) as well as on game day. The switch is Event news under Account → Notifications on the Followed teams card, which names your own team and the event (also in the bell on the tournament’s public site), and it is on unless you turn it off; there is no separate schedule-alerts switch. On a free event nothing buzzes your phone — phone alerts are a Tournament Plus feature the organizer chooses — but the schedule still updates and the Schedule updated bar still appears. Knowing your game moved is never the paid part. Families following your team get the same message you do.',
          keywords: ['schedule change', 'game moved', 'game time changed', 'game cancelled', 'cancelled game', 'schedule updated', 'schedule updated bar', 'moved to', 'field changed', 'diamond changed', 'venue changed', 'notified of schedule change', 'alert when game moves', 'rain delay alert', 'event news', 'schedule alerts', 'was 2:00', 'how do i know if my game moved', 'why did i not get a notification', 'no notification', 'free event no alerts', 'one message not many', 'parents notified', 'followed automatically', 'why am i following my own team', 'do i have to follow my own team', 'when do alerts start', 'before the tournament', 'run-up', 'accepted entry', 'my own team on the notifications page'],
          popular: true,
          answer: (
            <>
              <p>Yes — and there&apos;s nothing to set up.</p>
              <p><strong>In the app, on every plan.</strong> While your event is under way, your <strong>Schedule</strong> raises an amber <strong>Schedule updated</strong> bar naming the change, and the affected game keeps a <strong>was 2:00 p.m. at Diamond 2</strong> line underneath it. Tapping the bar dismisses it; the line on the game stays.</p>
              <p><strong>On your phone, when the organizer&apos;s event is on Tournament Plus.</strong> A notification says the same thing, and tapping it opens that game. Several changes made in one sitting arrive as <strong>one</strong> message with a count rather than one buzz per game, and a cancellation is always called out. Messages are held briefly so a busy editing session doesn&apos;t buzz you over and over — but a change to a game starting shortly goes straight through. A game that has already started or been played never triggers an alert.</p>
              <p>You don&apos;t need to follow your own team first — <strong>coaches are followed to their own team automatically</strong>, from the moment your entry is accepted, so you&apos;re covered through the run-up as well as game day. The switch is <strong>Event news</strong> under <strong>Account → Notifications</strong> (on the <strong>Followed teams</strong> card, which names your own team, and in the bell on the tournament&apos;s public site). It&apos;s on unless you turn it off, and there&apos;s no separate schedule-alerts switch.</p>
              <p><strong>On a free event nothing buzzes your phone</strong>, because phone alerts are a Tournament Plus feature the organizer chooses. Your schedule still updates and the bar still appears. <strong>Families following your team get the same message you do</strong>, so you don&apos;t have to relay it.</p>
            </>
          ),
        },
        {
          id: 'faq-premium-tournaments-where',
          question: 'Where are my tournaments in the Premium portal?',
          answerText: 'On Premium Coaches Portal, open the Tournaments item in your sidebar. It lists every tournament your team is entered in with live status (a live event shows Live or Today). Open one to see the full record inside your portal — the same four sections free coaches get: Status & Payment, Schedule, Your Team, and From the Organizer, with live scores on game day. You never get sent back to the free portal, and the tournament experience is the same on both tiers. What shows up here depends on how your team is set up. If your team is standalone, register on any organization’s public tournament page with this account’s email and it appears on this list automatically — while it’s empty, use the Browse public tournaments link to open /discover, the platform’s public tournament directory, and find one to enter. If your team belongs to an organization, entries appear once that organization registers the team and links the registration to it — ask your org admin to link it if a tournament you know about isn’t showing. Registered and still nothing here? The record hasn’t arrived yet; it lands as soon as the organizer processes your entry. A ? help button in the page header opens this guide without leaving the page.',
          keywords: ['premium tournaments', 'where tournaments', 'tournaments sidebar', 'live tournament', 'tournament record premium', 'same as free', 'standalone team', 'org-owned team', 'ask your org admin', 'link registration', 'discover', 'browse public tournaments', 'nothing here yet', 'registered but nothing', 'help button', 'question mark'],
          popular: true,
          answer: (
            <>
              <p>On <strong>Premium Coaches Portal</strong>, open the <strong>Tournaments</strong> item in your sidebar. It lists every tournament your team is entered in with live status (a live event shows <strong>Live</strong> or <strong>Today</strong>). Open one to see the full record inside your portal — the same four sections free coaches get (<strong>Status &amp; Payment</strong>, <strong>Schedule</strong>, <strong>Your Team</strong>, <strong>From the Organizer</strong>), with live scores on game day. You&apos;re never sent back to the free portal, and the tournament experience is the same on both tiers.</p>
              <p>What shows up here depends on how your team is set up:</p>
              <ul>
                <li><strong>Standalone team</strong> — register on any organization&apos;s public tournament page with this account&apos;s email, and the tournament appears on this list automatically, no linking step needed. While the list is empty, use the <strong>Browse public tournaments</strong> link to open <strong>/discover</strong>, the platform&apos;s public tournament directory, and find one to enter.</li>
                <li><strong>Org-owned team</strong> — entries appear once your organization registers the team for an event and links that registration to it. If a tournament you know about isn&apos;t listed, ask your org admin to link it — there&apos;s nothing to add yourself here.</li>
                <li><strong>Registered but nothing yet</strong> — the record hasn&apos;t arrived. It lands as soon as the organizer processes your entry.</li>
              </ul>
              <p>A <strong>?</strong> help button in the page header opens this guide without leaving the page.</p>
            </>
          ),
        },
        {
          id: 'faq-after-tournament-ends',
          question: 'What happens to my tournament record after the event is over?',
          answerText: 'It stays put — nothing is deleted and nothing is archived away. The top of the record turns into a result card: Event complete with the dates, your final record (wins-losses-ties from the games that were scored), a link to the final standings on the tournament’s public site, and a Share your team button that sends a link anyone can open, including families who do not have an account. If no scores were recorded for your team, the card says that instead of showing a false 0-0. All four sections stay exactly where they were, so you can still check what you paid, who you played, and what the organizer posted. Free coaches also see a short note underneath about what carries forward if you move to the Premium Coaches Portal — season history, playing time and awards — because on the free portal those live with the event rather than with your team. That note is the only place the portal mentions upgrading during a tournament: nothing is shown before or during your event, deliberately.',
          keywords: ['after the tournament', 'event over', 'tournament finished', 'final record', 'event complete', 'result card', 'share your team', 'final standings', 'what happens next', 'record deleted', 'archived', 'wrap up', 'season history'],
          popular: true,
          answer: (
            <>
              <p>It stays put — nothing is deleted or archived away. The top of the record turns into a <strong>result card</strong>: <strong>Event complete</strong> with the dates, your <strong>final record</strong> (wins&ndash;losses&ndash;ties from the games that were scored), a link to the <strong>final standings</strong> on the tournament&apos;s public site, and a <strong>Share your team</strong> button that sends a link anyone can open — including families without an account. If no scores were recorded for your team, the card says so rather than showing a false 0&ndash;0.</p>
              <p>All four sections stay exactly where they were, so you can still check what you paid, who you played, and what the organizer posted.</p>
              <p>On the free portal you&apos;ll also see a short note underneath about what carries forward if you move to the <strong>Premium Coaches Portal</strong> — season history, playing time and awards — because on the free portal those stay with the event rather than with your team. That note is the <em>only</em> place the portal mentions upgrading during a tournament: nothing is shown before or during your event, deliberately.</p>
            </>
          ),
        },
        {
          id: 'faq-pay-entry-fee',
          question: 'How do I pay the tournament entry fee?',
          answerText: 'You pay the organizer directly — there is no online payment through the portal. Open your tournament record and look at the first section, Status & Payment: it shows the amount owed and its due date, and if the organizer has written payment instructions they appear there under "How to pay" (they are in your acceptance email too). Follow those instructions; the organizer marks your fee paid once they receive it, and the same section then shows Paid. If no instructions are set, that section gives you the organizer’s contact address so you can arrange it.',
          keywords: ['pay entry fee', 'how to pay', 'payment instructions', 'tournament fee', 'deposit', 'e-transfer', 'status and payment', 'due date', 'where is the fee'],
          answer: (
            <>
              <p>You pay the organizer directly — there&apos;s no online payment through the portal. Open your tournament record and look at the first section, <strong>Status &amp; Payment</strong>: it shows the amount owed and its due date, and if the organizer has written payment instructions they appear there under <strong>How to pay</strong> (they&apos;re in your acceptance email too).</p>
              <p>Follow those instructions; the organizer marks your fee paid once they receive it, and that same section then shows <strong>Paid</strong>. If they haven&apos;t set instructions, the section gives you their contact address so you can arrange it.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-tournament-chat',
      group: 'Tournaments',
      heading: 'How to chat with your tournament organizer',
      summary: 'A live group chat with the organizer and the other coaches in each tournament you’re in.',
      keywords: ['chat', 'tournament chat', 'message organizer', 'group chat', 'unread', 'push notification', 'coach chat', 'rooms', 'division room', 'all coaches', 'channels', 'reply', 'quote', 'mention', '@mention', 'emoji', 'react', 'search', 'search messages', 'delete message', 'delete own message', 'message removed', 'read by', 'read receipt', 'pinned', 'pinned messages', 'last seen', 'chat tab', 'inbox', 'all my chats', 'back to your coaches portal', 'return to portal', 'report', 'report a message', 'report to organizers', 'mute room', 'mute this room', 'mute chat', 'unmute', 'long press', 'press and hold'],
      searchText: 'tournament chat group chat with organizer and other coaches live chat unread badge multiple rooms all coaches room division room channels switch rooms tournament name label side by side split view conversation list stays on screen desktop computer select a conversation two panes list beside conversation reply quote a message jump to original message push notification phone alert tap notification opens conversation no email last seen read receipts read by sent read by everyone join automatically muted closed read only free or paid mention @mention tag a coach mention reaches you even if muted emoji smiley react with emoji search recent messages magnifier delete your own message message removed pinned messages pin schedule field map rules banner jump to message see pinned only organizer can pin Chat tab in the app inbox all your tournament conversations in one place grouped by event back to tournament event chip return to event back to your coaches portal return bar get back to my portal lost my place no team chat card no chat on overview one chat door Event admin shortcut organizer chat controls report a message press and hold long press right click report to organizers goes privately to organizers mute this room mute a chat stop notifications quiet unmute personal you can still post',
      content: (
        <>
          <p>When an organizer runs a chat for a tournament your team is in, that conversation shows up on the <strong>Chat</strong> tab — alongside the organizer and the other coaches in that tournament. There&rsquo;s nothing to set up: you join automatically once you&rsquo;ve signed in with your team&rsquo;s email.</p>
        </>
      ),
      subtopics: [
        {
          id: 'tournament-chat-where',
          title: 'Where tournament chat lives',
          content: (
            <>
              <p>Every tournament you&rsquo;re in is gathered in one <strong>inbox</strong> on the Chat tab, grouped by event, with an <strong>unread badge</strong> on new messages. <strong>The Chat tab is the one place chat lives</strong> — there&rsquo;s no separate chat section inside your team. (On <strong>Premium Coaches Portal</strong>, Chat is also an item in your sidebar.) Open a conversation to read and reply in real time.</p>
              <p>On a <strong>computer</strong>, your conversation list stays <strong>beside</strong> the open conversation — like any desktop messaging app — so switching rooms is one click, and until you pick one the right side reads <em>Select a conversation</em>.</p>
              <p>Going to Chat doesn&rsquo;t mean losing your place: when you tap <strong>Chat</strong> from inside your Coaches Portal, the chat screen carries a <strong>← Back to your Coaches Portal</strong> link at the top that drops you back on the exact page you left. (Families browsing chat never see it — it&rsquo;s only there when you arrived from your portal.)</p>
            </>
          ),
        },
        {
          id: 'tournament-chat-send',
          title: 'Sending your first message',
          content: (
            <>
              <HelpSteps>
                <li>Open <strong>Chat</strong> and pick a conversation. You&rsquo;re always in the <strong>All coaches</strong> room, and on a bigger event you may also see a room for your division — each is labelled with the tournament name so they&rsquo;re easy to tell apart. (If you only have one, it opens straight away.)</li>
                <li>Type your message and send — everyone in that room sees it right away.</li>
              </HelpSteps>
              <p>You&rsquo;re placed into the right rooms automatically based on your team&rsquo;s division — there&rsquo;s nothing to join or manage. Inside a room, a chip with the <strong>tournament&rsquo;s name</strong> at the top takes you straight back to that event&rsquo;s page; if you also run the tournament, an <strong>Event admin</strong> shortcut takes you to the organizer&rsquo;s chat controls for it.</p>
            </>
          ),
        },
        {
          id: 'tournament-chat-features',
          title: 'It works like any chat app',
          content: (
            <>
              <p>Add an <strong>emoji</strong> from the smiley in the box, <strong>reply</strong> to a specific message (your reply shows the quote — tap it to jump to the original), and type <strong>@</strong> to <strong>mention</strong> a coach or the organizer by name. You can <strong>delete a message you sent</strong> — it then reads &ldquo;Message removed&rdquo; for everyone. The <strong>magnifier</strong> at the top <strong>searches</strong> the recent messages.</p>
              <p>Under your latest message, a small note shows when it&rsquo;s been read (<strong>Sent</strong> &rarr; <strong>Read by everyone</strong>). If the organizer has <strong>pinned</strong> anything — the schedule, a field map, the rules — it sits in a banner at the top; tap it to jump there. Only the organizer can pin.</p>
            </>
          ),
        },
        {
          id: 'tournament-chat-comfort',
          title: 'Keeping chat comfortable',
          content: (
            <p>Press and hold any message (or right-click on a computer) for a quick menu. From there you can <strong>Report to organizers</strong> if something&rsquo;s out of line — it goes privately to the tournament&rsquo;s organizers to review, and the sender isn&rsquo;t told who reported it — or <strong>Mute this room</strong> to silence its notifications and clear its unread badge when you need quiet. Muting is just for you: you can still open the room and post, and you can unmute the same way any time.</p>
          ),
        },
        {
          id: 'tournament-chat-notifications',
          title: 'How you hear about new messages',
          content: (
            <>
              <p>You get a <strong>phone notification</strong> for new messages, and the <strong>Chat</strong> tab shows an <strong>unread badge</strong> — no email. (Chat lives on the Chat tab, not in the notification bell.) An <strong>@mention</strong> always reaches you directly, even if you&rsquo;ve turned general chat notifications off. The chat shows a &ldquo;last seen&rdquo; marker per person rather than a tick on every message.</p>
              <HelpNote variant="info" title="If the organizer steps in">If the organizer <strong>mutes</strong> you, you can still read but can&rsquo;t post for a while; if they <strong>close</strong> the room, it becomes read-only.</HelpNote>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-tournament-chat-join',
          question: 'How do I join a tournament’s chat?',
          answerText: 'You join automatically. When an organizer opens chat for a tournament your team is in, the conversation appears on the Chat tab of the app (the bar at the bottom of your phone) with an unread badge. There is nothing to accept — just sign in with the email on your team registration and the conversation shows up. The Chat tab is the only place to look; there is no chat section inside your team, and no Team chat card on your Overview. On Premium Coaches Portal, Chat is also an item in your sidebar. It works the same whether your team is free or paid.',
          keywords: ['join chat', 'tournament chat', 'no chat showing', 'where is chat', 'unread', 'team chat card', 'chat tab', 'chat missing from overview'],
          popular: true,
          answer: (
            <>
              <p>You join automatically. When an organizer opens chat for a tournament your team is in, the conversation appears on the <strong>Chat</strong> tab of the app (the bar at the bottom of your phone) with an unread badge — there&rsquo;s nothing to accept. <strong>That tab is the only place to look:</strong> there&rsquo;s no chat section inside your team and no chat card on your Overview. (On <strong>Premium Coaches Portal</strong>, Chat is also an item in your sidebar.)</p>
              <p>If you don&rsquo;t see it yet, make sure you&rsquo;ve signed in with the email on your team registration. It works the same whether your team is free or paid.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-chat-notify',
          question: 'Will I be notified of new chat messages?',
          answerText: 'Yes — new chat messages send a phone push notification and show an unread badge on the Chat tab. Tapping the notification opens that conversation directly. Chat lives on the Chat tab, not in the notification bell. Chat does not email you. If someone @mentions you, that reaches you directly even if you have turned general chat notifications off. The chat shows a last seen marker per person, not a read tick on each message.',
          keywords: ['chat notification', 'push notification', 'new message alert', 'no email', 'unread', 'unread badge', 'chat tab', 'not in bell', 'mention', '@mention', 'mentioned', 'tap notification', 'opens the conversation', 'notification opens chat', 'where does the notification go'],
          answer: (
            <>
              <p>Yes — a new chat message sends a <strong>phone push notification</strong> and shows an <strong>unread badge on the Chat tab</strong>. <strong>Tapping the notification opens that conversation</strong> directly. Chat lives on the Chat tab, not in the notification bell. Chat doesn&rsquo;t email you.</p>
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
        {
          id: 'faq-tournament-chat-report-mute',
          question: 'Can I report a message or mute a chat?',
          answerText: 'Yes. Press and hold any message (or right-click on a computer) for a quick menu. Report to organizers sends it privately to the tournament organizers to review — the sender is not told who reported it. Mute this room silences that room notifications and clears its unread badge; muting is just for you, you can still read and post, and you can unmute the same way any time. Blocking another coach is not available — organizers handle moderation.',
          keywords: ['report', 'report a message', 'report to organizers', 'mute', 'mute room', 'mute this room', 'mute chat', 'unmute', 'inappropriate message', 'block coach', 'press and hold', 'long press', 'safety'],
          answer: (
            <>
              <p>Yes. Press and hold any message (or <strong>right-click</strong> on a computer) for a quick menu.</p>
              <p><strong>Report to organizers</strong> sends that message privately to the tournament&rsquo;s organizers to review — the sender isn&rsquo;t told who reported it. <strong>Mute this room</strong> silences that room&rsquo;s notifications and clears its unread badge; muting is <strong>just for you</strong> — you can still read and post, and you can unmute the same way any time.</p>
              <p>Blocking another coach directly isn&rsquo;t part of tournament chat — the organizers handle moderation, so reporting is the way to flag anything that&rsquo;s out of line.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-staff-room',
      group: 'Premium Coaches Portal',
      heading: 'Your team’s staff room',
      summary: 'A standing chat for your coaching staff — head coach and assistants — open all season, not tied to any tournament.',
      keywords: ['staff room', 'staff chat', 'team chat', 'coach chat', 'assistant chat', 'coaching staff', 'private chat', 'team staff', 'chat with assistants', 'staff messages', 'history', 'older messages', 'new assistant', 'pinned', 'season ended chat', 'read only chat'],
      searchText: 'staff room standing chat for your coaching staff head coach and assistants all season not tied to a tournament pinned at the top of your chats staff tag your coaching staff automatically added no setup invite an assistant staff page new members see messages from the day they join older messages hidden not visible to you privacy head coach runs the room pin remove messages polls season ends read only reopens next season cannot delete undeletable premium coaches portal club notifications same as tournament chat team name in chat tab',
      content: (
        <>
          <p>With <strong>Premium Coaches Portal</strong>, your team gets a <strong>staff room</strong> — a standing chat for your coaching staff, open all season. It&rsquo;s pinned at the top of <strong>Your chats</strong> with a <strong>Staff</strong> tag, named after your team, and it also appears on the app&rsquo;s <strong>Chat</strong> tab grouped under your team&rsquo;s name. There&rsquo;s nothing to create or configure: the room exists as soon as any of your coaches opens Chat, and it can&rsquo;t be deleted.</p>
          <p><strong>Who&rsquo;s in it.</strong> You and your assistant coaches, automatically. <strong>Helpers are not</strong> — a parent running a station has no place in the room where you talk about the team, and that isn&rsquo;t something you can switch on for them. If you genuinely want someone in here, make them an assistant coach on the <strong>Staff</strong> page. <strong>Staff chat</strong> is also a switch on each assistant&rsquo;s card now, on by default, if you ever need to take it back.</p>
          <p><strong>Your whole staff is in automatically.</strong> Assistants get a seat the moment they join your team and lose it if they leave — there&rsquo;s no separate chat permission to manage. If it&rsquo;s just you so far, the room points you at your <strong>Staff</strong> page to invite an assistant; each one you add appears here on their own.</p>
          <p><strong>New members see the room from the day they join.</strong> Messages sent before someone was on your staff stay private to the people who were there — a reply that quotes an older message simply shows &ldquo;Not visible to you&rdquo; to them. That&rsquo;s deliberate: staff talk is candid, and joining the team doesn&rsquo;t open its past. (This is different from tournament chat, where a coach joining an event sees the room&rsquo;s history.)</p>
          <p><strong>The head coach runs the room</strong> with the same tools organizers have in tournament chat: <strong>pin</strong> important messages, <strong>remove</strong> a message, and post <strong>polls</strong>. Everything else works exactly like the chat you know — replies, mentions, emoji, search, phone notifications with an unread badge, no email.</p>
          <p>When your season ends, the room goes <strong>read-only</strong> — everything stays readable, and it reopens by itself when the next season starts.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-staff-room-history',
          question: 'Why can’t my new assistant see older staff-room messages?',
          answerText: 'That is deliberate. In the staff room, every member sees messages only from the day they joined your staff — earlier messages stay private to the people who were in the room when they were sent. A reply that quotes an older message shows Not visible to you instead of the text. This applies to everyone, including a new head coach taking over the team. Tournament chat is different: there, a coach joining an event sees the full room history. If something needs to outlive coaching changes, keep it in your notes, documents, or announcements rather than chat.',
          keywords: ['new assistant', 'older messages', 'history', 'cannot see messages', 'not visible to you', 'staff room history', 'privacy', 'replacement coach', 'new head coach'],
          popular: true,
          answer: (
            <>
              <p>That&rsquo;s deliberate. In the staff room, every member sees messages <strong>only from the day they joined your staff</strong> — earlier messages stay private to the people who were in the room when they were sent, and a reply that quotes an older message shows &ldquo;Not visible to you&rdquo; instead of the text. This applies to everyone, including a new head coach taking over the team.</p>
              <p>(Tournament chat is different — there, a coach joining an event sees the room&rsquo;s history.) If something needs to outlive coaching changes, keep it in your notes, documents, or announcements rather than chat.</p>
            </>
          ),
        },
        {
          id: 'faq-staff-room-manage',
          question: 'Who runs the staff room — and can I close or delete it?',
          answerText: 'The head coach runs it: pin messages, remove a message, and post polls, right in the conversation — there is no separate management screen. Membership manages itself from your Staff page: add or remove an assistant there and their chat seat follows. Helpers are never in the staff room, and Staff chat is a switch on each assistant card if you need to take a seat back without removing them. The room cannot be deleted. When your season ends it becomes read-only — everything stays readable — and it reopens automatically when the next season starts.',
          keywords: ['head coach', 'moderate', 'pin', 'remove message', 'delete staff room', 'close staff room', 'season ended', 'read only', 'polls', 'manage staff room', 'who is in the staff room', 'helper in chat', 'remove someone from staff chat', 'staff chat switch'],
          answer: (
            <>
              <p><strong>The head coach runs it</strong> — pin messages, remove a message, and post polls, right in the conversation. There&rsquo;s no separate management screen: membership manages itself from your <strong>Staff</strong> page, so adding or removing an assistant there moves their chat seat too. <strong>Helpers are never in the room</strong>, and each assistant&rsquo;s card has a <strong>Staff chat</strong> switch if you ever need to take a seat back without removing the person.</p>
              <p>The room can&rsquo;t be deleted. When your season ends it becomes <strong>read-only</strong> — everything stays readable — and it reopens automatically when the next season starts.</p>
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
      searchText: 'coaches portal premium upgrade paid lineup builder attendance dues automation team budget document storage carries over organization joins start next season new season division team settings lineup rules innings caps notifications notification bell where are my notifications more menu phone email families announcements renamed chat versus announcements which one emails parents multi season year over year player profile positions best okay never ranked positions never play position preferences pitcher pitching depth chart ace pitcher rank max innings arm care innings cap this player pitches medical allergies emergency contact handedness bats throws jersey size attendance snapshot per player dues roster export pdf excel csv awards mvp best hitter hustle award season awards player awards development focus areas idp measurables 60 yard sprint test times log a measurable player development goals working on it achieved trend sparkline evaluation session testing day whole roster batch entry team board development page coverage previous seasons archive scrapbook history bring forward carry forward start fresh print summary pdf handout parent development report insights everyone getting attention history linked tryout snapshot development baseline start development from tryouts where the season started context not a measurable coach eyes only',
      content: (
        <>
          <p><strong>Premium Coaches Portal</strong> keeps everything in your free portal and adds the tools for running a full competitive season:</p>
          <ul>
            <li>A full <strong>player profile</strong> for everyone on your roster — positions, handedness and jersey size, allergies/medical notes and an emergency contact, plus that player&apos;s attendance, dues, and awards at a glance.</li>
            <li>A <strong>Development</strong> section on every player — plain-language focus areas with a simple status, coach-logged <strong>measurables</strong> (like a 60-yd sprint time) with a trend line once a player has two readings, a <strong>previous-seasons archive</strong> for confirmed returning players, and a printable one-page <strong>summary</strong> — plus a <strong>Development</strong> page (Progress menu) with <strong>Evaluation Sessions</strong> for whole-roster testing days, a <strong>Team board</strong> overview, and a coverage <strong>report in Insights</strong>.</li>
            <li>Attendance at every practice and game, and game-day lineups and batting orders.</li>
            <li>Recurring schedule events and calendar sync.</li>
            <li>Dues automation — installment schedules, due dates, and overdue reminders — plus a season budget with expenses and fundraiser credits.</li>
            <li>Export your roster to Excel, CSV, or a print-ready PDF.</li>
            <li>Document storage for waivers and team forms (see below).</li>
            <li>A <strong>Team settings</strong> area for your division, the season you&apos;re in, and the <strong>lineup rules</strong> game-day auto-fill follows (see below).</li>
            <li><strong>Family access</strong> — one link that lets grandparents and relatives follow your schedule and results after you approve them, a setting for how much is visible, shareable pages for individual games, and a calendar families can subscribe to (see below).</li>
          </ul>
          <p>If your organization later joins FieldLogicHQ, your team and its history carry over automatically.</p>
        </>
      ),
      faqs: [
        {
          // Chunk B (P1 #4). The premium portal gained its first-ever mobile door to notifications;
          // before this, searching the guide for "notifications" returned only tournament-alert
          // content, and the feed itself was unreachable on a phone.
          id: 'faq-premium-notifications-phone',
          question: 'Where are my notifications on my phone?',
          answerText: 'Tap More in the bar at the bottom of your screen — Notifications is the first row, and it shows a count when something is waiting. The count also appears on the More button itself, so you can see there is something new without opening the menu. Tapping the row opens your full notification list, and Notification settings at the top of that page is where you choose what reaches you. On a computer the same thing lives in the bell at the top of the left-hand menu. Notifications are per organization, so if you coach for two clubs each has its own list. Chat messages are not in here — chat has its own unread badge on the Chat tab.',
          keywords: ['notifications', 'notification', 'where are my notifications', 'notifications on phone', 'no bell', 'bell missing', 'cannot find notifications', 'notification settings', 'alerts', 'unread', 'badge', 'count on more', 'more menu', 'turn off notifications', 'notification bell', 'phone notifications'],
          popular: true,
          answer: (
            <>
              <p>Tap <strong>More</strong> in the bar at the bottom of your screen — <strong>Notifications</strong> is the first row, and it shows a count when something is waiting. That count also appears on the <strong>More</strong> button itself, so you can see there&rsquo;s something new without opening the menu.</p>
              <p>Tapping the row opens your full notification list, and <strong>Notification settings</strong> at the top of that page is where you choose what reaches you. On a computer the same thing lives in the <strong>bell</strong> at the top of the left-hand menu.</p>
              <p>Notifications are <strong>per organization</strong> — if you coach for two clubs, each has its own list. <strong>Chat messages aren&rsquo;t in here</strong>: chat has its own unread badge on the <strong>Chat</strong> tab.</p>
            </>
          ),
        },
        {
          // Chunk B (P1 #1). The nav door was renamed; this is where a coach who knew the old word
          // lands. Kept in the PREMIUM section deliberately — the free portal still says
          // "Announcements", so a shared FAQ would mislead half the audience.
          id: 'faq-premium-chat-vs-email',
          question: 'What’s the difference between Chat and Email families?',
          answerText: 'They reach different people in different ways. Email families (called Announcements in the free portal, and on your Explore list) sends one email out to every family on your roster, using the guardian addresses already there — it is one-way, and it is the one to use for a rain-out, a time change, or what to bring on Saturday. Chat is a conversation: your own coaching staff have a room that stays open all season, and while you are entered in a tournament you also get the organizer and the other coaches in that event. Chat never emails anyone; it notifies phones and shows an unread badge on the Chat tab. If you are trying to reach parents, it is Email families every time — parents are not in your chat rooms.',
          keywords: ['chat vs announcements', 'chat or email families', 'difference between chat and email', 'which one emails parents', 'reach parents', 'message parents', 'email families', 'announcements', 'two options', 'communication', 'staff room', 'organizer chat', 'who gets it', 'renamed'],
          popular: true,
          answer: (
            <>
              <p>They reach <strong>different people</strong>, in <strong>different ways</strong>.</p>
              <p><strong>Email families</strong> sends one email out to every family on your roster, using the guardian addresses already there. It&rsquo;s <strong>one-way</strong>, and it&rsquo;s the one for a rain-out, a time change, or what to bring on Saturday. (In the free portal this is called <strong>Announcements</strong> — same thing.)</p>
              <p><strong>Chat</strong> is a <strong>conversation</strong>. Your own coaching staff have a room that stays open all season, and while you&rsquo;re entered in a tournament you also get the organizer and the other coaches in that event. Chat never emails anyone — it notifies phones and shows an unread badge on the Chat tab.</p>
              <p><strong>Trying to reach parents? It&rsquo;s Email families, every time</strong> — parents aren&rsquo;t in your chat rooms.</p>
            </>
          ),
        },
        {
          id: 'faq-premium-player-profile',
          question: 'What can I keep on each player?',
          answerText: 'On Premium, open any player from your Roster to see their full profile. You set their fielding positions with one Positions picker — tap a position to cycle it through Best, Okay, or Never, and rank your Best spots in priority order (reorder with the arrows). Best are their go-to spots, Okay are fill-in spots, and Never is a hard block the game-day auto-fill will never assign. Pitchers are set separately in a Pitching section — turn on "This player pitches" and set their rank (Ace, #2, #3…) and an optional max-innings-per-game arm-care cap; pitching is not one of the fielding chips. You can also mark a player as an A-squad ("gold-medal starter") with the gold star. Alongside name, date of birth and jersey number you can also record handedness (bats/throws), jersey size, allergies or medical notes, and an emergency contact. When medical notes are present, a flag shows at the top so it is not missed on game day. The profile also shows that player’s attendance this season, their dues balance, and any awards they have earned this season (like "2× MVP") at a glance, plus any documents on file. If you tagged this player in a Note at the bench during a game, those lines gather here too, under Moments you logged — newest first, with the season’s count; they are yours and your staff’s and families never see them. If you set Primary/Secondary positions before, they carry over automatically as that player’s top two Best. To set positions, pitchers, and A-squad for your whole team at once, use the Depth chart view of your Roster (the List / Depth chart toggle) — it edits the same profiles.',
          keywords: ['player profile', 'positions', 'best okay never', 'never play', 'ranked positions', 'position preferences', 'primary secondary position', 'pitcher', 'pitching', 'ace', 'pitcher rank', 'max innings', 'arm care', 'innings cap', 'this player pitches', 'a-squad', 'gold medal', 'gold-medal starter', 'depth chart', 'medical', 'allergies', 'emergency contact', 'handedness', 'bats', 'throws', 'jersey size', 'attendance', 'dues', 'player details', 'awards', 'mvp', 'season awards', 'moments you logged', 'notes about a player', 'bench notes'],
          answer: (
            <>
              <p>On Premium, open any player from your <strong>Roster</strong> to see their full profile. Set their <strong>fielding positions</strong> with one <strong>Positions</strong> picker — tap a position to cycle it through <strong>Best</strong>, <strong>Okay</strong>, or <strong>Never</strong>, and rank your Best spots in priority order (reorder with the arrows). <strong>Best</strong> are their go-to spots, <strong>Okay</strong> are fill-in spots, and <strong>Never</strong> is a hard block the game-day auto-fill will never assign.</p>
              <p><strong>Pitchers are set separately</strong> in a <strong>Pitching</strong> section — turn on <strong>&ldquo;This player pitches&rdquo;</strong> and set their <strong>rank</strong> (Ace, #2, #3…) and an optional <strong>max innings per game</strong> arm-care cap. Pitching is handled here, not as one of the fielding chips. You can also mark a player as an <strong>A-squad</strong> (&ldquo;gold-medal starter&rdquo;) with the gold star — in competitive games they get their best positions and are protected from the bench.</p>
              <p>Alongside name, date of birth and jersey number you can also record <strong>handedness</strong> (bats/throws), <strong>jersey size</strong>, <strong>allergies or medical notes</strong>, and an <strong>emergency contact</strong>. When a player has medical notes, a flag appears at the top of their profile so it&apos;s never missed on game day. The profile also shows that player&apos;s <strong>attendance</strong> this season, their <strong>dues balance</strong>, and any <strong>awards</strong> they&apos;ve earned this season (like &ldquo;2&times; MVP&rdquo;) at a glance, plus any documents on file.</p>
              <p>If you tagged this player in a <strong>Note</strong> at the bench during a game, those lines gather here too, under <strong>Moments you logged</strong> — newest first, with the season&apos;s count. They&apos;re yours and your staff&apos;s; families never see them. It&apos;s the reading you want in front of you before a season-end conversation.</p>
              <p>If you set <strong>Primary</strong>/<strong>Secondary</strong> positions before, they carry over automatically as that player&apos;s top two <strong>Best</strong> — nothing to re-enter. To set positions, pitchers, and A-squad for your <strong>whole team at once</strong>, use the <strong>Depth chart</strong> view of your Roster (see below).</p>
            </>
          ),
        },
        {
          id: 'faq-premium-player-development',
          question: 'How do I track a player’s development? (focus areas and measurables)',
          popular: true,
          answerText: 'Open any player from your Roster and find the Development section. Focus areas are the things this player is working on, in plain language ("first-step quickness off the bag") with one short note and a simple status you tap to change — Working on it, Achieved, or Parked. No grades or percentages, on purpose. Measurables are the tests you already run at practice — a 60-yd sprint, home-to-first, throw velocity. Set up each test once (name + unit) and it becomes a chip you pick when logging; a reading is just the value and a date (defaults to today). A small trend line appears once a player has two readings of the same test — one reading honestly says a trend will show after a second entry. Every number compares the player only to themselves — there is no team leaderboard. Below, a Context list quotes the player’s depth-chart spots, this season’s field/bench innings, and attendance so the whole picture is on one screen. At the bottom, Print summary (PDF) builds a one-page handout — this season’s focus areas and dated readings with your organization’s header — made to hand a family at pickup; it never includes comparisons to other players and there is no share link. Only the head coach can add or edit development data; assistants see focus areas only if you’ve granted notes access, and measurables with any of the duties that open the development board. To rename or retire a test (retiring keeps its logged history), tap Test types at the top of the section. If the player came through your tryout and you ran Start development from tryouts, a Tryout snapshot card sits above their focus areas showing where their season started — it is context only, never a measurable and never part of a trend, and it is coach-eyes-only.',
          keywords: ['development', 'player development', 'focus areas', 'focus area', 'idp', 'measurables', 'measurable', 'log a measurable', '60 yard', 'sprint time', 'test times', 'trend', 'sparkline', 'working on it', 'achieved', 'parked', 'test types', 'retire test', 'player progress', 'track progress', 'print summary', 'print', 'pdf', 'handout', 'parent summary', 'family', 'tryout snapshot', 'development baseline', 'where the season started'],
          answer: (
            <>
              <p>Open any player from your <strong>Roster</strong> and find the <strong>Development</strong> section. <strong>Focus areas</strong> are the things this player is working on, in plain language (&ldquo;first-step quickness off the bag&rdquo;) with one short note and a simple status you tap to change — <strong>Working on it</strong>, <strong>Achieved</strong>, or <strong>Parked</strong>. No grades or percentages, on purpose.</p>
              <p><strong>Measurables</strong> are the tests you already run at practice — a 60-yd sprint, home-to-first, throw velocity. Set up each test once (name + unit) and it becomes a chip you pick when logging; a reading is just the value and a date (defaults to today). A small <strong>trend line</strong> appears once a player has <strong>two readings</strong> of the same test — one reading honestly says a trend will show after a second entry. Every number compares the player <em>only to themselves</em> — there&apos;s no team leaderboard.</p>
              <p>Below, a <strong>Context</strong> list quotes the player&apos;s depth-chart spots, this season&apos;s field/bench innings, and attendance, so the whole picture is on one screen. At the bottom, <strong>Print summary (PDF)</strong> builds a one-page handout — this season&apos;s focus areas and dated readings under your organization&apos;s header — made to hand a family at pickup. It never includes comparisons to other players, and there&apos;s no share link. Only the <strong>head coach</strong> can add or edit development data; assistants see focus areas only with <strong>notes</strong> access, and measurables with any of the duties that open the development board. To rename or retire a test (retiring keeps its logged history), tap <strong>Test types</strong> at the top of the section.</p>
              <p>If the player came through your tryout and you ran <em>Start development from tryouts</em>, a <strong>Tryout snapshot</strong> card sits above their focus areas showing where their season started. It&apos;s <strong>context only</strong> — never a measurable, never part of a trend — and it&apos;s coach-eyes-only.</p>
            </>
          ),
        },
        {
          id: 'faq-premium-evaluation-sessions',
          question: 'How do I test my whole roster at once? (Evaluation Sessions)',
          answerText: 'Open Development in the Progress menu and tap New session. Pick which test you are running (or set one up on the spot), then work straight down your roster — tap a player, type their number, and it saves as you go, with an "N of M entered" count so you always know where you are. Leave a player blank to skip them (an absent player is never given a fake 0). Rows always stay in roster order — testing day is not a leaderboard. Every reading lands on that player\'s profile exactly as if you had logged it there, tagged with the session date. The session itself is saved ("Jul 17 — 14 players, 2 tests") so you can come back to it, and deleting a session never deletes the readings — they just lose the grouping. Below your sessions the Development page has two doors — the Team board (everyone\'s focus areas and latest numbers at a glance, in roster order) and the coverage report in Insights — and then Your test list at the foot of the page. If New session is switched off, your test list has no active test on it yet. Two or three sessions a season is what makes each player\'s trend lines real.',
          keywords: ['evaluation session', 'testing day', 'test the whole team', 'whole roster', 'batch entry', 'development page', 'team board', 'new session', 'run tests', 'timing day', 'combine', 'your test list'],
          popular: true,
          answer: (
            <>
              <p>Open <strong>Development</strong> in the Progress menu and tap <strong>New session</strong>. Pick which test you&apos;re running (or set one up on the spot), then work straight down your roster — tap a player, type their number, and it <strong>saves as you go</strong>, with an &ldquo;N of M entered&rdquo; count so you always know where you are. <strong>Leave a player blank to skip them</strong> — an absent player is never given a fake 0. Rows always stay in <strong>roster order</strong> — testing day isn&apos;t a leaderboard.</p>
              <p>Every reading lands on that player&apos;s profile exactly as if you&apos;d logged it there, tagged with the session date. The session itself is saved (&ldquo;Jul 17 — 14 players, 2 tests&rdquo;) so you can come back to it, and <strong>deleting a session never deletes the readings</strong> — they just lose the grouping.</p>
              <p>Below your sessions, the Development page has two doors — the <strong>Team board</strong> (everyone&apos;s focus areas and latest numbers at a glance, in roster order) and the coverage report in <strong>Insights</strong> — and then <strong>Your test list</strong> at the foot of the page. If <strong>New session</strong> is switched off, your test list has no active test on it yet. Two or three sessions a season is what makes each player&apos;s trend lines real.</p>
            </>
          ),
        },
        {
          id: 'faq-premium-returning-players',
          question: 'How does the app recognize returning players?',
          answerText: 'When a tryout candidate or a roster player plausibly matches someone from one of your past seasons — same guardian email, matching name, and birth date all participate; a shared family email alone is never enough — the head coach sees a quiet "Possible returning player — verify" prompt: on the Decision Board during tryouts, and on the player\'s profile page. It shows the past record side by side (name, birth date, guardian) and you decide: Confirm, Not the same player, or Not sure yet. A suggested match never links automatically. The one exception is Start next season: the players you carry forward are linked for you, because the app copied last season\'s record itself — no guesswork involved. A confirmed link shows as a plain line ("Linked to your 2025 record — confirmed Jul 17") with an always-visible "Not the same player — unlink" that removes only the association — never any records. Saying "Not the same player" is remembered, so the same wrong pairing never comes back. Only the head coach sees any of this, and prompts never appear while tryout names are hidden in blind mode. Confirming a link unlocks that player\'s Previous seasons archive on their Development card — see the next question.',
          keywords: ['returning player', 'possible returning player', 'verify', 'link player', 'unlink', 'same player', 'previous season', 'played last year', 'recognize player', 'match player', 'continuity'],
          answer: (
            <>
              <p>When a tryout candidate or a roster player plausibly matches someone from one of your past seasons — same guardian email, matching name, and birth date all participate; <strong>a shared family email alone is never enough</strong> — the head coach sees a quiet <strong>&ldquo;Possible returning player — verify&rdquo;</strong> prompt: on the <strong>Decision Board</strong> during tryouts, and on the <strong>player&apos;s profile</strong> page. It shows the past record side by side (name, birth date, guardian) and you decide: <strong>Confirm</strong>, <strong>Not the same player</strong>, or <strong>Not sure yet</strong>. A suggested match never links automatically — the one exception is <strong>Start next season</strong>, where the players you carry forward are linked for you, because the app copied last season&apos;s record itself.</p>
              <p>A confirmed link shows as a plain line (&ldquo;Linked to your 2025 record — confirmed Jul 17&rdquo;) with an always-visible <strong>&ldquo;Not the same player — unlink&rdquo;</strong> that removes only the association — never any records. Saying &ldquo;Not the same player&rdquo; is remembered, so the same wrong pairing never comes back. Only the <strong>head coach</strong> sees any of this, and prompts never appear while tryout names are hidden in blind mode. Confirming a link unlocks that player&apos;s <strong>Previous seasons</strong> archive — see the next question.</p>
            </>
          ),
        },
        {
          id: 'faq-premium-development-history',
          question: 'What happens to development notes at the new season? (previous seasons and bring-forward)',
          popular: true,
          answerText: 'Nothing is lost. Once a player\'s history is linked (confirmed by you, or linked automatically by Start next season), their Development card gains a Previous seasons list — one dated row per past season ("2026 · U13 Purple — 2 focus areas (1 achieved) · 8 measurables · attendance 92%") that expands in place to show that season\'s focus areas and readings exactly as they were recorded. It is deliberately a scrapbook, not a scoreboard: past seasons sit side by side and the app never computes "better or worse than last year" — youth seasons are not comparable. On a newly linked player, the head coach also gets a one-time offer: bring forward the focus areas they were working on last season? You can look first (View record), bring them forward (they join this season as "Working on it"), or start fresh. Readings never carry over — last season\'s numbers stay in that season\'s archive so this season\'s trend lines stay honest. Either answer is remembered and the offer never re-appears. The Development report in Insights ("Is everyone getting attention?") shows a Returning player column so you can see at a glance whose past seasons are connected.',
          keywords: ['previous seasons', 'archive', 'history', 'last season', 'bring forward', 'carry forward', 'start fresh', 'rollover', 'new season', 'notes disappeared', 'keep notes', 'season history', 'development history', 'scrapbook'],
          answer: (
            <>
              <p>Nothing is lost. Once a player&apos;s history is <strong>linked</strong> (confirmed by you, or linked automatically by <strong>Start next season</strong>), their Development card gains a <strong>Previous seasons</strong> list — one dated row per past season (&ldquo;2026 · U13 Purple — 2 focus areas (1 achieved) · 8 measurables · attendance 92%&rdquo;) that expands in place to show that season&apos;s focus areas and readings exactly as they were recorded. It&apos;s deliberately a <strong>scrapbook, not a scoreboard</strong>: past seasons sit side by side, and the app never computes &ldquo;better or worse than last year&rdquo; — youth seasons aren&apos;t comparable.</p>
              <p>On a newly linked player, the head coach also gets a <strong>one-time offer</strong>: bring forward the focus areas they were working on last season? You can look first (<strong>View record</strong>), <strong>bring them forward</strong> (they join this season as &ldquo;Working on it&rdquo;), or <strong>start fresh</strong>. <strong>Readings never carry over</strong> — last season&apos;s numbers stay in that season&apos;s archive so this season&apos;s trend lines stay honest. Either answer is remembered, and the offer never re-appears.</p>
              <p>The <strong>Development report in Insights</strong> (&ldquo;Is everyone getting attention?&rdquo;) shows a <strong>Returning player</strong> column, so you can see at a glance whose past seasons are connected.</p>
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
      id: 'premium-bulk-roster',
      group: 'Premium Coaches Portal',
      heading: 'Adding your whole roster at once (Premium)',
      summary: 'Paste your team list or upload a spreadsheet, check the preview, and add everyone in one go.',
      keywords: ['add whole roster', 'bulk add', 'bulk', 'add players', 'paste', 'paste a list', 'paste roster', 'import', 'import roster', 'csv', 'excel', 'xlsx', 'spreadsheet', 'upload roster', 'template', 'download template', 'many players', 'add 15 players', 'save and add another', 'duplicate jersey', 'same number twice', 'faster roster'],
      searchText: 'add whole roster at once bulk add players paste a list paste roster import csv excel xlsx spreadsheet upload roster download template column headings first name last name jersey number position date of birth guardian email guardian phone notes preview table fix rows remove row duplicate jersey number already worn by same number twice already on your roster first name required skipped row save and add another add one player faster way to add players 15 players quickly',
      content: (
        <>
          <p>On Premium, <strong>Add players</strong> gets your whole team in at once instead of one form at a time. It opens with two ways in.</p>
          <p><strong>Paste a list.</strong> Put one player per line — your team list probably already exists in an email or a group chat, so paste it straight in. A number before or after the name becomes their jersey:</p>
          <ul>
            <li><code>12 Jordan Smith</code> and <code>Jordan Smith 12</code> both read as <strong>#12 Jordan Smith</strong>.</li>
            <li><code>Riley Novak</code> with no number is fine.</li>
            <li>Commas and tabs work as columns, so a copied spreadsheet row pastes cleanly too.</li>
          </ul>
          <p><strong>Upload a file.</strong> If your club handed you a spreadsheet, upload the Excel or CSV and the columns are matched by their headings — first name, last name, jersey, position, date of birth, guardian name, email and phone, and notes. Only a first name is required; anything else missing is just left blank. No spreadsheet? <strong>Download a template</strong> that already has the right headings.</p>
          <p>Either way you get a <strong>preview</strong> before anything is saved. Every cell is editable, you can drop a row you didn&apos;t mean to include, and problems are flagged in advance rather than after the fact: a jersey number used twice in your list, a number <em>already worn</em> by someone on your roster (it names who), and a player who&apos;s already there. A row with no first name can&apos;t be added and says so — the rest still go in, and you&apos;re told what was skipped.</p>
          <p><strong>Adding one player?</strong> The regular <strong>Add player</strong> form is still there and now has <strong>Save &amp; add another</strong> — it saves, clears itself, and keeps a running count in the header, so a few late signings don&apos;t mean reopening the form each time.</p>
          <p>Pasting captures names and numbers only. Positions, birthdates, and parent contacts are added per player afterwards, or come in through the spreadsheet&apos;s labelled columns — we don&apos;t guess at family contact details from typed text.</p>
        </>
      ),
    },
    {
      id: 'premium-season-end',
      group: 'Premium Coaches Portal',
      heading: 'When a season ends: Season’s End, your wrap-up, and what carries forward',
      summary: 'A closed season stays yours — a Season Wrapped highlight card you can share, plus read-only access to every result and money record.',
      keywords: ['season over', 'season ended', 'season complete', 'end of season', 'season wrapped', 'wrapped', 'share season', 'moments on wrapped', 'from the bench', 'bench notes on the card', 'season recap', 'highlight card', 'locked out', 'lost access', 'not assigned', 'read only', 'past seasons', 'season history', 'close season', 'close out the season', 'start next season', 'rollover', 'new season', 'what carries over', 'winding down', 'awards carry', 'development carry', 'tryout carry', 'unfinished tryout',
        // ⚠ Search matches KEYWORDS, not body text. The season SWITCHER was deleted on 2026-08-16,
        // and these terms stay listed anyway — a coach who learnt them, or who reads the words on an
        // old bookmark, must land on the article that explains what replaced it rather than on
        // nothing at all. Deleting the vocabulary of a removed feature hides its own explanation.
        'last year', 'last season', 'previous season', 'past season', 'old season', 'archive',
        'switch season', 'season switcher', 'change season', 'view past season', 'look up last year',
        'no season switcher', 'season dropdown gone', 'cannot switch to last year',
        'past roster', 'last year roster', 'old roster', 'past schedule', 'past results',
        'past attendance', 'past lineups', 'past money', 'old documents', 'past tryouts',
        'tryout history', 'turnout', 'returning player', 'tried out before', 'frozen', 'view only',
        // The deep pages a coach actually goes looking for in an archive, plus the "why can't I…"
        // searches the exclusions generate.
        'past dues', 'last year expenses', 'old budget', 'past budget vs actual', 'old fundraiser',
        'past player record', 'old player', 'past lineup', 'last year lineup', 'past development',
        'why can’t I edit', 'cannot edit past season', 'no edit button', 'read only season',
        'email past season', 'chat past season',
        // Chunk D Slice 3 — the recap engagement count lands on this page.
        'family season recaps', 'recap opened', 'did families read it', 'who opened the recap',
        'recap count', 'families opened', 'season recap',
        // 2026-08-03 — the helper exclusion. A head coach searches for the SYMPTOM they saw.
        'helper cannot see season wrapped', 'why can’t my helper see the season review',
        'helper season end', 'helper this season has finished', 'helper no access after season',
        'who can see season wrapped', 'season review access'],
      searchText: 'season over ended complete end of season seasons end page season wrapped highlight card share your season image final record longest streak closest game attendance rate most awarded lineup fact read only past seasons results archive locked out lost access team disappeared not assigned any teams club admin closes season reappears next season start next season close out the season winding down quiet nothing scheduled what carries over roster staff budget fee plan development history bring forward measurements start fresh awards all time record closing the season hands families their player season recap family season recaps line how many connected families opened theirs count never which families needs family contact access hidden when no families were connected seasons end is for coaches head coach and assistant coaches reach it helpers do not helper sees this season has finished thanks for helping out nothing else to open not about names a whole season story is not theirs share button puts a child first name on a picture make a helper an assistant coach to give them the full picture',
      content: (
        <p>When your season is marked complete, your team doesn&apos;t disappear — it lands on its <strong>Season&apos;s End</strong> page, and that becomes the first item in its menu in place of Overview. If you coach more than one team, you&apos;ll find it in your team switcher (the dropdown in the sidebar, or the team list on your phone&apos;s More menu) under <strong>No live season</strong>.</p>
      ),
      subtopics: [
        {
          id: 'season-end-wrapped',
          title: 'Season Wrapped, and the recaps families get',
          content: (
            <>
              <p><strong>Season Wrapped</strong> leads the page: your final record, longest win streak, closest game, attendance rate, top award-winner, and a standout lineup fact — built from the season you actually ran. If you used the <strong>Note</strong> button at the bench during the year, the card also carries <strong>one of your own lines</strong> — the most recent, with a count of how many you logged.</p>
              <p><strong>Share your season</strong> turns it into a picture and opens your phone&apos;s share sheet, so it goes wherever you choose (the family group chat is the usual first stop) — and the picture deliberately leaves your bench notes out, so sharing the card can never pass one along. A short season simply gets a smaller card — no padded stats, and no quote at all if you never logged one.</p>
              <p><strong>Closing the season is also what hands each family their player&apos;s season recap.</strong> Once it has, a <strong>Family season recaps</strong> line appears here telling you how many of your connected families have opened theirs — a count only, never <em>which</em> families. It shows up only if families were connected to that season, so a team that hadn&apos;t started sharing isn&apos;t shown a zero to interpret. Reading it needs family-contact access.</p>
            </>
          ),
        },
        {
          id: 'season-end-whats-there',
          title: 'The whole season is still there',
          content: (
            <>
              <p><strong>While your team is between seasons</strong>, Roster, schedule and results, attendance, lineups, money records, documents, development and tryouts all stay open, exactly as they were — you just can&apos;t change them, because the season is over. Your menu is the one you always had, in the same order; only its first item changes, from Overview to <strong>Season&apos;s End</strong>. Open anything from it the same way you did during the season.</p>
              <p><strong>It goes all the way down.</strong> Open Money and you can still read that season&apos;s dues, expenses, budget, budget-vs-actual and fundraiser results — open one of that year&apos;s fundraisers and it lists the players who were on <em>that</em> season&apos;s roster, not this one&apos;s. Open Roster and you can open a player to see their attendance, dues and awards for that season. Open Lineups and you can open a game and see the order you actually batted. Everything is marked <strong>Complete</strong> and nothing offers to be edited.</p>
              <HelpNote variant="info" title="What isn’t in a finished season, and why">
                <p>Anything that <em>does</em> something rather than records it. You can&apos;t request a payment, log a new org allocation, run a tryout, or open the drill and plan-template libraries for a season that has already happened — those screens say so and point you back here. Emailing families and Chat stay open, because they reach the people on your team rather than the season: between seasons is exactly when a coach needs them.</p>
              </HelpNote>
              <p>What you can see is decided by <strong>the permissions you hold now</strong>, in every season. If your head coach has given you money access on this team, you can read the finished season&apos;s money; if they haven&apos;t, you can&apos;t. It used to depend on what you happened to be granted back then, which meant your access changed depending on which year you opened.</p>
            </>
          ),
        },
        {
          id: 'season-end-moving',
          title: 'Looking back at an earlier year',
          content: (
            <>
              <p>There&apos;s <strong>no season switcher</strong> — your screens always describe the season your team is on, so you never have to check which year you&apos;re reading. In the weeks between seasons, that season <em>is</em> the finished one, which is why everything above is still open from your ordinary menu.</p>
              <p>Once the next season starts, an earlier year is reached in two places, both under <strong>Insights</strong>:</p>
              <ul>
                <li><strong>&ldquo;How are we doing?&rdquo; &rarr; Past seasons</strong> — every year the team has played, with its record, roster size, tryout acceptance and (with money access) dues and expenses.</li>
                <li><strong>Season Wrapped</strong> for any of those years, from a link on its row.</li>
              </ul>
              <p>What you won&apos;t find is a way to point Roster, Money or the Schedule at a year the team has already moved past. That&apos;s deliberate: those screens are for running the season you&apos;re in, and a switch that quietly changed which year they described was the easiest way in the whole portal to read the wrong number confidently.</p>
            </>
          ),
        },
        {
          id: 'season-end-who',
          title: 'Season’s End is for coaches',
          content: (
            <p>Your head coach and assistant coaches all reach it exactly as described above. <strong>Helpers don&apos;t</strong> — a parent who came in to run a station sees a short note saying the season has finished and thanking them, with nothing else to open. It isn&apos;t about names (a helper reads their group&apos;s names on the practice plan all season): a whole season&apos;s story simply isn&apos;t theirs to receive, and the Wrapped card carries a share button that puts a child&apos;s first name on a picture. If you&apos;d like a helper to keep the full picture, make them an assistant coach from your <strong>Staff</strong> page.</p>
          ),
        },
        {
          id: 'season-end-next',
          title: 'Getting to next season',
          content: (
            <>
              <p>On a standalone Premium team, the head coach starts it from Season&apos;s End (or Settings) — the roster and coaching staff carry forward. On a club-owned team, your club admin runs seasons; when you&apos;re on next season&apos;s coaching staff, the team moves back up into your active list automatically.</p>
              <p>And before any of that: once games stop and nothing new is scheduled for a couple of quiet weeks, your Overview asks a gentle <strong>Season check</strong> — <em>is the season over?</em> — so it never just… stops. It always offers <strong>Add an event instead</strong> beside the answer, in case you&apos;re not done after all, and <strong>Not yet</strong> keeps it quiet for the rest of the season. If closing seasons isn&apos;t yours to do, you get the same heads-up without the button: your club closes it, and your Season Wrapped appears when they do.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-season-end-what-carries',
          question: 'What carries into the new season, and what stays behind?',
          answer: (
            <>
              <p><strong>Carries:</strong> your active roster and your coaching staff, plus — your choice at rollover — the planned budget (projected buckets only) and the fee plan (amounts and installments, with due dates shifted forward; paid history stays behind).</p>
              <p><strong>Stays with the old season:</strong> the schedule, results, payments, and spending — its record is kept in Season&apos;s End and the Past seasons list. <strong>Development history</strong> stays too: each returning player&apos;s profile offers to bring their open goals forward, and measurements always start fresh. <strong>Awards</strong> never need carrying — they live on the team&apos;s all-time record. A <strong>tryout in progress doesn&apos;t carry either</strong> — the start-next-season screen warns you if candidates are still awaiting an outcome, so finish your picks first.</p>
            </>
          ),
        },
        {
          id: 'faq-season-end-locked-out',
          question: 'My season ended and my team vanished — where did it go?',
          answer: (
            <>
              <p>It&apos;s under <strong>No live season</strong> in your team list (the switcher in the sidebar, or the team menu on your phone), and its Season&apos;s End page has your wrap-up. If you coach one team only, the portal opens straight onto it. You&apos;re never locked out of a finished season&apos;s records — the whole menu still opens them, read-only.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-portal-tour',
      group: 'Premium Coaches Portal',
      heading: 'Getting around your Premium portal',
      summary: 'Where everything lives on Premium: the bar across the top of every page, the sidebar sections, the notification bell, the one card at the top of your Overview, and your six at-a-glance tiles.',
      keywords: ['team header', 'top bar', 'bar at the top', 'header', 'masthead', 'team name at the top', 'record in the header', 'game day in the header', 'next event in the header', 'public site flip', 'final record', 'complete season header', 'premium portal', 'sidebar', 'navigation', 'dashboard', 'overview', 'season setup', 'at a glance', 'snapshot', 'tooltips', 'help button', 'where is', 'required', 'optional', 'skip', 'skip step', 'progress bar', 'depth chart', 'squad', 'grouped menu', 'staff', 'tryouts', 'menu sections', 'attendance', 'where is attendance', 'attendance report', 'take attendance', 'season attendance', 'money', 'season review', 'lineups', 'find lineups', 'where are lineups', 'explore', 'team admin', 'last season', 'accounting renamed', 'history renamed', 'notifications', 'notification bell', 'bell', 'needs attention', 'activity feed', 'unread', 'see all notifications', 'notification centre', 'insights', 'season insights', 'where is season review', 'season review renamed', 'reports', 'stats', 'team stats', 'analytics hub', 'games tab', 'templates tab', 'filter games', 'needs lineup', 'what stands out', 'findings', 'scoreboard', 'close games', 'is playing time fair', 'where is playing time going', 'who shows up', 'week in review', 'weekly digest', 'weekly summary', 'sunday summary', 'weekly insights', 'notification settings', 'turn off notifications', 'turn off digest', 'turn off weekly summary', 'stop weekly notification', 'manage notifications', 'change notifications', 'my notification settings', 'notification preferences', 'push settings', 'opt out', 'one thing', 'one card', 'what should i do next', 'season check', 'is the season over', 'add an event instead', 'six tiles', 'overview tiles', 'attendance tile', 'playing time tile', 'money not set up', 'record tile', 'this week tile', 'finished tournament', 'live now', 'upcoming', 'fan view', 'last season line', 'not enough yet', 'board', 'why is my overview different', 'lineup set', 'lineup not set', 'ready chips', 'chips on the card', 'green chip', 'amber chip', 'no button', 'button disappeared', 'open game day', 'call time', 'uniform', 'which diamond', 'which field', 'where is the game'],
      searchText: 'team header bar across the top of every page masthead where is my team name record at the top of the page game day header next practice in the header what is that bar at the top public site flip from the header season complete final record in the header header folds away on my phone bar disappears when i scroll assistant cannot see the record no schedule access identity only no season switcher no season chip beside the page title screens always show the season the team is on premium portal layout sidebar navigation sections grouped menu squad season money communication team admin explore overview roster lineups tryouts schedule tournaments chat announcements money accounting documents season review history staff settings where are my lineups find lineups build lineup lineup front door menu where is accounting renamed money where is history now season review hide tryouts tournaments until used explore heading last season tile depth chart inside roster list depth chart toggle season setup checklist onboarding dashboard your team at a glance snapshot roster size next event dues outstanding budget spent remaining set tile who is coming next game headcount in late out no reply attendance lineup set not set nudge readiness chips row of chips green means done amber means still to do tappable chip opens that screen call time chip uniform chip venue and diamond which diamond which field where is the game diamond rink court pitch not just a number card has no button button disappeared build lineup gone open game day button first thing you have not done numbers add up missing guardian email flag season record recent form scored allowed differential current streak won lost win loss this week what is coming up birthdays next game question mark tooltips help button getting around find required optional skip skip step mark complete progress bar status only required step is roster optional jerseys positions schedule lineups budget skip the ones you wont use done or skipped open the setup guide drawer notification bell notifications centre needs attention activity feed today yesterday earlier unread all see all full notifications page bundled repeats chat tab unread badge not in bell your week in review weekly digest sunday evening summary push phone top findings quiet week nothing sent insights hub season insights where is season review now renamed insights season menu results playing time attendance past seasons reports stats analytics one place lineups games templates tabs filter games league tournament scrimmage needs lineup toggle count notification settings turn off notifications turn off the weekly digest weekly summary off switch change how i am notified manage notifications my notification settings notification preferences push settings bell push email one page for every team and organization you are part of coach card weekly summary at the top opt out one thing one card at a time never two cards conflicting contradicting instructions add an event and close the season at the same time season check is the season over add an event instead game day card next game card next setup step no card empty overview nothing waiting on you six tiles fixed places record roster next up this week tournaments dues budget attendance tile season average players under seventy percent playing time tile fairly even uneven evenly spread leans on a few across saved lineups assistant coach full board money not set up collapsed tile set up dues or a budget tiles return not enough yet not set muted tile quiet list at the bottom tail finished tournament live now upcoming fan view door last season line record dues collected spent opens insights record counts league tournament scrimmage choice lives in insights not counted two coaches see different cards only offered an action you can complete take attendance instead of build lineup club closes the season heads up with no button',
      content: (
        <>
          <p>Everything on Premium lives in three places: the <strong>bar across the top</strong> of every page, the <strong>sidebar</strong> down the left, and your <strong>Overview</strong> — one card for what matters now, then your six at-a-glance tiles.</p>
          <p>Stuck on a term? Look for the small <strong>?</strong> icons next to items for a one-line explanation, or the <strong>Help</strong> button in the page header — or <strong>Open the setup guide</strong> in the season-setup panel — to open this guide right beside what you&apos;re doing.</p>
        </>
      ),
      subtopics: [
        {
          id: 'premium-portal-tour-header',
          title: 'The bar across the top',
          content: (
            <>
              <p>A <strong>bar across the top</strong> of every team page tells you where you are and how the season is going. On the <strong>left</strong>: your club&rsquo;s name (a standalone team skips this — your team name is already in the sidebar), your <strong>team</strong>, and the season <strong>year</strong> with your <strong>record</strong>. On the <strong>right</strong>: the one thing that matters today — a <strong>Game day</strong> badge with the opponent and time, or <strong>Next</strong> with your next practice or game. A quiet week shows just the year and the record; nothing is invented to fill the space.</p>
              <p>Open a finished season and the right side reads <strong>Complete</strong> with that season&rsquo;s <strong>final record</strong> instead. It&rsquo;s a read-out, not a menu — to move between seasons, use the chip beside the page title. <strong>⇄ Public site</strong> sits at the far right and flips to your club&rsquo;s public pages (a standalone team has no public site, so it doesn&rsquo;t show). On a phone the bar keeps your team name and folds the rest away as you scroll.</p>
              <HelpNote variant="info" title="What an assistant sees">An assistant coach who hasn&rsquo;t been given schedule access sees the team and season only — the record and what&rsquo;s next come with that access.</HelpNote>
            </>
          ),
        },
        {
          id: 'premium-portal-tour-sidebar',
          title: 'The sidebar: where every tool lives',
          content: (
            <>
              <p>Every tool is in the left sidebar — no turning anything on. It&apos;s <strong>grouped</strong>, and the groups run in the order you&apos;re most likely to need them: the week&apos;s work at the top, the season&apos;s setup at the bottom. <strong>Nothing moves</strong> — every group is always there, in the same place, whether or not your team uses it yet.</p>
              <HelpDefs>
                <HelpDef term="Overview">At the top, on its own.</HelpDef>
                <HelpDef term="Season">Schedule, <strong>Practice plans</strong>, <strong>Lineups</strong> and <strong>Tournaments</strong> — everything attached to a date.</HelpDef>
                <HelpDef term="Progress">Development and <strong>Insights</strong> — a season scoreboard, a &ldquo;What stands out&rdquo; list that flags what&apos;s worth your attention, and reports on results, playing time and attendance, including <strong>&ldquo;Who&apos;s showing up?&rdquo;</strong>, your season attendance report. Insights was called <em>Season Review</em>, and <em>History</em> before that.</HelpDef>
                <HelpDef term="Money">Your budget, dues, and expenses — this was called <em>Accounting</em>. It opens with a guide card showing your next step and your four money numbers.</HelpDef>
                <HelpDef term="Communication">Chat, Email families.</HelpDef>
                <HelpDef term="Team">Roster and <strong>Tryouts</strong> — where your season&apos;s players come from. This group was called <em>Squad</em>.</HelpDef>
                <HelpDef term="Team admin">Staff, Documents, and Settings.</HelpDef>
              </HelpDefs>
              <p>Your <strong>Depth chart</strong> isn&apos;t a separate item — it&apos;s a view inside <strong>Roster</strong> (a <strong>List&nbsp;/&nbsp;Depth chart</strong> toggle at the top).</p>
              <p><strong>Attendance isn&apos;t its own sidebar item.</strong> You take attendance on the <strong>Schedule</strong>, inside a game or practice; the season report lives in <strong>Insights</strong> as &ldquo;Who&apos;s showing up?&rdquo;.</p>
            </>
          ),
        },
        {
          id: 'premium-portal-tour-lineups',
          title: 'Finding Lineups, and the tools that appear as you use them',
          content: (
            <>
              <p><strong>Lineups</strong> has its own spot under <strong>Season</strong>, beside Schedule and Practice plans, and opens on a <strong>Games</strong> tab — your upcoming and recent games, each flagged <strong>Lineup set / Not set</strong>, with a filter row (<strong>All / League / Tournament / Scrimmage</strong>, plus a <strong>⚠ Needs lineup</strong> toggle with a live count) and the bright <strong>Build lineup</strong> button on the next game that needs one. The <strong>Templates</strong> tab beside it manages your reusable lineups (you can still open a game straight from the Schedule too).</p>
              <p><strong>Nothing in the sidebar moves.</strong> <strong>Tryouts</strong> and <strong>Tournaments</strong> used to wait under a small <strong>Explore</strong> heading and jump into another group once your team ran a tryout or registered for a tournament. They don&apos;t any more — Tryouts sits under <strong>Team</strong> and Tournaments under <strong>Season</strong>, from day one, whether you use them or not. Each one explains what it&apos;s for when you open it.</p>
            </>
          ),
        },
        {
          id: 'premium-portal-tour-bell',
          title: 'The bell, and your week in review',
          content: (
            <>
              <p>Up in the sidebar header, the <strong>bell</strong> is your notification centre. Anything that needs you — like a schedule change or an assistant-coach request — is pinned at the top under <strong>Needs attention</strong> and clears as you handle it; everything else sits below as an <strong>Activity</strong> feed grouped by <strong>Today</strong>, <strong>Yesterday</strong>, and <strong>Earlier</strong>, with repeats bundled into a single line you can open in a tap. The bell opens on <strong>Unread</strong>, so reading something clears it from view — flip to <strong>All</strong> to see everything, or tap <strong>See all</strong> for your full notifications page. Team <strong>chat</strong> stays on the <strong>Chat</strong> tab with its own unread badge, not in the bell.</p>
              <p>Once your season is rolling, the bell — and your phone, if you&apos;ve allowed notifications — also brings a weekly <strong>&ldquo;Your week in review&rdquo;</strong>: your team&apos;s top Insights findings in one short note, sent only when something actually stood out (a quiet week sends nothing). Tap it to open <strong>Insights</strong>.</p>
              <p>To change how you&apos;re notified — or switch that weekly review off — open <strong>Notification settings</strong> from the bell (or the link at the top of your notifications page): it opens <strong>one page for every team and organization you&apos;re part of</strong>, with the weekly review right at the top of your coach card.</p>
            </>
          ),
        },
        {
          id: 'premium-portal-tour-one-thing',
          title: 'Your Overview: one card at the top',
          content: (
            <>
              <p>The Overview answers one question at a time — a single card for whatever matters most right now, and never two competing ones.</p>
              <p>On a <strong>game day</strong> it&apos;s the game: opponent, time, and where to be — the <strong>venue and the diamond</strong> (or rink, court or pitch), not just a number. Under that sits a row of <strong>chips</strong> for how ready you are: who&apos;s coming, whether the lineup is set, and your <strong>call time</strong> and <strong>uniform</strong> once you&apos;ve set them. <strong>Green means done, amber means still to do</strong>, and each chip opens the screen it&apos;s about.</p>
              <p>The button beside the game is always <strong>the first thing you haven&apos;t done</strong> — build the lineup, then take attendance — so it never asks for work you&apos;ve already finished. Once nothing is outstanding it stops asking: close to first pitch it becomes <strong>Open game day</strong>, and earlier in the day there&apos;s simply no button, because there&apos;s nothing left to do. (The score joins the card once you enter it.)</p>
              <p>Earlier in the week it&apos;s your <strong>next game</strong>. When the season has gone quiet it&apos;s a <strong>Season check</strong> asking whether you&apos;re done — with <strong>Add an event instead</strong> right beside it, so it never assumes. And in your first week it&apos;s simply your <strong>next setup step</strong>. If none of those apply, the card steps aside and your numbers lead.</p>
            </>
          ),
        },
        {
          id: 'premium-portal-tour-tiles',
          title: 'Your team at a glance, and the quiet list below',
          content: (
            <>
              <p><strong>Six tiles</strong> sit directly under that card rather than at the bottom of the page: your <strong>record</strong> (with recent form), <strong>roster</strong>, what&apos;s <strong>next up</strong> (or, when the card above is already about your next game, what&apos;s on <strong>this week</strong>, including player <strong>birthdays</strong>), <strong>tournaments</strong> (plus any <strong>entry fees due</strong>), and two money tiles — <strong>dues</strong> and <strong>budget</strong>. They keep the same places all season, so you learn where to look. Tiles also carry what needs attention: players <strong>missing a guardian email</strong>, a <strong>Lineup set / not set</strong> nudge, and who&apos;s <strong>overdue</strong> on dues.</p>
              <p>Below them, <strong>a quiet list</strong> holds anything that isn&apos;t today&apos;s work: your tournament (labelled <strong>Live now</strong>, <strong>Upcoming</strong> or <strong>Finished</strong>) with its <strong>⇄ Fan view</strong> door, and — once you&apos;ve wrapped a season — a <strong>Last season</strong> line (record, dues collected, spent) that opens <strong>Insights</strong>.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-header-record-mismatch',
          popular: true,
          question: 'The record in the top bar doesn’t match the one on Insights.',
          answer: (
            <>
              <p><strong>Insights lets you choose whether scrimmages count</strong> toward your record, and that choice is remembered on the device you set it on. The bar at the top of the page never counts scrimmages — it shows the same record as <strong>Season&rsquo;s End</strong> and your season history, so it reads the same on your phone and on your computer.</p>
              <p>So if the two disagree, scrimmages are switched on in Insights. Either number is honest; they&rsquo;re answering slightly different questions.</p>
              <p><strong>A cancelled game never counts anywhere</strong>, even if a score was entered before it was called off. And until a game has a result, nothing is counted — a season with no games played yet shows no record at all rather than <em>0–0</em>.</p>
            </>
          ),
          answerText: 'Insights lets you choose whether scrimmages count toward your record, and that choice is remembered on the device you set it on. The bar at the top of the page never counts scrimmages — it shows the same record as Season\'s End and your season history, so it reads the same on your phone and on your computer. If the two disagree, scrimmages are switched on in Insights. A cancelled game never counts anywhere, even if a score was entered before it was called off. Until a game has a result nothing is counted, so a season with no games played yet shows no record at all rather than 0-0.',
          keywords: ['record does not match', 'records disagree', 'wrong record', 'two different records', 'record in the header', 'record at the top', 'top bar record', 'scrimmages count', 'scrimmage record', 'do scrimmages count', 'insights record', 'cancelled game record', 'no record showing', '0-0', 'record missing'],
        },
        {
          id: 'faq-find-lineups',
          question: 'Where do I build game lineups on Premium?',
          answer: (
            <>
              <p>Open <strong>Lineups</strong> in the left sidebar (under <strong>Season</strong>). It opens on the <strong>Games</strong> tab — your upcoming and recent games, each flagged <strong>Lineup set / Not set</strong>, with the bright <strong>Build&nbsp;lineup</strong> button on the next game that needs one. A filter row cuts the list down: <strong>All / League / Tournament / Scrimmage</strong>, plus a <strong>⚠ Needs lineup</strong> toggle with a live count that stacks with the type filter (for example, tournament games still missing a lineup).</p>
              <p>The <strong>Templates</strong> tab beside it holds your reusable lineups. Your <strong>season analytics</strong> moved to <strong>Insights</strong> (in the <strong>Season</strong> menu) — the quiet <strong>Season insights</strong> link at the bottom of the Games tab jumps there.</p>
              <p>You can still open a game from the <strong>Schedule</strong> — its <strong>Lineup</strong> tab shows a quick <strong>read-only preview</strong> (batting order and inning-1 field) with an <strong>Edit in Lineups&nbsp;→</strong> link that jumps straight to the builder.</p>
            </>
          ),
          answerText: 'Open Lineups in the left sidebar (under Season). It opens on the Games tab — your upcoming and recent games, each flagged Lineup set or Not set, with the bright Build lineup button on the next game that needs one. A filter row cuts the list down: All, League, Tournament, Scrimmage, plus a "Needs lineup" toggle with a live count that stacks with the type filter (for example, tournament games still missing a lineup). The Templates tab beside it holds your reusable lineups. Season analytics moved to Insights in the Season menu — the quiet "Season insights" link at the bottom of the Games tab jumps there. You can still open a game on the Schedule; its Lineup tab shows a quick read-only preview with an "Edit in Lineups" link that jumps to the builder.',
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
              <p>Open <strong>Notification settings</strong> — it&apos;s a link in the <strong>bell</strong> menu, and there&apos;s one at the top of your full notifications page too. It opens <strong>one page for everything you&apos;re part of</strong>: a card for each team and organization. Each card opens on a <strong>simple view</strong> — plain-language groups (like <strong>Needs your attention</strong> and <strong>What&apos;s happening</strong>) with one <strong>bell</strong>, <strong>push</strong>, and <strong>email</strong> switch per group — with <strong>Customize individual notifications</strong> a tap away if you&apos;d rather set each one by hand. Your phones are managed once at the top, with a <strong>test</strong> button to confirm push is actually reaching a device.</p>
              <p>Your coach card leads with <strong>Weekly summary</strong> (the Sunday review), so it&apos;s the first thing you can switch off, followed by team activity like tryout responses. <strong>Chat</strong> notifications aren&apos;t here — they live on the <strong>Chat</strong> tab — and an <strong>@mention</strong> always reaches you.</p>
              <p><strong>Signing out</strong> stops notifications on <em>that device</em> — handy on a shared or family phone — and <strong>signing back in turns them on again automatically</strong>, with nothing to re-enable. Anything you missed while signed out is waiting in your <strong>bell</strong> and <strong>Chat</strong> unread badges.</p>
            </>
          ),
          answerText: 'Open Notification settings — the link in the bell menu, and one at the top of your full notifications page. It opens one page for everything you are part of: a card for each team and organization. Each card opens on a simple view — plain-language groups (like Needs your attention and What’s happening) with one bell, push, and email switch per group — with Customize individual notifications a tap away to set each one by hand. A group switch can read on, off, or mixed; tapping a mixed one turns the whole group on. Your phones are managed once at the top, with a test button to confirm push reaches a device. Your coach card leads with the Weekly summary (the Sunday review) so it is the first thing you can switch off, then team activity like tryout responses. Chat notifications are not here — they live on the Chat tab — and an @mention always reaches you. Signing out stops notifications on that device (handy on a shared or family phone), and signing back in turns them on again automatically with nothing to re-enable — anything you missed is waiting in your bell and Chat unread badges.',
          keywords: ['notification settings', 'change notifications', 'turn off notifications', 'manage notifications', 'notification preferences', 'push settings', 'email notifications', 'bell settings', 'my devices', 'test push', 'where are notification settings', 'account notifications', 'all your notification settings', 'opt out', 'stop emails', 'simple view', 'groups', 'customize individual notifications', 'turn on all', 'group switch', 'needs your attention', 'what is happening', 'sign out stops notifications', 'shared device', 'family phone', 'why did notifications stop', 'notifications stopped after signing out', 'sign back in notifications'],
        },
        {
          id: 'faq-setup-required-optional',
          question: 'Do I have to finish every setup step on Premium?',
          answer: (
            <p>No. Only <strong>adding your roster</strong> is genuinely required — almost everything else reads from it. The rest of the essentials, plus jersey numbers and positions, assistant coaches, and team documents, are <strong>optional</strong>. Set up the ones you want and hit <strong>Skip</strong> on any you won&apos;t use; skipping ticks the step off just like finishing it, and once every step is done or skipped the <strong>Season setup</strong> chip disappears from your header on its own. If you&apos;d rather it stopped prompting you right now, open the chip and choose <strong>Turn off setup hints</strong> — one click, reversible, and it applies to every team you coach. You can return to a skipped step any time from the sidebar.</p>
          ),
          answerText: 'No. Only adding your roster is genuinely required on Premium — almost everything else reads from it. The rest of the essentials, plus jersey numbers and positions, assistant coaches, and team documents, are optional. Set up the ones you want and hit Skip on any you will not use; skipping ticks the step off just like finishing it, and once every step is done or skipped the Season setup chip disappears from your header on its own. To stop it prompting you immediately, open the chip and choose Turn off setup hints — one click, reversible, and it applies to every team you coach. You can return to a skipped step later from the sidebar.',
          keywords: ['skip setup step', 'required step', 'optional step', 'finish setup', 'do i have to', 'budget optional', 'positions optional', 'schedule optional', 'mark complete', 'turn off setup hints', 'stop the prompts', 'hide setup'],
          popular: true,
        },
        {
          id: 'faq-first-week-trail',
          question: 'What is the “Season setup” chip in my Overview header?',
          answer: (
            <>
              <p>It&apos;s a small control beside the <strong>?</strong> button at the top of your team Overview, showing how many setup essentials are still open — <em>Season setup · 1 of 5</em>. Tap it and a panel drops down with the full list: <strong>Roster</strong>, <strong>Schedule</strong>, <strong>Lineup</strong>, <strong>Families</strong> (your first announcement) and <strong>Money</strong>, then a second group of things to do <strong>when you&apos;re ready</strong> — jersey numbers and positions, assistant coaches, team documents. Every step links into the section it names, and every optional step has its own <strong>Skip</strong>.</p>
              <p>Steps tick themselves off from your real data — add a player, put a game on the calendar, save a lineup, send an announcement, set a budget or dues. Nothing to mark complete by hand.</p>
              <p>While you&apos;re still getting set up, the card at the top of your Overview names the single next thing worth doing, with a button straight to it — and the offer to take the <strong>2-minute tour</strong> sits beside it, the one place it appears. Once the essentials are done the chip goes quiet; once everything is done or skipped it disappears. A game happening today always takes that card instead — setup never gets in the way of game day.</p>
              <p><strong>It&apos;s not the only way to find things.</strong> Every section of the portal explains itself the first time you open it — what it&apos;s for, what it makes easier elsewhere, and what needs doing first — so you can explore straight from the sidebar and never touch this chip. And you only ever see steps your access lets you complete: an assistant without money access isn&apos;t shown the Money step.</p>
            </>
          ),
          answerText: 'The Season setup chip sits beside the ? button at the top of your team Overview and shows how many setup essentials are still open, for example "Season setup 1 of 5". Tapping it opens a panel with the essentials — Roster, Schedule, Lineup, Families (your first announcement) and Money — plus a "when you are ready" group covering jersey numbers and positions, assistant coaches and team documents. Every step links into its section and every optional step has its own Skip. Steps tick off automatically from your real data; there is nothing to mark complete by hand. While you are still getting set up, the card at the top of your Overview names the next thing to do with a button to it, and the 2-minute tour offer sits beside it — the one place it appears. Once the essentials are done the chip goes quiet, and once everything is done or skipped it disappears. A game today always takes that card instead. You do not need the chip to find things: every section explains itself at its own empty state the first time you open it. You only see steps your access lets you complete.',
          keywords: ['season setup', 'setup chip', 'first week', 'your first week', 'progress trail', 'five steps', 'setup panel', 'overview panel', 'header chip', 'next action line', 'what else is there', 'sections i have not used', 'discover', 'also in your portal', 'chip wont go away', 'hide setup', 'turn off setup hints', 'when does setup disappear'],
          popular: true,
        },
        {
          id: 'faq-overview-one-thing',
          question: 'Why does my Overview only show one thing to do?',
          answer: (
            <>
              <p>Because on any given day there usually <em>is</em> only one. Your Overview picks the single card that matters most right now and shows that one — never two at once, and never two that disagree.</p>
              <p>What it picks, in order: a <strong>game today</strong> beats everything; then your <strong>next game</strong>; then a <strong>Season check</strong> if games have stopped for a few weeks; then a nudge to <strong>add an event</strong> if your schedule is empty; and in your first week, your <strong>next setup step</strong>. Whatever it picks, the alternatives sit beside it as plain links — the Season check, for instance, always offers <strong>Add an event instead</strong>, so being asked whether your season is over never traps you into saying yes.</p>
              <p>If nothing needs a decision, no card appears at all and your six tiles lead. That&apos;s not an error — it means there&apos;s nothing waiting on you.</p>
              <p><strong>The button also follows what you&apos;ve already done</strong>, not just what you&apos;re allowed to do. On a game day it names the first thing still outstanding — build the lineup, then take attendance — and once both are done it stops asking. It will never offer you work the card has just told you is finished.</p>
              <p><strong>Two coaches on the same team can see different cards</strong>, and that&apos;s deliberate: you&apos;re only ever offered an action you can actually complete. An assistant without lineup access is asked for <strong>attendance</strong> and never the lineup, and the lineup chip isn&apos;t shown to them either — the card would rather say nothing than guess about something they aren&apos;t cleared to see. (The game&apos;s own details — time, place, call time and uniform — show to everyone on staff.) A coach who can&apos;t close a season sees the Season check as a heads-up with no button, because the club closes it.</p>
            </>
          ),
          answerText: 'Your Overview shows one card at a time — the single thing that matters most right now — never two at once and never two that disagree. It picks in order: a game today beats everything, then your next game, then a Season check if games have stopped for a few weeks, then a nudge to add an event if your schedule is empty, and in your first week your next setup step. The alternatives sit beside it as links — the Season check always offers "Add an event instead", so being asked whether your season is over never traps you into saying yes. If nothing needs a decision, no card appears and your six tiles lead; that is not an error. The button also follows what you have already done, not just what you are allowed to do: on a game day it names the first thing still outstanding — build the lineup, then take attendance — and once both are done it stops asking, so it never offers work the card has just told you is finished. Two coaches on the same team can see different cards on purpose: you are only offered an action you can complete. An assistant without lineup access is asked for attendance and never the lineup, and the lineup chip is not shown to them either — the card would rather say nothing than guess about something they are not cleared to see, though the game\'s own details (time, place, call time and uniform) show to everyone on staff. A coach who cannot close a season sees the Season check as a heads-up with no button because the club closes it.',
          keywords: ['one thing', 'why only one card', 'overview card', 'what should i do next', 'season check', 'is the season over', 'close out the season', 'add an event instead', 'two cards', 'conflicting', 'contradicting', 'add an event and close the season', 'game day card', 'next game card', 'no card', 'empty overview', 'different from my assistant', 'assistant sees something else', 'build lineup missing', 'take attendance instead', 'button changes', 'button follows what i have done'],
          popular: true,
        },
        {
          id: 'faq-overview-no-button',
          question: 'My game-day card has no button. Where did Build lineup go?',
          answer: (
            <>
              <p><strong>You&apos;ve already done everything the card would ask for.</strong> The button names the first thing still outstanding, so when the lineup is set <em>and</em> attendance is taken, there&apos;s nothing left for it to say — and the card goes quiet rather than inventing a job for you. The <strong>green chips</strong> are the confirmation: <em>10 of 12 in</em> and <em>Lineup set</em>.</p>
              <p><strong>Nothing is out of reach.</strong> Every chip is a door — tap <strong>Lineup set</strong> to open the lineup you built, or the attendance chip to change who&apos;s coming. You can also reach both any time from <strong>Lineups</strong> and <strong>Schedule</strong> in the sidebar.</p>
              <p><strong>Closer to first pitch the button comes back as <em>Open game day</em></strong> — from your call time (or about two hours before the start) until a few hours after the end. That&apos;s the window in which there&apos;s actually a game to run; before it, the bench console has nothing to show you yet.</p>
              <p>Undo any of the prep — clear the lineup, say — and the matching button returns immediately, with its chip turning amber.</p>
            </>
          ),
          answerText: 'It means you have already done everything the card would ask for. The button names the first thing still outstanding, so when the lineup is set and attendance is taken there is nothing left for it to say, and the card goes quiet rather than inventing a job for you. The green chips are the confirmation: "10 of 12 in" and "Lineup set". Nothing is out of reach — every chip is a door, so tap "Lineup set" to open the lineup you built or the attendance chip to change who is coming, and both are also in Lineups and Schedule in the sidebar. Closer to first pitch the button comes back as "Open game day", from your call time (or about two hours before the start) until a few hours after the end — the window in which there is actually a game to run. Undo any of the prep, such as clearing the lineup, and the matching button returns immediately with its chip turning amber.',
          keywords: ['no button', 'button missing', 'button disappeared', 'build lineup gone', 'build lineup missing', 'where did build lineup go', 'no build lineup button', 'card has no button', 'nothing to click', 'open game day button', 'when does open game day appear', 'take attendance gone', 'green chips', 'lineup set chip', 'why is my card empty', 'game day card no action'],
          popular: true,
        },
        {
          id: 'faq-overview-tiles',
          question: 'What are the six tiles on my Overview, and why did mine change?',
          answer: (
            <>
              <p>They&apos;re your team at a glance, and they stay in the same places all season so you learn where to look. Most coaches see: <strong>record</strong>, <strong>roster</strong>, <strong>next up</strong> (or <strong>this week</strong> when the card above is already about your next game), <strong>tournaments</strong>, <strong>dues</strong> and <strong>budget</strong>.</p>
              <p><strong>If you don&apos;t have money access</strong>, the two money tiles are replaced — not removed — by the two questions that are actually yours: <strong>Attendance</strong> (your season average, and how many players have slipped below 70%) and <strong>Playing time</strong> (where minutes have gone across your saved lineups). Assistant coaches get a full board, not a gap.</p>
              <p><strong>Before you&apos;ve set up any money</strong>, dues and budget collapse into a single <strong>Money — not set up</strong> tile, and the freed space goes to Attendance. Set up either dues or a budget and the two tiles come back.</p>
              <p>A tile that reads <strong>Not set</strong> or <strong>Not enough yet</strong> isn&apos;t broken — it&apos;s telling you there isn&apos;t enough recorded to answer honestly yet. Attendance and playing time both wait for a few real sessions before showing a number rather than guessing from one.</p>
            </>
          ),
          answerText: 'The six Overview tiles are your team at a glance and keep the same places all season. Most coaches see record, roster, next up (or this week when the card above is already about your next game), tournaments, dues and budget. If you do not have money access, the two money tiles are replaced — not removed — by Attendance (your season average and how many players have slipped below 70%) and Playing time (where minutes have gone across your saved lineups), so assistant coaches get a full board rather than a gap. Before you have set up any money, dues and budget collapse into a single "Money — not set up" tile and the freed space goes to Attendance; set up dues or a budget and the two tiles return. A tile reading "Not set" or "Not enough yet" is not broken — attendance and playing time wait for a few real sessions before showing a number rather than guessing from one.',
          keywords: ['overview tiles', 'six tiles', 'at a glance', 'tiles changed', 'missing tile', 'attendance tile', 'playing time tile', 'playing time fair', 'where is playing time going', 'evenly spread', 'leans on a few', 'money not set up', 'dues tile', 'budget tile', 'record tile', 'this week tile', 'next up tile', 'not enough yet', 'not set', 'assistant coach tiles', 'different tiles', 'why is my board different'],
          popular: true,
        },
        {
          id: 'faq-overview-record-count',
          question: 'The record on my Overview isn’t counting the games I expected',
          answer: (
            <p>Your record counts <strong>league</strong> and <strong>tournament</strong> games by default, and leaves <strong>scrimmages</strong> out. That choice lives in <strong>Insights</strong> (under <strong>Season</strong>) — tick or untick the game types there and the Overview tile follows, so the two can never disagree. The tile names what it&apos;s counting underneath the number. If you&apos;ve unticked everything it reads <strong>Not counted</strong> rather than pretending you haven&apos;t played.</p>
          ),
          answerText: 'Your record counts league and tournament games by default and leaves scrimmages out. That choice lives in Insights under the Season menu — tick or untick the game types there and the Overview record tile follows, so the two can never disagree. The tile names what it is counting underneath the number. If you have unticked every type it reads "Not counted" rather than pretending you have not played any games. Only finalized games with a result count.',
          keywords: ['record wrong', 'record not counting', 'scrimmage not counted', 'include scrimmages', 'record filter', 'game types', 'league tournament scrimmage', 'why is my record different', 'record does not match', 'not counted', 'w l t', 'wins losses'],
        },
        {
          id: 'faq-fewer-fields',
          question: 'Where did the rest of the fields on Add player and Add event go?',
          answer: (
            <>
            <p>They&apos;re behind the <strong>&ldquo;＋ Add …&rdquo;</strong> lines at the bottom of the form. The forms now open with just the handful of things most players and events need, and everything else — parent/guardian contact, date of birth, notes, and on events the arrival time, address, field number, uniform, tags, links and custom name — opens when you tap that line. If you&apos;re <em>editing</em> something that already has those details filled in, the group opens by itself so you never lose sight of what you entered, and it stays open once you open it.</p>
            <p>One thing did move on purpose: <strong>Add player now asks for a single Best Position</strong> instead of a primary and a secondary. It&apos;s the same setting as the <strong>Positions</strong> picker on the player&apos;s profile — that picker just does it better, letting you rank as many spots as you like and mark Okay and Never. Add the player with their main spot, then rank the rest on their profile whenever you want.</p>
            </>
          ),
          answerText: 'Add player and Add event now open with only the fields most players and events need; the rest sit behind a "+ Add ..." line at the bottom of the form — parent/guardian contact, date of birth, notes, and on events the arrival time, address, field number, uniform, tags, links and custom name. Editing something that already has those details opens the group automatically. One change on purpose: Add player asks for a single Best Position instead of a primary and secondary. It is the same setting as the Positions picker on the player profile, which lets you rank as many spots as you like and mark Okay and Never — add the player with their main spot and rank the rest on their profile later.',
          keywords: ['missing fields', 'where did fields go', 'fewer fields', 'guardian email missing', 'add details', 'optional fields', 'shorter form', 'collapsed', 'expand fields', 'cant find notes', 'cant find address', 'field number missing', 'uniform missing', 'date of birth missing'],
        },
        {
          id: 'faq-assistant-permissions',
          question: 'How do I choose what an assistant coach can do?',
          answer: (
            <>
              <p>Open <strong>Staff</strong> (head coach only) and invite them by email. Each assistant has their own card with two groups.</p>
              <p><strong>Everyday coaching</strong> is up front — seeing the schedule, <strong>changing</strong> the schedule, attendance, lineups, <strong>staff chat</strong>, viewing the roster, and <strong>documents</strong> (the blank team forms your organization publishes). These are what an assistant is normally invited to do, they&rsquo;re all on from the start, and they save the moment you tap them.</p>
              <p><strong>Seeing and changing the schedule are separate switches.</strong> Leaving the second one off gives someone the practices and games to turn up to without the ability to add, edit or cancel any of them. Every assistant you invited before this existed has both.</p>
              <p><strong>Sensitive access</strong> sits behind its own line and covers team money, family contact details and player birthdates, internal notes, sending announcements, and tryouts. The line shows how many are currently granted, so nothing is ever hidden from you, and it opens by itself if anything is already on. <strong>Every one of them asks you to confirm before you grant it</strong> — each exposes something personal: your team&apos;s finances, your families&apos; details, private staff notes, the ability to email every parent, or the contact details of children still trying out. <strong>Taking access away is always instant</strong> and never asks.</p>
              <p><strong>One pair works together.</strong> A player&apos;s <em>signed</em> forms — waivers and medical consents on their profile — need <strong>both</strong> Documents <em>and</em> Contacts &amp; birthdates. Documents on its own is only the blank forms. So if you grant one and the assistant already has the other, we&apos;ll ask you to confirm at that point, because between them they open every family&apos;s signed paperwork.</p>
            </>
          ),
          answerText: 'Open Staff (head coach only) and invite an assistant by email. Their card has two groups. Everyday coaching — seeing the schedule, changing the schedule, attendance, lineups, staff chat, viewing the roster, and documents (the blank team forms your organization publishes) — is up front and saves instantly. Seeing and changing the schedule are separate switches: leave the second off and someone gets the practices and games to turn up to without being able to add, edit or cancel any of them; every assistant invited before this existed has both. Sensitive access sits behind its own line and covers team money, family contact details and birthdates, internal notes, sending announcements, and tryouts; the line shows how many are granted and opens automatically if any are on. Every item in the sensitive group asks you to confirm before granting. Removing access is always instant and never asks. One pair works together: a player’s signed forms — waivers and medical consents on their profile — need BOTH Documents and Contacts and birthdates. Documents on its own is only the blank team forms, so granting the second half of that pair asks you to confirm because together they open every family’s signed paperwork.',
          keywords: ['assistant coach', 'assistant permissions', 'what can my assistant do', 'staff permissions', 'grant access', 'money access', 'contacts and birthdates', 'send announcements', 'sensitive access', 'everyday coaching', 'confirm before granting', 'remove assistant', 'take access away', 'restrict assistant', 'internal notes access', 'tryouts access', 'signed forms access', 'medical consent access', 'waiver access', 'documents and contacts', 'why did it ask me to confirm'],
        },
      ],
    },
    {
      id: 'premium-money',
      group: 'Premium Coaches Portal',
      heading: 'Managing your team’s money (Premium)',
      summary: 'Money opens with your next step while you set up, then becomes a one-screen season dashboard — collections, cash on hand, budget, and the next 30 days of money. All of it reads on a phone.',
      keywords: ['money', 'money hub', 'money tabs', 'tab bar', 'switch between money screens', 'budget', 'season budget', 'dues', 'expenses', 'money in', 'money out', 'on hand', 'headroom', 'budget headroom', 'overview', 'money overview', 'dashboard', 'collections', 'cash on hand', 'next 30 days', 'money timeline', 'coming due', 'what is coming due', 'more in money', 'season total', 'estimated total', 'estimate', 'set an estimate', 'not itemized yet', 'over your estimate', 'budget buffer', 'expected funding', 'expected fundraising', 'fundraising in the budget', 'estimated fundraising', 'sponsorship', 'sponsor', 'grant', 'money coming in', 'money in', 'money in tab', 'record income', 'log income', 'income entry', 'money the team earned', 'registration revenue', 'concession revenue', 'gate admission', 'merchandise sales', 'money back', 'money back on something', 'refund', 'refunded entry', 'cancelled entry refunded', 'vendor credit', 'credit note', 'record a refund', 'log a refund', 'reimbursement from the club', 'club paid us back', 'a parent paid me back', 'is a refund income', 'refund vs income', 'money back vs paid out of pocket', 'who paid it back', 'date received', 'nets into the row', 'one row not two', 'statement', 'statement view', 'revenue and expenses', 'season net', 'by activity', 'did the tournament pay for itself', 'per activity', 'program report', 'report shapes', 'two report shapes', 'revenue section', 'expenses section', 'variance wording', 'under and over', 'up and down', 'one row one source', 'why cant i log income here', 'income already comes from fundraisers', 'lower player dues', 'funded by players', 'player installments', 'planned costs', 'estimated installments', 'scheduled installments', 'buffer above the plan', 'planned buffer', 'short of covering the plan', 'reduce dues with fundraising', 'list or by period', 'by period', 'plan by month', 'plan by quarter', 'unscheduled', 'spread a cost across the season', 'spreading costs', 'generate installments', 'split evenly', 'percent split', 'custom category', 'budget categories', 'unbudgeted', 'recategorize', 'export budget', 'treasurer', 'money tags', 'tag an expense', 'tag expenses', 'filter expenses by tag', 'spend by tag', 'expense tag', 'manage money tags', 'money on a phone', 'budget on my phone', 'swipe the table', 'table scrolls sideways', 'discard changes', 'keep editing', 'lost my budget line', 'unsaved changes', 'cash received', 'cash paid', 'budget by month', 'month view', 'months', 'month columns', 'monthly budget', 'spreadsheet view', 'scheduled', 'difference', 'no date yet', 'cash flow', 'running balance', 'run out of money', 'will we run short', 'last season', 'prior season', 'compare to last year', 'payables', 'payment schedule', 'what do we owe', 'overdue payable', 'deposit and balance', 'import', 'import a spreadsheet', 'import budget', 'import payables', 'upload a spreadsheet', 'paste from excel', 'template', 'download a template', 'excel', 'csv', 'bring my budget in', 'round trip', 'export and import', 'split by period', 'how is this line split', 'split by month', 'budget by month', 'monthly budget line', 'split by quarter', 'budget by quarter', 'quarterly budget', 'specific dates', 'just names', 'add period', 'fill the season', 'clear all periods', 'undo periods', 'period label', 'label optional', 'name a period', 'do i have to name a period', 'period has no date', 'undated period', 'deposit and balance', 'save changes does nothing', 'budget line will not save', 'things to fix', 'period total red', 'amounts do not add up', 'year band', 'year above the months', 'which year is this column', 'import will not update my fundraising line', 'sheet row is a cost', 'where is import', 'where is export', 'import button moved', 'export button moved', 'cant find import', 'cant find export', 'recent imports', 'import history', 'who imported', 'what was imported', 'export budget lines', 'export expenses', 'export payables', 'export fundraisers', 'export player dues', 'how do i get a csv', 'where is csv', 'where is pdf', 'choose a file type', 'which format', 'file type', 'save as', 'export as excel', 'printable dues statement', 'no export on my phone', 'export missing on phone', 'import missing on phone', 'download the season money', 'money in a spreadsheet', 'set dues for all players', 'redo dues', 'change dues', 'wrong due date', 'regenerate installments', 'replace the dues schedule', 'already paid', 'build a budget first', 'no budget yet', 'payment details', 'where is mark paid', 'deposit and balance hidden', 'expand a payable', 'payable status', 'part paid', 'scheduled', 'no schedule', 'payable row', 'edit an expense', 'edit a payable', 'change an expense', 'fix a typo', 'wrong amount', 'delete an expense', 'delete a payable', 'remove an expense', 'undo an expense', 'amount is locked', 'cannot change the amount', 'why cant i edit', 'greyed out amount', 'expense or payable', 'whats the difference between an expense and a payable', 'which one do i use', 'one add button', 'where is add expense', 'where is add payable', 'add button', 'switch to payable', 'wrong kind', 'transactions', 'transactions tab', 'where did expenses and payables go', 'expenses tab missing', 'two money tabs', 'commitments', 'commitments tab', 'commitment', 'add a commitment', 'record what we owe', 'expense or commitment', 'due date on a payable', 'commitment has no due date', 'no schedule', 'why isnt my payable on the schedule', 'nothing moves', 'when you save nothing moves', 'settle a commitment', 'mark paid asks when', 'mark paid opens a form', 'record the payment', 'back date a payment', 'wrong month on the report', 'promised not paid yet', 'where is promised not paid yet', 'future date', 'that hasnt happened yet', 'cant enter a future date', 'date in the future refused', 'schedule view', 'payables opens on the schedule', 'payment method', 'how did we pay', 'e-transfer spelling', 'same payment method', 'method suggestions', 'recurring payable', 'repeating payable', 'every month', 'monthly payable', 'fundraiser columns', 'raised team keeps credits', 'which fundraiser raised the most', 'record a payment', 'record payment', 'partial payment', 'part payment', 'pays monthly', 'smaller amounts', 'e-transfer', 'etransfer', 'cash', 'cheque', 'date received', 'payment date', 'backdate a payment', 'remove a payment', 'delete a payment', 'payments list', 'receipt', 'mark rest paid', 'overpayment', 'overpaid', 'paid too much', 'in credit', 'auto credit', 'balance owing', 'payments kept', 'change dues after payment', 'season totals', 'totals row', 'dues totals', 'total assessed', 'total collected', 'next due date', 'where are my dues totals', 'no totals row', 'see an example', 'preview the reminder email', 'what does the reminder email say', 'when do reminders go out', 'credits reduce', 'credit setting', 'last payment first', 'next payment first', 'keep credits separate', 'settle at season end', 'to send', 'left to send', 'covered by fundraising', 'settled', 'settled vs fully paid', 'up to date', 'past due', 'what does up to date mean', 'what does past due mean', 'why does it say partial', 'partial status', 'status column', 'dues status', 'who is behind on dues', 'who is late', 'whos overdue', 'fundraising lowers the bill', 'which bill does the credit come off', 'team is holding my money', 'owed back', 'where it lands', 'preview the credit', 'pay out', 'pay a credit back', 'hand the money back', 'refund a credit', 'cash back to a family', 'paid out', 'remove a payout', 'undo a payout', 'paid by', 'out of pocket', 'parent paid', 'family paid for it', 'reimburse a parent', 'reimbursement', 'a parent bought', 'no cash leaves the team', 'season settlement', 'settlement sheet', 'season refund', 'refund calculator', 'refund the families', 'refund at season end', 'end of season money', 'whats left over', 'surplus', 'surplus to share', 'share the surplus', 'split the money left', 'even share', 'one share per player', 'pay the families back', 'pay everyone back', 'pay all', 'cash the team holds', 'owed to families', 'hold back', 'hold back for next season', 'keep money for next year', 'forgive a balance', 'forgive what they owe', 'write off a balance', 'set a refund amount', 'no share', 'decline a share', 'still owes', 'family that left the team', 'departed player refund', 'siblings one cheque', 'one payout per family', 'team is short of what it owes', 'not enough to refund everyone', 'waiting on a family to pay', 'by installment', 'by instalment', 'installment view', 'installment grid', 'grid view', 'who is behind on which installment', 'what does the tick mean', 'what do the marks mean', 'tick', 'checkmark', 'half circle', 'faint dot', 'no caption', 'collection schedule', 'close out the season', 'close the season', 'pay everyone and close the season', 'ready to close', 'not ready to close yet', 'before the season can close', 'why cant i pay everyone', 'pay everyone is greyed out', 'cant close the season', 'brackets', 'number in brackets', 'negative amount', 'why is it in brackets', 'pay one family early', 'pay a family sooner', 'player left mid season', 'where is pay all', 'where is pay out on the settlement', 'settlement window', 'settlement modal', 'running a fundraiser', 'start a fundraiser', 'new fundraiser', 'open a fundraiser', 'fundraiser page', 'where is the fundraiser page', 'back to fundraisers', 'all fundraisers', 'fundraiser leaderboard', 'log what someone raised', 'log an amount', 'edit an amount', 'amount raised', 'player rebate', 'player rebate percent', 'change the rebate', 'rebate rate', 'close a fundraiser', 'closed fundraiser', 'reopen a fundraiser', 'fundraiser settings', 'bottle drive', 'chocolate sale', 'raffle', 'per player fundraising', 'past season fundraiser', 'old fundraiser results', 'last year fundraiser', 'sponsor', 'sponsors', 'sponsorship', 'add a sponsor', 'record a sponsor', 'new sponsor', 'business sponsor', 'grant', 'team sponsor', 'season sponsor', 'brought in by', 'who brought in the sponsor', 'club wide sponsor', 'pledged', 'pledge', 'received', 'promised money', 'not arrived yet', 'credit to that family', 'dollars or percent', 'default player credit', 'team default credit', 'standard split', 'expected sponsorship', 'sponsorship budget line', 'fundraising tab', 'fundraising vs sponsorship', 'allocations', 'org allocations', 'allocation', 'cost allocation', 'what has the club billed us', 'club bill', 'who creates an allocation', 'cannot add an allocation', 'allocation instalment', 'allocation installment', 'mark an instalment paid', 'payments tab', 'payment requests', 'payment request', 'pay org', 'request from org', 'from org', 'settle up with the club', 'ask the club to pay', 'club approval', 'pending request', 'cancel a request', 'withdraw a request', 'edit a payment request', 'change a payment request', 'correct a request', 'declined request', 'denied request', 'denial reason', 'why was my request declined', 'club run team', 'allocations vs expenses', 'difference between allocations and expenses', 'where are allocations', 'i dont see allocations'],
      searchText: 'money hub budget dues expenses where do i start money in money out on hand budget headroom cash treasurer team accountant plan collect spend review guide card next step season budget plan estimated total optional estimate plan to a number before you know every cost not itemized yet difference shrinks as you add lines over your estimate red row clear the estimate itemize line items expected funding fundraising sponsorship grant money coming in lowers player dues funded by players team share list or by period plan by month plan by quarter unscheduled column categories items custom category create category picker split by period percent split evenly installments generate installments every player same schedule preview player dues fundraisers expenses tournament payables deposits balances org allocations payment requests club owned budget vs actual variance monthly trend export excel csv pdf unbudgeted recategorize fix category what is this category and item item picker which item pick the item two levels category then item item names the row two lines one row summed together description fills itself in prefilled description why is description required rename an expense not budgeted charged but not budgeted flagged row item by item actual per item variance which item went over add a budget line for it team item club item publish to all teams standard item list re-file a cost after paying automatic dues reminders toggle 30 days 7 days back to money read only assistant money access money tags tag an expense tag expenses label spending winter dome fundraiser search box tag picker create tag filter expenses by tag vs tag spend by tag across categories manage money tags rename merge delete money tag shared org tag blue chip organization shared tag money on a phone mobile budget on my phone read my budget on a phone cards one card per expense labels on every line budget vs actual swipes sideways swipe the table scroll sideways horizontal scroll line name stays pinned first column stays put page does not slide cash received cash paid not what is still owed outstanding link to dues discard this budget line keep editing lost my work closed the form by accident unsaved changes asks before discarding untouched form closes org allocations payment requests money between your team and your club club run team what has the club billed us who creates an allocation i cannot add an allocation allocation is read only mark an instalment paid instalment schedule from the club field fees insurance association dues pay org request from org from org badge settle up with the club send money to the club ask the club to cover reimburse a permit i paid out of pocket every request is reviewed pending until the club reviews it edit a payment request change a request correct a request fix a typo on a request change the amount i asked for save changes withdraw a request withdraw request take it back cancel a pending request asks before withdrawing nothing is kept request locks once reviewed cannot edit an approved request pencil or eye on the row declined denied denial reason why was my request declined payment method reviewed date allocations vs expenses club money or supplier money outside supplier belongs on expenses read only assistant no action buttons no buttons i cannot use budget by month months view month columns spreadsheet view rows down side months across top budget scheduled actual difference lens what each cell shows no date yet column undated budget cash flow money in money out running balance do we run dry run short in july will we run out of money projection last season column prior season compare to last year lines i had last year and have not planned payables payment schedule tab every commitment by due date unpaid paid all overdue days late mark paid dome block umpire invoice uniform order deposit and balance split remembers which view you prefer tap a figure opens the form drill in import a spreadsheet import budget import payables upload excel xlsx csv paste from excel google sheets month grid simple list payables schedule template download a template amounts left blank we never put a figure in your budget preview verdict per row adds updates cant import reason fix a row in the preview nothing is saved until you confirm what was added updated skipped nothing could be imported never guesses ambiguous date names and numbers only payables always add look alike flagged not overwritten export edit import back round trip money edit access overview dashboard season dashboard collections card progress bar cash on hand card in out bars budget card next 30 days next 60 days next 90 days one list date ordered timeline coming due going out grouped installments twelve players one line remind shortcut overdue chip unpaid chip on track all in more in money list live figure per screen no big buttons split by period how is this line split months quarters specific dates just names period picker per row add period advances the month feb mar apr twelve taps fill the season twelve months four quarters clear all periods split evenly dollars or percentages changing the split clears the periods starts over fresh decision undo puts the periods back label is optional period names itself apr 2027 q2 2027 mar 14 2027 greyed in the label box type over it spring tournament deposit balance date is optional period without a date still saves no date yet column budget vs actual month columns only money blocks a save period with no amount amounts must add up to the line total period total turns red save changes does nothing button looks broken nothing happens when i save scrolls to the row at fault outlines it counter beside the button two things to fix jumps back to the problem missing label never blocks a save missing date never blocks a save annual budget by month ice time field rental coaching fees monthly entry fee due date uniform deposit import and export at the top of money same on every tab where is import where is export import button moved export button moved recent imports import history who imported it what was imported budget lines player dues expenses payables fundraisers budget vs actual pick what to export then choose a file type excel csv pdf like save as printable statement pdf only on plans that include it and only on player dues and budget vs actual put away on a phone no export on my phone spreadsheet is not phone work empty budget still offers import empty payables offers import paste from a message add line one add button expense or income pills at the top of the form this is a refund tick box already set to the tab you are on flipping it keeps what you typed one search box for category and item type to find an item search the item list item list follows the pill income does not show expense items expense does not show income items add an item without leaving the form manage our items rename an item move an item to the other side wrong side of the books what saving will do line above the buttons names the family paid by is under more save button says save new fundraiser new request sit with their own screen create button moved down edit an expense edit a payable pencil on the row tap the row to open it fix a typo wrong amount delete an expense delete a payable puts the money back tells you the amount first amount locks once paid already on the books delete and enter it again out of pocket credit removed too payment method suggests what you have used before stops three spellings of e-transfer no repeat option yet import a whole season set dues for all players opens the same window as generate installments one door both screens preview every player before you confirm how amounts are set split the budget evenly split the season estimate evenly set the amounts myself manual amounts type my own amounts deposit now balance later uneven installments per player figure shown before you pick amounts fill themselves in auto recalculate when you add a due date odd cents on the last payment short of what players need to fund collecting more than the budget a note never a block no budget yet even split greyed out with the reason you can still set dues by hand link to build a budget expected funding already covers the season estimated total is zero add players to the roster first empty roster is the only hard stop redo the dues change the dues wrong due dates wrong amount regenerate replaces the schedule payments are kept payment is never thrown away counts toward the new schedule paid more than the new total overpayment credit edit schedule on a player row record a payment amount date received method e-transfer cash cheque note oldest installment first part paid partial payment 200 of 300 mark rest paid payments list receipt remove a payment voids the books entry undo a payment overpayment auto credit balance owing reminder quotes what is left thank you for what has arrived season totals totals row at the bottom of the dues table dues totals total assessed total credits total collected balance owing next due date overdue count under next due where are my dues totals why is there no totals row totals hidden until dues are set last card on a phone credits reduce credit setting a credit is money the team owes a family last payment first next payment first keep separate settle at season end credits land on real installments to send left to send dues minus cash minus credits covered by fundraising not paid paid stays cash settled fully paid in credit team is holding this family money owed back where it lands preview which bill drops fundraising lowers the bill reminder names the fundraising family never chased when credits settled everything pay out hand the money back in cash money out entry dated the day it left partial payout remove a payout undo puts it back forgiven is never payable paid by out of pocket a parent paid for it reimbursement credit counts in the budget no cash leaves the team already settled nothing to mark paid by installment view grid one column per installment one row per player who is behind on which bill tick nothing left to send warning mark amount past its due date half circle part way faint dot not due yet every figure is money still to come in collection schedule band season settlement opens in a window forecast mid season cash the team holds credits owed to families dues still to come in hold back sits above the total surplus to share still owes column reads across brackets are a negative family owes the team change what they take even share set amount no share forgive close out the season pay everyone and close the season ready to close before the season can close every family square on their dues team holding enough to cover every refund checklist blockers warnings unspent plan club funding cannot be attributed pay one family sooner from their own money record player leaving mid season team is short of what it owes shares nothing running a fundraiser new fundraiser name player rebate percent dates it runs share that goes back to the player open a drive leaderboard one row per player amount raised rebate earned left to send opens inside money tab bar stays all fundraisers takes you back log amount where it lands preview which bills the rebate lowers credit on their dues each entry keeps the rate it was logged at changing the percentage applies to new entries only settings renames a drive closed drive stays readable stops accepting new amounts finished season lists the players who were on that season roster nothing can be edited sponsors sponsorship one business or grant gives directly single arrival pledged received promised but not arrived counts toward your budget posts to the books brought in by optional club wide sponsor belongs to no family credit to that family dollars or a percentage default player credit team settings money standard share fills in on every new fundraiser and sponsor expected sponsorship budget line budget vs actual did our sponsorship hit the number',
      content: (
        <p>On Premium, <strong>Money</strong> opens with a guide card while you&apos;re <strong>setting up</strong> — a brand-new team sees <em>&ldquo;Start with your season budget&rdquo;</em>; once a budget exists it offers to <strong>turn the plan into player dues in one click</strong>. The moment dues are out, the guide card&apos;s job is done and the Overview becomes your <strong>season dashboard</strong>.</p>
      ),
      subtopics: [
        {
          id: 'premium-money-cards',
          title: 'The season dashboard: three cards',
          content: (
            <>
              <p>In season, three cards read your books at a glance, each fact in exactly one place — and all three are <strong>cash received and cash paid, never what&apos;s still owed</strong>. An unpaid bill or instalment doesn&apos;t move them until it&apos;s marked paid, which is why they always agree with the Budget vs. Actual report.</p>
              <HelpDefs>
                <HelpDef term="Collections">What&apos;s come in of what&apos;s expected, on a progress bar, with a chip that flags anyone <strong>overdue</strong> or unpaid (the card edge turns red while anything is overdue).</HelpDef>
                <HelpDef term="Cash on hand">Received minus paid, with small <strong>In</strong> and <strong>Out</strong> bars you can compare at a glance — and it says plainly right on the card that these are cash, not what&apos;s still owed. It links straight to <strong>what&apos;s outstanding</strong> on Player Dues.</HelpDef>
                <HelpDef term="Budget">Your headroom first, then the plan against reality as three small bars on one dollar scale — <strong>Spending</strong> against planned costs, <strong>Player dues</strong> collected against what&apos;s actually scheduled (the real figure, never a computed even split), and <strong>Fundraising</strong> raised against what you budgeted — each row just two figures, actual of planned, with the headroom above them doing the subtraction. Going over the plan is striped and worded; beating a fundraising goal gets a ✓ instead.</HelpDef>
              </HelpDefs>
              <p>Below them, <strong>Next 30 days</strong> lists everything coming due — player dues, team payables, and org payments — as <strong>one date-ordered list</strong> (switchable to 60 or 90 days): installments that share a date and amount collapse into a single line like <em>&ldquo;Installment #2 — 12 players&rdquo;</em>, and an overdue line carries a <strong>Remind</strong> shortcut that jumps into Player Dues — the screen where reminders are actually sent.</p>
              <HelpNote variant="tip" title="The dashboard reports; it never acts">It deliberately has no big action buttons — doing something is always one tap away on the screen that owns it.</HelpNote>
            </>
          ),
        },
        {
          id: 'premium-money-navigation',
          title: 'Getting around the Money hub',
          content: (
            <>
              <p>Money is eight screens, and the hub lists them all in one place. <strong>Everything in Money</strong> — under the guide card while you&apos;re setting up — shows each with a live figure beside it, grouped in the treasurer&apos;s order, so working through the list is working through your season in the order it happens:</p>
              <HelpDefs>
                <HelpDef term="Plan">Season Budget Plan</HelpDef>
                <HelpDef term="Collect">Player Dues · Fundraisers · Sponsorships — the last two open the same <strong>Fundraising</strong> screen, each showing just its own kind</HelpDef>
                <HelpDef term="Spend">Payables and Transactions — plus Org Allocations and Payment Requests when a club or league runs your team</HelpDef>
                <HelpDef term="Review">Budget vs. Actual</HelpDef>
              </HelpDefs>
              <p>On a narrow window the list runs as one column; on a wide screen it folds into two side by side, so the whole list fits without scrolling. In season the same list appears under the dashboard as <strong>More in Money</strong>, carrying whatever the three cards above it don&apos;t already show. Either way, every screen is also one tap away in the <strong>tab bar</strong> across the top — hopping between Money screens never means leaving the page.</p>
              <p><strong>Spending is two screens, and the difference is timing.</strong> <strong>Transactions</strong> records money that has already moved; <strong>Payables</strong> holds what the team owes but hasn&apos;t paid, with the payment schedule. If it has a due date, it belongs on Payables. Older bookmarks still land on the right one.</p>
              <p><strong>All of it works on a phone.</strong> Lists of records — expenses, commitments, allocation instalments, fundraiser results — read as one card per item with a label on every line, so nothing is cut off at the edge of the screen. <strong>Budget vs. Actual</strong> is the exception: comparing <em>Budgeted</em>, <em>Actual</em> and <em>Variance</em> side by side is the whole point of that report, so instead of stacking, the table itself <strong>swipes sideways</strong> — the line-item name stays put on the left while the money columns move, and a small <em>&ldquo;swipe the table&rdquo;</em> cue appears whenever there&apos;s more to see. The page itself never slides around; only the table does.</p>
              <p><strong>Nothing here loses your work.</strong> Every Money form asks before discarding if you close it with something typed in — <strong>Keep editing</strong> puts you back exactly where you were. A form you haven&apos;t touched just closes.</p>
            </>
          ),
        },
        {
          id: 'premium-money-budget',
          title: 'Building your season budget',
          content: (
            <>
              <p><strong>Starting from zero.</strong> An empty <strong>Season Budget Plan</strong> opens with a guided starter — five tap questions about your season (tournaments, travel, officials, training, uniforms) build a worksheet where you price only the lines you know; nothing is guessed for you, so a blank amount simply moves to a <strong>&ldquo;Not in your plan yet&rdquo;</strong> checklist instead. That checklist keeps sitting quietly on your budget page afterward — tap <strong>+</strong> on an item once you know its cost, or <strong>&times;</strong> to hide one your team doesn&apos;t pay for (remembered on that device). Not ready to commit? A clearly-labelled <strong>sample budget</strong> for a made-up team — with its own budget and Budget vs. Actual tabs — is one tap away from either empty page: its numbers are invented, so there&apos;s nothing in it to copy. Every line asks <strong>what is this?</strong> in one search box — type a few letters of a category or an item, or type a name that isn&apos;t there yet and add it without leaving the form. The list follows what the line is, so an <strong>Expense</strong> line offers the words you spend against and a fundraising or sponsorship line the ones money arrives against. Words you add belong to your team alone; <strong>Manage our items</strong> beside <strong>Add Line</strong> renames one or moves it across.</p>
              <p><strong>Three figures tell the whole plan</strong> on the card at the top:</p>
              <HelpDefs>
                <HelpDef term="Planned costs">What the season costs. Set an optional <strong>Estimated total</strong> and it becomes this figure — the number you set is the number that counts, including for player installments — with a caption underneath tracking what you&apos;ve itemized so far. Itemize <em>past</em> your estimate and that caption turns red and says how far over: nothing is blocked, and nothing you typed is quietly ignored. <strong>Clear</strong> (inside the editor) takes it away again and your line items become the total.</HelpDef>
                <HelpDef term="Expected fundraising">A budget line can be an <strong>expense</strong> or <strong>expected fundraising</strong> — a campaign, a sponsor, a club grant. It&apos;s subtracted from what the season costs, so the plan tells you what players actually have to fund and dues are generated from that: budget $4,000 of fundraising against an $8,000 season and per player drops from $800 to $400. Enter what you expect the <strong>team</strong> to keep — if a fundraiser pays part of what a player raises back to that player, it already lowers their own dues and shouldn&apos;t be counted twice.</HelpDef>
                <HelpDef term="Player installments">The season&apos;s story: before dues exist it&apos;s <strong>estimated</strong> for you (costs less fundraising, with the per-player figure beside it and Generate installments one tap away); the moment dues go out it becomes the <strong>official scheduled figure</strong>.</HelpDef>
              </HelpDefs>
              <HelpNote variant="warning" title="The one amber caution">Scheduling <em>less</em> than the plan needs shows in amber, with the re-run door beside it. Scheduling <em>more</em> — most teams do — is confirmation, not a warning: the card just notes it plainly (<em>&ldquo;includes a $200.00 buffer above the plan&rdquo;</em>) and nothing turns red.</HelpNote>
              <p>Later, <strong>Budget vs. Actual</strong> measures expected fundraising against your team&apos;s share of what was really raised.</p>
            </>
          ),
        },
        {
          id: 'premium-money-periods',
          title: 'Spreading costs across the season',
          content: (
            <>
              <p><strong>Your plan across the season.</strong> Above the plan, <strong>List</strong> and <strong>By period</strong> switch between reading it down a list and reading it across <strong>months</strong> or <strong>quarters</strong>, built from the payment dates already on your lines. The <strong>year sits in a band above the months</strong>, so a season running September to February shows its two years as two labelled groups rather than making you read a date off one column. Anything without dates gathers in an <strong>Unscheduled</strong> column rather than disappearing, so the columns always add up to your plan.</p>
              <p>Tick <strong>Split by period</strong> on any budget line and it asks one thing first: <em>how is this line split?</em></p>
              <ul>
                <li><strong>Months</strong> — annual costs like ice or field time are far easier by month than by twelve exact dates.</li>
                <li><strong>Quarters</strong> — the same idea in four columns.</li>
                <li><strong>Specific dates</strong> — a tournament entry fee or a uniform deposit has a real due date.</li>
                <li><strong>Just names</strong> — you know the shape but not the timing yet: a deposit and a balance, with dates to come.</li>
              </ul>
              <p>Then add periods one at a time, each carrying its own picker. <strong>&ldquo;+ Add period&rdquo; moves the month along by itself</strong> — Feb, Mar, Apr — so a twelve-month budget is twelve taps and then <strong>Split evenly</strong>, with nothing to type; <strong>Fill the season</strong> does the same in one tap, and <strong>Clear all periods</strong> starts over. Amounts go in as dollars or percentages. Switching the split afterwards — months to quarters, say — <strong>clears the periods and starts over</strong>, because it&apos;s a fresh decision about how the line works rather than another way of viewing the same one. Nothing goes quietly: that, <strong>Fill the season</strong> and <strong>Clear all periods</strong> each leave an <strong>Undo</strong> beside them, which puts the periods — and the split you were using — straight back.</p>
              <p><strong>You don&apos;t have to name a period.</strong> Each one names itself from its month, quarter or date — <em>Apr 2027</em>, <em>Q2 2027</em>, <em>Mar 14, 2027</em> — and the name it will be saved under sits greyed in the label box, so there&apos;s never a surprise afterwards. Type over it whenever you want your own wording, like &ldquo;Spring tournament.&rdquo; A date is optional too: a period without one still saves, it just can&apos;t appear in the month columns of Budget vs. Actual, and the row tells you so at the time. <strong>The only things that hold a budget line back are money</strong> — a period with no amount, or amounts that don&apos;t add up to the line total.</p>
            </>
          ),
        },
        {
          id: 'premium-money-dues',
          title: 'Player dues & recording payments',
          content: (
            <>
              <p><strong>Record the money families send exactly as it arrives</strong> — any amount, on the day it arrived. A family paying $100 a month against $300 installments is recorded exactly as it happens:</p>
              <HelpScreenshot id="money-record-payment" />
              <HelpSteps>
                <li>Open the player on <strong>Player Dues</strong> and tap <strong>Record payment</strong>.</li>
                <li>Enter how much, the day it arrived (it starts on today; the team&apos;s books use <em>this</em> date, so catching up on a month of e-transfers keeps each one in its real month), how it arrived (e-transfer, cash, cheque, other) and an optional note.</li>
                <li>Money fills the <strong>oldest installment first</strong>, the table&apos;s <strong>Paid</strong> column includes every dollar received, and the family&apos;s status answers the only question that matters when you&apos;re scanning: <strong>Up to date</strong> if nothing of theirs is late, <strong>Past due</strong> if something is.</li>
                <li>Typed the wrong amount, date or method? <strong>Edit</strong> that payment in the player&apos;s <strong>Payments</strong> list — every payment sits there as its own receipt, with a pencil and a bin. Editing re-posts it: the old entry in the books is voided and a fresh one written on the date you give, so the books keep the trail and you keep your note. <strong>Remove</strong> is still there when the payment shouldn&apos;t exist at all; it voids the entry and rolls the schedule back.</li>
              </HelpSteps>
              <p>The small <strong>banknote button</strong> on an installment row is the shortcut for the same act — it records a payment for whatever the family is still asked to send on that installment, dated today, so it can never charge a family twice. It asks you to confirm first, naming the amount and the date, and then lands in the same <strong>Payments</strong> list where it can be edited or removed like any other. The only difference from <strong>Record payment</strong> is that it doesn&apos;t stop to ask how much, what day and how it arrived. Reminder emails follow the same truth: they ask for <strong>what&apos;s left to send</strong> and thank the family for what&apos;s already arrived, and a family with any recorded payment is never told they&apos;ve &ldquo;paid nothing.&rdquo;</p>
              <HelpNote variant="warning" title="Overpayments keep themselves">Pay <em>more</em> than what&apos;s left on the schedule and the extra is saved automatically as an <strong>Overpayment</strong> credit (marked <em>auto</em> in Credits — it goes away with its payment, not on its own).</HelpNote>

              <h4>Fundraising lowers the bill, not just the balance</h4>
              <p>A credit is <strong>money the team owes a family</strong> — a fundraising rebate, a contribution, an overpayment. It lands on their real installments, so the amount you ask them for actually drops:</p>
              <HelpSteps>
                <li>An $800 installment with $500 of fundraising against it shows <strong>$300.00</strong> under <strong>After fundraising</strong> and <strong>$300.00</strong> owing, with the effort that earned it named in the <strong>Note</strong> column.</li>
                <li>Cover the whole bill and the note reads <strong>Covered by fundraising</strong> — deliberately not &ldquo;Paid,&rdquo; because <strong>Paid means cash</strong> and your books should always be able to tell the two apart.</li>
                <li>The player&apos;s record runs left to right: <strong>Total dues → After fundraising → Paid → Left to send</strong>, first as four figures for the season and then a line per installment underneath, so the four totals at the top are literally the four columns added up. On a phone each installment is a tap-to-open card showing just its date and what&apos;s owing.</li>
                <li>Reminder emails open with the good news (&ldquo;your family&apos;s fundraising has earned $500.00 toward dues — thank you&rdquo;) and then ask only for the rest. A family whose fundraising settled everything isn&apos;t chased at all.</li>
              </HelpSteps>
              <p><strong>You choose which bill it lands on.</strong> Under <strong>Team settings → Money</strong>, <strong>Credits reduce</strong> offers three answers: <em>the last payment first</em> (the default — near-term amounts keep their dates and the far end of the schedule shrinks), <em>the next payment first</em> (relief now, for the family that needs it now), or <em>they don&apos;t — settle at season&apos;s end</em> (bills never move; the money is handed back instead). Nothing is ever locked in: if a family pays everything in cash anyway, the cash claims the bills and their credit simply becomes money the team owes them.</p>
              <h4>What each status means</h4>
              <p>The <strong>Status</strong> column answers one question — <em>does this family owe you anything right now?</em> — so a coach scanning the roster can see who needs chasing without doing arithmetic.</p>
              <HelpDefs>
                <HelpDef term="Past due">A bill has gone by and money is still being asked for. The only status that&apos;s a job, so it&apos;s the only one in red, with a ⚠ beside it.</HelpDef>
                <HelpDef term="Up to date">They still owe for the season, but nothing of theirs is late — including a family whose first installment simply hasn&apos;t come due yet. How far through they are is what the <strong>Paid</strong> and <strong>Balance</strong> columns are for.</HelpDef>
                <HelpDef term="Fully paid">The season is settled, entirely in cash.</HelpDef>
                <HelpDef term="Settled">The season is settled with fundraising or another credit doing part of the work. Deliberately not &ldquo;Fully paid&rdquo; — <strong>Paid means cash</strong>, so your books can always tell the two apart.</HelpDef>
                <HelpDef term="In credit">Nothing owed, and the team is holding money that belongs to this family.</HelpDef>
                <HelpDef term="Not set">No dues schedule for them yet.</HelpDef>
              </HelpDefs>
              <HelpNote variant="info" title="Fixing a credit">A credit you added yourself — a contribution, a forgiven balance, anything you typed — carries a <strong>pencil</strong> beside its bin, so a wrong amount or description is a correction rather than a delete-and-retype. Credits the system created for you can&apos;t be edited there and say why: one <em>from fundraiser</em> is the entry&apos;s raised amount and changes when you change the fundraiser; one <em>from expense</em> follows the out-of-pocket cost that created it; an <em>auto</em> overpayment rides its payment. Each is corrected where it was born, so two numbers can never disagree about the same money. What a credit <em>is</em> also can&apos;t be retyped — the kind is where the money came from, so a wrong kind means removing it and adding the right one.</HelpNote>
              <p>When the team is holding a family&apos;s money, their drawer says so plainly — <em>&ldquo;the team is holding $125.00 of this family&apos;s money&rdquo;</em> — and the <strong>Season settlement</strong> sheet at the foot of this screen is where it&apos;s handed back.</p>

              <h4>Handing the money back in cash</h4>
              <p>Lowering a bill is only one way to settle a debt. <strong>Pay out</strong> — on the player&apos;s record, beside that same line — records the cash going the other way: how much, the day it left, how it went, and an optional note. It posts one <strong>money out</strong> line to the team&apos;s books dated the day the money left, and each payout sits in the player&apos;s record as its own receipt.</p>
              <HelpNote variant="info" title="Paying out puts their bills back up">If that money was lowering an installment, handing it over in cash means it can&apos;t do both jobs — the installment returns to its full amount and reminders go back to asking for it. The sheet says exactly that before you save, and removing a payout puts everything back.</HelpNote>
              <p>You can pay out part of it; whatever&apos;s left keeps working against their bills. What a coach can never do is hand back more than a family has in credit — and a <strong>forgiven</strong> balance is never payable, because that was debt relief the team gave, not money it&apos;s holding.</p>

              <h4>When a family pays for something out of pocket</h4>
              <p>A parent buys the pizza, or covers a tournament entry on their own card. Record it as an ordinary expense and set <strong>Paid by</strong> to that family — it&apos;s under <strong>More</strong> at the foot of the form, and the line above the buttons names the family and the credit before you save:</p>
              <HelpDefs>
                <HelpDef term="The budget">Counts it exactly as if the team had paid — it&apos;s a real cost either way, and Budget vs. Actual treats it the same.</HelpDef>
                <HelpDef term="The team&apos;s cash">Untouched. No money left the account, so &ldquo;money out&rdquo; and cash on hand don&apos;t move, and the expense arrives already settled — there&apos;s nothing to mark paid.</HelpDef>
                <HelpDef term="The family">Now owed that amount, as an ordinary credit. It lowers their bills, or you pay it out in cash, or it&apos;s handed back at season&apos;s end — the same three ways as any other credit.</HelpDef>
              </HelpDefs>

              <p><strong>Your season&apos;s dues, totalled where you read them.</strong> The last row of the <strong>Player Dues</strong> table is the season&apos;s own: <strong>Assessed</strong>, <strong>Credits</strong>, <strong>Collected</strong>, <strong>Balance owing</strong> — what&apos;s left after payments <em>and</em> credits — and the <strong>next due date</strong>, each figure sitting directly under the column it totals, so none of them needs a second label. If anyone is past their due date, the count sits under that date rather than in a corner of its own. The row appears only once at least one player has a dues schedule: a team that hasn&apos;t set dues yet gets no row instead of a line of zeros. On a phone, where the table reads as one card per player, it becomes the last card in the list.</p>
              <p>A player&apos;s status word follows the same rule: <strong>Fully paid</strong> means cash covered it, <strong>Settled</strong> means credits did part of the work, and <strong>In credit</strong> means the team is holding money that&apos;s theirs.</p>
            </>
          ),
        },
        {
          id: 'premium-money-by-installment',
          title: 'Seeing the season instalment by instalment',
          content: (
            <>
              <p>The <strong>By installment</strong> view turns Player Dues into a grid — one column per instalment, one row per player — so you can see who is behind on which bill without opening anybody.</p>
              <p>The instalment&apos;s amount and due date sit once in the column heading, and each cell answers one question: <em>is there anything still to send here?</em></p>
              <HelpDefs>
                <HelpDef term="A tick">Nothing left to send. Whether the family paid it or fundraising covered it, there&apos;s nothing to chase — the player&apos;s own record is where you see which.</HelpDef>
                <HelpDef term="A warning mark and an amount">Past its due date, with that much still to send.</HelpDef>
                <HelpDef term="A half-circle and an amount">Part-way — some has arrived, that much is left.</HelpDef>
                <HelpDef term="A faint dot">Not due yet, and nothing paid against it. Nothing to do.</HelpDef>
              </HelpDefs>
              <p>So every figure left on the grid is money still to come in. A player whose own instalment differs from the rest of the team&apos;s shows their own amount and date in the cell. On a phone the grid becomes a card per player instead, which spells each instalment out in words.</p>
              <p>Above the grid, the <strong>Collection schedule</strong> band gives each instalment&apos;s progress; below it, the last row totals what to collect now and the season&apos;s balance owing under the columns those figures belong to.</p>
            </>
          ),
        },
        {
          id: 'premium-money-settlement',
          title: 'Season settlement — what each family is owed',
          content: (
            <>
              <p>At the foot of <strong>Player Dues</strong>, one line says what the season still has coming in and opens <strong>Season settlement</strong> in a window. It works out what the team owes each family and what&apos;s left to share — nothing to calculate and nothing to type. Open it any time: mid-season it&apos;s a forecast, and it says so.</p>

              <h4>Where the money comes from</h4>
              <p>The summary adds up in front of you: dues received, plus fundraising raised, minus what you&apos;ve spent, gives <strong>the cash the team holds</strong>. Take off the credits you owe families, add the dues still to come in, take off anything you&apos;re holding back — and what&apos;s left is <strong>the surplus to share</strong>. (A drive&apos;s full amount counts as money in, and each player&apos;s rebate sits on the credits line, so fundraising is counted once, in the right place.)</p>
              <p>The only figure you set is <strong>hold back</strong> — what you keep for next season. It sits above the total because it has already been taken out of it, so the column adds up as you read it, and it can only come out of the surplus: never out of money the team owes families.</p>

              <h4>Reading the table</h4>
              <HelpDefs>
                <HelpDef term="Owed back">The family&apos;s own money, held by the team. No judgement involved, and payable whether or not there&apos;s a surplus.</HelpDef>
                <HelpDef term="Even share">Their part of what&apos;s left over — one share per player.</HelpDef>
                <HelpDef term="Still owes">Dues they haven&apos;t sent yet. It&apos;s subtracted from their refund, so every row reads across.</HelpDef>
                <HelpDef term="Refund">Owed back, plus their share, less what they still owe.</HelpDef>
              </HelpDefs>
              <p>A figure <strong>in brackets</strong> is a negative, here and on every coach money screen — in the Refund column it means the family owes the team rather than being owed.</p>
              <p><strong>Tap any row</strong> to see where its number came from, with <strong>Change what … takes</strong> beside the arithmetic: an even share, a set amount, no share, or <strong>forgive</strong> what they still owe. Whatever a choice frees up goes to the other families straight away, so the rows always add back up.</p>
              <p>Players from the same household sit together, and each keeps their own line in the books.</p>
            </>
          ),
        },
        {
          id: 'premium-money-close-out',
          title: 'Closing out the season',
          content: (
            <>
              <p>Paying families back is one act, at the end of the season: <strong>Pay everyone and close the season</strong>. The settlement doesn&apos;t pay anyone before then — opening it early shows you where the season is heading, not a button to spend.</p>

              <h4>What has to be true first</h4>
              <p>Beside the money summary, <strong>Before the season can close</strong> lists every condition at once, so you never have to hunt for what&apos;s blocking you. Two of them stop the payout:</p>
              <HelpSteps>
                <li><strong>Every family is square on their dues.</strong> Until they are, part of the surplus is money that hasn&apos;t arrived, and paying it out would spend what the team doesn&apos;t have.</li>
                <li><strong>The team is holding enough to cover every refund.</strong> This can bite even when all the dues are in — if a family was paid out early for more than their eventual share, the money left no longer stretches. Change what someone takes, or reduce the hold-back, and it balances.</li>
              </HelpSteps>
              <p>Two more only warn: money the season still plans to spend, and club funding the sheet can&apos;t attribute to one season. Both are your call, and the hold-back is how you answer the first.</p>
              <p>When everything is clear the heading changes to <strong>Ready to close</strong>, the blockers become ticks, and the button comes alive.</p>

              <h4>Paying one family sooner</h4>
              <p>A player leaving mid-season can still be paid straight away — from that player&apos;s own money record, where the rest of their history is, rather than from the settlement. That works at any point in the season and doesn&apos;t wait on anyone else.</p>
              <HelpNote variant="warning" title="If the team is short of what it owes">If the team can&apos;t cover the money it&apos;s holding for families, the sheet says so plainly and shares nothing, rather than quietly shrinking anyone&apos;s rebate. That&apos;s a debt to settle, not a surplus to split.</HelpNote>
            </>
          ),
        },
        {
          id: 'premium-money-fundraisers',
          title: 'Fundraisers and sponsors',
          content: (
            <>
              <p>The <strong>Fundraising</strong> tab holds two kinds of money coming in, and the difference decides what you record. A <strong>fundraiser</strong> is something the whole team takes part in — a bottle drive, a chocolate sale — so it keeps a list of every player and what each one raised. A <strong>sponsor</strong> is a single arrival: one business or grant giving directly, so it&apos;s one row with an amount and, if a family found them, who brought them in.</p>
              <p>The list shows both, each tagged, with a filter to see one kind at a time. The figures above it split the same way, so you can see how much of the season is funded by families selling things versus by sponsors. The Money <strong>Overview</strong> lists the two separately as well — <strong>Fundraisers</strong> and <strong>Sponsorships</strong> — and each opens this tab already showing just that kind. Which kind you&apos;re looking at is part of the address, so a filtered list can be bookmarked or sent to someone, and <strong>Back</strong> steps through it.</p>

              <h4>Recording a sponsor</h4>
              <p><strong>＋ New</strong> asks which of the two it is first, then follows your answer. For a sponsor it wants the business name, the amount, and whether the money has actually arrived:</p>
              <HelpDefs>
                <HelpDef term="Received">The money is in. It posts to the team&apos;s books, and any share you credit lands on that family&apos;s dues straight away.</HelpDef>
                <HelpDef term="Pledged">Promised, but not arrived. It counts toward your budget so you can plan around it, and counts as nothing in your books until you mark it received.</HelpDef>
              </HelpDefs>
              <p><strong>Brought in by</strong> is optional — leave it for a club-wide sponsor that belongs to no family. When you do name a family, <strong>Credit to that family</strong> decides their share, and you can type it either as dollars or as a percentage; whichever you choose, the other is shown underneath so you can see exactly what will come off their dues.</p>
              <HelpNote variant="info" title="Changing a sponsor later">Open it and everything is editable — the amount, who brought it in, their share, and whether it has arrived. Moving one back to <strong>Pledged</strong> takes it off the books and removes the family&apos;s credit, so the two never disagree.</HelpNote>

              <h4>Starting a fundraiser</h4>
              <p>A fundraiser asks for a name, a <strong>player credit %</strong>, and optionally the dates it runs. The credit is the share that goes back to the player who raised it — set it to 0 and the whole amount stays with the team.</p>
              <p>If your team uses one standard share all year, set it once under <strong>Team settings → Money</strong> as the <strong>default player credit</strong> and it fills in on every new fundraiser and sponsor. You can still change it on any one of them, and changing the default later never alters anything you&apos;ve already recorded.</p>

              <h4>Logging what people raised</h4>
              <p>Open a fundraiser to get its own leaderboard: one row per player, with what they raised, the credit they earned, and what they still have <strong>Left to send</strong> on their dues. It opens <em>inside</em> Money — the tab bar stays where it is, and <strong>&larr; All fundraisers</strong> takes you back to the list.</p>
              <p><strong>Log amount</strong> on a player&apos;s row shows a <strong>Where it lands</strong> preview before you save: exactly which of that family&apos;s bills the rebate will lower, and by how much. Save and the credit is on their dues straight away.</p>
              <HelpNote variant="info" title="Changing the rebate % later">Each entry keeps the rate it was logged at. Changing the percentage in <strong>Settings</strong> applies to new entries only, so an amount you recorded last month never quietly changes value.</HelpNote>

              <h4>Tagging what came in</h4>
              <p>A fundraiser or a sponsor can carry <strong>money tags</strong> — the same labels you put on expenses, so &ldquo;Winter dome&rdquo; means one thing whether the money went out or came in. Tags live on the record, not on the list, so pick them when you create it or open <strong>Settings</strong> to change them later. They come through on the export, which is what lets a spreadsheet show what a label cost you <em>and</em> what it brought in.</p>

              <h4>Closing one</h4>
              <p><strong>Settings</strong> renames a drive, changes its dates or its rate, and sets it to <strong>Closed</strong> when it&apos;s over. A closed drive stays fully readable and keeps every credit it gave out — it just stops accepting new amounts.</p>
              <p>In a finished season a drive is a record: it lists the players who were on <em>that</em> season&apos;s roster, and nothing on it can be edited.</p>
            </>
          ),
        },
        {
          id: 'premium-money-transactions',
          title: 'Transactions: recording what happened',
          content: (
            <>
              <p><strong>Transactions is the record of money that has already moved.</strong> It has two lists: <strong>Expenses</strong>, what the team has spent, and <strong>Money in</strong>, what has arrived. Money the team has <em>promised</em> but not paid lives one tab over, on <strong>Payables</strong>.</p>
              <p><strong>Add</strong> opens one form, already set to the list you&apos;re looking at. Two buttons at the top say which way the money went — <strong>Expense</strong> or <strong>Income</strong> — and a tick box beside them says <strong>This is a refund</strong> when money came back on something the team paid for. Picked wrong? Press the other one; everything you&apos;ve typed comes with you.</p>
              <p><strong>What is this?</strong> is one search box for your category and item — type a few letters of either, or type a name that isn&apos;t there yet and add it without leaving the form. <strong>One line above the buttons then says what saving will do</strong>, in dollars; on a cost a family fronted it names that family and the credit they&apos;re owed.</p>
              <HelpDefs>
                <HelpDef term="Date paid">The day the money actually left. It decides which month the cost lands in on Budget vs. Actual, so back-date it when you&apos;re catching up on paperwork.</HelpDef>
                <HelpDef term="Leaving it blank">Records the cost as unpaid. It waits on this list with a <strong>Mark Paid</strong> button until you say when the money went.</HelpDef>
                <HelpDef term="A date in the future">Refused — this form records what happened. The message links you to <strong>Add a commitment</strong> on Payables, which is where something you&apos;ve agreed to pay later belongs.</HelpDef>
              </HelpDefs>
              <p><strong>Fixing a mistake.</strong> Tap the pencil on any row — or the row itself — to reopen it. <strong>Everything can be changed, including after it&apos;s been paid:</strong> the amount, the date, the name, the category and item. Correcting a figure carries through to the team&apos;s books, so cash on hand follows the new number; the form says so above the buttons before you save. <strong>Delete</strong> sits at the bottom of the same form and tells you the exact amount it will put back first, so a mistyped $1,300 is a correction rather than something you live with all season. If a family paid out of pocket, deleting also removes the credit the team owed them — the form says so before you confirm.</p>
              <HelpNote variant="info" title="Two things can’t be changed after saving">Who paid something <strong>out of pocket</strong> (it decides which family the team owes — delete and re-enter instead), and an old payment from before the books started linking entries, if we can&apos;t tell which entry was its. Everything else is editable.</HelpNote>
            </>
          ),
        },
        {
          id: 'premium-money-payables',
          title: 'Payables: what you owe, and when',
          content: (
            <>
              <p><strong>Payables is everything the team has agreed to pay but hasn&apos;t yet.</strong> It opens on the <strong>Schedule</strong> — every commitment by due date — with a <strong>Commitments</strong> list beside it where each one is created and managed.</p>
              <p><strong>The Schedule</strong> shows commitment deposits and balances, and on a club-run team your organization&apos;s allocations too. Filter by <strong>Unpaid</strong>, <strong>Paid</strong> or <strong>All</strong>; overdue rows say how many days late they are. It&apos;s money going <em>out</em> only — player dues are money coming in and live on Player Dues, where the reminders that chase them are. The <strong>Next 30 days</strong> list on the Money Overview is the 30/60/90-day preview of the same commitments, interleaved with dues coming in, and links straight here.</p>
              <p><strong>Add a commitment</strong> asks four things: what it&apos;s for, how much is owed, when it&apos;s due, and what to call it. A commitment is always money going out. Anything with a due date belongs here — a tournament entry, a dome block, an umpire invoice, a uniform order. Open <strong>&ldquo;Split into a deposit and a balance&rdquo;</strong> when it&apos;s billed in two parts; each half then keeps its own due date and is marked paid on its own. The form says what saving will do: <strong>nothing moves</strong>. Cash on hand is unchanged and no family is affected — it joins your payment schedule, and that&apos;s all.</p>
              <p><strong>Marking one paid</strong> — from the Schedule, or from <strong>Payment details</strong> on a commitment&apos;s row — opens the <strong>Add money</strong> form already filled in from the commitment, asking the one thing it can&apos;t know: <strong>when the money actually left</strong>. Back-date it and the cost lands in that month rather than this one. Saving settles that commitment; it does not add a second record beside it. On a split commitment the other half stays exactly as it was.</p>
              <HelpNote variant="info" title="Paying the same thing every month?">There&apos;s no repeat option yet — add each month, or bring a whole season in at once with <strong>Import</strong>.</HelpNote>
            </>
          ),
        },
        {
          id: 'premium-money-money-in',
          title: 'Money coming in, and money back',
          content: (
            <>
              <p><strong>The <em>Money in</em> list on Transactions holds every arrival</strong> — and there are two kinds, because money arriving is not one thing. Both use the same <strong>Add</strong> form and the same category + item as a cost, so what you earn lines up against what you spend, row for row.</p>
              <HelpDefs>
                <HelpDef term="Income">Money the team <strong>earned or was given</strong> — registrations for a tournament you hosted, concession takings, a grant. It gets its own row under <strong>Revenue</strong> on Budget vs. Actual.</HelpDef>
                <HelpDef term="Money back">A <strong>refund, credit or reimbursement</strong> of something already recorded — a cancelled entry refunded, a vendor credit, the club paying back a permit you fronted. Press <strong>Expense</strong> and tick <strong>This is a refund</strong> — the money comes in, but what it repays is something you <em>spent</em>, so you pick from the spending words. It <strong>reduces the row it repaid</strong> instead of becoming a row of its own.</HelpDef>
              </HelpDefs>
              <p><strong>Why a refund isn&apos;t income.</strong> When a tournament refunds a $150 entry, the team didn&apos;t <em>earn</em> $150 — it <em>spent $150 less</em>. So Entry fees shows <strong>$2,250 on one line</strong> ($2,400 paid, $150 back), with the detail underneath. Two rows would make you do the arithmetic the row exists to save you.</p>
              <HelpNote variant="warning" title="“A parent paid me back” means two opposite things">
                <p><strong>Money back</strong> is the team&apos;s own cash returning: it went out, some came back, and the team owes nobody anything.</p>
                <p><strong>Paid out of pocket</strong> is the opposite: a family paid the vendor <em>directly</em>, no team cash ever moved, and the team now <strong>owes that family a credit</strong> against their dues. Record that one as an <strong>Expense</strong> with the refund box left <em>unticked</em>, and set <strong>Paid by</strong> to the family — under <strong>More</strong> at the foot of the form. Get it wrong and the credit they&apos;re owed is lost; the line above the buttons names the family, so you can check before saving.</p>
              </HelpNote>
              <p><strong>One row, one source.</strong> Fundraisers and sponsors already report their own totals, so a row those cover won&apos;t accept a typed figure — record the money on Fundraisers and it appears here. And <strong>none of this changes anyone&apos;s dues</strong>: extra money arriving usually means extra things to spend it on, so passing it on stays a deliberate edit you make on Player Dues.</p>
              <p><strong>Correcting one.</strong> Tap the row. Amount, date, note and what it points at can all change — re-filing moves no money. <strong>Delete</strong> tells you the amount first: deleting an arrival takes it back off the books, so cash on hand goes <em>down</em>.</p>
            </>
          ),
        },
        {
          id: 'premium-money-org',
          title: 'Money between your team and your club',
          content: (
            <>
              <p>Two extra screens appear in Money when your team belongs to a club or league — <strong>Allocations</strong> and <strong>Payments</strong>. They are the only Money screens about your dealings with your own club rather than with the outside world, and a standalone team never sees them.</p>
              <HelpDefs>
                <HelpDef term="Allocations">What the club has billed this team. Your club&apos;s owner or treasurer splits a shared cost — field and diamond fees, league insurance, association dues — across its teams, and your share arrives here already divided into instalments with due dates. You can&apos;t create or change one: your job is to <strong>mark each instalment paid</strong> as you pay it. Instalments coming due also show on your <strong>Payment schedule</strong> and in <strong>Next 30 days</strong>.</HelpDef>
                <HelpDef term="Payments">Where you settle up with the club, in either direction. <strong>Pay Org</strong> sends money to the club — handing back an unused float, or your share of an invoice the club paid up front. <strong>Request from Org</strong> asks the club to cover or pay back a cost — a permit you paid out of pocket, a tournament entry the club agreed to fund.</HelpDef>
              </HelpDefs>
              <p><strong>Every request is reviewed by someone at the club</strong>, and sits as <strong>Pending</strong> until the office gets to it. Until then it&apos;s still yours: tap the row to correct anything — amount, wording, even which direction it goes — or <strong>Withdraw request</strong> to take it off their list. Withdrawing asks first, because nothing is kept.</p>
              <p><strong>Once the club answers, the request locks.</strong> An approved or declined row opens the same window to read, not edit, because it now records what they acted on. A decline opens with their written reason above the request. The row&apos;s icon says which you&apos;ll get: a <strong>pencil</strong> while it can change, an <strong>eye</strong> once it can&apos;t. In the list the two types read as <em>Pay Org</em> and <em>From Org</em>.</p>
              <HelpNote variant="info" title="Your club, or an outside supplier?">Allocations and Payments are always money moving between your team and your own club. Anything you owe someone outside it — a dome block, an umpire invoice, a tournament organizer — belongs on <strong>Payables</strong> instead.</HelpNote>
            </>
          ),
        },
        {
          id: 'premium-money-report-shapes',
          title: 'Budget vs. Actual: the two report shapes',
          content: (
            <>
              <p><strong>Budget vs. Actual has three views, and it remembers which one you prefer.</strong> Two of them read the same records; the third is the month grid, below.</p>
              <HelpDefs>
                <HelpDef term="Statement">The default. <em>Revenue</em>, then <em>Expenses</em>, then the <strong>season net</strong>, with your categories and items inside each. The shape a treasurer, a board or a parent already expects, and the one that answers <em>&ldquo;are we going to be short?&rdquo;</em></HelpDef>
                <HelpDef term="By activity">The same records grouped the other way — <strong>one block per category</strong> showing what it earned, what it cost and what it netted. This is the one that answers <em>&ldquo;did hosting the tournament pay for itself?&rdquo;</em>, which a statement structurally can&apos;t, because a category appears in both of its halves.</HelpDef>
              </HelpDefs>
              <p>Both end on the same season net, because they are the same money.</p>
              <p><strong>Over budget is good news on income and bad news on a cost</strong>, so the wording changes with the section: revenue reads <em>+$400</em> or <em>−$160</em>; costs read <em>$150 under</em> or <em>$160 over</em>. A figure in <strong>brackets</strong> is a negative — most often a refund filed against the wrong item, which is exactly why it&apos;s shown rather than hidden or flipped.</p>
              <p>Under both shapes sits <strong>Funded by players</strong>: what dues still have to cover once everything coming in is taken off. It&apos;s the same subtraction the Budget Plan&apos;s summary makes, so the two pages end on the same number.</p>
            </>
          ),
        },
        {
          id: 'premium-money-months',
          title: 'Budget vs. Actual, month by month',
          content: (
            <>
              <p><strong>Months</strong> lays the season out the way a spreadsheet does — your budget lines down the side, the season&apos;s months across the top, totals both ways. It shows money going <em>out</em>. One toggle changes what every cell shows:</p>
              <HelpScreenshot id="money-budget-vs-actual-months" />
              <HelpDefs>
                <HelpDef term="Budget">What you planned for that month.</HelpDef>
                <HelpDef term="Scheduled">What you&apos;ve actually committed to pay, by its due date. Budget and Scheduled stay separate on purpose, so a commitment never quietly becomes part of your estimate and nothing gets counted twice.</HelpDef>
                <HelpDef term="Actual">What&apos;s been paid.</HelpDef>
                <HelpDef term="Difference">Your plan minus what you paid. It only fills in months that have already happened — a month still ahead shows a dash, because money nobody has spent yet isn&apos;t a saving.</HelpDef>
              </HelpDefs>
              <p>Anything in your plan without a payment date sits in its own <strong>&ldquo;No date yet&rdquo;</strong> column rather than being spread across months you never chose.</p>
              <p><strong>Will we run short?</strong> Under the month grid, three rows answer it: <strong>money in</strong>, <strong>money out</strong>, and a <strong>running balance</strong>. If the balance dips below zero, a line underneath names the month and the amount in plain words. It projects using whichever view you&apos;re reading — Budget projects your plan, Scheduled projects your commitments — and says so, so it&apos;s always clear which one you&apos;re looking at. Money in counts <em>player dues</em>; fundraiser rebates already credit dues, so counting both would count the same dollar twice. Teams in their second season or later also get a <strong>last season</strong> column, plus a short list of lines you had last year and haven&apos;t planned this year — often the most useful part.</p>
              <p><strong>Tapping a figure takes you to the tool that owns it:</strong> a budget cell opens that line&apos;s form with its payment dates ready to edit; an Actual or Scheduled figure opens a plain list of what makes it up. The grid is a way of getting to your forms, never a second place to edit.</p>
            </>
          ),
        },
        {
          id: 'premium-money-import-export',
          title: 'Imports, exports & templates',
          content: (
            <>
              <p><strong>Import</strong> and <strong>Export</strong> sit at the top of Money and stay the same on every tab, so you never have to work out which screen hides them. <strong>Import</strong> offers <em>Budget lines</em> and <em>Commitments</em>, plus <strong>Recent imports</strong> — what&apos;s been brought in this season, when, and by whom. <strong>Export sits on each tab</strong>, in the row of controls above the numbers — so it always gives you <strong>what you&apos;re looking at</strong>. On Budget vs. Actual that means the month grid if you&apos;re reading by month, or the category table if you&apos;re not; on Transactions and Payables it follows the view you&apos;re on and any tag filter you&apos;ve set. Every tab has one except Overview, which reports rather than holding a list of its own.</p>
              <p><strong>Whichever you pick, you&apos;re asked which file type you want</strong> — the same way any program asks when you save or print:</p>
              <ul>
                <li><strong>Excel</strong> for working with the numbers.</li>
                <li><strong>CSV</strong> for plain text that opens anywhere.</li>
                <li><strong>PDF</strong> — on Player dues and Budget vs. Actual — for something printable you can hand to a parent. PDF appears only on plans that include it.</li>
              </ul>
              <p>Exporting doesn&apos;t need edit access: an assistant who can see the numbers can take them away. <strong>On a phone, spreadsheets are put away</strong> — an exported file lands in a downloads folder you&apos;d never open there, and nobody imports a season&apos;s budget standing at a field. So on a phone <strong>Import disappears</strong>, and <strong>Export appears only where it can give you something you&apos;d actually use on a phone</strong> — a printable PDF of player dues or Budget vs. Actual. <strong>You can still import where it matters:</strong> an empty budget and an empty payables list both offer it right there, at any screen size, including the paste-from-a-message path built for phones.</p>
              <p><strong>Bringing a budget in from a spreadsheet.</strong> Pick which shape your sheet is, then either <strong>paste</strong> your rows straight out of Excel or Google Sheets, or <strong>upload</strong> the file — both end up in the same place:</p>
              <ul>
                <li>A <strong>month grid</strong> — a row per cost, a column per month.</li>
                <li>A <strong>simple list</strong> — one amount per line.</li>
                <li>A <strong>payables schedule</strong> — what you owe and when.</li>
              </ul>
              <p><strong>Nothing is saved until you say so.</strong> You get a preview with a verdict on every row: <strong>Adds</strong> a new line, <strong>Updates</strong> one you already have (matched on category and line name, with the old amount shown so you can see what changes), or <strong>Can&apos;t import</strong> — with the reason, in plain words. Fix a row right there — change its category, its name, its amount — and the verdict updates as you type. Rows you leave broken are simply left out, and the result afterwards says exactly what was added, what was updated and what was skipped. If nothing could be imported, it says so rather than reporting a quiet success.</p>
              <p><strong>Download a template to start from.</strong> Each shape has one, in Excel or CSV. It carries the column headings and some standard cost names — <strong>the amounts are left blank for you to fill in</strong>. We never put a figure in your budget. The month-grid template uses your own season&apos;s months when you have dates already, and your Budget vs. Actual export uses the same columns — so you can export what you have, edit it in a spreadsheet, and import it straight back.</p>
              <p><strong>What it won&apos;t do.</strong> It reads names and numbers, and nothing else — it will never guess what an unfamiliar category means or read an ambiguous date like <em>03/04/2026</em>. Anything it can&apos;t read confidently is handed back to you rather than filed somewhere plausible. Importing payables always <em>adds</em>; two payments to the same tournament are two real commitments, so it flags a look-alike instead of overwriting one. A spreadsheet row is always a <strong>cost</strong> — a sheet has no column for money coming in — so an imported row never matches or overwrites one of your <strong>expected fundraising</strong> lines, even when the names look the same. Add those on the plan itself. An imported payable lands on a <strong>category</strong>, not on a specific item: the sheet has no column for one. Open any of them afterwards and set what it is if you want it reported item by item. An imported BUDGET line does get an item — if the name in your sheet isn&apos;t in the list, it&apos;s added to your team&apos;s own items so the line still has a name. Importing needs <strong>money edit</strong> access.</p>
            </>
          ),
        },
        {
          id: 'premium-money-tags',
          title: 'Categories, items & money tags',
          content: (
            <>
              <p><strong>Your budget is two levels deep: a category, then an item</strong> — &ldquo;Facilities / Dome time&rdquo;. The <strong>item names the row</strong>, so two budget lines on one item show as <strong>one row</strong> carrying the total. Whatever you type on a line is a <strong>note</strong>; it never names a row.</p>
              <p><strong>Spending records the same two things.</strong> Every expense and payable asks <strong>&ldquo;What is this?&rdquo;</strong> — one search box holding the same category and item your budget uses — and picking an item fills in the description with its name, ready to type over. That&apos;s what lets the report compare your plan to your books row for row.</p>
              <p><strong>Every item belongs to one side</strong> — something you spend against, or something money arrives against — so the list follows what you&apos;re recording: <strong>Income</strong> won&apos;t show you <em>Diamond permits</em>, and a word you add picks up the side you were on. <strong>Manage our items</strong> on the Budget Plan renames one (which changes what it&apos;s called everywhere) or moves it across (which moves no money).</p>
              <p><strong>You never have to say whether something was budgeted.</strong> If your plan has a line for that category and item, it counts against it. If it doesn&apos;t, the cost appears on Budget vs. Actual as <strong>its own row inside its own category, with nothing in the Budget column</strong> — so <em>&ldquo;what did we get charged for that we never planned?&rdquo;</em> finally has an answer, and the empty Budget figure is the answer.</p>
              <p><strong>Tag your spending.</strong> Every expense and payable has an optional <strong>Tags</strong> box — your own labels for grouping spending, like &ldquo;Winter dome,&rdquo; &ldquo;Spring tournament,&rdquo; or &ldquo;Fundraiser.&rdquo; Start typing to find a tag you&apos;ve used or tap <strong>+ Create</strong> for a new one; only the tags you&apos;ve picked show as chips, so a long list never clutters the form. On the <strong>Expenses</strong> list you can filter by a tag — every row shows the tags it carries, and you change them by opening that record (the pencil, or the row) — and <strong>Budget vs. Actual</strong> gains the same filter — pick a tag to see just that spending with a &ldquo;vs {'{tag}'}&rdquo; total <em>across</em> every category it touches (tags cut across categories, so &ldquo;Winter dome&rdquo; can span a facility rental and an officials fee). Money tags are separate from game tags. Use <strong>Manage tags</strong> on the Expenses page to rename, merge, or delete your money tags. Some tags may be <strong>shared by your whole organization</strong> (a club or league sets them up) — those show in <strong>blue</strong>; you can apply them, but only an org admin renames or removes them.</p>
            </>
          ),
        },
        {
          id: 'premium-money-assistants',
          title: 'What assistant coaches can see',
          content: (
            <p>Assistant coaches need <strong>money access</strong> from the head coach: with read access they see every number and can still <strong>Export</strong>, but <strong>nothing that changes anything</strong> is offered — no <em>Import</em>, and no add or edit buttons anywhere in Money, so they&apos;re never shown something they can&apos;t finish. With money access off, Money doesn&apos;t appear for them at all. Applying or editing a money tag needs <strong>money edit</strong> access, the same as logging an expense.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-money-where-start',
          question: 'Where do I start with my team’s money?',
          popular: true,
          answer: (
            <p>Follow the guide card at the top of <strong>Money</strong> — it always shows your next step. The fastest path: build your <strong>Season Budget Plan</strong> (estimate costs by category), then tap <strong>Generate installments</strong> to turn it into every player&apos;s dues schedule in one click, then log expenses as the season runs. The <strong>Everything in Money</strong> list under the guide card runs in the same order — <strong>Plan → Collect → Spend → Review</strong> — so working through it is working in the right order. Once dues are out, the guide card&apos;s job is done and the Overview switches to your season dashboard.</p>
          ),
          answerText: 'Follow the guide card at the top of Money — it always shows your next step. The fastest path: build your Season Budget Plan (estimate costs by category), then tap Generate installments to turn it into every player’s dues schedule in one click, then log expenses as the season runs. The Everything in Money list under the guide card runs in the same order — Plan, Collect, Spend, Review — so working down it is working in the right order. Once dues are out, the guide card’s job is done and the Overview switches to your season dashboard.',
          keywords: ['where do i start', 'money first step', 'set up budget', 'new treasurer', 'guide card'],
        },
        {
          id: 'faq-budget-starter',
          question: 'What should my season budget include?',
          answer: (
            <>
              <p>Short answer: <strong>whatever your team actually spends</strong> — FieldLogicHQ never proposes a number, because costs swing too hard by region, age, and level for a suggested figure to mean anything for your team. You always type your own.</p>
              <p>To help you get there, an empty <strong>Season Budget Plan</strong> opens with a guided starter: five tap questions about your season (how many tournaments, travel, officials, training, uniforms) build a worksheet, and you price only the lines you already know. Leave an amount blank and it isn&apos;t skipped — it moves to a <strong>&ldquo;Not in your plan yet&rdquo;</strong> checklist on your budget page, ready for whenever you do know the cost. From there, tap <strong>+</strong> on an item to add it (you type the amount), or <strong>&times;</strong> to hide one your team doesn&apos;t pay for — that stays hidden on your device.</p>
              <p>Rather see a finished budget before building your own? An empty Budget page (and an empty Budget vs. Actual) offers <strong>&ldquo;See a finished example&rdquo;</strong> — a clearly-labelled made-up team, with its own budget and Budget vs. Actual tabs. Good for seeing the <em>structure</em>, but its numbers are invented, so there&apos;s nothing in it worth copying.</p>
            </>
          ),
          answerText: 'Short answer: whatever your team actually spends — FieldLogicHQ never proposes a number, because costs swing too hard by region, age, and level for a suggested figure to mean anything for your team. You always type your own. To help you get there, an empty Season Budget Plan opens with a guided starter: five tap questions about your season (how many tournaments, travel, officials, training, uniforms) build a worksheet, and you price only the lines you already know. Leave an amount blank and it is not skipped — it moves to a “Not in your plan yet” checklist on your budget page, ready for whenever you do know the cost. From there, tap + on an item to add it (you type the amount), or × to hide one your team does not pay for — that stays hidden on your device. Rather see a finished budget before building your own? An empty Budget page (and an empty Budget vs. Actual) offers “See a finished example” — a clearly-labelled made-up team, with its own budget and Budget vs. Actual tabs. Good for seeing the structure, but its numbers are invented, so there is nothing in it worth copying.',
          keywords: ['what should my budget include', 'budget starter', 'guided starter', 'starting a budget', 'season budget questions', 'five questions', 'how many tournaments', 'budget worksheet', 'leave it blank', 'blank amount', 'not in your plan yet', 'budget checklist', 'add a checklist item', 'hide a checklist item', "we don't pay for that", 'sample budget', 'example budget', 'made up team', 'riverdale', 'riverdale 12u', 'see a sample budget', 'finished example', 'why no suggested amount', 'how much should i budget', 'new treasurer'],
        },
        {
          id: 'faq-money-numbers',
          question: 'What do Money In, Money Out, On Hand, and Budget Headroom mean?',
          answer: (
            <p>All of them are <strong>cash</strong> — received and paid, never what&apos;s still owed. The <strong>Cash on hand</strong> card says so right on it, and links to what&apos;s outstanding. <strong>In</strong> (money in) is dues families have actually paid plus fundraising raised (plus anything your org reimbursed, on club-owned teams). <strong>Out</strong> (money out) is everything actually paid out — expenses, tournament deposits and balances, and payments to your org. <strong>Cash on hand</strong>, the card&apos;s big number, is simply received minus paid. <strong>Headroom</strong>, the Budget card&apos;s big number, compares your paid spending to your budget — green means room left, red means over. Unpaid bills and unpaid dues don&apos;t move these numbers until they&apos;re marked paid, which is why Money and the Budget vs. Actual report always agree. To see what families still owe, open <strong>Player Dues</strong>.</p>
          ),
          answerText: 'All of them are cash — received and paid, never what is still owed. The Cash on hand card says so right on it, and links to what is outstanding. In (money in) is dues families have actually paid plus fundraising raised (plus anything your org reimbursed, on club-owned teams). Out (money out) is everything actually paid out — expenses, tournament deposits and balances, and payments to your org. Cash on hand, the card’s big number, is simply received minus paid. Headroom, the Budget card’s big number, compares your paid spending to your budget — green means room left, red means over. Unpaid bills and unpaid dues do not move these numbers until marked paid, which is why Money and the Budget vs. Actual report always agree. To see what families still owe, open Player Dues.',
          keywords: ['money in', 'money out', 'on hand', 'headroom', 'budget headroom', 'what do the numbers mean', 'net balance', 'paid only', 'cash received', 'cash paid', 'what is still owed', 'outstanding'],
        },
        {
          id: 'faq-money-generate-installments',
          question: 'How do I set every player’s dues at once?',
          popular: true,
          answer: (
            <>
              <p><strong>Set dues for all players</strong> on Player Dues and <strong>Generate installments</strong> on the Season Budget Plan open the same window — start from whichever screen you&apos;re already on. Add a due date for each payment, choose <strong>how the amounts are set</strong>, then <strong>preview</strong> exactly what every player will owe before you confirm. Every active player gets the same schedule.</p>
              <p>Three ways to set the amounts, and each one shows what it works out to <em>per player</em> before you pick it:</p>
              <ul>
                <li><strong>Split the budget evenly</strong> — your cost lines, less any expected fundraising, divided across the roster.</li>
                <li><strong>Split the season estimate evenly</strong> — the same, measured against the estimated total you set rather than your itemised lines. Useful when you&apos;ve priced the year but haven&apos;t itemised all of it yet.</li>
                <li><strong>Set the amounts myself</strong> — type each installment, so &ldquo;a deposit now, the balance in the new year&rdquo; is a schedule you can actually build.</li>
              </ul>
              <p>In either even-split mode the amounts fill themselves in and <strong>recalculate whenever you add or remove a due date</strong>, so the same money divides across players and dates at once — odd cents land on the last payment, so nobody is a penny out. If you type your own, we compare them to what players need to fund and tell you when you&apos;re short or over. That&apos;s a note, never a block: a deposit-only schedule is often exactly what you want.</p>
              <p><strong>No budget yet?</strong> You can still set dues by hand. The two even-split options are greyed out with the reason, typing your own amounts works as normal, and there&apos;s a link to build a Season Budget Plan if you&apos;d rather start there. The only thing that stops you outright is an empty roster — there&apos;s nobody to charge. Afterwards, adjust any single player from their own row with <strong>Edit schedule</strong>.</p>
            </>
          ),
          answerText: 'Set dues for all players on Player Dues and Generate installments on the Season Budget Plan open the same window — start from whichever screen you are already on. Add a due date for each payment, choose how the amounts are set, then preview exactly what every player will owe before you confirm; every active player gets the same schedule. There are three ways to set the amounts and each one shows what it works out to per player before you pick it. Split the budget evenly divides your cost lines, less any expected fundraising, across the roster. Split the season estimate evenly does the same against the estimated total you set instead of your itemised lines — useful when you have priced the year but not itemised all of it yet. Set the amounts myself lets you type each installment, so a deposit now and the balance later is a schedule you can actually build. In either even-split mode the amounts fill themselves in and recalculate every time you add or remove a due date, so the same money divides across players and dates at once; odd cents land on the last payment so nobody is a penny out. If you type your own amounts we compare them to what players need to fund and tell you if you are short or over — as a note, never a block, because a deposit-only schedule is often exactly what you want. You do not need a Season Budget Plan to set dues by hand: without one the two even-split options are greyed out with the reason and typing your own amounts still works, with a link to build a budget if you would rather. The only thing that stops you entirely is an empty roster, because there is nobody to charge. Afterwards you can adjust any single player from their own row with Edit schedule. The Automatic Dues Reminders switch under Team settings → Money controls the 30-day and 7-day reminder emails; before you have set any dues, Player Dues offers it inline so you can decide it while you are setting things up.',
          keywords: ['generate installments', 'set dues for all players', 'dues for all players', 'installment schedule', 'same schedule every player', 'bulk dues', 'set dues at once', 'charge everyone', 'no budget yet', 'build a budget first', 'set dues without a budget', 'dues with no budget', 'why do i need a budget to set dues', 'nothing for players to fund', 'how amounts are set', 'split the budget evenly', 'split the season estimate', 'set the amounts myself', 'manual amounts', 'type my own amounts', 'deposit and balance', 'deposit now rest later', 'different amounts per installment', 'uneven installments', 'amount is ignored', 'it changed my amount', 'preview does not match', 'short of what players need to fund', 'collecting less than the budget', 'auto amount', 'greyed out option'],
        },
        {
          id: 'faq-money-redo-dues',
          question: 'I set the dues wrong — can I redo them? What about families who already paid?',
          answer: (
            <>
              <p>Yes — even mid-season, even after money has come in. Run <strong>Set dues for all players</strong> again with the right dates and amounts. When it finds a schedule already there it <strong>asks first</strong> — <em>&ldquo;this roster already has dues&rdquo;</em> — and only replaces it once you say so, with your figures still on screen if you&apos;d rather go back. <strong>Payments are kept, always:</strong> every dollar a family has sent stays recorded and counts toward the new schedule, filling its earliest installments first, so a family halfway through paying simply owes the difference to the new total. If someone has already paid <em>more</em> than their new total, the extra becomes an <strong>Overpayment</strong> credit automatically rather than disappearing. Afterwards it tells you how many players had payments carried across, and names anyone whose dues couldn&apos;t be written.</p>
              <HelpNote variant="warning" title="Schedules you set by hand are named, and you can keep them">If you&apos;ve adjusted anyone individually with <strong>Edit schedule</strong> — a hardship arrangement, a deposit-then-balance plan, a mid-season joiner on prorated dates — that question <strong>names them</strong>, because applying the team schedule to everyone would give them the same one as the rest of the roster. Choose <strong>&ldquo;Keep the ones I set by hand&rdquo;</strong> and their season isn&apos;t touched at all; <strong>&ldquo;Apply to everyone&rdquo;</strong> is still there when that&apos;s what you mean. The same screen tells you if the <strong>due dates change</strong> for families who already have them, since reminder emails will start quoting the new ones.</HelpNote>
            </>
          ),
          answerText: 'Yes — even mid-season, even after money has come in. Run Set dues for all players again with the right dates and amounts. When it finds a schedule already there it asks first — this roster already has dues — and only replaces it once you say so, with your figures still on screen if you would rather go back. Payments are kept, always: every dollar a family has sent stays recorded and counts toward the new schedule, filling its earliest installments first, so a family halfway through paying simply owes the difference to the new total. If someone has already paid MORE than their new total, the extra becomes an Overpayment credit automatically rather than disappearing. Afterwards it tells you how many players had payments carried across, and names anyone whose dues could not be written. Schedules you set by hand are named and can be kept: if you have adjusted anyone individually with Edit schedule — a hardship arrangement, a deposit then balance plan, a mid-season joiner on prorated dates — the question names them, because applying the team schedule to everyone would give them the same schedule as the rest of the roster. Keep the ones I set by hand leaves their season untouched; Apply to everyone is still there. The same screen says if due dates change for families who already have them, since reminder emails will quote the new dates. This is also the answer to wrong due dates, a wrong per-player amount, raising or lowering dues partway through the season, or a budget that changed after you had already sent dues out.',
          keywords: ['redo dues', 'redo the dues', 'change dues', 'change the dues', 'wrong dates', 'wrong due date', 'wrong amount', 'regenerate dues', 'regenerate installments', 'run it again', 'do it again', 'already paid', 'replace dues', 'replace the schedule', 'start dues over', 'fix dues for everyone', 'budget changed after dues', 'dues do not match my budget', 'raise dues mid season', 'lower dues mid season', 'change dues after payment', 'payments kept', 'paid more than the new total', 'hand set schedule', 'schedule i set by hand', 'keep the ones i set by hand', 'apply to everyone', 'will it overwrite my manual changes', 'lost my custom schedule', 'hardship plan', 'payment plan for one family', 'prorated dues', 'mid season joiner', 'due dates change', 'due dates moved'],
        },
        {
          id: 'faq-money-record-payment',
          question: 'A family pays in different amounts than the installments — how do I record that?',
          popular: true,
          answer: (
            <>
              <p>Record the money exactly as it arrives. Open the player on <strong>Player Dues</strong> and tap <strong>Record payment</strong>: the amount, the day it arrived, how it arrived (e-transfer, cash, cheque, other) and an optional note. A family paying $100 a month against $300 quarterly installments is three taps a quarter — each payment fills the oldest installment first, the installment shows <em>&ldquo;$200.00 of $300.00&rdquo;</em> while it&apos;s partly covered, and the family&apos;s row shows every dollar under <strong>Paid</strong>. While they&apos;re keeping up, their status stays <strong>Up to date</strong>.</p>
              <p>Because the books use the day the money <em>arrived</em>, your month-by-month cash view stays true even when you record a few weeks at once. Reminder emails ask only for <strong>what&apos;s left</strong> and thank the family for what&apos;s in — nobody who&apos;s paying gets told they&apos;ve paid nothing. Typed the wrong amount? Remove that payment from the player&apos;s <strong>Payments</strong> list and record it again — the books entry is voided, never edited in place. And if a payment overshoots what&apos;s left on the schedule, the extra is kept automatically as an <strong>Overpayment</strong> credit.</p>
            </>
          ),
          answerText: 'Record the money exactly as it arrives. Open the player on Player Dues and tap Record payment: the amount, the day it arrived, how it arrived (e-transfer, cash, cheque, other) and an optional note. A family paying $100 a month against $300 quarterly installments is three taps a quarter — each payment fills the oldest installment first, the installment shows $200.00 of $300.00 while it is partly covered, and the family’s row shows every dollar under Paid. While they are keeping up their status stays Up to date; it only changes to Past due when a bill goes by unpaid. Because the books use the day the money arrived, your month-by-month cash view stays true even when you record a few weeks at once. Reminder emails ask only for what is left and thank the family for what is in — nobody who is paying gets told they have paid nothing. Typed the wrong amount, date or method? Edit that payment in the player’s Payments list — the old books entry is voided and a fresh one posted, because an entry is never rewritten in place. Remove is still there when the payment should not exist at all. And if a payment overshoots what is left on the schedule, the extra is kept automatically as an Overpayment credit.',
          keywords: ['record a payment', 'record payment', 'partial payment', 'part payment', 'part paid', 'paying in smaller amounts', 'pays monthly', 'different amounts than installments', 'not the installment amount', 'e-transfer', 'etransfer', 'cash', 'cheque', 'date received', 'backdate a payment', 'payment date', 'remove a payment', 'delete a payment', 'undo a payment', 'wrong payment amount', 'overpaid', 'overpayment', 'paid too much', 'in credit', 'auto credit', 'payments list', 'receipt', 'mark rest paid', 'balance owing'],
        },
        {
          id: 'faq-money-credit-application',
          question: 'A player earned a fundraising rebate — which bill does it come off?',
          popular: true,
          answer: (
            <>
              <p>Their <strong>last</strong> one, by default — so the near-term installments keep their dates and amounts while the far end of the schedule shrinks. A $500 rebate against a final $800 installment leaves that bill reading <strong>&ldquo;$300.00 to send&rdquo;</strong>, with the fundraiser named underneath, and the family&apos;s reminder email says so.</p>
              <p>Change it under <strong>Team settings → Money → Credits reduce</strong>. Player Dues prints
                the answer under the table with a link straight to it, so you can always see which way
                credits are landing without leaving the screen:</p>
              <HelpDefs>
                <HelpDef term="The last payment first">The default. The far end of the schedule shrinks, so the season&apos;s cash rhythm is protected.</HelpDef>
                <HelpDef term="The next payment first">Relief lands on the bill that&apos;s coming up — for the family that needs it now.</HelpDef>
                <HelpDef term="They don&apos;t — settle at season&apos;s end">Bills never move; the money is handed back when the season closes.</HelpDef>
              </HelpDefs>
              <p>It&apos;s one setting for the whole team and it applies to every kind of credit. A big rebate simply keeps walking: it finishes the last bill, then starts on the one before it. And nothing is ever locked in — if the family pays everything in cash anyway, the cash claims the bills and their credit becomes money the team owes them.</p>
            </>
          ),
          answerText: 'Their last one, by default — so the near-term installments keep their dates and amounts while the far end of the schedule shrinks. A $500 rebate against a final $800 installment leaves that bill reading $300.00 to send, with the fundraiser named underneath, and the family reminder email says so. Change it under Team settings → Money → Credits reduce, and Player Dues prints the answer under the table with a link straight to it: the last payment first (default, protects the season cash rhythm); the next payment first (relief lands on the bill coming up); or they don’t — settle at season’s end (bills never move, the money is handed back when the season closes). One setting for the whole team, applying to every kind of credit. A big rebate keeps walking: it finishes the last bill then starts on the one before it. Nothing is locked in — if the family pays everything in cash anyway, the cash claims the bills and their credit becomes money the team owes them, shown as the team is holding $X of this family’s money.',
          keywords: ['credits reduce', 'which bill does the credit come off', 'which installment does the rebate lower', 'last payment first', 'next payment first', 'keep credits separate', 'settle at season end', 'credit setting', 'how credits work', 'fundraising lowers the bill', 'covered by fundraising', 'to send', 'left to send', 'why is my installment lower', 'credit applied', 'settled vs fully paid', 'settled', 'team is holding my money', 'owed back', 'money the team owes a family'],
        },
        {
          id: 'faq-money-season-settlement',
          question: 'The season is over and there’s money left — how do I give it back?',
          popular: true,
          answer: (
            <>
              <p>Open <strong>Season settlement</strong> from the line at the foot of <strong>Player Dues</strong>. It works the money out for you and shows the arithmetic: dues received plus fundraising raised minus what you spent is <strong>the cash the team holds</strong>; take off the credits you owe families, add the dues still to come in, take off anything held back, and what&apos;s left is <strong>the surplus to share</strong>.</p>
              <p>Each family&apos;s row is their own money back, plus one even share, less anything they still owe — all four figures on the row, so it reads across. A figure in brackets is a negative: in the Refund column that means the family owes the team.</p>
              <p><strong>Tap a row</strong> to see where its number came from and to <strong>change what that family takes</strong>: an even share, a set amount, no share, or <strong>forgive</strong> what they still owe. Whatever a choice frees up goes to the other families straight away, so the rows always add back up to the pot.</p>
              <p>Paying out is one act at the end: <strong>Pay everyone and close the season</strong>. It comes alive only when every family is square on their dues <em>and</em> the team is holding enough to cover every refund — the checklist beside the money summary tells you which of those is still outstanding. A player leaving mid-season is paid sooner from their own money record instead.</p>
              <p>If the team can&apos;t cover what it owes families, the sheet says so and shares nothing rather than quietly shrinking anybody&apos;s rebate.</p>
            </>
          ),
          answerText: 'Open Season settlement from the line at the foot of Player Dues. It works the money out for you and shows the arithmetic: dues received plus fundraising raised minus what you spent is the cash the team holds; take off the credits you owe families, add the dues still to come in, take off anything held back, and what is left is the surplus to share. There is no total to type and no Calculate button — the old Season Refund Calculator is gone, along with the double-counting it allowed. Each family row is their own money back plus one even share less anything they still owe, with all four figures on the row so it reads across. A figure in brackets is a negative: in the Refund column that means the family owes the team. Tap a row to see where its number came from and to change what that family takes: an even share, a set amount, no share, or forgive what they still owe; whatever a choice frees up goes to the other families straight away so the rows always add back up to the pot. Hold back keeps money for next season, sits above the total because it has already been taken out of it, and can only come out of the surplus — never out of what the team owes families. Paying out is one act at the end of the season: Pay everyone and close the season. It comes alive only when every family is square on their dues AND the team is holding enough to cover every refund; the checklist beside the money summary names whichever is still outstanding, along with two softer warnings — money the season still plans to spend, and club funding that cannot be attributed to one season. The settlement does not pay anyone mid-season: a player leaving early is paid from their own money record instead, which works at any point in the season. If the team cannot cover what it owes families it says so and shares nothing rather than shrinking anyone’s rebate.',
          keywords: ['season settlement', 'settlement sheet', 'season refund', 'refund calculator', 'where is the refund calculator', 'refund the families', 'give the money back', 'pay the families back', 'money left over', 'whats left at the end of the season', 'surplus', 'surplus to share', 'even share', 'hold back', 'keep money for next season', 'forgive a balance', 'set a refund amount', 'no share', 'still owes', 'end of season money', 'closing the books', 'close out the season', 'close the season', 'pay everyone and close the season', 'close the budget', 'ready to close', 'not ready to close', 'before the season can close', 'why cant i pay everyone', 'pay button greyed out', 'pay everyone is disabled', 'cant close the season', 'brackets', 'why is a number in brackets', 'negative amount', 'pay one family early', 'player left the team', 'pay a family sooner', 'where is pay out', 'where is pay all', 'pay all is gone'],
        },
        {
          id: 'faq-money-fundraising-lowers-dues',
          question: 'Can fundraising lower what families pay?',
          popular: true,
          answer: (
            <>
              <p>Yes — budget it and the dues follow. On the <strong>Season Budget Plan</strong>, add a line and choose <strong>Expected fundraising</strong> instead of <em>Expense</em>: a campaign you expect to run, a sponsor, a club grant. You name it in the description — fundraising lines don&apos;t ask for a spending category. It shows in its own section at the foot of the plan, subtracted from what the season costs, and the plan card&apos;s <strong>Player installments</strong> figure is estimated from what&apos;s left. Budget $4,000 of fundraising against an $8,000 season and per player drops from $800 to $400 — and <strong>Generate installments</strong> starts from the lower figure, so nobody has to do the subtraction by hand.</p>
              <p>Once dues are out, <strong>Player installments</strong> becomes the official scheduled figure, and the plan also lists it as its own row beneath the fundraising section. Schedule more than the plan needs — most teams do — and the card simply notes your <strong>buffer</strong>; schedule less and it says, in amber, how far short of covering the plan you are.</p>
              <p>Enter what you expect the <strong>team</strong> to keep. If a campaign pays part of what a player raises back to that player, that already lands on that player&apos;s own installments as a credit — counting it here as well would lower the same dues twice. Later, <strong>Budget vs. Actual</strong> compares what you budgeted against your team&apos;s share of what was really raised, so &ldquo;did our fundraising hit the number?&rdquo; has an answer.</p>
              <p>That player-side half happens as you log the results: recording what someone raised shows a <strong>Where it lands</strong> preview — exactly which of their bills drop, and by how much — before you save, and the fundraiser&apos;s roster list carries a <strong>Left to Send</strong> column so you can see the effect across the team.</p>
            </>
          ),
          answerText: 'Yes — budget it and the dues follow. On the Season Budget Plan, add a line and choose Expected fundraising instead of Expense: a campaign you expect to run, a sponsor, a club grant. You name it in the description — fundraising lines do not ask for a spending category. It shows in its own section at the foot of the plan, subtracted from what the season costs, and the plan card’s Player installments figure is estimated from what is left. Budget $4,000 of fundraising against an $8,000 season and per player drops from $800 to $400 — and Generate installments starts from the lower figure, so nobody has to do the subtraction by hand. Once dues are out, Player installments becomes the official scheduled figure, and the plan also lists it as its own row beneath the fundraising section. Schedule more than the plan needs — most teams do — and the card simply notes your buffer; schedule less and it says, in amber, how far short of covering the plan you are. Enter what you expect the TEAM to keep. If a campaign pays part of what a player raises back to that player, that already lands on that player’s own installments as a credit — counting it here as well would lower the same dues twice. Later, Budget vs. Actual compares what you budgeted against your team’s share of what was really raised, so did our fundraising hit the number has an answer. Recording what someone raised shows a Where it lands preview — which of their bills drop and by how much — before you save, and the fundraiser roster list carries a Left to Send column.',
          keywords: ['fundraising lower dues', 'reduce dues', 'lower what families pay', 'expected funding', 'expected fundraising', 'budget fundraising', 'sponsorship', 'sponsor', 'grant', 'money coming in', 'player installments', 'offset dues', 'subsidize dues', 'raise money instead of charging', 'buffer above the plan', 'planned buffer', 'short of covering the plan', 'player dues in the budget', 'budget complete', 'no category for fundraising', 'where it lands', 'preview the credit', 'which bill does the rebate lower', 'left to send'],
        },
        {
          id: 'faq-money-estimated-total',
          question: 'What is the estimated total, and why is my budget showing less than my line items?',
          answer: (
            <>
              <p>The <strong>estimated total</strong> is optional: what you think the season costs before you&apos;ve itemized it. Set one and it becomes the <strong>Planned costs</strong> figure on the plan card, with a caption underneath tracking what you&apos;ve itemized so far — the caption updates on its own as you add lines, so the total you set holds.</p>
              <p>If your line items add up to <strong>more</strong> than your estimate, that caption turns red and says how far over you are. Planned costs still shows the estimate, because the number you set is the number that counts — including for player installments. Trim lines, raise the estimate, or <strong>Clear</strong> it (inside the editor) and your line items become the total again. <strong>Budget vs. Actual</strong> says the same thing, so the two pages never disagree.</p>
            </>
          ),
          answerText: 'The estimated total is optional: what you think the season costs before you have itemized it. Set one and the gap between it and your real lines shows as its own row — not itemized yet — which shrinks on its own as you add lines, so the total you set holds. If your line items add up to MORE than your estimate, that row turns red and says how far over you are. Your total then shows the estimate, because the number you set is the number that counts — including for per-player dues. Trim lines, raise the estimate, or Clear it and your line items become the total again. Budget vs. Actual says the same thing, so the two pages never disagree. This replaced the old Season Total and its non-itemized buffer.',
          keywords: ['estimated total', 'season total', 'estimate', 'budget shows less than my lines', 'over your estimate', 'not itemized yet', 'buffer', 'non-itemized buffer', 'clear the estimate', 'why is my total lower', 'lines exceed estimate'],
        },
        {
          id: 'faq-budget-split-by-month',
          question: 'Can I budget by month or quarter instead of picking dates?',
          answer: (
            <>
              <p>Yes. Tick <strong>Split by period</strong> on a budget line and choose how it&apos;s split: <strong>Months</strong>, <strong>Quarters</strong>, <strong>Specific dates</strong>, or <strong>Just names</strong>. Each period row then carries the right picker for what you chose — a month, a quarter, or a calendar date.</p>
              <p>It&apos;s worth matching the choice to the cost. A tournament entry fee or a uniform deposit has a real due date, so <strong>Specific dates</strong> fits. Ice time, field rental or coaching fees are usually thought about by the month, and picking twelve exact dates for them is work for nothing. <strong>Just names</strong> covers the case where you know the shape but not the timing yet — a deposit and a balance, with dates to come.</p>
              <p>For a whole season, <strong>&ldquo;+ Add period&rdquo; advances the month for you</strong>, or <strong>Fill the season</strong> lays out all twelve (or all four quarters) in one tap — then <strong>Split evenly</strong> divides the total across them.</p>
            </>
          ),
          answerText: 'Yes. Tick Split by period on a budget line and choose how it is split: Months, Quarters, Specific dates, or Just names. Each period row then carries the right picker for what you chose — a month, a quarter, or a calendar date. It is worth matching the choice to the cost. A tournament entry fee or a uniform deposit has a real due date, so Specific dates fits. Ice time, field rental or coaching fees are usually thought about by the month, and picking twelve exact dates for them is work for nothing. Just names covers the case where you know the shape but not the timing yet — a deposit and a balance, with dates to come. For a whole season, + Add period advances the month for you, or Fill the season lays out all twelve (or all four quarters) in one tap — then Split evenly divides the total across them. Switching the split afterwards clears the periods and starts over, and leaves an Undo beside it.',
          keywords: ['budget by month', 'split by month', 'monthly budget line', 'budget by quarter', 'split by quarter', 'quarterly budget', 'specific dates', 'just names', 'how is this line split', 'split by period', 'fill the season', 'twelve months', 'four quarters', 'add period', 'annual budget', 'spread a cost', 'monthly instalments', 'ice time by month', 'too many clicks', 'date picker every time'],
        },
        {
          id: 'faq-budget-period-name',
          question: 'Do I have to name every payment period?',
          answer: (
            <>
              <p>No. Every period names itself from its month, quarter or date — <em>Apr 2027</em>, <em>Q2 2027</em>, <em>Mar 14, 2027</em> — and the name it will be saved under shows greyed in the <strong>Label</strong> box while you work, so you always know what you&apos;re getting. The box is marked optional for exactly that reason.</p>
              <p>Type in it whenever your own wording is better — &ldquo;Spring tournament,&rdquo; &ldquo;Deposit,&rdquo; &ldquo;Balance&rdquo; — and that&apos;s what&apos;s saved and what shows in <strong>Budget vs. Actual</strong> instead.</p>
              <p>Dates are optional too. A period with no date still saves; it simply can&apos;t be placed in the month columns of Budget vs. Actual, so it lands in the <strong>&ldquo;No date yet&rdquo;</strong> column — the row says so while you&apos;re on the form, rather than surprising you later.</p>
            </>
          ),
          answerText: 'No. Every period names itself from its month, quarter or date — Apr 2027, Q2 2027, Mar 14 2027 — and the name it will be saved under shows greyed in the Label box while you work, so you always know what you are getting. The box is marked optional for exactly that reason. Type in it whenever your own wording is better — Spring tournament, Deposit, Balance — and that is what is saved and what shows in Budget vs. Actual instead. Dates are optional too. A period with no date still saves; it simply cannot be placed in the month columns of Budget vs. Actual, so it lands in the No date yet column — the row says so while you are on the form, rather than surprising you later.',
          keywords: ['period label', 'name a period', 'do i have to name a period', 'label optional', 'period name', 'each period must have a label', 'blank label', 'rename a period', 'period has no date', 'undated period', 'date optional', 'no date yet'],
        },
        {
          id: 'faq-budget-line-wont-save',
          question: 'I pressed Save on a budget line and nothing happened — is it broken?',
          answer: (
            <>
              <p>No — something on the form still needs a number, and the form takes you straight to it. Press <strong>Save Changes</strong> and it <strong>scrolls to the row at fault, outlines it and puts your cursor in it</strong>. A counter appears beside the button — <em>&ldquo;2 things to fix&rdquo;</em> — which stays in view however far you scroll, and jumps you back to the problem when tapped.</p>
              <p>Only money holds a save up: a <strong>period with no amount</strong>, or <strong>period amounts that don&apos;t add up to the line total</strong>. The running <strong>Period total</strong> underneath the rows shows both figures as you type, and turns red while they disagree — <strong>Split evenly</strong> settles it in one tap.</p>
              <p>A missing label or a missing date never blocks a save. Periods name themselves, and an undated one just won&apos;t appear in the month columns of Budget vs. Actual.</p>
            </>
          ),
          answerText: 'No — something on the form still needs a number, and the form takes you straight to it. Press Save Changes and it scrolls to the row at fault, outlines it and puts your cursor in it. A counter appears beside the button — 2 things to fix — which stays in view however far you scroll, and jumps you back to the problem when tapped. Only money holds a save up: a period with no amount, or period amounts that do not add up to the line total. The running Period total underneath the rows shows both figures as you type and turns red while they disagree; Split evenly settles it in one tap. A missing label or a missing date never blocks a save. Periods name themselves, and an undated one just will not appear in the month columns of Budget vs. Actual.',
          keywords: ['save changes does nothing', 'button does not work', 'save button broken', 'budget line will not save', 'cannot save budget line', 'things to fix', 'why will it not save', 'period total red', 'amounts do not add up', 'must equal line total', 'missing amount', 'nothing happens when i save'],
        },
        {
          id: 'faq-money-unbudgeted',
          question: 'Why does a row on my report have no Budget figure?',
          answer: (
            <>
              <p>Because you spent on something your plan doesn&apos;t have a line for. The row shows the item and the amount, with a dash where the budget would be — sitting inside its own category, so <em>&ldquo;what did we get charged for that we never planned?&rdquo;</em> reads straight off the report. <strong>The empty Budget figure is the whole answer</strong>; there&apos;s no label to look for.</p>
              <p><strong>Two ways to settle it.</strong> If it&apos;s a real cost you simply hadn&apos;t planned, <strong>add a budget line for that category and item</strong> and the row starts comparing against it. If it was filed under the wrong thing, open the cost (the pencil, or the row) and change what it is — the dash fills in by itself.</p>
              <p>Nothing is hidden either way: the amount always counts in your category totals, your season total and your headroom.</p>
            </>
          ),
          answerText: 'Because you spent on something your plan does not have a line for. The row shows the item and the amount, with a dash where the budget would be — sitting inside its own category, so “what did we get charged for that we never planned?” reads straight off the report. The empty Budget figure is the whole answer; there is no label to look for. Two ways to settle it: if it is a real cost you had not planned, add a budget line for that category and item and the row starts comparing against it; if it was filed under the wrong thing, open the cost (the pencil, or the row) and change what it is, and the dash fills in by itself. Nothing is hidden either way — the amount always counts in your category totals, your season total and your headroom.',
          keywords: ['unbudgeted', 'not budgeted', 'no budget figure', 'blank budget column', 'why is the budget empty', 'dash in the budget column', 'expense not counting', 'wrong category', 'wrong item', 'category mismatch', 'fix category', 'charged but not budgeted', 'dash instead of budget'],
        },
        {
          id: 'faq-money-line-actual-dash',
          question: 'I wrote two budget lines — why does my plan show one row?',
          answer: (
            <>
              <p>Because they&apos;re on the <strong>same item</strong>, and your budget groups two levels: category, then item. Two lines under &ldquo;Tournaments / Entry fees&rdquo; are one thing you spend on, so the plan and the report show <strong>one row carrying the total</strong>, captioned with how many lines are behind it. Open the row to see them and edit either one.</p>
              <p><strong>Want them apart?</strong> Give them <strong>different items</strong> — that&apos;s the split the report can measure against. If the item you want isn&apos;t in the list, add it in the picker; it belongs to your team and no other team will see it.</p>
              <p>The reason for grouping this way is that your spending records the same category and item, so the plan and the books line up on the same words. Six tournament entries paid across a season roll up to the one row that budgeted for them, rather than six.</p>
            </>
          ),
          answerText: 'Because they are on the same item, and your budget groups two levels: category, then item. Two lines under Tournaments / Entry fees are one thing you spend on, so the plan and the report show one row carrying the total, captioned with how many lines are behind it. Open the row to see them and edit either one. Want them apart? Give them different items — that is the split the report can measure against. If the item you want is not in the list, add it in the picker; it belongs to your team and no other team will see it. The reason for grouping this way is that your spending records the same category and item, so the plan and the books line up on the same words. Six tournament entries paid across a season roll up to the one row that budgeted for them, rather than six.',
          keywords: ['two lines one row', 'lines merged', 'plan shows fewer rows', 'why did my lines combine', 'summed together', 'same item', 'split them apart', 'per item actual', 'spending by item', 'category and item', 'group by item'],
        },
        {
          id: 'faq-money-on-phone',
          question: 'Can I read my budget on my phone?',
          popular: true,
          answer: (
            <>
              <p>Yes — every Money page works on a phone. Lists of records (expenses, payables, allocation instalments, fundraiser results) read as <strong>one card per item</strong> with a label on every line, so nothing runs off the edge.</p>
              <p><strong>Budget vs. Actual works differently on purpose.</strong> Seeing <em>Budgeted</em>, <em>Actual</em> and <em>Variance</em> next to each other is the entire point of that report, so rather than stacking them the table <strong>swipes sideways</strong>: the line-item name stays put on the left while the money columns move, and a small <em>&ldquo;swipe the table&rdquo;</em> cue shows whenever there&apos;s more to the right. The page itself never slides — only the table.</p>
            </>
          ),
          answerText: 'Yes — every Money page works on a phone. Lists of records (expenses, payables, allocation instalments, fundraiser results) read as one card per item with a label on every line, so nothing runs off the edge. Budget vs. Actual works differently on purpose: seeing Budgeted, Actual and Variance next to each other is the entire point of that report, so rather than stacking them the table swipes sideways — the line-item name stays put on the left while the money columns move, and a small swipe the table cue shows whenever there is more to the right. The page itself never slides, only the table.',
          keywords: ['money on a phone', 'budget on my phone', 'mobile', 'read budget on phone', 'swipe the table', 'table scrolls sideways', 'columns cut off', 'variance column missing', 'budget vs actual phone'],
        },
        {
          id: 'faq-money-discard-prompt',
          question: 'Why is it asking me to discard — and can I get my work back?',
          answer: (
            <>
              <p>Because you closed a Money form with something typed into it. The longer forms — a <strong>budget line</strong> (especially one split into payment periods), an expense, a payable, a payment request, or fundraiser settings — check before throwing anything away.</p>
              <p>Choose <strong>Keep editing</strong> and you go straight back to the form with <strong>every field exactly as you left it</strong> — nothing is lost. <strong>Discard</strong> throws it away. A form you haven&apos;t typed anything into just closes, without asking.</p>
              <p>Once you&apos;ve pressed Discard the entry is gone — it was never saved — so if you&apos;re unsure, choose Keep editing and press <strong>Save</strong>.</p>
            </>
          ),
          answerText: 'Because you closed a Money form with something typed into it. The longer forms — a budget line (especially one split into payment periods), an expense, a payable, a payment request, or fundraiser settings — check before throwing anything away. Choose Keep editing and you go straight back to the form with every field exactly as you left it, nothing is lost. Discard throws it away. A form you have not typed anything into just closes without asking. Once you press Discard the entry is gone because it was never saved, so if you are unsure choose Keep editing and press Save.',
          keywords: ['discard', 'discard this budget line', 'keep editing', 'unsaved changes', 'lost my work', 'closed the form by accident', 'asked me to discard', 'get my work back', 'budget split gone', 'periods disappeared'],
        },
        {
          id: 'faq-money-tags',
          question: 'Can I tag my money to slice it my own way?',
          answer: (
            <p>Yes. Every expense and payable has a <strong>Tags</strong> box — start typing to find a label you&apos;ve used or tap <strong>+ Create</strong> for a new one (like &ldquo;Winter dome&rdquo; or &ldquo;Tournament weekend&rdquo;). Only the tags you&apos;ve picked show as chips. On the <strong>Expenses</strong> list, a tag row up top lets you filter to one tag and see its total, and you can tap the chips on any row to re-tag it later. <strong>Budget vs. Actual</strong> gets the same filter — choose a tag to see just that spending, totalled across every category it touches. <strong>Fundraisers and sponsors carry the same tags</strong>, picked on the record itself rather than on the list, so one label can follow a thing in both directions — what it cost you and what it brought in — and both come through on the exports. Money tags are their own list (separate from game tags) and need <strong>money edit</strong> access to add or change. A club or league can also share tags org-wide — those appear in <strong>blue</strong> and you can apply them, but only an org admin edits them.</p>
          ),
          answerText: 'Yes. Every expense and payable has a Tags box — start typing to find a label you have used or tap + Create for a new one (like Winter dome or Tournament weekend). Only the tags you picked show as chips. On the Expenses list, a tag row up top lets you filter to one tag and see its total, every row shows its own tags, and you change them by opening that record with the pencil or by tapping the row. Tags come through on the export too. Budget vs. Actual gets the same filter — choose a tag to see just that spending, totalled across every category it touches. Fundraisers and sponsors carry the same tags, picked on the record itself rather than on the list, so one label can follow a thing in both directions — what it cost you and what it brought in — and both come through on the exports. Money tags are their own list, separate from game tags, and need money edit access to add or change. A club or league can also share tags org-wide — those appear in blue and you can apply them, but only an org admin edits them. Use Manage tags on the Expenses page to rename, merge, or delete your own money tags.',
          keywords: ['money tags', 'tag an expense', 'tag expenses', 'tag a sponsor', 'tag a fundraiser', 'filter expenses by tag', 'spend by tag', 'expense tag', 'winter dome', 'manage money tags', 'shared tag', 'org tag'],
        },
        {
          id: 'faq-money-tabs',
          question: 'How do I switch between Budget Plan, Player Dues, and the other Money screens?',
          answer: (
            <p>Tap any tab — <strong>Budget Plan</strong>, <strong>Player Dues</strong>, <strong>Fundraising</strong>, <strong>Transactions</strong>, <strong>Payables</strong>, and the rest — in the tab bar across the top of <strong>Money</strong>, or any link on the <strong>Overview</strong> tab: every card&apos;s footer links and every row in the More in Money list lead to the screen that owns the number. Either way you switch in place; the tab bar stays put, so getting from one Money screen to another is one tap, not a trip back to Money first. Overview lists <strong>Fundraisers</strong> and <strong>Sponsorships</strong> as two rows — both open Fundraising, each showing just that kind.</p>
          ),
          answerText: 'Tap any tab — Budget Plan, Player Dues, Fundraising, Transactions, Payables, and the rest — in the tab bar across the top of Money, or any link on the Overview tab: every card’s footer links and every row in the More in Money list lead to the screen that owns the number. Either way you switch in place; the tab bar stays put, so getting from one Money screen to another is one tap, not a trip back to Money first. Overview lists Fundraisers and Sponsorships as two rows — both open Fundraising, each showing just that kind.',
          keywords: ['tab bar', 'money tabs', 'switch tabs', 'switch between money screens', 'back to money', 'navigate money', 'change tabs'],
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
      keywords: ['arrival time', 'call time', 'be there by', 'field number', 'diamond number', 'uniform', 'jersey', 'location', 'address', 'google maps', 'map link', 'recent locations', 'links', 'attach link', 'resources', 'tags', 'tag a game', 'game tags', 'manage tags', 'merge tags', 'rename tag', 'filter by tag', 'record by tag', 'awards', 'give an award', 'mvp', 'best hitter', 'hustle award', 'award types', 'manage awards', 'retire award',
        // Chunk D Slice 3 — printable certificates live off the awards report.
        'certificate', 'certificates', 'print certificate', 'print certificates', 'print awards',
        'award certificate', 'awards night', 'banquet', 'year end party', 'pizza party', 'printable award'],
      searchText: 'arrival call time be there by field diamond number uniform jersey what to wear home whites location place name street address google maps open in maps map link recent locations chips tap to fill calendar export ics spreadsheet excel csv arrival field uniform columns game day details premium links attach link resource drill video rules page field map flyer youtube google doc url open in new tab tags tag a game rivalry top team autocomplete create new tag chip picker manage tags rename merge delete tag library filter by tag vs tag record how are we doing insights awards give an award mvp best hitter hustle award award icon emoji picker manage award types retire award restore award who is earning it leaderboard print certificate certificates awards night banquet year end pizza party letter landscape team colour full name signature line background graphics',
      content: (
        <>
          <p>When you add or edit an event on the <strong>Premium</strong> schedule, a few optional details make game day smoother. Leave any of them blank if you don&apos;t need them.</p>
          <HelpDefs>
            <HelpDef term="Arrival / call time">A &ldquo;be there by&rdquo; time separate from the start (e.g. arrive 5:15 for a 6:00 game). Shows on the event and travels with the calendar export.</HelpDef>
            <HelpDef term="Field / Diamond #">Which specific diamond or field at the venue (e.g. &ldquo;Diamond 2&rdquo;), shown right beside the location.</HelpDef>
            <HelpDef term="Uniform">Games only — what to wear, e.g. &ldquo;Home whites.&rdquo;</HelpDef>
          </HelpDefs>
          <p>All three also flow into your exports: they appear in the spreadsheet download and ride along in the calendar (.ics) export, so a synced phone calendar shows them too.</p>
        </>
      ),
      subtopics: [
        {
          id: 'event-details-location',
          title: 'Location: name vs. address',
          content: (
            <>
              <p><em>Location</em> is the place name a coach recognizes (&ldquo;Sherwood Park&rdquo;) — it&apos;s what shows on the schedule. <em>Address</em> is an optional street address that powers the map. On the event, the location becomes a tappable <strong>open-in-Google-Maps</strong> link that uses the address when you&apos;ve added one (and searches the name if you haven&apos;t).</p>
              <p><strong>Recent locations.</strong> Under the location box, a row of <strong>Recent</strong> chips shows places your team has already used — tap one to fill in both the name and its saved address in a single tap.</p>
            </>
          ),
        },
        {
          id: 'event-details-tags',
          title: 'Tags (games only)',
          content: (
            <p>Your own vocabulary for grouping games, e.g. &ldquo;Rivalry&rdquo; or &ldquo;Top in the province.&rdquo; Type in the Tags box: if a tag you&apos;ve used before matches, tap it to apply it; if it&apos;s new, tap <strong>+ Create</strong> to add it to your team&apos;s tag list and apply it in one step. A game can carry as many tags as you like. Use the <strong>Manage tags</strong> link on the same screen to rename a tag, delete one you don&apos;t need, or <strong>merge</strong> two into one (merging keeps all the game history under whichever tag you keep — handy if &ldquo;top team&rdquo; and &ldquo;top in province&rdquo; both crept in for the same idea). Tags are visible to any coach with schedule access on your team. Once you&apos;ve tagged a few games, open <strong>Insights → &ldquo;How are we doing?&rdquo;</strong> to filter the season&apos;s results by tag and see your record just for that group. If your club or league has set up <strong>shared</strong> tags, they appear in <strong>blue</strong> alongside your own — you can apply them, but only an org admin renames or removes them.</p>
          ),
        },
        {
          id: 'event-details-awards',
          title: 'Awards (games only, once a final score is in)',
          content: (
            <p>A quick way to recognize a player right after the game. Open the game and tap <strong>Give an award</strong>: pick a player, pick an award from your team&apos;s list — seeded with <strong>MVP</strong>, <strong>Best Hitter</strong>, and <strong>Hustle Award</strong> to start, fully yours to edit — add an optional note, and save. The form clears right away so you can hand out another for the same game without reopening anything. To edit your award list — change an award&apos;s name and icon, retire one you don&apos;t use (past awards keep it, it just drops off the picker for new ones), or bring a retired one back — open <strong>Insights → &ldquo;Who&apos;s earning it?&rdquo;</strong> and tap <strong>Manage award types</strong> there. Awards also show on the player&apos;s profile, and once you&apos;ve given a few, that same Insights page has a season leaderboard. A club or league can also share award types across every team — those show up in your picker to hand out, but only an org admin edits or retires them.</p>
          ),
        },
        {
          id: 'event-details-links',
          title: 'Links',
          content: (
            <p>Every event has a <strong>Links</strong> section where you can attach labelled web links — a drill video, a rules page, a field map, a practice-plan doc, a flyer. Give each a short label and paste the address; the form hints what fits each event type. On the event they show as tappable rows with a matching icon (video / map / doc) and open in a new tab. You can add up to 10. (Links are for you and your staff right now; a player/parent view may come later.)</p>
          ),
        },
      ],
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
          id: 'faq-print-certificates',
          question: 'Can I print award certificates for the year-end party?',
          answerText: 'Yes. Open Insights then "Who\'s earning it?". Every row in the Full history has a print icon that opens a ready-to-print certificate for that award. To do a whole set at once, filter to a single award type with the chips at the top and use "Print N certificates" — one page per player. Certificates print Letter size, landscape, framed in your team colour, with your organization name, the award, the player\'s full name, your team and season, your note if you left one, and a line for you to sign. Turn on background graphics in your browser\'s print options if the frame does not appear. Nothing new to fill in — it prints the awards you already gave.',
          keywords: ['certificate', 'certificates', 'print certificate', 'print awards', 'award certificate', 'awards night', 'year end', 'banquet', 'pizza party', 'trophy', 'printable', 'print', 'landscape'],
          popular: true,
          answer: (
            <>
              <p>Open <strong>Insights → &ldquo;Who&apos;s earning it?&rdquo;</strong>. Every row in <strong>Full history</strong> has a <strong>print</strong> icon that opens a ready-to-print certificate for that award.</p>
              <p>For a whole set at once, filter to one award type with the chips at the top and use <strong>Print N certificates</strong> — one page per player.</p>
              <p>Certificates come out <strong>Letter size, landscape</strong>, framed in your team colour, carrying your organization&apos;s name, the award, the player&apos;s <strong>full name</strong>, your team and season, your note if you left one, and a line for you to sign. There&apos;s nothing new to fill in — it prints the awards you already gave.</p>
              <p>If the coloured frame doesn&apos;t appear, switch on <strong>background graphics</strong> in your browser&apos;s print options.</p>
            </>
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
      searchText: 'attendance mark who is coming going not going in out late no reply unknown counts filter chips status symbol rsvp button edit rsvp open choices set status note per player note icon all in reset bulk premium event attendance roster headcount available not playing drops out of lineup remove from lineup add back single source auto save auto-fill auto fill generate lineup who plays where best okay never position preferences ranked positions cant fill position lineup warning fair playing time season attendance reliability roster attendance view who shows up over the season games practices attended totals drifting away not a ranking any coach attendance access not tracked yet',
      content: (
        <>
          <p>On <strong>Premium</strong>, open any event and pick the <strong>Attendance</strong> tab to track who&apos;s coming. Each player is one of four states: <strong>In</strong>, <strong>Late</strong>, <strong>Out</strong>, or <strong>No reply</strong> (not marked yet).</p>
          <p>At the top, a <strong>color-coded count bar</strong> shows the totals at a glance — All, In, Late, Out, and No reply. <strong>Tap any count to filter</strong> the list to just those players (tap it again to show everyone); great for working through the &ldquo;No reply&rdquo; pile until it&apos;s empty.</p>
          <p>Each player shows their <strong>current status as a small colored symbol</strong> — the same icons as the count bar — next to an <strong>RSVP</strong> button. Tap <strong>RSVP</strong> (or <strong>Edit RSVP</strong> once a status is set) to open the four choices and an optional <strong>note</strong> (&ldquo;leaving early&rdquo;, &ldquo;ride needed&rdquo;); pick one and the status symbol updates right away. Only one player&apos;s chooser is open at a time, so a long roster stays tidy. Use <strong>All in</strong> to mark everyone present at once, or <strong>Reset</strong> to clear back to No reply. Your changes <strong>save automatically</strong>.</p>
          <p><strong>See the season picture.</strong> Over time, open <strong>Insights → &ldquo;Who&apos;s showing up?&rdquo;</strong> for a season-long read of who&apos;s been making it out — each player&apos;s <strong>games</strong> and <strong>practices</strong> attended (for example, &ldquo;Games 9/10 · Practices 12/15&rdquo;). It&apos;s meant to inform playing-time decisions and to spot when someone&apos;s drifting — not a ranking — and events with <strong>no reply aren&apos;t counted against anyone</strong>. Any coach with attendance access can see it.</p>
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
          answerText: "Open Insights (in the Progress menu) and tap ‘Who’s showing up?’. Each player shows games and practices attended (for example, 'Games 9/10 · Practices 12/15'). 'Present' means marked In or Late; events with no reply aren't counted against anyone, and a player with nothing recorded shows 'not tracked yet'. It's a supportive read for playing-time decisions and spotting a kid drifting away — not a ranking. Any coach with attendance access can see it.",
          keywords: ['who shows up', 'season attendance', 'attendance reliability', 'games practices attended', 'playing time', 'drifting', 'over the season', 'insights', 'attendance report'],
          answer: (
            <p>Open <strong>Insights</strong> (in the <strong>Progress</strong> menu) and tap <strong>&ldquo;Who&apos;s showing up?&rdquo;</strong>. Each player shows <strong>games</strong> and <strong>practices</strong> attended (for example, &ldquo;Games 9/10 · Practices 12/15&rdquo;). &ldquo;Present&rdquo; means marked <strong>In</strong> or <strong>Late</strong>; events with <strong>no reply aren&apos;t counted against anyone</strong>, and a player with nothing recorded shows &ldquo;not tracked yet.&rdquo; It&apos;s a supportive read for playing-time decisions and spotting a kid drifting away — not a ranking. Any coach with attendance access can see it.</p>
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
      ],
    },
    {
      id: 'premium-repeat-weekly',
      group: 'Premium Coaches Portal',
      heading: 'Set up a repeating practice or league schedule (Premium)',
      summary: 'Set the pattern once, then see every date it will create — and give each game its own opponent — before anything is saved.',
      keywords: ['repeat weekly', 'repeating', 'recurring', 'every tuesday', 'weekly practice', 'series', 'round robin', 'league schedule', 'different opponent each week', 'bye week', 'skip a week', 'twelve games'],
      searchText: 'repeat weekly repeating recurring event every tuesday weekly practice series round robin league schedule different opponent each week per date opponent bye week skip a week remove a date preview before saving edit this and future all occurrences delete series how many games will it create',
      content: (
        <>
          <p>Tick <strong>Repeat weekly</strong> on a practice, league game or team event, then set the day, the time and the first and last dates.</p>
          <p><strong>You then see the actual list of dates</strong> it will create — not a summary sentence. For games, type the opponent beside each date; for practices it&rsquo;s just the dates. Nothing is saved until you tap the button at the bottom, which names exactly how many events you&rsquo;re about to add.</p>
          <ul>
            <li><strong>A different opponent every week</strong> is the normal case for a league, so each date has its own box. Leave one blank and that game simply names itself.</li>
            <li><strong>A bye week?</strong> Tap the <strong>✕</strong> beside that date to drop it before anything is created. Tap <strong>↩</strong> to put it back.</li>
            <li><strong>Editing later</strong> works as it always has: open any occurrence and choose <strong>This</strong>, <strong>This &amp; future</strong>, or <strong>All</strong>.</li>
          </ul>
        </>
      ),
      faqs: [
        {
          id: 'faq-repeat-different-opponents',
          question: 'Can a repeating series have a different opponent each week?',
          answerText: 'Yes. When you tick Repeat weekly on a league game and set the day, time and date range, the form shows you the actual list of dates it is about to create, with a box for the opponent beside each one. Type them in and tap the button at the bottom — it names the exact count, for example "Add 11 league games". Leave an opponent blank and that game just names itself; you can fill it in later. If your league has a bye week, tap the ✕ beside that date to drop it before anything is created, and ↩ to put it back. Nothing is written until you tap the button, so you can correct anything first.',
          keywords: ['different opponent each week', 'round robin', 'twelve different teams', 'opponent per date', 'bye week', 'skip a date', 'remove a week'],
          popular: true,
          answer: (
            <>
              <p><strong>Yes.</strong> Tick <strong>Repeat weekly</strong> on a league game and set the day, time and date range — the form then shows you the <strong>actual list of dates</strong> it&rsquo;s about to create, with an <strong>opponent box beside each one</strong>.</p>
              <p>Type them in and tap the button at the bottom; it names the exact count (&ldquo;Add 11 league games&rdquo;). Leave one blank and that game just names itself — you can fill it in later.</p>
              <p>If your league has a <strong>bye week</strong>, tap the <strong>✕</strong> beside that date to drop it before anything is created (<strong>↩</strong> puts it back). Nothing is written until you tap the button.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-schedule-import',
      group: 'Premium Coaches Portal',
      heading: 'Bring a schedule in from a spreadsheet (Premium)',
      summary: 'Paste it from a league email or upload the file — every row shows you what it will do before anything is saved.',
      keywords: ['import schedule', 'import', 'upload schedule', 'paste schedule', 'spreadsheet', 'excel', 'csv', 'league sent me a schedule', 'bulk add games', 'template'],
      searchText: 'import schedule upload spreadsheet excel xlsx csv paste from email league schedule bulk add games template download games sheet practice block round trip export then import back review before saving what will change ambiguous date refused cannot tell the date organizer game duplicate keep both skip row',
      content: (
        <>
          <p>On your <strong>Schedule</strong>, tap <strong>Import</strong> (beside Export). Paste the rows from a league email, or upload the <strong>.xlsx</strong> or <strong>.csv</strong> the league sent.</p>
          <p><strong>You review everything before it&rsquo;s saved.</strong> Each row shows what it will do in plain words — <strong>Adds</strong>, <strong>Updates</strong> (naming what changes, like &ldquo;time changes from 2:00 p.m. to 6:00 p.m.&rdquo;), or <strong>Can&rsquo;t import</strong> with the reason. Fix anything in place and the verdict updates as you type.</p>
          <ul>
            <li><strong>Templates</strong> — download a <strong>Games sheet</strong> or a <strong>Practice block</strong> to fill in. They carry the column headings only; no dates or opponents are filled in for you.</li>
            <li><strong>It reads its own export.</strong> Export your schedule, edit it in Excel, and bring the same file straight back.</li>
            <li><strong>A blank column is left alone.</strong> If your sheet has no uniform column, importing it won&rsquo;t clear the uniforms you already set.</li>
          </ul>
        </>
      ),
      faqs: [
        {
          id: 'faq-import-ambiguous-date',
          question: 'Why won’t it accept my dates?',
          answerText: 'Because a date like 03/04/2026 could be 3 April or 4 March, and there is no safe way for us to tell which one you meant. Rather than pick one and quietly put your season a month out, that row is handed back saying "We can’t tell what date 03/04/2026 is — write it as 2026-04-03 and we’ll take it." Anything unambiguous is accepted as-is: 2026-04-03, 2026/4/3, "Sep 8, 2026" and "8 September 2026" all work. Times are forgiving — 6:00 PM, 6pm and 18:00 are all fine. You can fix the date right there in the review list and the row turns green without re-uploading anything.',
          keywords: ['ambiguous date', 'wont accept my date', 'date format', 'cannot tell the date', 'dd/mm', 'mm/dd', 'date rejected', 'fix the date'],
          popular: true,
          answer: (
            <>
              <p>Because a date like <strong>03/04/2026</strong> could be <strong>3 April</strong> or <strong>4 March</strong>, and there&rsquo;s no safe way for us to know which you meant. Rather than pick one and quietly put your season a month out, that row comes back asking.</p>
              <p>Anything unambiguous is accepted as-is: <strong>2026-04-03</strong>, <strong>2026/4/3</strong>, <strong>Sep 8, 2026</strong> and <strong>8 September 2026</strong> all work. Times are forgiving — <strong>6:00 PM</strong>, <strong>6pm</strong> and <strong>18:00</strong> are all fine.</p>
              <p>Fix the date right there in the review list and the row turns green — no need to re-upload anything.</p>
            </>
          ),
        },
        {
          id: 'faq-import-tournament-duplicate',
          question: 'My league sheet includes our tournament games — will it duplicate them?',
          answerText: 'No. Games that come from a FieldLogicHQ tournament belong to the organizer, and nothing you import will change or overwrite them. If a row you are importing looks like one of those games, it is shown side by side marked "Already yours", with the tournament named, and two choices: Keep both (import your row as a separate event as well) or Skip this row. We never merge them for you and we never guess — your hand-entered copy might have attendance and a lineup on it that we would be throwing away.',
          keywords: ['duplicate tournament game', 'league sheet has tournament games', 'will it duplicate', 'keep both', 'skip row', 'already yours', 'organizer game'],
          answer: (
            <>
              <p><strong>No.</strong> Games that come from a FieldLogicHQ tournament belong to the organizer, and nothing you import will change or overwrite them.</p>
              <p>If a row looks like one of those games, it&rsquo;s shown marked <strong>Already yours</strong> with the tournament named, and two choices: <strong>Keep both</strong> (import your row as a separate event too) or <strong>Skip this row</strong>.</p>
              <p>We never merge them for you — your hand-entered copy might carry attendance and a lineup we&rsquo;d be throwing away.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-tournament-games',
      group: 'Premium Coaches Portal',
      heading: 'Tournament games on your team calendar (Premium)',
      summary: 'Your real tournament games sit on your schedule like any other game — attendance, lineups, and your season record — while the organizer keeps the time and score true.',
      keywords: ['tournament game', 'tournament games', 'attendance on tournament game', 'lineup for tournament game', 'tournament game attendance', 'game moved', 'organizer moved my game', 'rescheduled', 'cant edit game', 'cannot delete game', 'why is this game read only', 'duplicate game', 'two games', 'added it myself', 'record changed', 'tournament games count'],
      searchText: 'tournament games attendance lineups real tournament games on my schedule take attendance for a tournament game build a lineup for a tournament game organizer moved the game rescheduled changed time cannot edit cannot delete read-only game arrival time uniform duplicate game i added it myself remove my copy season record changed tournament games count toward my record bracket to be scheduled tbd',
      content: (
        <>
          <p>When your team plays in a FieldLogicHQ tournament, those games land on your <strong>Schedule</strong> automatically, alongside your practices and league games. They&rsquo;re real games: open one and you get <strong>Attendance</strong> and the <strong>Lineup</strong> builder, exactly like any other game, and they count toward your season record and Insights.</p>
          <p><strong>The organizer keeps the facts true.</strong> The date, time, opponent, field and final score come from the tournament and stay in step on their own — if the organizer reschedules a game or a bracket resolves, your calendar has already moved by the time you look. That&rsquo;s also why you can&rsquo;t edit or delete those details: your calendar can never disagree with the tournament you&rsquo;re playing in.</p>
          <p><strong>What&rsquo;s yours stays yours.</strong> Arrival time, uniform, field notes, links, tags — plus your attendance and your lineup — are yours to set, and nothing the organizer does overwrites them.</p>
          <p><strong>Games with no time yet</strong> (an unresolved bracket slot) wait in a <strong>To be scheduled</strong> group at the bottom of the list and join the calendar the moment the organizer sets a time.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tournament-game-moved',
          question: 'I built my lineup and the organizer moved the game — do I have to redo it?',
          answerText: 'No. Your lineup and your attendance are attached to the game itself, not to the time slot it was in, so they move with it. Open the game at its new time and everything is exactly as you left it. You will see a Moved marker on that game in your Schedule, and inside it a line saying what it moved from — for example "Moved from Sat May 16, 9:00 a.m." The marker clears once you have opened the game. If the game moved to a different DAY, the line adds a reminder that your attendance was taken for the old time and is worth re-checking — your replies are never wiped, but people who said yes to a Saturday morning may not be free on Sunday afternoon. Some organizers reschedule by deleting a game and creating a new one, and regenerating a bracket does this to every game at once. Your work follows the game to its new identity in that case too, as long as it is recognisable — same tournament, same opponent. If it genuinely cannot be matched, the old game is kept and marked cancelled with your attendance and lineup intact rather than being thrown away.',
          keywords: ['game moved', 'rescheduled', 'organizer changed the time', 'lineup lost', 'do i have to redo my lineup', 'moved marker', 'moved from', 'attendance after reschedule', 'different day', 'recheck attendance', 'bracket regenerated', 'game deleted and recreated'],
          popular: true,
          answer: (
            <>
              <p><strong>No.</strong> Your lineup and your attendance are attached to the <em>game</em>, not to the time slot it was in — so they move with it. Open the game at its new time and everything is exactly as you left it.</p>
              <p>You&rsquo;ll see a <strong>Moved</strong> marker on that game in your Schedule, and inside it a line saying what it moved from (&ldquo;Moved from Sat May 16, 9:00 a.m.&rdquo;). The marker clears once you&rsquo;ve opened the game.</p>
              <p>If it moved to a <strong>different day</strong>, that line adds a nudge to re-check your attendance. Nothing is wiped — but people who said yes to a Saturday morning may not be free on Sunday afternoon.</p>
              <p>Some organizers reschedule by deleting a game and creating a new one, and regenerating a bracket does that to every game at once. Your work follows the game to its new identity in that case too, as long as it&rsquo;s recognisable (same tournament, same opponent). If it genuinely can&rsquo;t be matched, the old game is <strong>kept and marked cancelled</strong> with your attendance and lineup intact, rather than thrown away.</p>
            </>
          ),
        },
        {
          id: 'faq-tournament-game-duplicate',
          question: 'I typed my tournament games in by hand — now there are two of each',
          answerText: 'That is expected, and there is a one-tap fix. Before tournament games arrived on your schedule automatically, adding them yourself was the only way to take attendance or build a lineup for them, so plenty of coaches did. Now that the real ones show up on their own, you have two rows for the same game — and both count toward your season record. Your Schedule shows a note naming the pair, with two choices. Remove my copy deletes only the game you added; it asks first and tells you exactly what goes with it, such as its attendance and its saved lineup, so nothing disappears by surprise. The tournament version stays and you can take attendance and build the lineup on that one instead. Keep both leaves everything alone and remembers your answer for that pair. Nothing is ever merged or deleted automatically — your copy may hold real work, and guessing wrong would throw it away. Separately, expect your displayed record to change once when tournament games start counting: that is the correction, but it is worth knowing before you notice it.',
          keywords: ['duplicate game', 'two games', 'same game twice', 'i added it myself', 'remove my copy', 'keep both', 'record changed', 'record wrong', 'counted twice', 'double counted'],
          answer: (
            <>
              <p>Expected — and there&rsquo;s a one-tap fix. Before tournament games arrived automatically, typing them in yourself was the only way to take attendance or build a lineup for them, so plenty of coaches did. Now that the real ones show up on their own, you have two rows for one game — and <strong>both count toward your record</strong>.</p>
              <p>Your Schedule shows a note naming the pair, with two choices:</p>
              <ul>
                <li><strong>Remove my copy</strong> — deletes only the game <em>you</em> added. It asks first and names exactly what goes with it (its attendance, its saved lineup), so nothing disappears by surprise. The tournament&rsquo;s version stays, and you take attendance and build the lineup on that one instead.</li>
                <li><strong>Keep both</strong> — leaves everything alone and remembers your answer for that pair.</li>
              </ul>
              <p>Nothing is ever merged or deleted automatically: your copy may hold real work, and guessing wrong would throw it away.</p>
              <p>Separately — expect your displayed <strong>record to change once</strong> when tournament games start counting. That&rsquo;s the correction, but it&rsquo;s worth knowing before you notice it.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-lineups',
      group: 'Premium Coaches Portal',
      heading: 'Building lineups & reusable templates (Premium)',
      summary: 'Set who plays where once, then reuse it game to game — and let game sheets, attendance and Insights read from it.',
      keywords: ['lineups', 'lineup', 'build lineup', 'playing order', 'batting order', 'field positions', 'who plays where', 'templates', 'auto-fill', 'game sheet', 'needs lineup', 'reorder batting order', 'drag to reorder', 'move a player up', 'change the batting order', 'positions tab', 'batting order tab', 'print lineup', 'dugout poster', 'batting order card', 'undo', 'save lineup'],
      searchText: 'lineups lineup build a lineup playing order batting order field positions who plays where period by period inning by inning game sheet print attendance insights playing time fairness templates reusable base lineup apply template auto-fill generate lineup needs lineup not set games tab templates tab no games yet add a game schedule first assistant coach lineup access batting order tab positions tab playing time tab three views drag to reorder press and hold move a player up or down bench cut line nine player ball swap someone in positions follow the player saves automatically no save button where is the save button saving saved couldnt save retry undo redo mis-tap print lineup dugout poster batting order card paper lineup sheet print lineup notes',
      content: (
        <>
          <p>A <strong>lineup</strong> is your playing order and field positions for one game, set period by period. Open <strong>Lineups</strong> in the Season menu — the <strong>Games</strong> tab lists every game on your schedule, each marked <strong>Lineup set</strong> or <strong>Not set</strong>, so you can see at a glance what still needs doing before the weekend.</p>
          <p><strong>Why it&rsquo;s worth doing once.</strong> A saved lineup isn&rsquo;t just a game-day sheet. Your game sheet and attendance read from it instead of asking you again, and <strong>Insights</strong> uses it to answer <em>&ldquo;Where is playing time going?&rdquo;</em> — innings on the field versus the bench, positions each player has covered, and pitching against your arm-care caps.</p>
        </>
      ),
      subtopics: [
        {
          id: 'lineups-three-views',
          title: 'Inside a game: three views of one lineup',
          content: (
            <>
              <p>Each answers a different question, and they&rsquo;re all the same lineup:</p>
              <HelpDefs>
                <HelpDef term="Batting order">Who bats when. A plain list: <strong>press and hold a row and drag it</strong> where you want, or use the arrows. In 9-player ball the batting nine sit above a line with the bench below; drag someone across it and they swap in.</HelpDef>
                <HelpDef term="Positions">Who plays where, period by period. This is where the page opens.</HelpDef>
                <HelpDef term="Playing time">Where the innings are going.</HelpDef>
              </HelpDefs>
              <p>Changes carry across all three, and a player&rsquo;s positions <strong>follow the player</strong> when you move them in the order — nothing gets left behind in the slot they were in.</p>
            </>
          ),
        },
        {
          id: 'lineups-templates',
          title: 'Templates, and finding the games that need one',
          content: (
            <>
              <p><strong>Templates</strong> (the second tab) are reusable base lineups you apply to any game in one tap — your usual order, a rain-day rotation, a tournament arrangement. Build one from scratch, or save a game&rsquo;s lineup as a template once you like it.</p>
              <p><strong>Filters:</strong> the Games tab has scope chips (League / Tournament / Scrimmage) and a <strong>Needs lineup</strong> toggle that narrows the list to the games still missing one.</p>
              <HelpNote variant="info" title="You need a game before you can build a lineup">
                <p>If the Games tab is empty, add a practice or game on your <strong>Schedule</strong> first. Lineups are always attached to a real game — there&rsquo;s nowhere to put one otherwise.</p>
              </HelpNote>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-lineup-autofill-positions',
          question: 'How does Auto-fill decide who plays where?',
          answerText: 'Auto-fill uses the positions you set on each player’s profile and a game Mode you pick in the Auto-fill menu (Competitive, Balanced, or Development — pre-picked from the game type). It never puts a player at a position you marked Never, and it favors each player’s Best positions in the order you ranked them (Okay spots are used as fill-ins). For the mound, it uses your pitchers: competitive games lead with your ace, balanced and development games spread innings down the pitcher order, and it never works a pitcher past their max-innings cap. In Competitive mode your A-squad (gold-medal starters) get their best positions and can be protected from the bench. It also follows your team Lineup rules — caps on innings at one position, a pitching innings ceiling, and a minimum innings per player. It still spreads bench time evenly across the roster. If a spot genuinely can’t be filled — for example everyone available has it set to Never, or a cap leaves no one eligible — Auto-fill leaves that cell blank and shows a warning instead of forcing a bad fit, so you can adjust it by hand. Auto-fill always gives you a starting point you can edit before the game. You can re-run it any time: the Reshuffle button gives a fresh arrangement with even bench rotation using your current settings, and the "Innings to fill" range lets you auto-fill only some innings (say 1–3) and leave the rest as you set them — it still counts what you have already done toward the caps and bench balance.',
          keywords: ['auto-fill', 'auto fill', 'generate lineup', 'fill lineup', 'mode', 'competitive', 'balanced', 'development', 'a-squad', 'never position', 'best position', 'ranked positions', 'position preferences', 'pitcher', 'ace', 'max innings', 'arm care', 'lineup rules', 'innings cap', 'minimum innings', 'cant fill position', 'blank position', 'lineup warning', 'who plays where', 'reshuffle', 'shuffle lineup', 'innings to fill', 'inning range', 'fill some innings', 'regenerate'],
          answer: (
            <>
              <p><strong>Auto-fill</strong> uses the positions you set on each player&apos;s profile plus a game <strong>Mode</strong> you pick in the Auto-fill menu (see below). It <strong>never</strong> puts a player at a position you marked <strong>Never</strong>, and it favors each player&apos;s <strong>Best</strong> positions in the order you ranked them (<strong>Okay</strong> spots are used as fill-ins). For the <strong>mound</strong>, it uses your pitchers: competitive games lead with your <strong>ace</strong>, balanced and development games spread innings down the pitcher order, and it never works a pitcher past their <strong>max-innings cap</strong>. It also follows your team <strong>Lineup rules</strong> (below). It still spreads bench time evenly across the roster.</p>
              <p>If a spot genuinely can&apos;t be filled — for example everyone available has it set to <strong>Never</strong>, or a cap leaves no one eligible — Auto-fill leaves that cell blank and shows a <strong>warning</strong> instead of forcing a bad fit, so you can set it by hand. Auto-fill always gives you a starting point you can edit before the game.</p>
              <p><strong>Re-run it any time.</strong> The <strong>Reshuffle</strong> button hands you a fresh arrangement with even bench rotation, using your current settings (tap again for another). And <strong>&ldquo;Innings to fill&rdquo;</strong> lets you auto-fill just a range of innings — say <strong>1–3</strong> — and leave the rest exactly as you set them; it still counts what&apos;s already in the other innings toward your caps and bench balance.</p>
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
          answerText: 'When you Auto-fill a lineup you pick a Mode, and it starts on the right one for the game type — tournament games open on Competitive, scrimmages on Development, and league games on Balanced. You can change it. Balanced gives players their preferred spots while rotating everyone evenly. Development rotates everyone through lots of positions for variety. Competitive puts your best on the field: it leans on Best positions and your ace, and it uses your A-squad. Your A-squad is your gold-medal starters — turn on "Gold-medal starter" on a player’s profile to mark them. In Competitive games A-squad players get their best positions and can be protected from the bench; it has no effect on Balanced or Development games. When you choose Competitive, two extra dials appear: A-squad emphasis — "Play key spots, bench rotates evenly" keeps bench time even across the rest of the roster, or "Stay on field, others cover the bench" leans harder on your best — and a "Nobody sits two innings in a row" switch so the bottom of the roster keeps rotating. Your minimum-innings rule always comes first (everyone still gets their floor), then no back-to-back sits, then A-squad protection. These mode dials apply to that one game and are not saved.',
          keywords: ['mode', 'competitive', 'balanced', 'development', 'game mode', 'a-squad', 'gold medal', 'starters', 'best players', 'prioritize', 'bench rotation', 'no back to back', 'tournament lineup', 'scrimmage lineup'],
          answer: (
            <>
              <p>When you <strong>Auto-fill</strong> a lineup you pick a <strong>Mode</strong>, and it starts on the right one for the game type — <strong>tournament</strong> games open on <strong>Competitive</strong>, <strong>scrimmages</strong> on <strong>Development</strong>, and <strong>league</strong> games on <strong>Balanced</strong>. You can always change it.</p>
              <ul>
                <li><strong>Balanced</strong> — players get their preferred spots while everyone rotates evenly.</li>
                <li><strong>Development</strong> — rotates everyone through lots of positions for variety.</li>
                <li><strong>Competitive</strong> — puts your best on the field: leans on Best positions, your ace, and your A-squad.</li>
              </ul>
              <p>Your <strong>A-squad</strong> is your gold-medal starters — turn on <strong>&ldquo;Gold-medal starter&rdquo;</strong> on a player&apos;s profile to mark them. In Competitive games, A-squad players get their best positions and can be protected from the bench; it has <strong>no effect</strong> on Balanced or Development games.</p>
              <p>When you choose <strong>Competitive</strong>, two dials appear:</p>
              <ul>
                <li><strong>A-squad emphasis</strong> — <em>Play key spots, bench rotates evenly</em> keeps bench time even across the rest of the roster, or <em>Stay on field, others cover the bench</em> leans harder on your best.</li>
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
          id: 'faq-lineup-save-print',
          question: 'How do I save a lineup, undo a mistake, or print one for the field?',
          answerText: 'You never save a lineup by hand. It saves itself about a second after your last change, and the bar along the bottom of the builder tells you where it stands — Saving, then Saved. If a save fails it says so and offers Retry, so a lineup is never lost quietly. That bar stays at the bottom of the screen the whole time you work, on a phone as well, and holds three controls. Undo and Redo step back and forward through your changes, which is worth knowing on a screen this tap-heavy; they grey out when there is nothing to step through. Print gives you two sheets: a Dugout poster, which is positions period by period with blank boxes to pen in at the field, and a Batting order card, a large-type order for the scorekeeper or the dugout. If you have written lineup notes, a checkbox prints them on the poster too. The bar appears once there is at least one player in the lineup.',
          keywords: ['save lineup', 'save', 'no save button', 'where is the save button', 'autosave', 'saves automatically', 'saved', 'couldn\'t save', 'retry', 'undo', 'redo', 'undo a mistake', 'mis-tap', 'wrong tap', 'print lineup', 'print', 'dugout poster', 'batting order card', 'lineup sheet', 'paper lineup', 'pdf', 'lineup notes', 'print notes'],
          answer: (
            <>
              <p><strong>You never save by hand.</strong> A lineup saves itself about a second after your last change. The bar along the bottom of the builder tells you where it stands — <em>Saving&hellip;</em>, then <strong>Saved</strong> — and if a save fails it says so and offers <strong>Retry</strong>, so nothing is lost quietly.</p>
              <p>That bar stays at the bottom of the screen the whole time you work, on a phone as well, and holds three controls:</p>
              <ul>
                <li><strong>Undo</strong> and <strong>Redo</strong> — step back and forward through your changes, which is worth knowing on a screen this tap-heavy. They grey out when there&rsquo;s nothing to step through.</li>
                <li><strong>Print</strong> — two sheets. A <strong>Dugout poster</strong> (positions period by period, with blank boxes to pen in at the field) and a <strong>Batting order card</strong> (large-type order for the scorekeeper or the dugout). If you&rsquo;ve written lineup notes, a checkbox prints them on the poster too.</li>
              </ul>
              <p>The bar appears once there&rsquo;s at least one player in the lineup.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-game-day',
      group: 'Premium Coaches Portal',
      heading: 'Game day: running the bench from your phone (Premium)',
      summary: 'On game day the schedule grows a Game day button — who’s on the field right now, tap-to-substitute, the running score, a Note button for the moments worth keeping, and one End game tap that tells families the final.',
      // "game day" / "bench" / "substitute" / "live score" are what a coach searches for mid-game,
      // and search never reads the prose — so they all have to live here. "moment"/"note" joined
      // in P2 and are the terms a coach will hunt for when they want last June's line back.
      keywords: ['game day', 'game-day', 'bench console', 'run the game', 'live game', 'substitution', 'substitute', 'sub', 'swap players', 'who is on the field', 'bench', 'running score', 'keep score', 'score the game', 'plus one', 'end game', 'final score', 'notify families', 'one notification', 'who covers', 'skip lineup', 'everyone plays', 'game recap', 'playing time tonight', 'scored by the tournament', 'your coach runs the bench', 'note', 'notes', 'moment', 'moments', 'jot something down', 'remember this', 'first triple', 'write a note about a player', 'tag a player', 'longest sitting first', 'bench order', 'who has been sitting longest', 'bench sorted', 'why did the bench reorder', 'innings pitched', 'innings pitched chip', 'pitch count', 'pitching cap', 'arm care', 'max innings', 'season default cap', 'no innings pitched showing', 'screen staying on', 'keep the screen on', 'screen keeps turning off', 'phone keeps sleeping', 'screen timeout', 'stay awake'],
      searchText: 'game day button schedule row lineups masthead overview card open game day fourth door bench console phone at the field on the field bench right now current inning tap to substitute sub swap from this inning on this inning only saves into the lineup playing time report player recap running score plus one run families not notified per run one notification final score end game win loss tie decided who is here in late out no reply mark absent who covers no lineup start from a template everyone plays skip lineup just score and attendance read only recap playing time tonight season report opponent name scouting book their tournament so far add to the book tournament game scored by the tournament organizer archived season no button helper read only your coach runs the bench note button moment moments capture a line jot it down something worth remembering first triple tag a player optional tag saved add another one sitting 280 characters tonight moments end game wrap remove a moment cannot edit retype delete a mistake private to you and your staff families never see moments no notification for a note player profile moments you logged season wrapped from the bench quoted line share image does not include moments bench sorted longest sitting first order settles when you move the inning holds still nothing shuffles under your thumb benched mid inning joins the bottom of the list second straight inning sitting chip three of four innings pitched turns red at the cap where the pitching number comes from max innings per game on the player profile game override in the builder season default team settings lineup rules no cap set nothing shown never invents an arm care limit screen staying on chip keeps the phone awake tap to switch it off only while the game is live only the coach running the bench lets go when you end the game or pocket the phone phone that cannot do it no chip screen keeps turning off between pitches',
      content: (
        <p><strong>On game day, the game itself grows a door.</strong> From about two hours before first pitch (or your arrival time, whichever is earlier) until a few hours after the end, the game&rsquo;s row on the <strong>Schedule</strong> and in <strong>Lineups</strong> wears a <strong>Game day</strong> pill, the team masthead&rsquo;s &ldquo;Game day&rdquo; line becomes a link, and — once your lineup and attendance are both done — the card at the top of your <strong>Overview</strong> offers <strong>Open game day</strong> as its button. No setup, no &ldquo;start game&rdquo; ceremony — the door appears when it&rsquo;s useful and retires when it isn&rsquo;t. A finished season never shows it.</p>
      ),
      subtopics: [
        {
          id: 'premium-gameday-subs',
          title: 'The bench board: making a substitution',
          content: (
            <>
              <p><strong>The console is one phone screen:</strong> the matchup and score up top with an inning stepper, then your roster split <strong>On the field / Bench</strong> for the inning you&rsquo;re in. Tap a bench player, tap who they go in for, and choose <strong>from this inning on</strong> or <strong>this inning only</strong>.</p>
              <p>Every change saves into <strong>the same lineup you built before the game</strong> — so the playing-time report and each player&rsquo;s season recap reflect what actually happened, not just the plan. If you stop tapping mid-game, nothing breaks: the plan simply stands in for the rest, exactly as if you&rsquo;d never opened the screen.</p>
              <p><strong>The board sorts itself so the right name is on top.</strong> The <strong>Bench</strong> list leads with whoever has been sitting longest, and the order <strong>settles when you move the inning and then holds still</strong> — so nothing shuffles between the moment you look and the moment your thumb lands. Bench someone mid-inning and they join the bottom of the list rather than pushing everyone down. Beside the names, the same two cues the season reports use: a red <strong>&ldquo;2nd straight inning sitting&rdquo;</strong> chip, and, for whoever is on the mound, <strong>&ldquo;3 of 4 innings pitched&rdquo;</strong>, which turns red at the cap.</p>
              <HelpNote variant="info" title="Where that pitching number comes from">
                <p>The player&rsquo;s own <strong>max innings per game</strong> if you set one on their profile, otherwise this game&rsquo;s cap if you overrode it in the builder, otherwise your team&rsquo;s <strong>season default</strong> from <strong>Team settings &rarr; lineup rules</strong>. Set nothing anywhere and the console says nothing — it will never invent an arm-care limit you didn&rsquo;t choose.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-gameday-score',
          title: 'The score, and the one notification families get',
          content: (
            <p><strong>The score is two big +1 buttons</strong> (tap the score to open them). Families are <strong>not</strong> pinged run-by-run — they get <strong>exactly one notification, the final score, when you tap End game</strong>. That&rsquo;s also the moment the win/loss/tie is decided and your season record updates. Until then the running score just quietly keeps itself saved.</p>
          ),
        },
        {
          id: 'premium-gameday-attendance',
          title: 'Who’s here, and keeping the screen awake',
          content: (
            <>
              <p><strong>Who&rsquo;s here</strong> opens the attendance sheet — the same four words as the schedule tab (<strong>In &middot; Late &middot; Out &middot; No reply</strong>), one tap each. Mark a player who&rsquo;s on the field as <strong>Out</strong> and the board immediately asks who covers their position.</p>
              <p><strong>Your screen stays on while the game does.</strong> A <strong>Screen staying on</strong> chip sits with the field and uniform chips in the header, on from the start so you aren&rsquo;t waking the phone between pitches. Tap it to switch it off. It only applies while the game is live and only for the coach running the bench, it lets go the moment you end the game or put the phone in your pocket, and on a phone that can&rsquo;t do it the chip simply isn&rsquo;t there.</p>
            </>
          ),
        },
        {
          id: 'premium-gameday-no-lineup',
          title: 'No lineup saved yet?',
          content: (
            <>
              <p>The console offers three doors:</p>
              <HelpDefs>
                <HelpDef term="Start from a template">Opens the builder.</HelpDef>
                <HelpDef term="Everyone plays">Auto-fills an even rotation on the spot.</HelpDef>
                <HelpDef term="Skip lineup">The screen runs as score-and-attendance only for the night.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'premium-gameday-moments',
          title: 'Moments: the part nobody writes down',
          content: (
            <>
              <p><strong>Note</strong> is for exactly that. Tap it, type one line — <em>&ldquo;first triple, never slowed down at second&rdquo;</em> — optionally tap a player&rsquo;s name to file it under them, and save. The sheet stays open saying <strong>Saved &mdash; add another?</strong> with the keyboard up, so a second thought costs nothing.</p>
              <HelpNote variant="tip" title="Moments are yours">
                <p><strong>Families never see them and nothing about a moment is ever notified to anyone.</strong> They read back in the End game wrap, on that player&rsquo;s profile, and as one quoted line on your <strong>Season Wrapped</strong> card at the end of the year.</p>
              </HelpNote>
              <p>A moment can&rsquo;t be edited after saving — remove a mistyped one with the &times; and type it again — so what a line says is always what you wrote at the time. Log none all season and nothing anywhere looks emptier for it.</p>
            </>
          ),
        },
        {
          id: 'premium-gameday-scouting',
          title: 'Scouting at the bench',
          content: (
            <p>The opponent&rsquo;s name in the header opens your book on them — and on a platform tournament game it includes <strong>Their tournament so far</strong>, their other results this weekend. After the game, the recap offers a quiet <em>add to the book</em> line while it&rsquo;s fresh.</p>
          ),
        },
        {
          id: 'premium-gameday-after',
          title: 'After the game, and tournament games',
          content: (
            <>
              <p><strong>After End game</strong> (or any time outside the live window) the same link is a <strong>read-only recap</strong>: innings on the field per player from the lineup you actually ran, tonight&rsquo;s moments if you logged any, and a door to the <strong>Playing time</strong> season report.</p>
              <p><strong>Tournament games run by an organizer</strong> keep their score with the tournament — the score area says so and steps back, and there&rsquo;s no End game (the organizer&rsquo;s result is the record). Substitutions, attendance and the book all still work.</p>
            </>
          ),
        },
        {
          id: 'premium-gameday-access',
          title: 'Who can do what',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Substitutions">Needs <strong>lineups</strong> access.</HelpDef>
                <HelpDef term="Who’s here">Needs <strong>attendance</strong> access.</HelpDef>
                <HelpDef term="Score &amp; End game">Need <strong>schedule</strong> (manage) access.</HelpDef>
                <HelpDef term="Note">Goes with running the bench — anyone holding any one of those three can log a moment.</HelpDef>
              </HelpDefs>
              <p>A schedule-only helper who opens the console sees the matchup and score with <em>&ldquo;Your coach runs the bench.&rdquo;</em> — no lineup board, because the lineup itself follows lineup access, and no Note button either.</p>
            </>
          ),
        },
      ],
      links: [
        { label: 'Building the lineup', href: '#premium-lineups' },
        { label: 'Attendance', href: '#recipe-attendance' },
        { label: 'Tournament games on your schedule', href: '#premium-tournament-games' },
      ],
      faqs: [
        {
          id: 'faq-game-day-notifications',
          question: 'Will families get a notification every time I score a run?',
          answerText: 'No. While the game is live, the console saves the running score quietly — no notification goes out per run, on purpose. Families get exactly one notification for the night: the final score, sent when you tap End game and confirm. That is also the moment the win, loss or tie is decided and your season record updates. If you never tap End game, no final-score notification is sent at all — you can still enter or fix the score later from the schedule, which notifies as it always has.',
          keywords: ['notification', 'notify families', 'every run', 'score notification', 'spam', 'one notification', 'final score', 'end game', 'when do families hear'],
          popular: true,
          answer: (
            <>
              <p>No. While the game is live, the console saves the running score <strong>quietly</strong> — nothing goes out per run, on purpose.</p>
              <p>Families get <strong>exactly one notification for the night: the final score</strong>, sent when you tap <strong>End game</strong> and confirm. That&rsquo;s also the moment the win/loss/tie is decided and your season record updates.</p>
              <p>If you never tap End game, no final-score notice is sent — you can still enter or fix the score later from the schedule, which notifies as it always has.</p>
            </>
          ),
        },
        {
          id: 'faq-game-day-abandon',
          question: 'I stopped using the console in the fourth inning — did I break anything?',
          answerText: 'No. The console edits the same lineup you built before the game, one substitution at a time, and each change saves within a second or two. Whatever you did not change simply keeps the plan — exactly the data you would have had if you had never opened the screen. Nothing is half-recorded, and the playing-time report reads the one lineup either way. If you did not end the game, no family notification went out; enter the final score from the schedule whenever you like.',
          keywords: ['abandoned', 'stopped using', 'closed the app', 'mid game', 'forgot to end', 'did not end the game', 'half finished', 'is my data wrong'],
          answer: (
            <>
              <p>No. The console edits the <strong>same lineup you built before the game</strong>, one substitution at a time, and each change saves within a second or two of the tap.</p>
              <p>Whatever you didn&rsquo;t change simply keeps the plan — exactly the data you&rsquo;d have if you&rsquo;d never opened the screen. Nothing is half-recorded, and the playing-time report reads the one lineup either way.</p>
              <p>If you didn&rsquo;t end the game, no family notification went out; enter the final score from the schedule whenever you like.</p>
            </>
          ),
        },
        {
          id: 'faq-game-day-pitch-cap',
          question: 'Why don’t I see the “innings pitched” chip for my pitcher?',
          answerText: 'The chip only appears when a cap exists to count against, and only for the player actually on the mound this inning. The console looks for that cap in three places, in order: the max innings per game on that player’s own profile, then this game’s cap if you overrode it in the lineup builder, then your team’s season default under Team settings, lineup rules. If none of those is set, the console deliberately says nothing rather than inventing an arm-care limit you never chose. Set a season default once and every pitcher without a personal cap starts showing the chip. The number turns red when they reach the cap; it is a prompt to look, never a block — the console will not stop you.',
          keywords: ['innings pitched', 'no chip', 'pitching cap', 'arm care', 'max innings', 'season default', 'lineup rules', 'why no cap showing', 'pitch limit', 'protect an arm'],
          answer: (
            <>
              <p>The chip only appears when a cap exists to count against, and only for the player actually on the mound that inning.</p>
              <p>The console looks for that cap in three places, in order: the <strong>max innings per game</strong> on that player&rsquo;s own profile, then <strong>this game&rsquo;s cap</strong> if you overrode it in the lineup builder, then your team&rsquo;s <strong>season default</strong> under <strong>Team settings &rarr; lineup rules</strong>. If none is set, the console says nothing rather than inventing an arm-care limit you never chose.</p>
              <p>Set a season default once and every pitcher without a personal cap starts showing it. The number turns red at the cap — a prompt to look, never a block.</p>
            </>
          ),
        },
        {
          id: 'faq-game-day-bench-order',
          question: 'Why did the bench list change order — and why didn’t it?',
          answerText: 'The Bench list leads with whoever has been sitting longest, and it re-sorts once, when you move the inning. Within an inning it deliberately holds still: a list that re-shuffles between the moment you look at it and the moment your thumb lands is how the wrong player gets sent in. So if you bench someone mid-inning they join the bottom of the list rather than pushing everyone else down, and nobody already on the list moves. Everything settles into longest-sitting-first again the moment you tap to the next inning. Each row still carries its own red "2nd straight inning sitting" chip, so a long sit is visible wherever the row happens to sit.',
          keywords: ['bench order', 'longest sitting first', 'why did the bench reorder', 'bench did not reorder', 'sorted bench', 'who has been sitting longest', 'list moved', 'rows moved'],
          answer: (
            <>
              <p>The <strong>Bench</strong> list leads with whoever has been sitting longest, and it re-sorts <strong>once, when you move the inning</strong>.</p>
              <p>Within an inning it deliberately holds still. A list that re-shuffles between the moment you look at it and the moment your thumb lands is how the wrong player gets sent in — so if you bench someone mid-inning they join the <strong>bottom</strong> of the list, and nobody already on it moves. Tap to the next inning and everything settles into longest-sitting-first again.</p>
              <p>Each row keeps its own red <strong>&ldquo;2nd straight inning sitting&rdquo;</strong> chip either way, so a long sit is visible wherever the row happens to be.</p>
            </>
          ),
        },
        {
          id: 'faq-game-day-helper',
          question: 'What does an assistant or helper see on the game-day screen?',
          answerText: 'Exactly what their permissions say, zone by zone. Substitutions need lineups access; the Who is here sheet needs attendance access; the score buttons and End game need schedule manage access. The Note button goes with running the bench — anyone holding any one of those three can log a moment. An attendance-only assistant gets the score view, Who is here and Note, with no lineup board. A schedule-only helper sees the matchup and score, read-only, with the line "Your coach runs the bench" — no board at all, because the lineup itself follows lineup access, and no Note button. Nobody ever sees a disabled button they cannot use; controls they do not have are simply not there.',
          keywords: ['assistant', 'helper', 'permissions', 'read only', 'your coach runs the bench', 'who can substitute', 'who can score', 'attendance only', 'who can log a moment', 'who can write a note'],
          answer: (
            <>
              <p>Exactly what their permissions say, zone by zone: substitutions need <strong>lineups</strong>, the Who&rsquo;s here sheet needs <strong>attendance</strong>, the score and <strong>End game</strong> need <strong>schedule (manage)</strong>. <strong>Note</strong> goes with running the bench — any one of those three is enough.</p>
              <p>An attendance-only assistant gets the score view, Who&rsquo;s here and Note — no lineup board. A schedule-only <strong>helper</strong> sees the matchup and score, read-only, with the line <em>&ldquo;Your coach runs the bench.&rdquo;</em> — no board at all, because the lineup itself follows lineup access, and no Note button.</p>
              <p>Nobody sees a disabled button: controls someone doesn&rsquo;t have simply aren&rsquo;t there.</p>
            </>
          ),
        },
        {
          id: 'faq-game-day-moments-private',
          question: 'Do families see the notes I write at the bench?',
          answerText: 'No. A moment you log with the Note button is yours and your coaching staff\'s, and nothing else. Families are never shown it and are never notified about it — the one notification a game sends is still the final score at End game, and a note does not add a second one. Moments read back in three places, all of them coach-side: the End game wrap, the tagged player\'s profile in your Roster, and one quoted line on your Season Wrapped card at the end of the season. The family season recap, which each connected parent or guardian reads when the season closes, is built from records like games played and innings on the field — no moment is ever added to it. Even the shareable Season Wrapped picture leaves them out on purpose: the quote shows on your screen but is not baked into the image, so sharing the card cannot pass a note along by accident. If you want a family to hear something you wrote, tell them — the product will not do it for you.',
          keywords: ['private', 'do families see', 'parents see notes', 'guardian', 'family recap', 'notify', 'notification', 'moment', 'note', 'share', 'share image', 'season wrapped picture', 'confidential', 'who can read my notes'],
          popular: true,
          answer: (
            <>
              <p>No. A moment is <strong>yours and your coaching staff&rsquo;s</strong>. Families are never shown one and are never notified about one — a game still sends exactly one notification, the final score at <strong>End game</strong>, and a note doesn&rsquo;t add a second.</p>
              <p>Moments read back in three coach-side places: the <strong>End game wrap</strong>, the tagged player&rsquo;s <strong>profile</strong> in your Roster, and one quoted line on your <strong>Season Wrapped</strong> card. The <strong>family season recap</strong> — what a connected parent or guardian reads when the season closes — is built from records like games played and innings on the field; no moment is ever added to it.</p>
              <p>Even the shareable Season Wrapped <strong>picture</strong> leaves them out on purpose: the quote shows on your screen but isn&rsquo;t baked into the image, so sharing the card can&rsquo;t pass a note along by accident. If you want a family to hear something you wrote, tell them — the product won&rsquo;t do it for you.</p>
            </>
          ),
        },
        {
          id: 'faq-game-day-moments-edit',
          question: 'Can I edit a note after I save it?',
          answerText: 'No — and that is deliberate. A moment is stamped with the time you wrote it, so being able to rewrite it later would make that stamp a lie. If you mistype one, remove it with the small × beside it and type it again; the new line carries the new time. Anyone who can log a moment can remove their own, and the head coach can remove any of them. There is a 280-character limit, roughly a couple of sentences, and a counter appears as you type. Once a season is closed you can still read the moments logged during it, on Season Wrapped, but you cannot add or remove one — a finished season is a record, not a draft.',
          keywords: ['edit a note', 'change a moment', 'delete', 'remove', 'mistyped', 'typo', 'undo', 'character limit', '280', 'how long can a note be', 'closed season'],
          answer: (
            <>
              <p>No — deliberately. A moment carries the time you wrote it, so rewriting it later would make that stamp a lie. Mistyped one? Remove it with the small <strong>&times;</strong> beside it and type it again; the new line carries the new time.</p>
              <p>Anyone who can log a moment can remove their own; the head coach can remove any of them. Notes run to <strong>280 characters</strong> — a couple of sentences — with a counter as you type.</p>
              <p>Once a season is <strong>closed</strong> you can still read the moments logged during it on Season Wrapped, but you can&rsquo;t add or remove one. A finished season is a record, not a draft.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-practice-plans',
      group: 'Premium Coaches Portal',
      heading: 'Practice plans: what you’re doing Tuesday, and who’s where (Premium)',
      summary: 'Write the practice on the practice — blocks, stations, groups and a rotation the product works out for you — then print it.',
      // "rotation" / "stations" / "groups" are the terms a coach searches for, and none of them
      // appear in a heading — search never reads the prose, so they have to live here.
      keywords: ['practice plan', 'practice plans', 'plan a practice', 'practice', 'practice plans page', 'practice plans list', 'needs a plan', 'which practices need a plan', 'blocks', 'add a block', 'stations', 'rotation', 'rotations', 'carousel', 'rotate toggle', 'stop rotating', 'stations side by side', 'groups', 'random groups', 'draw groups', 'split into groups', 'pair up', 'coaching points', 'what to watch for', 'print practice', 'practice sheet', 'copy last practice', 'start this plan from', 'rest of practice', 'kit', 'equipment', 'who runs it', 'players moved', 'where did my players go', 'run practice', 'how it went', 'practice notes', 'write up a practice', 'after the practice', 'what this practice is about', 'kind of practice', 'practice tags'],
      searchText: 'practice plan plans plan a practice tuesday night practice plans page list of practices needs a plan no plan plan set which practices still need a plan coming up recent practices blocks add a block timed blocks how long minutes rest of practice remaining time running clock start time stations station name how many equipment kit bring setup who runs it who is at it note for tonight rotation rotations carousel rotate toggle rotates by default turn off rotation stop rotating stations side by side separate stations two stations rotate every 15 minutes one turn each rounds group by round grid where is everyone who is at which station groups draw at random random draw shuffle reshuffle draw again how many groups players per group uneven split people live in one place players moved where did my players go coaching points what to watch for focus areas what everyone is working on focus rail copy from a previous practice copy last practice start this plan from a past season start from last year reuse last october past season practices three ways in what happens to my plans when the season ends are my plans kept do i lose my practice plans finished season practice plans the practices you ran season’s end practices read a past plan called off cancelled practice does not appear notes only no plan written helper cannot read past plans print the sheet one page pdf assistant tee station head coach only schedule access reorder blocks up down arrows planned not done run practice at the field',
      content: (
        <p>A <strong>practice plan</strong> belongs to one practice: the blocks, stations and groups for that night. <strong>Practice plans</strong> in the sidebar lists your practices and shows which ones still need a plan — or open the practice on your <strong>Schedule</strong> and plan it from there.</p>
      ),
      subtopics: [
        {
          id: 'premium-practice-blocks',
          title: 'The shape of the night: blocks',
          content: (
            <>
              <p><strong>Start with the shape of the night.</strong> Give the practice a goal and an <strong>Equipment</strong> line, then add <strong>blocks</strong> in the order you&rsquo;ll run them. A block is a number of minutes, or one <strong>rest of practice</strong> block — you only get one of those, since only one thing can run to the end. The clock times down the side are worked out from the practice&rsquo;s own start time, so you never type them.</p>
              <p>Each block holds a description, a goal, who&rsquo;s running it, who&rsquo;s in it, and <strong>coaching points</strong> — the two or three things you actually want to see. Reorder blocks with the <strong>up and down arrows</strong> rather than dragging, so it works with cold hands on a phone.</p>
            </>
          ),
        },
        {
          id: 'premium-practice-stations',
          title: 'Stations, and who stands where',
          content: (
            <>
              <p><strong>Stations</strong> sit inside a block: what the station is, <strong>what you&rsquo;re doing</strong>, <strong>what you&rsquo;re watching for</strong>, the coaching points, the equipment, how it&rsquo;s set up, who runs it, who&rsquo;s at it, and a note just for tonight.</p>
              <p><strong>You don&rsquo;t have to type a station twice.</strong> When you add a block or a station you can <strong>pick from your drills</strong> instead, and it arrives already written — see <em>Your drills</em> below.</p>
              <HelpNote variant="info" title="People live in one place at a time">
                <p>A block with no stations holds its own list of players. Add a station and that list moves down to the stations — because that&rsquo;s now where people actually stand. Turn on rotating and they move again, into the groups. You&rsquo;ll see the names move when you do it; nothing is lost, and it means a station can never give you two different answers to &ldquo;who&rsquo;s here?&rdquo;</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-practice-rotations',
          title: 'Rotations — the part a shared document can’t do',
          content: (
            <>
              <p>A rotation is a block of your practice plan where groups move between stations. There&rsquo;s no separate kind of block to add — <strong>put two or more stations in a block and it rotates by default</strong>. (A single station isn&rsquo;t a rotation, it&rsquo;s a queue, so the choice only appears once there are two.) If your stations run side by side instead, switch <strong>rotate</strong> off inside the block and each keeps its own players.</p>
              <p>Say how long the block runs and how often groups move, and the plan works out <em>who is at which station in every round</em> and shows you the grid. Leave &ldquo;rotate every&rdquo; blank and it gives everyone exactly one turn at each station.</p>
              <p><strong>It tells you the truth when the numbers don&rsquo;t divide neatly</strong>, rather than tidying the arithmetic up for you:</p>
              <ul>
                <li><em>&ldquo;3 rounds of 15, with 5 min spare&rdquo;</em></li>
                <li><em>&ldquo;Group C won&rsquo;t reach the third station&rdquo;</em></li>
                <li><em>&ldquo;Groups A and D share a station in round 2&rdquo;</em></li>
              </ul>
              <p>It will never quietly invent a round or drop a station to make the numbers work.</p>
            </>
          ),
        },
        {
          id: 'premium-practice-groups',
          title: 'Groups, drawn or chosen',
          content: (
            <>
              <p><strong>Groups</strong> can be picked by hand or <strong>drawn at random</strong> — choose how many groups, or how many players per group, and press <strong>Draw again</strong> as often as you like. Only players who&rsquo;ve replied that they&rsquo;re coming go into the draw, and anyone left out is named rather than quietly dropped. The draw is deliberately simple: it shuffles and deals. <strong>It never sorts anyone by ability.</strong></p>
              <p><strong>Beside the plan sits the roster and what each player is currently working on</strong>, in roster order — so putting three players on a station is a glance, not a memory test. Tap <strong>Choose players</strong> anywhere in the plan and you get the same list, with their focus areas beside them.</p>
            </>
          ),
        },
        {
          id: 'premium-practice-tags',
          title: 'Saying what the practice is about',
          content: (
            <p>The tags at the top are your own words, shared with your drills and your players&rsquo; focus areas — so tagging tonight &ldquo;Hitting&rdquo; is the same &ldquo;Hitting&rdquo; everywhere. They&rsquo;re what softens the focus areas that aren&rsquo;t about tonight, and what lets you pull up every hitting practice you&rsquo;ve run later.</p>
          ),
        },
        {
          id: 'premium-practice-reuse',
          title: 'If last week worked, start from it',
          content: (
            <>
              <p><strong>Start this plan from…</strong> offers a <strong>template</strong>, a <strong>previous practice</strong> or <strong>a past season</strong> — one control, three ways in. Whichever you pick, it copies onto tonight and leaves the original exactly as it was, so you change the one block that needs changing. See <em>Plan templates</em> below.</p>
              <p><strong>A past season</strong> lists the practices you ran in previous years, each named with the season it came from and its date, so you can start tonight from the session that worked last October without adding anything to your template library. The groups arrive empty — last year&rsquo;s players aren&rsquo;t on this year&rsquo;s roster — and the finished season is not changed in any way.</p>
            </>
          ),
        },
        {
          id: 'premium-practice-finished-season',
          title: 'What happens to your plans when the season ends',
          content: (
            <>
              <p><strong>Every plan is kept, in full.</strong> When your season finishes, the <strong>Practice plans</strong> page tells you so and stops offering to plan — there&rsquo;s nothing left to plan for — but nothing you wrote has gone anywhere.</p>
              <p><strong>Where to find them.</strong> That season&rsquo;s <strong>Season&rsquo;s End</strong> page has a section called <strong>The practices you ran</strong>, closed until you open it. Each row opens the plan exactly as you wrote it, read-only, together with what you said afterwards about how it went. The same list also sits under <em>&ldquo;Is everyone getting attention?&rdquo;</em> in Insights, as <strong>Practices you&rsquo;ve run</strong>.</p>
              <p>A practice you <strong>called off</strong> never appears — it didn&rsquo;t happen, so it isn&rsquo;t part of the record. A practice where you wrote no plan but did write a note afterwards <em>does</em> appear, and says so.</p>
              <HelpNote variant="info" title="Who can read a finished season’s plans">
                <p>The same people who can read the rest of the team&rsquo;s record — your assistant coaches. A <strong>helper</strong> brought in to run one station has the schedule and tonight&rsquo;s plan, and nothing from a season that has finished.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-practice-after',
          title: 'Print it, run it, then say how it went',
          content: (
            <>
              <p><strong>Print the sheet</strong> gives you a one-page PDF, rotation grid and all, to hand to whoever&rsquo;s running a station. It&rsquo;s a download you carry, never a link you share.</p>
              <p><strong>Then run it.</strong> When the plan&rsquo;s written, <strong>Run practice</strong> takes it to the field — from the plan itself, or straight off the <strong>Practice plans</strong> list once the practice is close enough to be tonight&rsquo;s. See <em>Running a practice at the field</em> below.</p>
              <p><strong>Afterwards, say how it went.</strong> <strong>How it went</strong> sits under the plan — one note, written at home, about the <em>practice</em>: <em>&ldquo;tees were too crowded, run four next time&rdquo;</em>. It&rsquo;s for you and your staff; families never see it. It&rsquo;s deliberately about the practice and never about a player, and it&rsquo;s the thing that makes looking back at what you ran worth doing.</p>
            </>
          ),
        },
        {
          id: 'premium-practice-access',
          title: 'What a plan is — and who can write one',
          content: (
            <>
              <HelpNote variant="info" title="A plan is what you intend to do">
                <p>Nothing here records what actually happened on the night — that&rsquo;s deliberate, so the plan never quietly turns into a claim about your players.</p>
              </HelpNote>
              <HelpDefs>
                <HelpDef term="Writing the plan">Head coach only.</HelpDef>
                <HelpDef term="Opening &amp; printing">Any coach with <strong>schedule</strong> access — which is what makes it useful to hand an assistant a station.</HelpDef>
                <HelpDef term="Seeing focus areas">Needs <strong>player notes</strong> access.</HelpDef>
                <HelpDef term="Attendance markers">The markers in the player list need <strong>attendance</strong> access.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
      ],
      links: [
        { label: 'Running it at the field', href: '#premium-practice-run' },
        { label: 'Plan templates', href: '#premium-plan-templates' },
        { label: 'Player Development', href: '#premium-development' },
        { label: 'Repeating practices', href: '#premium-repeat-weekly' },
      ],
      faqs: [
        {
          id: 'faq-practice-plan-where',
          question: 'Where do I write a practice plan?',
          answerText: 'Two ways in, and they reach the same plan. Practice plans in the sidebar, under Season, lists your practices with a "Plan set" or "No plan" marker on each, and a "Needs a plan" filter that shows only the ones still waiting. Or open your Schedule, tap the practice, and use "Plan this practice" in the Practice plan section — it becomes "Open the plan" once one exists. Writing the plan is head-coach only; any coach with schedule access can open and print one. Practice plans are a live-season tool, so a completed season does not list them.',
          keywords: ['where do i write a practice plan', 'where are practice plans', 'cannot find practice plans', 'practice plan page', 'practice plans page', 'practice plans list', 'plan this practice', 'no practice plan section', 'needs a plan', 'which practices need a plan', 'practices without a plan'],
          popular: true,
          answer: (
            <>
              <p>Two ways in, and they reach the same plan.</p>
              <p><strong>Practice plans</strong> in the sidebar, under <em>Season</em>, lists your practices with <strong>Plan set</strong> or <strong>No plan</strong> on each, and a <strong>Needs a plan</strong> filter that leaves only the ones still waiting. Start there when you&rsquo;re planning the week.</p>
              <p>Or go at it from the night itself: open your <strong>Schedule</strong>, tap the practice, and use <strong>Plan this practice</strong> in the <em>Practice plan</em> section — it reads <strong>Open the plan</strong> once one exists.</p>
              <p>Writing the plan is <strong>head-coach only</strong>. Any coach with <strong>schedule</strong> access can open and print one. Plans are a live-season tool, so a completed season doesn&rsquo;t list them.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-plan-no-plan-marker',
          question: 'I typed a goal, so why does the list still say “No plan”?',
          answerText: 'Because a goal on its own does not tell anyone what happens at six o clock. The Practice plans list marks a practice "Plan set" once it has at least one block; a goal, an equipment note or a practice type is saved but does not count on its own, so the practice stays in the "Needs a plan" filter. Nothing you typed is lost — open the practice and it is all still there, waiting for its first block.',
          keywords: ['no plan', 'says no plan', 'plan set', 'still needs a plan', 'typed a goal', 'goal but no plan', 'why does it say no plan', 'needs a plan filter'],
          answer: (
            <>
              <p>Because a goal on its own doesn&rsquo;t tell anyone what happens at six o&rsquo;clock.</p>
              <p>The list marks a practice <strong>Plan set</strong> once it has at least one <strong>block</strong>. A goal, an equipment note or a practice type is saved the moment you type it, but none of them count on their own — so the practice stays in the <strong>Needs a plan</strong> filter, which is where you want it.</p>
              <p>Nothing you wrote is lost. Open the practice and it&rsquo;s all still there, waiting for its first block.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-plan-rotation',
          question: 'How do I set up three groups rotating between three stations?',
          answerText: 'Add a block and switch it to a rotation. Name your stations, then type how long the whole rotation runs and how often groups move — for example 45 minutes moving every 15. The plan works out the rest: 3 rounds of 15, and a grid showing which group is at which station in each round. Groups move forward one station each round and coaches stay put. You can pick the groups yourself or draw them at random. If the numbers do not divide evenly the plan says so plainly rather than fudging it — it will tell you about spare minutes, name any group that will not reach a station, and say when two groups share one. It never invents an extra round or drops a station.',
          keywords: ['rotation', 'rotate', 'carousel', 'three groups three stations', 'rotate every 15 minutes', 'group rotation', 'stations rotation', 'who is at which station', 'rotation grid'],
          popular: true,
          answer: (
            <>
              <p>Add a block and switch it to a <strong>rotation</strong>. Name your stations, then type <strong>how long the whole rotation runs</strong> and <strong>how often groups move</strong> — say 45 minutes, moving every 15.</p>
              <p>The plan works out the rest: <em>3 rounds of 15</em>, plus a grid showing which group is at which station in each round. Groups move forward one station each round; coaches stay put.</p>
              <p>If the numbers don&rsquo;t divide evenly it <strong>says so plainly</strong> rather than fudging it — spare minutes, any group that won&rsquo;t reach a station, and when two groups share one. It won&rsquo;t invent an extra round or drop a station to make it tidy.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-plan-random-groups',
          question: 'Does the random draw balance the groups by ability?',
          answerText: 'No, and that is deliberate. The draw shuffles the players and deals them out — nothing more. It does not balance by ability, by focus area, or by anything else, and "Draw again" simply re-draws rather than trying to improve on the last one. Sorting children against each other is not something this product does. Only players who have replied that they are coming go into the draw, and anyone left out is named underneath so you can add them by hand. If a split is uneven the plan tells you up front, for example "3 groups from 10 — one of 4, two of 3".',
          keywords: ['random groups', 'draw at random', 'balance groups', 'even groups', 'by ability', 'fair groups', 'draw again', 'reshuffle', 'uneven groups'],
          answer: (
            <>
              <p>No — and that&rsquo;s deliberate. The draw <strong>shuffles and deals</strong>, and nothing more. It doesn&rsquo;t balance by ability, by focus area, or by anything else, and <strong>Draw again</strong> simply re-draws rather than trying to improve on the last one. Sorting children against each other isn&rsquo;t something this product does.</p>
              <p>Only players who&rsquo;ve replied that they&rsquo;re coming go into the draw, and anyone left out is <strong>named</strong> underneath so you can add them by hand.</p>
              <p>If a split is uneven you&rsquo;re told up front — <em>&ldquo;3 groups from 10 — one of 4, two of 3&rdquo;</em>.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-plan-assistant',
          question: 'Can my assistant coach see the practice plan?',
          answerText: 'Yes. Reading and printing a practice plan rides schedule access, so an assistant who can already open Tuesday\'s practice can open its plan and print the sheet — which is the point, since they are often the one running a station. Writing the plan is head-coach only. What players are working on is separate: those focus areas need player-notes access, so an assistant without it sees the blocks, the stations and the names, but never the notes about a child. The printed sheet follows the same rule — if you cannot see focus areas in the app, they are simply absent from the sheet you print.',
          keywords: ['assistant coach practice plan', 'can assistants see the plan', 'share plan with assistant', 'assistant print practice', 'who can edit the practice plan'],
          answer: (
            <>
              <p>Yes. Reading and printing a plan rides <strong>schedule</strong> access, so an assistant who can already open Tuesday&rsquo;s practice can open its plan and print the sheet — which is the point, since they&rsquo;re often the one running a station.</p>
              <p><strong>Writing</strong> the plan is head-coach only.</p>
              <p><em>What players are working on</em> is separate: those focus areas need <strong>player notes</strong> access. An assistant without it sees the blocks, the stations and the names, but never the notes about a child — and the <strong>printed sheet follows the same rule</strong>, so if you can&rsquo;t see focus areas in the app they simply aren&rsquo;t on the sheet you print.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-stations-side-by-side',
          question: 'My two stations run side by side — how do I stop them rotating?',
          answerText: 'Switch "rotate" off inside the block. As soon as a block has two or more stations it rotates by default, because a carousel is the common case — the toggle only appears at two stations, since one station with groups queued behind it is a queue, not a rotation. Turn rotate off and each station keeps its own list of players instead of sharing groups that move around. Note that turning it on or off moves where the players live: with rotating on, people sit in the groups; with it off, they sit on each station. You will see the names move when you switch it, and nothing is lost.',
          keywords: ['stop rotating', 'turn off rotation', 'stations side by side', 'no rotation', 'rotate toggle', 'two stations', 'stations at the same time', 'separate stations', 'dont rotate'],
          answer: (
            <>
              <p>Switch <strong>rotate</strong> off inside the block. As soon as a block has <strong>two or more stations it rotates by default</strong>, because a carousel is the common case — and the choice only appears at two, since one station with groups queued behind it is a queue, not a rotation.</p>
              <p>With rotate off, each station keeps <strong>its own list of players</strong> instead of sharing groups that move around.</p>
              <p>Switching it moves where the players live — with rotating on they sit in the <strong>groups</strong>, with it off they sit on <strong>each station</strong>. You&rsquo;ll see the names move when you do it, and nothing is lost.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-players-moved',
          question: 'I added a station and my players jumped out of the block — where did they go?',
          answerText: 'Onto the stations. Players live in exactly one place at a time: a block with no stations holds its own list, adding a station moves that list down to the stations, and turning on rotating moves it again into the groups. This is deliberate — it is what stops a station ever showing two different answers to "who is here?", and it means the printed sheet and the field screen can never disagree. Nothing is deleted; the names move to the level that now makes sense, and you can move them again by hand.',
          keywords: ['players disappeared', 'players moved', 'where did my players go', 'lost players', 'block players gone', 'who is at this station', 'players jumped'],
          answer: (
            <>
              <p>Onto the stations. Players live in <strong>exactly one place at a time</strong>: a block with no stations holds its own list, adding a station moves that list <strong>down to the stations</strong>, and turning on rotating moves it again into the <strong>groups</strong>.</p>
              <p>That&rsquo;s deliberate — it&rsquo;s what stops a station ever showing two different answers to &ldquo;who&rsquo;s here?&rdquo;, and it means the printed sheet and the field screen can never disagree.</p>
              <p>Nothing is deleted. The names move to the level that now makes sense, and you can move them again by hand.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-drill-library',
      group: 'Premium Coaches Portal',
      heading: 'Your drills: write it once, then it’s four taps (Premium)',
      summary: 'Save a drill once — the setup, what you’re watching for, the coaching points — and adding it to a practice stops being retyping.',
      // "drill library" / "save a drill" / "read only" / "shared drills" are what a coach searches
      // for, and none appear in a heading — search never reads the prose, so they live here.
      keywords: ['drills', 'drill', 'drill library', 'my drills', 'your drills', 'save a drill', 'save to my drills', 'reuse a drill', 'pick a drill', 'drill picker', 'from your drills', 'write one', 'preview a drill', 'retire a drill', 'restore a drill', 'delete a drill', 'edit a drill', 'why can’t i edit', 'read only drill', 'greyed out', 'locked', 'edit just for this practice', 'swap drill', 'club drills', 'shared drills', 'org drills', 'category', 'categories', 'tags', 'tag a drill', 'rename a tag', 'merge tags', 'your tags', 'duplicate tags', 'add from a past season', 'import drills', 'last season', 'in 8 plans', 'used'],
      searchText: 'drills drill library my drills your drills in development save a drill once write it once four taps reuse stop retyping the same warm up every tuesday pick from your drills write one preview before adding category categories coach typed not a fixed list hitting fielding your own words usual minutes how long it usually runs what you are doing what you are watching for coaching points setup equipment no people no players no coaches empty of people read only cannot edit why is it greyed out locked edit just for this practice detach make it a one off swap drill change the drill save to my drills promote a station retire a drill restore hide from the picker keeps old plans delete club shared drills organisation wide every team can use admin manages them add from a past season import last season bring forward old practices in 8 plans not in a plan yet head coach only schedule access rotation two stations',
      content: (
        <>
          <p>You run the same warm-up most Tuesdays. <strong>Your drills</strong> is where you write it down once — and after that, putting it in a practice is a few taps instead of retyping it. You&rsquo;ll find it in <strong>Development → Your drills</strong>.</p>
        </>
      ),
      subtopics: [
        {
          id: 'premium-drills-what',
          title: 'What a drill holds — and what it never holds',
          content: (
            <>
              <p><strong>What a drill holds:</strong> its name, what kind of drill it is, roughly how long it runs, <strong>what you&rsquo;re doing</strong>, <strong>what you&rsquo;re watching for</strong>, the <strong>coaching points</strong>, the setup, and the equipment. That&rsquo;s the shape of the drill and the teaching that goes with it.</p>
              <HelpNote variant="info" title="What a drill never holds is people">
                <p>No coaches, no players, no groups — those belong to a particular practice. That&rsquo;s what lets the same drill work in April with twelve players and July with nine, and it&rsquo;s why your library doesn&rsquo;t go stale when the roster changes.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-drills-using',
          title: 'Using one in a practice',
          content: (
            <>
              <p>When you add a block or a station, choose <strong>From your drills</strong>, search or filter, and <strong>Preview</strong> it before you commit. The station arrives already named, kitted, set up and taught — asking only to be staffed.</p>
              <p><strong>Two drills in one block is how you build a rotation.</strong> Pick one and you&rsquo;ve got a block with that activity in it. Pick a second into the same block and you now have two stations — which is exactly when the rotation switch appears.</p>
            </>
          ),
        },
        {
          id: 'premium-drills-editing',
          title: 'Why an added drill reads as text, not boxes',
          content: (
            <>
              <p><strong>That&rsquo;s on purpose.</strong> A drill is a claim that you ran <em>that</em> drill, so if the words could be rewritten every time, &ldquo;in 8 plans&rdquo; would stop meaning anything. What stays editable is everything the <em>practice</em> owns: who runs it, who&rsquo;s at it, how long the block is, and <strong>Just for tonight</strong> — which covers most one-off changes on its own.</p>
              <p><strong>Need it different tonight anyway?</strong> Two doors, and neither touches your library:</p>
              <HelpDefs>
                <HelpDef term="Edit just for this practice">Every word is kept and everything unlocks — it simply stops being that drill from your library, and stops counting towards it.</HelpDef>
                <HelpDef term="Swap drill">Replaces it with a different one.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'premium-drills-saving',
          title: 'Wrote something good in the plan instead?',
          content: (
            <p>Use <strong>Save to my drills…</strong> on that station. It asks one question — the tags — and even that&rsquo;s optional. It copies: tonight&rsquo;s practice is left exactly as it is, and the drill is there for next time. Nothing is ever saved to your library automatically, so it doesn&rsquo;t fill up with five near-identical warm-ups.</p>
          ),
        },
        {
          id: 'premium-drills-tags',
          title: 'Tags are your words, not ours',
          content: (
            <p>Nothing is supplied and nothing is pre-loaded — you type what makes sense for your sport, and a new one is only created when you say so, so the list grows by decision rather than by typo. One list runs across your drills, your plan templates, your practices and your players&rsquo; focus areas, which is what lets the plan show whose focus areas match tonight. Two spellings of the same word can&rsquo;t both exist, and if you end up with two near-duplicates you can <strong>merge</strong> them — every drill, template, practice and focus area that used one comes along.</p>
          ),
        },
        {
          id: 'premium-drills-retire',
          title: 'Retiring, club drills, and past seasons',
          content: (
            <>
              <p><strong>Retiring, not deleting.</strong> A retired drill disappears from the picker and every practice that already used it is untouched — those plans keep reading exactly as they did. You can restore it any time, and you can reuse the name.</p>
              <p><strong>Club drills.</strong> If your organisation shares a set of drills, they appear in your picker beside your own, marked <em>Club</em>. You can use them; renaming and retiring them stays with your club&rsquo;s administrator.</p>
              <p><strong>Starting from what you&rsquo;ve already done.</strong> <strong>Add from a past season</strong> reads the practices you ran in previous years and offers what you wrote in them as drills. Adding one copies it into your library — the old practice is not changed. Anything already in your library is shown greyed out, so you can see why it isn&rsquo;t offered.</p>
              <p><strong>Your drills stay with your team from season to season.</strong> There&rsquo;s nothing to move across when a new season starts. The library itself isn&rsquo;t browsable while you&rsquo;re looking at a finished season — it&rsquo;s a tool you use now, not a record of a year — but nothing in it is lost.</p>
            </>
          ),
        },
        {
          id: 'premium-drills-access',
          title: 'What the counts mean, and who can do what',
          content: (
            <>
              <p><strong>&ldquo;In 8 plans&rdquo; counts plans, not practices.</strong> Nothing in the product records what actually got run on the night, so it tells you how many plans a drill appears in and nothing more.</p>
              <HelpDefs>
                <HelpDef term="Managing drills">Writing, editing, retiring, importing — head coach only.</HelpDef>
                <HelpDef term="Seeing &amp; picking">Any coach with <strong>schedule</strong> access, which is what lets an assistant build a practice from the drills you&rsquo;ve written.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
      ],
      links: [
        { label: 'Writing the plan', href: '#premium-practice-plans' },
        { label: 'Plan templates', href: '#premium-plan-templates' },
        { label: 'Running it at the field', href: '#premium-practice-run' },
        { label: 'Player Development', href: '#premium-development' },
      ],
      faqs: [
        {
          id: 'faq-drill-tags-merge',
          question: 'I’ve ended up with “Hitting” and “Hitting mechanics”. Can I tidy that up?',
          answerText: 'Yes. Open Your tags from the drills or plan-templates room and use Merge into… — everything tagged with the one you are folding away becomes tagged with the one you keep, and the old tag disappears from the list. Every drill, plan template, tagged practice and player focus area comes along, so no history is lost and nothing is deleted. You can also just rename a tag, which relabels it everywhere at once because things are linked to the tag itself rather than to the word. Two spellings of the same word cannot both exist in the first place — capitalisation is ignored — so "Hitting" and "hitting" can never split your library.',
          keywords: ['merge tags', 'duplicate tags', 'two tags the same', 'rename a tag', 'tidy up tags', 'your tags', 'manage tags', 'delete a tag'],
          popular: true,
          answer: (
            <>
              <p>Yes. Open <strong>Your tags</strong> from the drills or plan-templates room and use <strong>Merge into…</strong>. Everything tagged with the one you&rsquo;re folding away becomes tagged with the one you keep, and the old tag leaves the list.</p>
              <p><strong>Every drill, plan template, tagged practice and player focus area comes along</strong> — nothing is deleted and no history is lost. You can also simply <strong>rename</strong> a tag, which relabels it everywhere at once, because things are linked to the tag itself rather than to the word.</p>
              <p>Two spellings of the same word can&rsquo;t both exist in the first place — capitalisation is ignored — so &ldquo;Hitting&rdquo; and &ldquo;hitting&rdquo; can never split your library.</p>
            </>
          ),
        },
        {
          id: 'faq-drill-read-only',
          question: 'Why can’t I edit a drill after adding it to a practice?',
          answerText: 'Because a drill is a claim that you ran that particular drill. If its words could be rewritten every time you used it, "in 8 plans" would be counting eight different things and would stop meaning anything. Everything the practice owns is still editable — who runs the station, who is at it, how long the block runs, and the "Just for tonight" note, which covers most one-off changes. If you genuinely need the drill itself to read differently tonight, tap "Edit just for this practice": every word is kept and everything unlocks, and the station simply stops being that library drill from then on. You can then use "Save to my drills…" to keep the new version as a separate drill.',
          keywords: ['cannot edit', 'can’t edit', 'read only', 'greyed out', 'locked', 'not editable', 'why is it locked', 'edit a drill in a practice', 'edit just for this practice', 'detach'],
          popular: true,
          answer: (
            <>
              <p>Because a drill is a claim that you ran <em>that</em> drill. If its words could be rewritten every time you used it, <strong>&ldquo;in 8 plans&rdquo;</strong> would be counting eight different things — and would stop meaning anything.</p>
              <p>Everything the <em>practice</em> owns is still editable: who runs the station, who&rsquo;s at it, how long the block runs, and <strong>Just for tonight</strong>, which covers most one-off changes on its own.</p>
              <p>If you genuinely need the drill itself to read differently tonight, tap <strong>Edit just for this practice</strong>. Every word is kept and everything unlocks — the station just stops being that library drill from then on. You can then <strong>Save to my drills…</strong> to keep the new version as its own drill.</p>
            </>
          ),
        },
        {
          id: 'faq-drill-retire',
          question: 'If I retire a drill, do my old practice plans lose it?',
          answerText: 'No. Retiring only removes a drill from the picker when you are building a practice. Every plan that already uses it is completely untouched and keeps reading exactly as it did — a practice plan stores its own copy of the words, so it never depends on the library. You can restore a retired drill at any time, and you can reuse its name for a new one. There is no way to delete a drill outright, precisely so this can never go wrong.',
          keywords: ['retire', 'retired', 'delete a drill', 'remove a drill', 'old plans', 'past practices', 'restore', 'bring back'],
          answer: (
            <>
              <p>No. Retiring only takes a drill out of the picker when you&rsquo;re building a practice. <strong>Every plan that already uses it is untouched</strong> and keeps reading exactly as it did — a plan stores its own copy of the words, so it never depends on your library.</p>
              <p>You can restore it any time, and you can reuse the name for something new. There&rsquo;s no way to delete a drill outright, precisely so this can&rsquo;t go wrong.</p>
            </>
          ),
        },
        {
          id: 'faq-drill-past-season',
          question: 'Can I get drills from last season?',
          answerText: 'Yes, two things are true here. First, your drill library belongs to your team and is not tied to a season at all, so anything you saved last year is still there this year with nothing to move. Second, for practices you wrote before you had a library, use "Add from a past season" in Your drills: it reads the practices you ran in previous years and offers what you wrote in them as drills you can save. Adding one copies it forward and changes nothing in the old practice. Drills you already have are shown greyed out so you can see why they are not offered.',
          keywords: ['last season', 'past season', 'previous season', 'old drills', 'import drills', 'bring forward', 'new season', 'season rollover'],
          answer: (
            <>
              <p>Two things are true here, and together they cover it.</p>
              <p><strong>Your library belongs to your team, not to a season.</strong> Anything you saved last year is still there this year — there&rsquo;s nothing to move across.</p>
              <p><strong>For practices you wrote before you had a library</strong>, use <strong>Add from a past season</strong> in Your drills. It reads the practices you ran in previous years and offers what you wrote in them. Adding one copies it forward and changes nothing in the old practice; drills you already have are shown greyed out so you can see why they&rsquo;re not offered.</p>
            </>
          ),
        },
        {
          id: 'faq-drill-club-shared',
          question: 'What are the drills marked “Club”?',
          answerText: 'They are drills your organisation shares with every team, curated by your club administrator on the shared library screen. They appear in your picker alongside your own drills and you can use them in any practice exactly like your own. You cannot rename or retire them — that stays with the administrator, which is what keeps a club standard actually standard. If your club has not set any up, you simply will not see any, and your own drills work exactly the same.',
          keywords: ['club drills', 'shared drills', 'organisation drills', 'org drills', 'blue drills', 'who manages', 'club standard'],
          answer: (
            <>
              <p>They&rsquo;re drills your organisation shares with every team, curated by your club administrator. They appear in your picker beside your own and you can use them in any practice exactly like your own.</p>
              <p>You can&rsquo;t rename or retire them — that stays with the administrator, which is what keeps a club standard actually standard. If your club hasn&rsquo;t set any up, you simply won&rsquo;t see any.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-plan-templates',
      group: 'Premium Coaches Portal',
      heading: 'Plan templates: your standard Tuesday, ready to go (Premium)',
      summary: 'Save a practice you’d run again, then start from it next week instead of rebuilding it.',
      // "template" / "save as template" / "start from" / "reuse a practice" are what a coach
      // searches for, and search never reads the prose — so they all have to live here.
      keywords: ['template', 'templates', 'plan template', 'plan templates', 'practice template', 'save as template', 'save a practice', 'reuse a practice', 'standard practice', 'standard tuesday', 'start this plan from', 'start from a template', 'use a template', 'copy a practice', 'rename a template', 'retire a template', 'restore a template', 'started 8 plans', 'add from a past season', 'import a practice', 'template tags', 'edit a template'],
      searchText: 'plan templates template practice template save as template save a practice you would run again standard tuesday standard practice reuse start this plan from a template or a previous practice one picker two sources use it started 8 plans not started a plan yet never used how many times rename retire restore retired dims plans keep reading new template build one from scratch empty room blocks stations full editor no players no staff no just for tonight the practice supplies the people april twelve july nine tags several tags per template filter chips no tags flat list not groups add from a past season import old practices bring forward team not season rollover nothing to move head coach only schedule access assistant read only started from provenance edit anything changes will not change the template drill inside stays read only',
      content: (
        <p>You have a Tuesday you&rsquo;d run again. <strong>Plan templates</strong> is where you keep it — and after that, next Tuesday starts from it instead of an empty page. You&rsquo;ll find it in <strong>Development → Plan templates</strong>.</p>
      ),
      subtopics: [
        {
          id: 'premium-templates-making',
          title: 'Two ways to make one',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="Save as template…">On any practice plan — keeps the practice as it is now. It asks for a name and, optionally, tags, and nothing else.</HelpDef>
                <HelpDef term="New template">Builds one from scratch in the room, with the same blocks-and-stations editor the practice uses.</HelpDef>
              </HelpDefs>
              <p><strong>What a template holds is the shape and the teaching.</strong> Blocks, timings, stations, coaching points, setup, equipment — and, if a station came from your drills, it stays a drill. <strong>What it never holds is people</strong>: no players, no staff, no &ldquo;just for tonight&rdquo; notes. Those belong to a particular practice, which is what lets one template work in April with twelve players and July with nine.</p>
            </>
          ),
        },
        {
          id: 'premium-templates-using',
          title: 'Using one',
          content: (
            <>
              <p>On the practice, <strong>Start this plan from…</strong> offers a template, a previous practice <em>or</em> a past season — one control, three ways in. Pick a template and the plan appears with a line at the top saying where it came from.</p>
              <p><strong>Once it&rsquo;s loaded, it&rsquo;s yours — edit anything.</strong> Changing tonight&rsquo;s practice never changes the template, and editing the template later never changes a practice already written from it. (The one thing that stays read-only inside it is a station that came from <em>your drills</em>, for the same reason it always does.)</p>
            </>
          ),
        },
        {
          id: 'premium-templates-tags',
          title: 'Tags, and what the counts mean',
          content: (
            <>
              <p><strong>Tags are your own words</strong>, shared with your drills and your players&rsquo; focus areas — so tagging a template &ldquo;Hitting&rdquo; is the same &ldquo;Hitting&rdquo; everywhere. A template can carry several, and the chips at the top of the room narrow the list by them. <strong>No tags</strong> is always offered, so a template can never get lost by not having any.</p>
              <p><strong>&ldquo;Started 8 plans&rdquo; counts plans, not practices.</strong> Nothing in the product records what actually got run on the night, so it tells you how many plans a template produced and nothing more. One that hasn&rsquo;t been used yet simply says so, in words.</p>
            </>
          ),
        },
        {
          id: 'premium-templates-seasons',
          title: 'Retiring, and carrying templates across seasons',
          content: (
            <>
              <p><strong>Retiring, not deleting.</strong> A retired template leaves the list you pick from and dims in place; every plan already started from it is untouched. You can restore it any time and reuse the name.</p>
              <p><strong>Your templates stay with your team from season to season</strong> — there&rsquo;s nothing to move across when a new season starts. The room itself isn&rsquo;t browsable while you&rsquo;re looking at a finished season, because it&rsquo;s a tool you use now rather than a record of a year. <strong>Add from a past season</strong> reads the practices you ran in previous years and offers them as templates; adding one copies it forward and changes nothing in the old practice.</p>
            </>
          ),
        },
        {
          id: 'premium-templates-access',
          title: 'Who can do what',
          content: (
            <p><strong>Managing</strong> templates — creating, editing, renaming, retiring, importing — is head-coach only. Any coach with <strong>schedule</strong> access can see the room and start a plan from a template. An assistant sees no Rename, Retire or New buttons at all, rather than buttons that refuse.</p>
          ),
        },
      ],
      links: [
        { label: 'Writing the plan', href: '#premium-practice-plans' },
        { label: 'Your drills', href: '#premium-drill-library' },
        { label: 'Player Development', href: '#premium-development' },
      ],
      faqs: [
        {
          id: 'faq-template-vs-drill',
          question: 'Why can I edit a template freely but not a drill?',
          answerText: 'Because they are different kinds of thing. A template is scaffolding for a practice — of course you adapt it, and adapting it is the point, so a loaded template is fully editable from the first keystroke. A drill is a claim that you ran that particular drill, so if its words could be rewritten every time, "in 8 plans" would be counting eight different things. Both rules are deliberate, and you will see them side by side: a fully editable plan that came from a template, with one read-only station inside it that came from a drill. If you need that drill different tonight, "Edit just for this practice" keeps every word and unlocks it.',
          keywords: ['edit a template', 'why can i edit', 'template read only', 'drill read only', 'difference between a template and a drill', 'locked station', 'greyed out'],
          popular: true,
          answer: (
            <>
              <p>Because they&rsquo;re different kinds of thing.</p>
              <p><strong>A template is scaffolding.</strong> Of course you adapt a practice — adapting it is the point — so a loaded template is fully editable from the first keystroke, and nothing you do to it touches the template.</p>
              <p><strong>A drill is a claim that you ran <em>that</em> drill.</strong> If its words could be rewritten every time you used it, &ldquo;in 8 plans&rdquo; would be counting eight different things.</p>
              <p>You&rsquo;ll see both at once: a fully editable plan that came from a template, with one read-only station inside it that came from a drill. If you need that drill different tonight, <strong>Edit just for this practice</strong> keeps every word and unlocks it.</p>
            </>
          ),
        },
        {
          id: 'faq-template-people',
          question: 'Does a template remember who was in each group?',
          answerText: 'No, and that is deliberate. A template keeps the shape and the teaching — the blocks, the timings, the stations, the coaching points, and how often groups move — but never the players, the staff or the "just for tonight" notes. Those belong to a particular practice. It is exactly what lets the same template work in April with twelve players and in July with nine, and it means your templates never go stale when your roster changes. When you start a plan from one, you draw or pick that night’s groups on the practice itself.',
          keywords: ['groups', 'players', 'does a template save players', 'staff', 'who runs it', 'roster changes', 'stale template'],
          answer: (
            <>
              <p>No, deliberately. A template keeps <strong>the shape and the teaching</strong> — blocks, timings, stations, coaching points, and how often groups move — but never the players, the staff, or the &ldquo;just for tonight&rdquo; notes.</p>
              <p>That&rsquo;s what lets the same template work in April with twelve players and July with nine, and it means your templates never go stale when your roster changes. You draw or pick that night&rsquo;s groups on the practice itself.</p>
            </>
          ),
        },
        {
          id: 'faq-template-edit-later',
          question: 'If I change a template, does it change practices I already planned?',
          answerText: 'No. Starting a plan from a template copies it, so the two are independent from that moment on. Editing the template later never touches a practice already written from it, and editing that practice never changes the template. The line at the top of the plan says which template it came from, and that stays true no matter how much you change — it is a record of where the plan started, not a live link.',
          keywords: ['edit a template', 'change a template', 'does it update', 'linked', 'affects old plans', 'started from'],
          answer: (
            <>
              <p>No. Starting a plan from a template <strong>copies</strong> it, so the two are independent from that moment on. Editing the template later never touches a practice already written from it, and editing that practice never changes the template.</p>
              <p>The line at the top of the plan says which template it came from, and that stays true however much you change — it&rsquo;s a record of where the plan started, not a live link.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-practice-run',
      group: 'Premium Coaches Portal',
      heading: 'Running a practice at the field (Premium)',
      summary: 'One block at a time on your phone, big enough to read in the sun — the rotation, your own station, and a clock that never beeps.',
      // "run practice" / "my station" / "rotate now" / "timer" are what a coach searches for, and
      // search never reads the prose — so every one of them has to live here.
      keywords: ['run practice', 'run it', 'field screen', 'at the field', 'practice timer', 'timer', 'countdown', 'clock', 'rotate now', 'next block', 'my station', 'station view', 'running a station', 'who is here tonight', 'started late', 'running late', 'overrun', 'amber', 'read in the sun', 'one block at a time',
        // Phase 4 — a helper's version of this screen, searched for by the coach who invited them.
        'helper', 'parent volunteer', 'helper station', 'no rotate button', 'who moves everyone on'],
      searchText: 'run practice run it at the field field screen one block at a time phone in the sun gloves one hand arm length big timer countdown clock counts down remaining time left of overrun amber over by next block back button rotate now rotation due round 2 of 3 which group is at which station carousel no alarm no sound no beep no vibration no buzz no notification does not advance by itself never moves on its own manual tap my station station picker what am i doing what am i watching for coaching points setup note for tonight coming to you who is here tonight attendance folded collapsed running late started late behind schedule nothing is recorded no ticks read only planned not done assistant tee station schedule access',
      content: (
        <>
          <p><strong>Run practice</strong> opens the field screen — one block filling the phone, big enough to read at arm&rsquo;s length in the sun. The block, a countdown, the note, and one quiet line at the foot telling you what&rsquo;s next. Two buttons: a big <strong>Next block</strong> and a smaller <strong>Back</strong>. There&rsquo;s nothing to swipe or drag, because gloves defeat all of that.</p>
          <p>You&rsquo;ll find it on the plan itself, and on the practice in your <strong>Schedule</strong>. Opening it mid-practice lands you on whichever block should be running right now, so you don&rsquo;t tap through from the start.</p>
        </>
      ),
      subtopics: [
        {
          id: 'practice-run-rotation',
          title: 'Rotations, and the clock',
          content: (
            <>
              <p><strong>In a rotation the same screen shows the carousel</strong> — which group is at which station right now, who&rsquo;s running each one, and how long until they move. The button reads <strong>Rotate now</strong>, and once there&rsquo;s no round left it goes back to <strong>Next block</strong>. A rotation isn&rsquo;t a mode you have to get out of; it&rsquo;s just part of the same run.</p>
              <HelpNote variant="tip" title="It’s a clock, not an alarm">
                <p>It never beeps, never buzzes, and never moves itself on. If a drill runs long the clock simply turns amber and says so — a practice that overruns is normal, and a phone going off in front of twelve kids is not. <strong>Starting late is fine too:</strong> whenever you tap, that block gets its full length from that moment, so one late start doesn&rsquo;t leave everything reading as overdue for the rest of the night.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'practice-run-my-station',
          title: '“My station” is for whoever’s running one',
          content: (
            <>
              <p>Tap a station and you get just that patch of grass — the group with you now and how long you&rsquo;ve got, what you&rsquo;re doing, <strong>what you&rsquo;re watching for</strong>, the coaching points, the setup, tonight&rsquo;s note, and who&rsquo;s coming to you next. If you&rsquo;re tagged on a station it&rsquo;s marked as yours, and it stays chosen for the rest of the practice. You can still look at what everyone else is doing.</p>
              <p><strong>Who&rsquo;s here tonight</strong> sits folded shut at the bottom — the attendance replies you already have, nothing to fill in. It needs <strong>attendance</strong> access.</p>
            </>
          ),
        },
        {
          id: 'practice-run-nothing-recorded',
          title: 'Nothing is recorded at the field',
          content: (
            <>
              <p>No ticks, no &ldquo;we did this&rdquo;, and <strong>Rotate now</strong> writes nothing either. That&rsquo;s deliberate: attendance is the one thing coaches reliably finish during a practice and it already exists, and a half-finished second one would quietly turn your plan into a claim about your players.</p>
              <p><strong>Who can use it:</strong> any coach with <strong>schedule</strong> access can run a practice — that&rsquo;s what makes it useful to hand an assistant a station. There&rsquo;s nothing to save here, so there&rsquo;s nothing that needs head-coach access.</p>
            </>
          ),
        },
      ],
      links: [
        { label: 'Writing the plan', href: '#premium-practice-plans' },
        { label: 'Attendance', href: '#recipe-attendance' },
      ],
      faqs: [
        {
          id: 'faq-practice-run-timer',
          question: 'Does the practice timer beep or move on by itself?',
          answerText: 'No. It is a clock, not an alarm. There is no sound, no vibration, no notification, and it never advances by itself. If a block or a rotation runs past its planned length the clock simply turns amber and shows how far over you are, and it waits for you. A drill that is going well should be allowed to run long, and a phone going off in front of twelve kids helps nobody. The screen only ever moves when you tap Next block or Rotate now.',
          keywords: ['timer', 'practice timer', 'does it beep', 'alarm', 'sound', 'vibrate', 'buzz', 'notification', 'auto advance', 'moves on by itself', 'countdown', 'overrun', 'running over'],
          popular: true,
          answer: (
            <>
              <p>No — it&rsquo;s a <strong>clock, not an alarm</strong>. No sound, no vibration, no notification, and it never advances by itself.</p>
              <p>If a block or a rotation runs past its planned length the clock turns <strong>amber</strong> and shows how far over you are, then waits. A drill that&rsquo;s going well should be allowed to run long; a phone going off in front of twelve kids helps nobody.</p>
              <p>The screen moves only when you tap <strong>Next block</strong> or <strong>Rotate now</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-run-late',
          question: 'We started ten minutes late — is the whole field screen wrong now?',
          answerText: 'No. When you open the field screen it lands on whichever block the plan says should be running, with the real time left, which is what you want if you have just pulled your phone out mid-practice. But the moment you tap Next block or Rotate now, that block gets its full planned length starting from that moment. So a late start does not leave every remaining block showing as overdue for the rest of the night. Nothing about the plan itself changes, and nothing is saved.',
          keywords: ['started late', 'running late', 'behind schedule', 'clock is wrong', 'times are off', 'late start', 'practice started late'],
          answer: (
            <>
              <p>No. Opening the field screen lands you on whichever block the plan says should be running, with the real time left — handy when you&rsquo;ve just pulled your phone out mid-practice.</p>
              <p>But the moment you tap <strong>Next block</strong> or <strong>Rotate now</strong>, that block gets its <strong>full planned length from that moment</strong>. A late start doesn&rsquo;t leave everything showing as overdue for the rest of the night.</p>
              <p>Nothing about the plan itself changes, and nothing is saved.</p>
            </>
          ),
        },
        {
          id: 'faq-practice-run-my-station',
          question: 'I am running one station — can I see just mine?',
          answerText: 'Yes. On the field screen, tap your station under Stations and you get "My station": the group with you right now and how long until they move, what you are doing, what you are watching for, the coaching points, the setup, any note the head coach left for tonight, and who is coming to you next. If your name is tagged on a station it is marked as yours, and once you open it, it stays chosen for the rest of the practice. You can still look at what the other stations are doing. It is read-only — there is nothing to fill in. Helpers see the same screen with one difference: no Next block or Rotate now button, and a line naming the coach who moves everyone on instead.',
          keywords: ['my station', 'just my station', 'station view', 'i am on tees', 'what am i doing', 'what am i watching for', 'running a station', 'assistant station', 'station screen', 'helper station', 'parent running a station', 'no rotate button', 'cannot rotate', 'who moves everyone on'],
          popular: true,
          answer: (
            <>
              <p>Yes. On the field screen, tap your station under <strong>Stations</strong> and you get <strong>My station</strong>: the group with you right now and how long until they move, what you&rsquo;re doing, <strong>what you&rsquo;re watching for</strong>, the coaching points, the setup, any note left for tonight, and <strong>who&rsquo;s coming to you next</strong>.</p>
              <p>If your name is tagged on a station it&rsquo;s marked as yours, and once you open it, it stays chosen for the rest of the practice. You can still look at what the other stations are doing.</p>
              <p>It&rsquo;s read-only — there&rsquo;s nothing to fill in.</p>
              <p><strong>A helper sees this same screen,</strong> with one difference: no <strong>Next block</strong> or <strong>Rotate now</strong>. Deciding when the whole team moves isn&rsquo;t theirs to do, so instead they get a line naming the coach who does it — which is the answer they&rsquo;d otherwise have to go and ask for.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-development',
      group: 'Premium Coaches Portal',
      heading: 'Player Development: focus areas, tests & evaluation sessions (Premium)',
      summary: 'Track what each player is working on and how they are progressing — a coverage picture, never a ranking.',
      // 'test types' stays in keywords ON PURPOSE after the rename to "Your test list": the
      // player-profile Development section still uses the old label, and a coach who remembers
      // either name must land here. Same reason the failure phrasings ("greyed out", "can't
      // start a session") are listed — search matches keywords, never the prose above.
      keywords: ['development', 'player development', 'evaluation session', 'measurables', 'test list', 'your test list', 'test types', 'focus area', 'goals', 'team board', 'progress', 'skills test', 'start here', 'new session greyed out', 'cannot start a session', 'retire test', 'change session date', 'session date', 'taken at', 'link session to practice', 'recorded here', 'is everyone getting attention', 'coverage', 'in a plan', 'not in a plan yet', 'practices you’ve run', 'open the plan', 'past practice plan', 'what did we do last season', 'tryout snapshot', 'development baseline', 'where the season started', 'dashed card', 'context not a measurable', 'coach-eyes-only'],
      searchText: 'player development focus areas goals what each player is working on measurables tests test types test list your test list evaluation session run tests whole roster team board coverage tryout snapshot development baseline where the season started dashed border context not a measurable never a trend never counts as a measurable frozen coach eyes only families never see tryout evaluations start development from tryouts seeded from tryouts who is getting attention progress trend lines season insights development report head coach only assistant notes capability no sessions yet not a ranking then go look doors faded dimmed nothing behind it start here add your first test new session greyed out disabled switched off why can i not start a session add a test first retired test retire restore last active test session history stays visible page order layout change the date of a session edit session date wrong date backdate typed them in later taken at link a session to a practice which practice recorded here readings move with the date re-stamp confirm how many readings will move rescheduled practice does not move the session',
      content: (
        <>
          <p><strong>Development</strong> is where you record what each player is working on and how they&rsquo;re coming along. It has two halves that work together:</p>
          <HelpDefs>
            <HelpDef term="Focus areas">The one or two things a player is currently working on, in your words.</HelpDef>
            <HelpDef term="Tests">The repeatable measurements you take. <strong>Your test list</strong> defines them, and you decide what&rsquo;s on it.</HelpDef>
          </HelpDefs>
          <p>An <strong>evaluation session</strong> runs your tests across the whole roster in one go, at a practice. A few sessions a season is what turns single readings into a trend you can actually coach from.</p>
        </>
      ),
      subtopics: [
        {
          id: 'premium-development-layout',
          title: 'How the page is laid out — and starting from scratch',
          content: (
            <>
              <p>Top to bottom: your <strong>evaluation sessions</strong> and the button to start a new one, then — under <em>&ldquo;Then go look&rdquo;</em> — two doors out to the <strong>team board</strong> and the coverage report in <strong>Insights</strong>, and last, <strong>your test list</strong>. A door fades when there&rsquo;s nothing behind it yet, so you can tell at a glance whether it&rsquo;s worth opening.</p>
              <p><strong>Starting from scratch.</strong> A session can only record what&rsquo;s on your test list, so until you have at least one test the page puts <strong>your test list first</strong> and marks it <em>Start here</em>. <strong>New session</strong> stays switched off, with a line saying what turns it on. Add one test and the page reorders itself into its everyday shape.</p>
              <p><strong>Retiring tests.</strong> Retiring a test keeps every reading already logged against it — it just leaves the picker. If you retire your <em>last</em> active test, new sessions switch off again until you add or restore one, but <strong>every session you&rsquo;ve already run stays right where it was</strong> and stays open.</p>
            </>
          ),
        },
        {
          id: 'premium-development-dates',
          title: 'When the readings were taken, and where',
          content: (
            <>
              <p>A session opens dated today, but you can <strong>change the date</strong> — for the common case of writing numbers on the back of your hand on Tuesday and typing them in on Thursday. You can also say which event they were <strong>taken at</strong>; pick the practice and the date fills itself in.</p>
              <HelpNote variant="warning" title="Moving a session’s date moves every reading in it">
                <p>So the session never disagrees with its own contents — you&rsquo;re asked first, and told exactly how many readings will move.</p>
              </HelpNote>
              <p>Linking a practice only <em>fills in</em> the date; if that practice is later rescheduled, your session stays on the day the testing actually happened. The practice itself gains a <strong>Recorded here</strong> line pointing back at the session.</p>
            </>
          ),
        },
        {
          id: 'premium-development-feeds',
          title: 'What it feeds: the board and the coverage report',
          content: (
            <>
              <p>The <strong>team board</strong> shows every player&rsquo;s focus areas and latest numbers in roster order, and <strong>Insights</strong> answers <em>&ldquo;Is everyone getting attention?&rdquo;</em> — one row per player, so the quiet kid at the end of the bench doesn&rsquo;t get overlooked. It&rsquo;s deliberately a coverage view, not a leaderboard.</p>
              <p><strong>That report also reads your practice plans.</strong> An <strong>In a plan</strong> column shows a quiet tick, or <em>&ldquo;not in a plan yet&rdquo;</em> for anyone whose name hasn&rsquo;t appeared in one — no counts and no scores, because it&rsquo;s a note about where your attention has gone, not a mark against a child. It only appears once you&rsquo;ve written a few plans <em>and</em> named players in at least one of them; naming players is optional, so until you do the question can&rsquo;t honestly be answered and the column stays away.</p>
              <p><strong>Underneath it</strong> you&rsquo;ll find the focus-area <strong>tags</strong> no practice has been about yet, and <strong>Practices you&rsquo;ve run</strong> — filter to &ldquo;Hitting&rdquo; and you get every hitting practice, what was in it, and what you wrote afterwards. <strong>Open the plan</strong> works on a finished season too, read-only, so &ldquo;what did we do last spring?&rdquo; has an answer.</p>
              <HelpNote variant="info" title="Two different kinds of truth, kept apart on purpose">
                <p>The coverage table says what was <em>planned</em>. Only <em>Practices you&rsquo;ve run</em> describes what happened — and it earns that because you sat down afterwards and wrote it.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-development-tryout',
          title: 'Where the season started: the tryout snapshot',
          content: (
            <p>If a player came through your tryout and you ran <em>Start development from tryouts</em> on the Build team tab, their development page opens with a <strong>Tryout snapshot</strong> card — their category ratings and overall from tryout day, dated, with how many evaluators scored them. It&rsquo;s drawn deliberately apart from your measurables, with a dashed edge, because it is <strong>context, not a measurement</strong>: a tryout rating is a panel&rsquo;s judgment on one day, not a timed drill, so it <strong>never joins a trend line and never counts as a measurable</strong>. It&rsquo;s frozen the moment you set it — editing your scorecard afterwards doesn&rsquo;t rewrite it — and like every tryout evaluation it is <strong>coach-eyes-only</strong>: families never see it, and only coaches with tryouts access see it at all.</p>
          ),
        },
        {
          id: 'premium-development-access',
          title: 'Who can do what',
          content: (
            <p>Every coach with player access can read the board. <strong>Writing</strong> — starting sessions, recording readings, editing the test list and focus areas — is head-coach only, because it&rsquo;s coach judgment written about a minor.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-development-new-session-off',
          question: 'Why is “New session” switched off?',
          answerText: 'Because there is nothing on your test list for a session to record. A session runs your tests across the roster, so it needs at least one active test to exist. When that is the case the Development page puts Your test list at the top and marks it "Start here" — add a test there and New session turns on straight away. The same thing happens if every test on your list is retired: retired tests leave the picker, so an all-retired list counts as an empty one. Add a new test or restore a retired one and sessions come back. Any sessions you have already run stay on the page and stay open the whole time — only starting a new one is switched off. If you are an assistant coach rather than the head coach, starting sessions is head-coach only, and the button will not appear for you at all.',
          keywords: ['new session greyed out', 'new session disabled', 'cannot start a session', 'can\'t start session', 'button not working', 'session button off', 'start here', 'no tests', 'empty test list', 'all retired', 'retired tests', 'why is the button grey'],
          popular: true,
          answer: (
            <>
              <p>Because there&rsquo;s nothing on your test list for a session to <em>record</em>. A session runs your tests across the roster, so it needs at least one <strong>active</strong> test to exist.</p>
              <p>When that&rsquo;s the case, the Development page puts <strong>Your test list</strong> at the top and marks it <em>Start here</em> — add a test there and <strong>New session</strong> turns on straight away.</p>
              <p>The same happens if <strong>every test on your list is retired</strong>: retired tests leave the picker, so an all-retired list counts as an empty one. Add a new test or restore a retired one and sessions come back. <strong>Sessions you&rsquo;ve already run stay on the page and stay open</strong> the whole time — only starting a <em>new</em> one is switched off.</p>
              <p>If you&rsquo;re an <strong>assistant coach</strong>, starting sessions is head-coach only, so the button won&rsquo;t appear for you at all.</p>
            </>
          ),
        },
        {
          id: 'faq-development-tryout-snapshot',
          question: 'Why does the Tryout snapshot look different from my measurables?',
          answerText: 'Because it is context, not a measurement, and the card is drawn to say so. A tryout rating is a panel’s judgment on one day against your scorecard; a measurable is a number you took with a stopwatch or a tape. Treating the two as one line would invent a trend out of two different kinds of thing — "4.4 at tryouts, 4.9 in June" is not an improvement, it is two unrelated judgments. So the snapshot sits apart with a dashed edge, never joins a trend, and never counts as a measurable anywhere. It is frozen at the moment you set it in Start development from tryouts, so editing your scorecard or correcting a score afterwards never rewrites the card you chose focus areas from. It is set once per season and is not editable by hand. It is also coach-eyes-only: families never see tryout evaluations on a recap, a keepsake or anywhere else, and only coaches with tryouts access see it at all — an assistant with roster or notes access does not. A player who came through your tryout but was never scored simply has no card.',
          keywords: ['tryout snapshot', 'development baseline', 'dashed card', 'context not a measurable', 'why is it separate', 'not a trend', 'trend line', 'frozen', 'coach eyes only', 'families see', 'privacy', 'assistant coach', 'where the season started'],
          answer: (
            <>
              <p>Because it&rsquo;s <strong>context, not a measurement</strong>, and the card is drawn to say so. A tryout rating is a panel&rsquo;s judgment on one day against your scorecard; a measurable is a number you took with a stopwatch or a tape. Putting them on one line would invent a trend out of two different kinds of thing — <em>&ldquo;4.4 at tryouts, 4.9 in June&rdquo;</em> isn&rsquo;t an improvement, it&rsquo;s two unrelated judgments. So the snapshot sits apart with a dashed edge, <strong>never joins a trend, and never counts as a measurable</strong>.</p>
              <p>It&rsquo;s <strong>frozen</strong> the moment you set it in <em>Start development from tryouts</em> — editing your scorecard or correcting a score afterwards never rewrites the card you chose focus areas from. It&rsquo;s set once per season and isn&rsquo;t editable by hand.</p>
              <p>It&rsquo;s also <strong>coach-eyes-only</strong>: families never see tryout evaluations on a recap, a keepsake, or anywhere else, and only coaches with <strong>tryouts</strong> access see it at all — an assistant with roster or notes access doesn&rsquo;t. A player who came through your tryout but was never scored simply has no card.</p>
            </>
          ),
        },
        {
          id: 'faq-session-change-date',
          question: 'I tested on Tuesday but typed it in on Thursday — can I fix the date?',
          answerText: 'Yes. Open the session and change the Date field. Because every reading is stamped with the session\'s date as you type it, moving the session moves those readings with it — otherwise the session would disagree with its own contents and the trend lines would plot on the wrong day. You are asked to confirm first and told exactly how many readings will move; with nothing entered yet there is no prompt at all. You can also set "Taken at" to the practice or game the readings came from, which fills the date in for you. Linking an event only fills the date in, it never owns it: if that practice is later rescheduled your session stays on the day the testing actually happened. Readings you logged one at a time from a player\'s profile are not part of any session and are never touched. Changing the date is head-coach only.',
          keywords: ['change session date', 'wrong date', 'edit the date', 'backdate a session', 'typed it in later', 'session on the wrong day', 'taken at', 'link session to practice', 'move a session'],
          popular: true,
          answer: (
            <>
              <p>Yes — open the session and change the <strong>Date</strong>.</p>
              <p>Every reading is stamped with the session&rsquo;s date as you type it, so <strong>moving the session moves those readings with it</strong>. Otherwise the session would disagree with its own contents and your trend lines would plot on the wrong day. You&rsquo;re asked to confirm first and told <strong>exactly how many readings will move</strong>; with nothing entered yet there&rsquo;s no prompt at all.</p>
              <p>You can also set <strong>Taken at</strong> to the practice or game the readings came from, which fills the date in for you. That link only <em>fills in</em> the date — it never owns it, so a practice that&rsquo;s later rescheduled won&rsquo;t drag your session with it.</p>
              <p>Readings you logged one at a time from a player&rsquo;s profile aren&rsquo;t part of any session and are never touched. Changing the date is head-coach only.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-tryout-history',
      group: 'Premium Coaches Portal',
      heading: 'Tryout history: turnout year over year, and the player who comes back',
      summary: 'A finished season’s tryout stays on the record — how many turned up, what you decided, and what your evaluators wrote.',
      keywords: ['tryout history', 'past tryout', 'last year tryout', 'previous tryout', 'turnout',
        'how many tried out', 'tryout numbers', 'growing', 'program growth',
        'returning player', 'tried out before', 'came back', 'didn’t make the team', 'did not make the team',
        'cut player', 'past evaluations', 'old scores', 'evaluator notes', 'past decisions',
        'who did we offer', 'declined offer', 'archive tryout'],
      searchText: 'tryout history past tryout last year turnout how many candidates tried out numbers growing program growth returning player tried out before came back did not make the team cut past evaluations old scores evaluator notes past decisions offered declined archive read only',
      content: (
        <>
          <p>Once a season is finished, its tryout stays readable under <strong>Tryouts</strong> for as long as that season is the one your team is on — which is the whole period between seasons, when a coach is most likely to go looking. Once the next season starts, Tryouts describes <em>it</em>; last year&rsquo;s candidate list isn&rsquo;t reachable from there.</p>
          <p><strong>Turnout is shown as a comparison,</strong> not just a count: &ldquo;31 candidates, up 7 from 2024&rdquo;. A number on its own doesn&rsquo;t tell you whether the program is growing, which is the question the page exists to answer.</p>
          <p>Below it, every candidate with their average score, what you decided, and — where evaluators left them — their <strong>notes</strong>, opened one candidate at a time.</p>
          <p><strong>The player who comes back.</strong> When someone registers for this year&rsquo;s tryout who has been through one before, their name is marked on your check-in list: <em>Tried out in 2025</em>, or <em>On the 2025 roster</em>. Open that season&rsquo;s tryout history to read what was said last time. It&rsquo;s the same matching the portal already uses to spot returning players, so a change of nickname or a new email address doesn&rsquo;t lose them.</p>
          <p><strong>What isn&rsquo;t here:</strong> anything that <em>runs</em> a tryout. You can&rsquo;t check anyone in, send an evaluator link, change a decision or email an offer for a season that has already finished. This is the record of what happened.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tryout-history-who-can-see',
          question: 'Can my assistant coaches read past evaluations?',
          answer: (
            <>
              <p>Only if they hold <strong>Tryouts</strong> access on your team <em>now</em>. Permissions are the ones you hold today, applied to every season — so an assistant you trust with tryouts this year can read what was said last year, and one you don&rsquo;t, can&rsquo;t.</p>
              <p>If you&rsquo;d rather someone no longer had it, take the grant away on the <strong>Staff</strong> page — or remove them from the team, which closes everything at once.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-history-no-tryout',
          question: 'The page says no tryout was held — but we definitely ran one.',
          answer: (
            <>
              <p>Tryout records belong to the season they were run in, and your screens show the season your team is on — so a tryout from a season the team has already moved past isn&rsquo;t listed here. If the tryout was run outside the portal (on paper, or in a spreadsheet), there&rsquo;s nothing to show either — the record starts from the first tryout you run here.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-insights',
      group: 'Premium Coaches Portal',
      heading: 'Insights: how your season is going (Premium)',
      summary: 'Your season read back to you — record and form, playing time, attendance, dues and development — built entirely from what you have already entered.',
      keywords: ['insights', 'season insights', 'reports', 'what stands out', 'scoreboard', 'record', 'form', 'playing time', 'fair', 'where is playing time going', 'attendance report', 'season review', 'history', 'ask about your team'],
      searchText: 'insights season insights how is my season going scoreboard band record form streak run differential close games attendance percentage dues collected what stands out findings flags ask about your team ask bar questions reports doorways is playing time fair where is playing time going who shows up where is the money who is earning it is everyone getting attention nothing to show yet empty insights fills in on its own no numbers invented read only derived',
      content: (
        <>
          <p><strong>Insights</strong> (in the Season menu) is your season read back to you. You never enter anything here — every number is built from the games, lineups, attendance and dues you&rsquo;ve already recorded elsewhere in the portal.</p>
          <p>It has four parts, top to bottom:</p>
          <ul>
            <li><strong>The scoreboard band</strong> — the figures you&rsquo;d recite out loud: record, recent form, scoring difference, close games, attendance rate, dues collected. A block only appears once it has real data behind it.</li>
            <li><strong>What stands out</strong> — the reports read <em>for</em> you. A pitcher over their arm-care cap, a player who&rsquo;s sat the bench most, dues going overdue. Each one links straight to the report it came from.</li>
            <li><strong>Ask about your team</strong> — a single bar you tap to ask one of a handful of ready-made questions and get a straight answer, with the records behind it. See <em>Asking about your team</em> below.</li>
            <li><strong>Report doorways</strong> — question-titled tiles (<em>&ldquo;Where is playing time going?&rdquo;</em>, <em>&ldquo;Who&apos;s showing up?&rdquo;</em>) that open the full report.</li>
          </ul>
          <p><strong>Why it may look empty.</strong> Insights fills in on its own as the season runs — nothing is invented to make the page look busy. Enter a game result, save a lineup, or take attendance once, and the matching part appears. A brand-new season is legitimately blank here.</p>
          <p><strong>What you see depends on your access.</strong> The money report only appears for coaches with money access, playing time needs lineup access, and attendance needs player access — so two coaches on the same team can honestly see different tiles.</p>
          <p><strong>Insights works on a finished season too.</strong> Switch seasons with the chip beside the page title and the whole page describes that year instead — its scoreboard, what stood out, and the same report tiles. Two are deliberately missing: <em>&ldquo;Where is playing time going?&rdquo;</em> and <em>&ldquo;Who are we up against?&rdquo;</em>. Playing-time figures are recalculated from saved lineups each time you open them, and your opponent notes are the book you keep <em>today</em> — neither can promise to show a past season as you actually saw it back then, so we don&rsquo;t offer them rather than quietly showing you this year&rsquo;s answer under last year&rsquo;s heading.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-lineup-season-analytics',
          question: 'What does “Where is playing time going?” in Insights show?',
          answerText: 'Open Insights (in the Season menu) and tap "Where is playing time going?" — a report with one row per player, built from the lineups you have actually saved: innings on the field vs on the bench, back-to-back bench games, every position they have played, and pitching innings against their arm-care cap with a flag on any game over it. Below the table, "Which lineup wins?" lists each batting order you have reused with its win-loss record, counting only games with a score entered. Every number comes only from saved lineups — nothing is invented, and honest empty states show until you have saved a few. The Insights page itself also flags standouts for you under "What stands out" (like a pitcher over their cap, or who has sat the bench most). These read-outs used to sit at the bottom of the Lineups page; the Lineups Games tab keeps a quiet Season insights link that jumps there.',
          keywords: ['season analytics', 'analytics', 'fair playing time', 'where is playing time going', 'bench balance', 'position variety', 'arm care', 'pitching load', 'records by lineup', 'lineup record', 'win loss lineup', 'playing time report', 'who sits most', 'reused lineup', 'lineup trends', 'insights', 'is playing time fair', 'which lineup wins', 'what stands out', 'where did season analytics go', 'lineups page analytics'],
          answer: (
            <>
              <p>Open <strong>Insights</strong> (in the <strong>Season</strong> menu) and tap <strong>&ldquo;Where is playing time going?&rdquo;</strong> — a report with <strong>one row per player</strong>, built from the lineups you&apos;ve saved: innings <strong>on the field vs. on the bench</strong>, <strong>back-to-back</strong> bench games, every <strong>position</strong> they&apos;ve played, and <strong>pitching</strong> innings against their arm-care cap, with a ⚠ flag on any game over it.</p>
              <p>Below the table, <strong>&ldquo;Which lineup wins?&rdquo;</strong> lists each batting order you&apos;ve reused with its win-loss record — counting only games with a score entered.</p>
              <p><strong>Every figure comes only from saved lineups</strong> — nothing is invented, and honest empty states show until you&apos;ve saved a few. The Insights page also flags standouts for you under <strong>&ldquo;What stands out&rdquo;</strong> (a pitcher over their cap, who&apos;s sat the bench most), so you don&apos;t have to go digging.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-ask',
      group: 'Premium Coaches Portal',
      heading: 'Asking about your team (Premium)',
      summary: 'Tap one of a handful of ready-made questions and get a straight answer, with the exact records it came from listed underneath.',
      keywords: ['ask', 'ask about your team', 'ask the front office', 'questions', 'question bar', 'receipts', 'who has not played', 'what does each family owe', 'who missed practices', 'who has not paid', 'search my team'],
      searchText: 'ask about your team ask the front office question bar tap a question ready-made questions receipts evidence proof who has not played catcher lately position recently what does each family still owe family dues who has not paid anything yet never paid who has missed the most practices attendance is playing time even whose arm needs a rest pitching cap choose a question cannot type free text no typing search box answers from your own records never a guess never outside data nothing recorded yet honest empty state assistant coach cannot see money question current season only',
      links: [{ label: 'Insights', href: '#premium-insights' }],
      content: (
        <>
          <p>On <strong>Insights</strong>, between <em>What stands out</em> and the report tiles, there&rsquo;s a single bar: <strong>Ask about your team</strong>. Tap it and a short list of ready-made questions opens. Tap one and you get a straight answer in a sentence, with the exact records it came from listed underneath — each linking to the full report.</p>
          <p>The questions available today:</p>
          <ul>
            <li><strong>Who hasn&rsquo;t played a position lately?</strong> — pick a position and see who&rsquo;s waited longest for a turn there, and who&rsquo;s covered it since.</li>
            <li><strong>What does each family still owe?</strong> — dues rolled up per family, so brothers and sisters count as one conversation instead of two.</li>
            <li><strong>Who hasn&rsquo;t paid anything yet?</strong></li>
            <li><strong>Who&rsquo;s missed the most practices?</strong> — over recent practices, with the specific dates.</li>
            <li><strong>Is playing time even?</strong></li>
            <li><strong>Whose arm needs a rest?</strong> — against the per-game cap <em>you</em> set. Diamond sports only.</li>
          </ul>
          <p><strong>You tap, you don&rsquo;t type.</strong> The bar is a list of questions to choose from, not a search box — that&rsquo;s why it says &ldquo;Choose a question&rdquo;.</p>
          <p><strong>Every answer is built from your own records.</strong> Nothing is estimated, predicted, or compared against other teams, and no answer ever appears without its evidence. If there&rsquo;s nothing recorded yet, it says so plainly and tells you the one thing that would fill it in — it never shows a zero it can&rsquo;t stand behind.</p>
          <p><strong>You only see what your access allows.</strong> A question you&rsquo;re not cleared for simply isn&rsquo;t on the list — an assistant without money access has no dues questions at all, rather than a locked one. If your access leaves no questions, the bar doesn&rsquo;t appear.</p>
          <p><strong>Current season only.</strong> Opening a finished season shows no question bar.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-ask-typing',
          question: 'Can I type my own question?',
          answerText: 'Not yet. Today "Ask about your team" is a list of ready-made questions you tap — that is why the bar says "Choose a question" rather than showing a text box. Typing your question in your own words is planned for a later version. The tappable questions will keep working exactly as they do now.',
          keywords: ['type a question', 'free text', 'search box', 'my own words', 'typing', 'ai', 'chatbot'],
          answer: (
            <>
              <p>Not yet. Today <strong>Ask about your team</strong> is a list of ready-made questions you tap — which is why the bar says <em>&ldquo;Choose a question&rdquo;</em> rather than showing a text box.</p>
              <p>Typing a question in your own words is planned for a later version. When it arrives, the tappable questions keep working exactly as they do now.</p>
            </>
          ),
        },
        {
          id: 'faq-ask-empty',
          question: 'Why does a question say “nothing recorded yet”?',
          answerText: 'Because it is true. Every answer is assembled from what you have recorded — saved lineups, attendance you have taken, dues you have set up. If none of that exists yet for a question, it says so and names the one thing that would fill it in, such as taking attendance at a single practice. It will never show a made-up figure or a zero it cannot stand behind, so a brand-new team is honestly blank here.',
          keywords: ['nothing recorded', 'empty answer', 'no data', 'blank', 'why no answer', 'new team'],
          answer: (
            <>
              <p>Because it&rsquo;s true. Every answer is assembled from what <em>you&rsquo;ve</em> recorded — saved lineups, attendance you&rsquo;ve taken, dues you&rsquo;ve set up.</p>
              <p>If none of that exists yet for a question, it says so and names the one thing that would fill it in (take attendance at a single practice, save one lineup). It will never show an invented figure or a zero it can&rsquo;t stand behind — so a brand-new team is honestly blank here.</p>
            </>
          ),
        },
        {
          id: 'faq-ask-missing-question',
          question: 'An assistant coach can’t see one of the questions — why?',
          answerText: 'Questions are filtered by each coach\'s own access. An assistant without money access has no dues questions at all — they are absent from the list rather than shown locked, because a question they can never get an answer to is just a dead end. The same applies to lineup and player access. If a coach\'s access leaves no questions at all, the bar itself does not appear for them. Change what they can see under Staff.',
          keywords: ['assistant cannot see', 'missing question', 'permissions', 'access', 'money access', 'hidden question', 'fewer questions'],
          answer: (
            <>
              <p>Questions are filtered by each coach&rsquo;s own access. An assistant without <strong>money access</strong> has no dues questions at all — they&rsquo;re <em>absent</em> from the list rather than shown locked, because a question you can never get an answer to is just a dead end. The same applies to lineup and player access.</p>
              <p>If a coach&rsquo;s access leaves no questions at all, the bar doesn&rsquo;t appear for them. Change what they can see under <strong>Staff</strong>.</p>
            </>
          ),
        },
        {
          id: 'faq-ask-family-names',
          question: 'Why does the dues answer name players instead of families?',
          answerText: 'Because that coach can see dues but not guardian contact details. Brothers and sisters are still correctly counted as one family — the grouping happens behind the scenes — but the family is labelled with the players\' names instead of the family surname, since those are names that coach already sees on every roster screen. A head coach, or an assistant granted guardian access, sees the family surname.',
          keywords: ['family name', 'surname', 'guardian access', 'player names dues', 'siblings', 'brothers sisters'],
          answer: (
            <>
              <p>Because that coach can see dues but not <strong>guardian contact details</strong>.</p>
              <p>Brothers and sisters are still correctly counted as <em>one</em> family — the grouping happens behind the scenes — but the family is labelled with the players&rsquo; names rather than the family surname, since those are names that coach already sees on every roster screen. A head coach, or an assistant granted guardian access, sees the family surname.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-scouting',
      group: 'Premium Coaches Portal',
      heading: 'The opponent book: scouting the teams you play (Premium)',
      summary: 'A page per opponent — your record against them across every season, every past meeting, and the notes your staff logs right after each game.',
      keywords: ['scouting', 'opponent', 'opponents', 'opponent book', 'scouting book', 'tendencies', 'rival', 'record against', 'who are we up against', 'observation', 'observations', 'book line', 'add to the book', 'numbers vs them', 'share to staff chat', 'game plan', 'same team as', 'merge opponents', 'game week reminder',
        // P3 — the tournament-intel block and the practice-week panel. A coach searches by what
        // they saw on screen ("their tournament so far") or by what they want ("opponent's other
        // games"); search reads keywords, not the prose.
        'their tournament so far', 'tournament intel', 'opponent tournament results', 'opponent other games', 'pool standing', 'standings', 'tournament weekend', 'practice plan opponent', 'practice week', 'full book',
        // Club Shared Book — a coach searches by what they saw ("from your club") or by what they
        // want ("see other teams' notes"), never by the feature's internal name. Search reads
        // keywords and searchText, not the prose.
        'from your club', 'club shared book', 'share our book', 'share with the club',
        'other teams notes', 'another team scouting', 'club scouting', 'sibling team',
        'stop sharing', 'why can I see another team', 'club plan scouting'],
      searchText: 'scouting book opponent book opponents who are we up against record against them last meeting tendencies notes on other teams rival scouting tab add to the book observation log book line head coach remove observation helper assistant contribute jersey number not names merge duplicate spelling same team as un-merge also answers to scrimmage not counted exhibition record rule archived season no scouting numbers vs them home away split this season all time average biggest win worst loss from n games what worked lineup share to staff chat game plan snapshot brief staff you play reminder masthead nudge dismiss tag filter chips add another several observations one sitting their tournament so far opponent results this weekend other games same tournament pool standing runs for against refreshed automatic no capture forfeit not counted external tournament missing why no block practice plan panel you play saturday the book while building practice full book link from your club club shared book share our book with the club other teams in my club can see my notes who can read my scouting see another team observations read only cannot edit another team note records per team never averaged all n from team club has more observations on this opponent marker on the opponents list two switches club admin turns it on head coach opts in notes access stop sharing disappears immediately reciprocity see theirs while you share yours never leaves the club another organization cannot see our book club plan only no switch in team settings archived season no club layer',
      content: (
        <p>The <strong>opponent book</strong> keeps what you know about the teams you play — in the portal instead of a notes app on your phone. Open <strong>Insights → &ldquo;Who are we up against?&rdquo;</strong> for the list: every opponent you&rsquo;ve ever named on a game, your all-time record against them (across seasons), when you last met, and an amber dot wherever something&rsquo;s written.</p>
      ),
      subtopics: [
        {
          id: 'premium-opponent-layers',
          title: 'What an opponent’s page holds',
          content: (
            <>
              <p>Three layers:</p>
              <HelpDefs>
                <HelpDef term="The numbers">Record, runs for and against, streak, and every past meeting season by season. Scrimmages are listed with an <strong>EXH</strong> badge but never counted, so the record here always matches Season Wrapped and Insights.</HelpDef>
                <HelpDef term="The book line">One distilled sentence (<em>&ldquo;Beatable when we run early&rdquo;</em>), written by the head coach (or an assistant granted notes access). It leads every scouting surface.</HelpDef>
                <HelpDef term="Observations">One-line notes logged after games (<em>&ldquo;their shortstop cheats up with runners on&rdquo;</em>), each dated, tagged, and signed by whoever wrote it. Tag chips above the log filter it — on the opponent page and on the game&rsquo;s Scouting tab alike.</HelpDef>
              </HelpDefs>
              <p><strong>The book writes some lines itself.</strong> Once you&rsquo;ve met a team three times, <strong>&ldquo;The numbers vs them&rdquo;</strong> appears on their page: home/away split, this season vs all-time, average score, biggest win and worst loss — and with a couple of saved lineups against them, patterns like <em>&ldquo;In both wins, Sam started at pitcher; in the loss they didn&rsquo;t.&rdquo;</em> Every line says how many games it&rsquo;s drawn from, and a line that hasn&rsquo;t earned its evidence simply doesn&rsquo;t appear.</p>
            </>
          ),
        },
        {
          id: 'premium-opponent-writing',
          title: 'Writing happens right after the score',
          content: (
            <>
              <p>When you save a final score, a quiet <strong>&ldquo;Add to the book&rdquo;</strong> link appears beside it — it opens the game&rsquo;s <strong>Scouting</strong> tab, where you can log several observations in one sitting (each save confirms and invites another).</p>
              <p>That tab is also where the book resurfaces before you play them again: your record shows on the schedule row, the tab holds the book line and freshest notes, and in game week the team bar adds one quiet reminder — <em>&ldquo;You play Thunder Saturday — 6 observations in the book&rdquo;</em> — that jumps straight there. Dismiss it and it stays gone for that game.</p>
              <HelpNote variant="warning" title="One house rule">
                <p>The whole bench can scout — assistants and helpers can log observations too, every entry shows who wrote it, and the head coach can remove any entry (writers can remove their own). Refer to opposing players by <strong>jersey number or position, never by name</strong> — they&rsquo;re someone else&rsquo;s kids.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-opponent-tournament',
          title: 'At a tournament, the book fills itself between games',
          content: (
            <p>When your game is part of a tournament that runs on FieldLogicHQ, its Scouting tab adds <strong>&ldquo;Their tournament so far&rdquo;</strong> — the opponent&rsquo;s other results this weekend, their pool standing, and their runs for and against, assembled automatically from the tournament&rsquo;s own live results and refreshed every time you open the tab. Sunday&rsquo;s semifinal opponent arrives with Saturday&rsquo;s scores already in the book, and nobody on your bench typed a thing. It&rsquo;s the same public information the tournament&rsquo;s standings page shows — results and standings from <em>that</em> tournament only, team names and scores, never anyone&rsquo;s roster. A game against a team that forfeited shows the scoreline with a small <em>forfeit</em> marker, and those invented runs stay out of the totals. This only exists where the tournament itself runs on the platform — a league game, or a tournament you entered by hand, simply doesn&rsquo;t have it to offer.</p>
          ),
        },
        {
          id: 'premium-opponent-practice',
          title: 'Saturday’s intelligence meets Tuesday’s plan',
          content: (
            <>
              <p>When you build a practice plan in a week with a booked game against a team whose book has content, one quiet line appears above the plan — <em>&ldquo;You play Thunder Saturday — the book:&rdquo;</em> — with your book line, the freshest observation, and a <strong>Full book</strong> link. <em>&ldquo;They bunt the first strike&rdquo;</em> becomes this week&rsquo;s bunt-defense station without anyone going looking. No game that week, or nothing in the book, and the planner looks exactly as it always has.</p>
              <p><strong>Brief the bench in one tap.</strong> <strong>Share to staff chat</strong> — on the opponent page or the Scouting tab — posts a game-plan snapshot (record, book line, the numbers, recent observations) into your team&rsquo;s staff room. It&rsquo;s a snapshot: edits you make to the book afterwards don&rsquo;t rewrite what was posted.</p>
            </>
          ),
        },
        {
          id: 'premium-opponent-club',
          title: 'Your club can pool what it knows (Club plan)',
          content: (
            <>
              <p>The 12U A team&rsquo;s hard-won read on a rival helps nobody while it sits in one coach&rsquo;s book. If your club turns sharing on and you switch your own team in, an opponent&rsquo;s page grows a <strong>&ldquo;From your club&rdquo;</strong> section under your own timeline: one block per club team that has faced them, with <em>their</em> record, <em>their</em> book line, and their observations — each one signed with the writer and the team, like <em>&ldquo;— Coach Dana · 12U A&rdquo;</em>. &ldquo;All 8 from 12U A&rdquo; opens the rest.</p>
              <p><strong>Records stay side by side, one per team, and are never blended</strong> into a single number: what the A team is 3&ndash;1 against, your team may be 0&ndash;2 against, and both are true. Where the club knows something, the opponents list marks the row and a game&rsquo;s Scouting tab adds one quiet line — <em>&ldquo;Your club has 8 more observations on Thunder&rdquo;</em> — that jumps to the section.</p>
              <p><strong>What sharing does and doesn&rsquo;t do.</strong> Everything in the club layer is <strong>read-only across team lines</strong>: you can&rsquo;t edit or erase another team&rsquo;s note, and no other coach can touch yours. Each head coach still curates exactly one book — their own. Sharing is <strong>two switches</strong>: your club admin turns it on for the organization, then each head coach opts their own team in under <strong>Team settings → &ldquo;Share our book with the club&rdquo;</strong> (it needs notes access). You <strong>see the club&rsquo;s books while you share yours</strong> — stop sharing and your book disappears from their pages, and theirs from yours, straight away. Nothing was ever copied. And sharing stops at your club&rsquo;s walls: another organization&rsquo;s books are never visible to you, and yours are never visible to them.</p>
            </>
          ),
        },
        {
          id: 'premium-opponent-past',
          title: 'Past seasons',
          content: (
            <p>The book remembers every season&rsquo;s games, but it serves the season you&rsquo;re coaching now — an archived season doesn&rsquo;t show scouting screens, the club layer included.</p>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-opponent-book-who-writes',
          question: 'Who can write in the opponent book — and who can delete a note?',
          answerText: 'Anyone on your staff who can see the schedule — assistants and helpers included — can log observations, and every entry is signed with their name. The head coach can remove any observation; everyone else can remove only their own. The book line (the one-sentence summary at the top of an opponent page) is different: only the head coach, or an assistant granted notes access, can edit it. Many people scout, one voice decides.',
          keywords: ['who can write scouting', 'helper observation', 'assistant scouting', 'delete observation', 'remove note', 'book line access', 'notes access'],
          answer: (
            <>
              <p><strong>Logging observations:</strong> anyone on your staff who can see the schedule — assistants and helpers included. Every entry is signed with their name.</p>
              <p><strong>Removing them:</strong> the head coach can remove any observation; everyone else only their own.</p>
              <p><strong>The book line</strong> — the one-sentence summary at the top — is head-coach territory (or an assistant granted notes access). Many people scout; one voice decides.</p>
            </>
          ),
        },
        {
          id: 'faq-opponent-book-club-sharing',
          question: 'If I share our book with the club, what exactly do the other coaches see?',
          answerText: 'They see your book line, your observations, and your record against that opponent — nothing else. Each note stays labelled with your team and the name of whoever wrote it, so nothing of yours is ever read as theirs. They cannot edit or delete anything in your book, and you cannot touch theirs: across team lines the club layer is read-only, and each head coach still curates exactly one book, their own. It is your team\'s scouting only — no roster, no families, no money, nothing else from your team travels. Sharing needs two switches: your club admin turns it on for the organization, then each head coach opts their own team in under Team settings, Share our book with the club, which needs notes access. You see the club\'s books while you share yours. Stop sharing and your book disappears from their pages, and theirs from yours, straight away — nothing was ever copied. Sharing never crosses the club: another organization can never see your book, and you can never see theirs. This is part of the Club plan.',
          keywords: ['share our book', 'club shared book', 'what do other coaches see', 'who can read my scouting', 'stop sharing', 'share with the club', 'from your club', 'other teams notes', 'reciprocity', 'club plan scouting'],
          answer: (
            <>
              <p><strong>Your book line, your observations, and your record</strong> against that opponent — and nothing else. No roster, no families, no money: only the scouting travels.</p>
              <p><strong>Everything stays labelled.</strong> Each note carries your team and the name of whoever wrote it, so nothing of yours is ever read as somebody else&rsquo;s.</p>
              <p><strong>Nobody can change anyone else&rsquo;s book.</strong> Across team lines it&rsquo;s read-only in both directions — they can&rsquo;t edit or remove your notes, you can&rsquo;t touch theirs. Each head coach still curates exactly one book: their own.</p>
              <p><strong>It takes two switches.</strong> Your club admin turns sharing on for the organization; then each head coach opts their own team in under <strong>Team settings → &ldquo;Share our book with the club&rdquo;</strong> (needs notes access). You see the club&rsquo;s books <em>while</em> you share yours.</p>
              <p><strong>Stopping is instant.</strong> Switch it off and your book disappears from their pages — and theirs from yours — straight away. Nothing was ever copied.</p>
              <p><strong>It never leaves your club.</strong> Another organization can never see your book, and you can never see theirs.</p>
            </>
          ),
        },
        {
          id: 'faq-opponent-book-club-missing',
          question: 'Another coach mentioned “From your club” but I don’t have that section. Why?',
          answerText: 'Three things have to be true, and the section is simply absent until all three are. Your organization has to be on the Club plan — book sharing between teams is part of it. Your club admin has to turn sharing on for the organization, under Rep Teams then Shared library. And your own team has to be sharing: you see the club\'s books only while you share yours, so if your Team settings switch is off, the section, the marker on the opponents list, and the line on the Scouting tab are all gone. If you cannot see the switch in Team settings at all, your club admin has not turned the feature on yet. One more reason it can be absent even when everything is on: no other team in your club has written anything about that particular opponent yet. The section only appears when there is something to read.',
          keywords: ['no from your club', 'missing club section', 'cannot see club notes', 'where is share our book', 'no switch in team settings', 'club layer missing', 'why no club scouting'],
          answer: (
            <>
              <p>Three things have to be true, and the section is simply absent until they are:</p>
              <ul>
                <li>Your organization is on the <strong>Club plan</strong> — sharing books between teams is part of it.</li>
                <li>Your <strong>club admin has turned sharing on</strong> for the organization (Rep Teams → Shared library). If you can&rsquo;t see the switch in your own Team settings at all, this is why.</li>
                <li><strong>Your own team is sharing.</strong> You see the club&rsquo;s books only while you share yours — with your switch off, the section, the opponents-list marker and the Scouting-tab line all disappear.</li>
              </ul>
              <p>One more: even with everything on, the section only appears when there&rsquo;s something to read. If no other team in your club has written about <em>that</em> opponent yet, there&rsquo;s nothing to show — and an empty shell would be worse than nothing.</p>
            </>
          ),
        },
        {
          id: 'faq-opponent-book-duplicate',
          question: 'The same team shows up twice under two spellings. How do I combine them?',
          answerText: 'The book groups games by the opponent name typed on each game, so "Thunder 12U" and "Oakville Thunder" read as two different opponents until you tell the book they are the same team. On either opponent page, scroll to Identity and choose "Same team as…" — pick the duplicate, and the book shows you both records and what they combine to before anything happens. After the merge, the records unify, the observations come along, and the old spelling keeps working everywhere as another name for the team. Changed your mind? The Identity section lists "also answers to" names with a remove button — removing one splits the two spellings apart again. Merging needs notes access (head coach, or an assistant granted it). Tidying the spelling on the games themselves still helps future games group correctly on their own.',
          keywords: ['duplicate opponent', 'two spellings', 'merge opponents', 'same team twice', 'opponent name', 'same team as', 'un-merge', 'unmerge', 'combine opponents', 'also answers to'],
          answer: (
            <>
              <p>The book groups games by the opponent name typed on each game — so <em>&ldquo;Thunder 12U&rdquo;</em> and <em>&ldquo;Oakville Thunder&rdquo;</em> read as two different opponents until you tell the book they&rsquo;re the same team.</p>
              <p>On either opponent&rsquo;s page, scroll to <strong>Identity</strong> and choose <strong>&ldquo;Same team as…&rdquo;</strong> — pick the duplicate, and the book shows you both records and what they combine to <em>before</em> anything happens. After the merge, the records unify, the observations come along, and the old spelling keeps working everywhere as another name for the team.</p>
              <p>Changed your mind? The same Identity section lists the <em>&ldquo;also answers to&rdquo;</em> names with a remove button — removing one splits the two spellings apart again. Merging needs <strong>notes access</strong> (the head coach, or an assistant granted it).</p>
              <p>Tidying the spelling on the games themselves still helps — future games then group correctly on their own.</p>
            </>
          ),
        },
        {
          id: 'faq-opponent-book-tournament-intel',
          question: 'One game’s Scouting tab shows “Their tournament so far” — why don’t my other games have it?',
          answerText: 'That block exists only when the game is part of a tournament that runs on FieldLogicHQ, because it is assembled from the tournament\'s own live results — the same public information its standings page shows. A league game, or a tournament you typed into your schedule by hand, has no results feed behind it, so there is nothing to assemble and the tab simply shows the book as usual. It also stays away until the opponent has actually played: the first game of the weekend has no "so far" to report. When it does appear it covers that tournament only — never the opponent\'s games from other events — and it refreshes every time you open the tab, so between-game scores arrive on their own. A forfeit shows with a marker and its invented score stays out of the totals.',
          keywords: ['their tournament so far', 'tournament intel missing', 'no tournament block', 'why no tournament results', 'opponent other games', 'external tournament', 'standings in scouting', 'pool standing', 'forfeit total'],
          answer: (
            <>
              <p>That block exists only when the game belongs to a <strong>tournament running on FieldLogicHQ</strong> — it&rsquo;s assembled from the tournament&rsquo;s own live results, the same public information its standings page shows. A league game, or a tournament you typed into your schedule by hand, has no results feed behind it, so there&rsquo;s nothing to assemble and the tab simply shows the book as usual.</p>
              <p>It also stays away until the opponent has actually <em>played</em> — the first game of the weekend has no &ldquo;so far&rdquo; to report. When it does appear, it covers <strong>that tournament only</strong> (never the opponent&rsquo;s games from other events), and it refreshes every time you open the tab, so between-game scores arrive on their own.</p>
              <p>One number worth trusting: a <strong>forfeit</strong> shows its scoreline with a small marker, but those invented runs stay out of the for/against totals — same rule the tournament&rsquo;s standings use.</p>
            </>
          ),
        },
        {
          id: 'faq-opponent-book-numbers',
          question: 'Why doesn’t an opponent’s page show “The numbers vs them”?',
          answerText: 'The numbers vs them lines appear only when there is enough evidence to trust them: at least three counted meetings for the record-based lines (scrimmages never count), and at least two saved lineups against that opponent for the "what worked" lines. Below those floors the block stays empty on purpose — the book would rather say nothing than guess. Every line that does appear says how many games it is drawn from.',
          keywords: ['numbers vs them', 'no insights', 'missing numbers', 'three meetings', 'from n games', 'what worked', 'lineup insight'],
          answer: (
            <>
              <p>Those lines appear only when there&rsquo;s enough evidence to trust them: at least <strong>three counted meetings</strong> for the record-based lines (scrimmages never count), and at least <strong>two saved lineups</strong> against that opponent for the <em>&ldquo;what worked&rdquo;</em> lines.</p>
              <p>Below those floors the block stays empty on purpose — the book would rather say nothing than guess. Every line that does appear tells you how many games it&rsquo;s drawn from.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'premium-staff',
      group: 'Premium Coaches Portal',
      heading: 'Adding assistant coaches and helpers (Premium)',
      summary: 'Give another coach their own sign-in with exactly the areas you choose — or invite a parent as a helper, who sees one practice and nothing else.',
      keywords: ['staff', 'assistant coach', 'invite coach', 'second coach', 'permissions', 'capabilities', 'duty grid', 'access', 'head coach',
        // Chunk F — the archive's staff vocabulary; search reads keywords, not the prose above.
        'remove access', 'revoke access', 'past season staff', 'who can see last season',
        'former assistant', 'assistant left', 'archive access', 'take away access',
        // Phase 4 — helpers. A head coach looks for this by the words they'd use for the person
        // ("parent", "volunteer"), never by the word the product happens to have chosen.
        'helper', 'helpers', 'invite a parent', 'parent volunteer', 'parent helper', 'volunteer',
        'outside instructor', 'guest coach', 'run a station', 'station helper',
        'someone who is not a coach', 'non-coach', 'temporary access', 'limited access',
        'make assistant coach', 'promote a helper', 'change the schedule', 'staff chat switch',
        // A1 — the retired Roster switch. A head coach who used it comes looking for it by name,
        // and by the thing they were trying to do. Search reads keywords, not the prose.
        'roster switch', 'roster hidden', 'hide the roster', 'hide player names', 'hide names',
        'where did the roster setting go', 'roster visibility', 'stop an assistant seeing names',
        'who can see player names', 'names and numbers', 'contacts and birthdates',
        // 2026-08-03 — the removal/family seam. A coach searches by the SYMPTOM, not the mechanism.
        'removed but still sees schedule', 'remove assistant still has access',
        'also connected as a family member', 'also follows this team', 'family access',
        'fully remove someone', 'revoke everything', 'two connections'],
      searchText: 'coaching staff assistant coaches invite an assistant second coach their own login sign in permissions capabilities what each assistant can see duties grid schedule attendance lineups guardian contacts notes money documents announcements tryouts least privilege default head coach only remove an assistant no assistant coaches yet helper helpers invite a parent to help at practice parent volunteer outside instructor runs a station sees the practice plan and the players at their station and nothing else no staff chat cannot change anything read only schedule promote a helper to assistant coach make assistant coach two schedule switches see the schedule and change the schedule staff chat is a switch now where did the roster switch go roster hidden gone retired cannot hide the roster hide player names from an assistant hide names stop an assistant seeing names names are visible to all staff names numbers positions baseline everyone contacts and birthdates is the real switch guardian contacts still protected assistant sees names beside dues player #12 no longer sections follow the duties you grant removing someone from staff ends their coaching access only a family connection is separate and survives remove them under family access on the roster page also connected to this team as a family member note matches the email they signed in with absence is not proof hidden on a finished season removed but still sees our schedule',
      content: (
        <>
          <p><strong>Staff</strong> is where you give someone else their own sign-in to this team. They get their own account — you never share a password — and they see the team through whatever access you grant.</p>
          <p><strong>You choose which kind before you type the email,</strong> because it changes everything underneath it.</p>
        </>
      ),
      subtopics: [
        {
          id: 'premium-staff-kinds',
          title: 'Assistant coach, or helper?',
          content: (
            <>
              <HelpDefs>
                <HelpDef term="An assistant coach">Staff. They start with the least access that is still useful — seeing and changing the schedule, attendance, lineups, and the blank team forms — and they&rsquo;re in your staff chat. Everything sensitive is off until you switch it on.</HelpDef>
                <HelpDef term="A helper">The parent or outside instructor who turns up to run a station on a Tuesday. They see your practice schedule, the plan for each practice, and the names, numbers and positions of the players at their station. That is the whole list.</HelpDef>
              </HelpDefs>
              <p>A helper <strong>can&rsquo;t change anything</strong> — not the plan, not the schedule, not one game — and they are <strong>never in your staff chat</strong>. No roster page, no notes, no contacts, no money, no tryouts, no attendance, no lineups.</p>
              <p><strong>Why bother with either.</strong> An assistant with schedule access can add the games you&rsquo;re both chasing; one with lineup access can build the lineup while you run the practice. A helper saves you printing a sheet with ten children&rsquo;s names on it and handing it to someone who then takes it home — and you can take their access back the moment the season, or your mind, changes.</p>
              <p><strong>Changed your mind about a helper?</strong> Their card has <strong>Make assistant coach</strong>. Same person, same sign-in, no new invitation — they simply get everything an assistant starts with, and you can grant more from there.</p>
            </>
          ),
        },
        {
          id: 'premium-staff-names',
          title: 'Players’ names are not a switch',
          content: (
            <>
              <p>Anyone you give access to a team can see players&rsquo; <strong>names, numbers and positions</strong> — every assistant, and every helper. There used to be a <em>Roster: Hidden</em> control here and it has been retired, because it only worked on some screens: an assistant with the roster &ldquo;hidden&rdquo; still saw every full name in the lineup builder, the playing-time report, the dues page and awards. It promised something the portal couldn&rsquo;t keep.</p>
              <HelpNote variant="warning" title="The switch that does the real protecting is Contacts &amp; birthdates">
                <p>Guardian names, emails and phone numbers, dates of birth, medical notes and emergency contacts — it is untouched, still off by default, and still asks you to confirm before you grant it.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-staff-duties',
          title: 'What each duty opens',
          content: (
            <>
              <p><strong>Which sections an assistant can open follows the duties you give them.</strong> Attendance, lineups, player notes, team money, documents or tryouts each open their own area, and holding any of them also opens the roster page, the development board and Insights. An assistant you leave on the defaults is unchanged.</p>
              <p>One practical upshot: an assistant you&rsquo;ve given <strong>team money</strong> now sees players&rsquo; <strong>names</strong> beside the amounts on the dues page, instead of &ldquo;Player #12&rdquo; and a phone call to you.</p>
              <p><strong>Two things on the grid are worth knowing.</strong> <strong>Schedule</strong> is two switches: seeing the schedule and practice plans, and <em>changing</em> the schedule — adding, editing and cancelling events. Every assistant you invited before has both, exactly as they always did. And <strong>Staff chat</strong> is a switch too; it used to come automatically with being on the staff. It&rsquo;s still on for every assistant, and it&rsquo;s the one thing a helper can never be given without making them an assistant coach.</p>
            </>
          ),
        },
        {
          id: 'premium-staff-head-coach',
          title: 'What stays with the head coach',
          content: (
            <p><strong>Only the head coach</strong> can invite, adjust, or remove anyone. Assistants never receive roster editing in this version — adding and editing players stays with you.</p>
          ),
        },
        {
          id: 'premium-staff-past-season',
          title: 'One staff list, every season',
          content: (
            <>
              <p><strong>Your staff list belongs to the team, not to a season.</strong> Whoever is on it can open the team — and removing someone removes them <strong>everywhere, immediately: every screen, every season</strong>. There is no season-by-season access to manage.</p>
              <ul>
                <li>Each finished season still <strong>remembers who coached it</strong> — that record doesn&rsquo;t change when your staff does.</li>
                <li>Adding someone back later restores their access, with their permissions where you left them.</li>
              </ul>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-remove-staff-family-access',
          question: 'I removed someone from Staff — why can they still see our schedule?',
          answer: (
            <>
              <p>Because they&rsquo;re connected to your team <strong>twice</strong>, and removing one doesn&rsquo;t remove the other.</p>
              <p>Removing someone from <strong>Staff</strong> ends their <em>coaching</em> access straight away — the plan, the roster, whatever you&rsquo;d granted them. But if that same person is also connected as a <strong>family member</strong> (a parent following the team), that&rsquo;s a separate connection they asked for and you approved, and it&rsquo;s untouched. They keep seeing your schedule, your results, and any game page you&rsquo;ve shared.</p>
              <p><strong>To end that too:</strong> open your <strong>Roster</strong> page and remove them under <strong>Family access</strong>. The two live in different places on purpose — one is your coaching staff, the other is a family who follows the team, and they&rsquo;re rarely the same decision.</p>
              <p>When we can tell it&rsquo;s the same person, we say so: their staff card shows <em>&ldquo;Also connected to this team as a family member&rdquo;</em>, and the removal confirmation spells it out before you confirm. ⚠ We match on the email address they signed in with — so if they follow the team under a <em>different</em> address, that note won&rsquo;t appear. <strong>Not seeing the note isn&rsquo;t proof they have no family connection</strong>; if you&rsquo;re making sure, check the Family access list on your Roster page. The note is also hidden when you&rsquo;re looking at a finished season, because it describes today rather than back then.</p>
            </>
          ),
          answerText: 'I removed someone from Staff but they can still see our schedule and results. Because they are connected to your team twice and removing one does not remove the other. Removing someone from Staff ends their coaching access straight away — the plan, the roster, whatever you granted. If that same person is also connected as a family member, a parent following the team, that is a separate connection they asked for and you approved, and it is untouched: they keep seeing your schedule, your results and any game page you shared. To end that too, open your Roster page and remove them under Family access. When we can tell it is the same person their staff card shows "Also connected to this team as a family member" and the removal confirmation spells it out before you confirm. We match on the email address they signed in with, so if they follow under a different address the note will not appear — not seeing the note is not proof they have no family connection, check the Family access list on your Roster page. The note is hidden when viewing a finished season because it describes today.',
          keywords: ['removed but still sees schedule', 'removed them but they can still see the schedule', 'remove assistant still has access', 'remove helper still sees', 'staff removal family follower', 'also connected as a family member', 'also follows this team', 'remove family follower', 'family access', 'two connections', 'still getting our results', 'revoke access completely', 'fully remove someone'],
        },
        {
          id: 'faq-roster-switch-retired',
          question: 'I used to be able to hide the roster from an assistant. Where did that setting go?',
          answer: (
            <>
              <p>It&rsquo;s gone, on purpose. <strong>Players&rsquo; names, numbers and positions are now visible to everyone you give access to your team</strong> — assistants and helpers alike.</p>
              <p>The honest reason: the old <strong>Roster: Hidden</strong> switch only worked on some screens. An assistant with the roster &ldquo;hidden&rdquo; was blocked from the roster page, attendance and the development board — and still saw every player&rsquo;s full name and number in the <strong>lineup builder</strong>, the <strong>playing-time report</strong>, the <strong>dues page</strong> and <strong>awards</strong>, because each of those reads its own setting. Four screens obeyed it, four ignored it. A switch that only half works is worse than no switch, because you believed you&rsquo;d protected something you hadn&rsquo;t.</p>
              <p><strong>Nothing that actually needed protecting has moved.</strong> Guardian names, emails and phone numbers, players&rsquo; dates of birth, medical notes and emergency contacts all sit behind <strong>Contacts &amp; birthdates</strong>, which is unchanged: off by default, and it still asks you to confirm before you turn it on. That switch was always the one doing the real work.</p>
              <p>You also can&rsquo;t build a batting order, chase a family&rsquo;s dues, or run a station against anonymous rows — every one of those screens is meant to name the player.</p>
            </>
          ),
          answerText: 'I used to be able to hide the roster from an assistant. Where did that setting go? It is gone on purpose. Players names, numbers and positions are now visible to everyone you give access to your team, assistants and helpers alike. The old Roster: Hidden switch only worked on some screens — an assistant with the roster hidden was blocked from the roster page, attendance and the development board, and still saw every full name and number in the lineup builder, the playing-time report, the dues page and awards, because each reads its own setting. Four screens obeyed it, four ignored it. A switch that only half works is worse than no switch because you believed you had protected something you had not. Nothing that actually needed protecting has moved: guardian names, emails and phone numbers, dates of birth, medical notes and emergency contacts all sit behind Contacts and birthdates, unchanged, off by default, and it still asks you to confirm before you turn it on. That switch was always doing the real work. You also cannot build a batting order, chase a family dues, or run a station against anonymous rows.',
          keywords: ['hide roster', 'roster hidden', 'roster switch gone', 'where did the roster setting go', 'hide player names', 'hide names from assistant', 'roster visibility', 'who can see names', 'names and numbers', 'contacts and birthdates', 'privacy', 'stop assistant seeing roster'],
        },
        {
          id: 'faq-helper-what-they-see',
          question: 'A parent is running a station on Tuesday. What will they actually see?',
          answer: (
            <>
              <p>Invite them from <strong>Staff</strong> as a <strong>helper</strong>. When they sign in on their own phone they land straight on that day&rsquo;s practice, with one button: <strong>Open my station</strong>. Inside, they see the station they&rsquo;re running, what it&rsquo;s for, the coaching points, and the group standing in front of them by name and number.</p>
              <p>That is genuinely everything. No roster page, no notes about any player, no guardian contacts, no money, no tryouts, and <strong>not your staff chat</strong>. They can&rsquo;t change a thing — the plan, the schedule and every game stay yours.</p>
              <p>On a day with no practice they see when the next one is. If you haven&rsquo;t written the plan yet, they&rsquo;re told so, and told there&rsquo;s nothing for them to do until you have.</p>
            </>
          ),
          answerText: 'A parent running a station on Tuesday. Invite them from Staff as a helper. They sign in on their own phone and land on that day’s practice with one button, Open my station. They see the station they are running, what it is for, the coaching points, and the group in front of them by name and number. Nothing else: no roster page, no player notes, no guardian contacts, no money, no tryouts, and not your staff chat. They cannot change anything — the plan, the schedule and every game stay yours. On a day with no practice they see when the next one is. If the plan is not written yet they are told so and told there is nothing to do.',
          keywords: ['helper', 'parent volunteer', 'invite a parent', 'what does a helper see', 'parent at practice', 'run a station', 'volunteer access', 'non-coach', 'outside instructor', 'my station', 'helper phone'],
          popular: true,
        },
        {
          id: 'faq-helper-no-link',
          question: 'Can I just send a helper a link to the practice plan?',
          answer: (
            <>
              <p>No — and we won&rsquo;t build it. A link to a practice plan is a page naming ten children alongside a date, a start time and a street address. Forwarded once, it&rsquo;s public for good, and you&rsquo;d never get it back.</p>
              <p>So a helper gets an <strong>invitation and a sign-in</strong>, which you can revoke whenever you like. If someone won&rsquo;t make an account, the <strong>printed sheet</strong> is still there and still works — just remember that the paper has the same names on it and can&rsquo;t be taken back.</p>
            </>
          ),
          answerText: 'Can I send a helper a link to the practice plan? No, and it will not be built. A link to a practice plan is a page naming ten children with a date, a start time and a street address, and once forwarded it is public permanently. A helper gets an invitation and a sign-in you can revoke at any time. If someone will not make an account, the printed sheet still works, but the paper carries the same names and cannot be taken back. share a plan share link send the plan public link no login',
          keywords: ['share the plan', 'send a link', 'share link', 'link to the practice plan', 'no account', 'without signing in', 'google docs', 'share with a parent', 'public link', 'why do they need an account'],
        },
        {
          id: 'faq-staff-past-season-access',
          question: 'An assistant left the club — can I stop them seeing last season?',
          answer: (
            <>
              <p>Yes. Switch to that season, open <strong>Staff</strong>, and choose <strong>Remove access</strong> beside their name. They lose the ability to open that season&rsquo;s records immediately.</p>
              <p>It affects that season only. It doesn&rsquo;t change anything about the season itself — they stay part of its record — and it doesn&rsquo;t touch your current team, which you manage from the live season.</p>
            </>
          ),
          answerText: 'assistant left the club stop them seeing last season past season remove access staff page remove beside their name lose access immediately every season at once not just one does not change the record of who coached that year re-adding restores revoke former assistant historical access',
          keywords: ['remove access', 'revoke access', 'former assistant', 'assistant left', 'past season access', 'stop them seeing', 'archive access'],
        },
        {
          id: 'faq-staff-past-season-grants',
          question: 'Do I set an assistant’s access per season?',
          answer: (
            <>
              <p><strong>No — there&rsquo;s one setting per person, on your team.</strong> Whatever you give them applies wherever they can look, including seasons that have already finished, and it stays as you set it when the next season starts.</p>
              <p>It used to be per season, which had two costs a coach felt: what an assistant could see changed depending on which year they opened, and every grant you had customised quietly reset the day a new season began.</p>
              <p>To stop someone seeing anything at all, remove them from the team on the <strong>Staff</strong> page — that closes every season at once, and the record of who coached each year is untouched.</p>
            </>
          ),
          answerText: 'do i set assistant access per season one setting per person on the team applies to every season including finished ones survives rollover no longer resets each year used to be per season what they could see changed depending which year they opened remove them from the team on staff closes every season at once record of who coached is kept',
          keywords: ['change access past season', 'toggles disabled', 'greyed out', 'edit permissions past season', 'per season permissions', 'permissions reset each season', 'access changed by year', 'why can’t I change'],
        },
      ],
    },
    {
      // Chunk D Slice 1. The family layer is the first thing in the portal that hands a person
      // OUTSIDE the coaching staff a view of the team, so the guide leads with who ends up seeing
      // what — that is the question a coach actually has before they paste a link into a group
      // chat. The guardian tier is deliberately described as not-yet-open rather than omitted: a
      // coach WILL be asked "can my parents connect?" and needs a true answer.
      id: 'premium-family-access',
      group: 'Premium Coaches Portal',
      heading: 'Letting families follow your team (Premium)',
      summary: 'Share one link so grandparents and relatives can follow your schedule and results — you approve every one of them, and you decide how much is visible.',
      keywords: ['guardians', 'guardian', 'parent access', 'connect a parent', 'approve as', 'two guardians', 'second household', 'invite a guardian', 'family', 'families', 'family access', 'family link', 'team family link', 'follow the team', 'followers', 'family followers', 'grandparent', 'grandparents', 'relatives', 'parents see schedule', 'let parents see', 'share schedule', 'share my schedule', 'who can see my schedule', 'schedule visibility', 'staff only', 'public link', 'approve family', 'approval queue', 'requests waiting', 'remove follower', 'revoke', 'reset link', 'new link', 'stop sharing', 'guardian', 'parent access', 'connect parents', 'calendar', 'subscribe calendar',
        // Chunk D Slice 3 — the recap the coach can preview today, and the keepsake families save.
        'season recap', 'player season recap', 'family season recap', 'recap', 'preview recap',
        'what parents see', 'what the family sees', 'end of season recap', 'keepsake',
        'keepsake card', 'save keepsake', 'player card', 'share card', 'publish recap',
        'release recap', 'when do families get the recap'],
      searchText: 'family access team family link share link with families grandparents relatives follow team schedule results approve decline requests waiting queue remove follower revoke reset link new link old link stops working schedule visibility staff only families public link who can see games practices calendar subscription ics feed family gets alerts when a game moves final score guardian parent tier not open yet privacy review premium coaches portal roster page family access card no roster shown to requester family season recap preview what the parent sees attendance worked on focus areas test readings first to latest awards playing time fair play band typical range nothing invented absent not empty never called an improvement never compares players closing the season releases recaps no publish button keepsake card first name and jersey saved to their phone no public link family list and staff list are separate in both directions removing a follower does not remove coaching access removing someone from staff does not stop them following the team to end both do both same person two connections',
      content: (
        <p>Families can follow your team without you sending anything out by hand. You share <strong>one link</strong>, they ask to follow, and you approve. It sits on your <strong>Roster</strong> page in the <strong>Team family access</strong> card.</p>
      ),
      subtopics: [
        {
          id: 'premium-family-link',
          title: 'Sharing the link',
          content: (
            <>
              <HelpSteps>
                <li>Open <strong>Roster</strong> and find <strong>Team family access</strong>.</li>
                <li>Choose <strong>Create link</strong> — it copies to your clipboard.</li>
                <li>Paste it wherever your team already talks: the group chat, an email, a season-start message.</li>
              </HelpSteps>
              <p>The link is the only way in. There is <strong>no way to search for your team or a player</strong> — someone has to be given the link, and then you still have to approve them.</p>
            </>
          ),
        },
        {
          id: 'premium-family-visibility',
          title: 'Deciding who sees the schedule',
          content: (
            <>
              <p><strong>Schedule visibility</strong> has three settings, and it applies to games and practices together:</p>
              <HelpDefs>
                <HelpDef term="Staff only">Nobody outside your coaching staff sees the schedule. Families who are already connected get a short &ldquo;not available right now&rdquo; message rather than an error, and their connection stays intact for when you switch it back.</HelpDef>
                <HelpDef term="Families">The default — the people you have approved see the full schedule.</HelpDef>
                <HelpDef term="Public link">Additionally, your team&apos;s public page shows the schedule to anyone who visits it.</HelpDef>
              </HelpDefs>
              <p>This is enforced on our side, not just hidden. Setting it to Staff only genuinely removes the schedule everywhere, including from any calendar a family already subscribed to.</p>
            </>
          ),
        },
        {
          id: 'premium-family-approving',
          title: 'Approving and removing people',
          content: (
            <>
              <p>Requests wait quietly on this same card as a <strong>&ldquo;waiting&rdquo;</strong> count — nothing chases you, and you deal with them when you are already on the page. Each row shows the email address and whatever they said about themselves (&ldquo;Grandparent&rdquo;). Choose <strong>Approve</strong> or <strong>Decline</strong>. Declining is not permanent — if you decline the wrong person, they can ask again.</p>
              <p>Use <strong>Manage</strong> to see everyone currently following and <strong>Remove</strong> anyone. Removing takes effect immediately, including any calendar they had subscribed.</p>
              <HelpNote variant="warning" title="This list and your Staff list are separate, in both directions">
                <p>Removing someone here ends their family connection and nothing else — if they&rsquo;re also an assistant coach or a helper, they keep every bit of that coaching access until you remove them from <strong>Staff</strong> too. It works the same way the other way round, which is the one that catches people out: taking someone off Staff does <em>not</em> stop them following the team. To end both, do both.</p>
              </HelpNote>
            </>
          ),
        },
        {
          id: 'premium-family-sees',
          title: 'What a follower actually sees',
          content: (
            <>
              <p>Games and practices in one list, results once you enter them, and any game page you have shared. They can add the schedule to their own phone calendar, where it keeps itself current. They get a notice when you move a game, cancel one, or post a final score.</p>
              <p><strong>What they never see:</strong> your roster, any player&apos;s name, contact details, fees, attendance, or anything else from your portal. A follower is connected to the <em>team</em>, not to a child.</p>
            </>
          ),
        },
        {
          id: 'premium-family-reset',
          title: 'If you need a link back',
          content: (
            <>
              <p><strong>Reset link</strong> creates a new one and stops the old one working everywhere it has been shared — the right move if a link travelled further than you meant it to. People you have already approved are unaffected.</p>
              <p><strong>Connecting a player&apos;s own parent or guardian is not open yet.</strong> That part of the family experience is waiting on a privacy review covering a child&apos;s information. A parent who opens your link is told so plainly and offered the follow option instead, so nobody is left guessing.</p>
            </>
          ),
        },
        {
          id: 'premium-family-recap',
          title: 'The season recap you can already look at',
          content: (
            <>
              <p>Open any player from your <strong>Roster</strong> and you&apos;ll find <strong>Family season recap</strong> with a <strong>Preview</strong> control. It shows exactly what that player&apos;s parent or guardian will read once your season closes — you&apos;re looking at their screen, not a summary of it.</p>
              <p>It&apos;s built entirely from things you already record: <strong>attendance</strong>, what you <strong>worked on</strong> with them (their focus areas, and each test&apos;s first and latest reading), their <strong>awards</strong>, and how their <strong>playing time</strong> sat against your team&apos;s typical range — plus your team&apos;s season record. There is nothing extra to write.</p>
              <p><strong>Anything you didn&apos;t record simply isn&apos;t there.</strong> A team that never logged a test has no &ldquo;worked on&rdquo; section — not an empty one, not a prompt. Nothing is invented, and nothing tells a family a section is missing. A recap built from one feature you used all season is a short, true recap.</p>
              <p>Two things it deliberately does <em>not</em> do: it never calls a test reading an improvement (only you know whether faster or higher is better for your own test), and it never compares one player to another.</p>
              <HelpNote variant="tip" title="Closing your season is what hands recaps to families">
                <p>There&apos;s no separate publish step. That&apos;s why the preview lives here during the season: it&apos;s while the season is open that you can still log a last reading or hand out an award. Preview needs player-notes access.</p>
              </HelpNote>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-family-who-sees-roster',
          question: 'Can people who follow my team see my roster?',
          answerText: 'No. A follower is connected to the team, not to a player. They see the schedule, results and any game page you shared. They never see your roster, a player name, contact details, fees or attendance. Even the request page shows them nothing about your team beyond its name.',
          keywords: ['roster', 'player names', 'privacy', 'what do followers see', 'can they see'],
          answer: (
            <>
              <p>No. A follower is connected to the <strong>team</strong>, not to a player. They see the schedule, results, and any game page you shared.</p>
              <p>They never see your roster, a player&apos;s name, contact details, fees or attendance — and the request page itself shows them nothing about your team beyond its name.</p>
            </>
          ),
        },
        {
          id: 'faq-family-link-spread',
          question: 'Someone forwarded my family link — what do I do?',
          answerText: 'Choose Reset link on the Team family access card. That creates a new link and stops the old one working everywhere it was shared. Families you already approved keep their access. Anyone using the old link can no longer request. Nobody gets access from holding the link alone — you still approve every request.',
          keywords: ['forwarded', 'shared too far', 'reset link', 'revoke link', 'new link', 'stop the link'],
          popular: true,
          answer: (
            <>
              <p>Choose <strong>Reset link</strong> on the Team family access card. That creates a new link and stops the old one working everywhere it was shared. Families you have already approved keep their access.</p>
              <p>Worth knowing either way: holding the link never grants anything on its own — every request still comes to you.</p>
            </>
          ),
        },
        {
          id: 'faq-family-hide-schedule',
          question: 'How do I stop families seeing the schedule for a while?',
          answerText: 'Set Schedule visibility to Staff only on the Team family access card. Connected families see a short not-available message instead of the schedule, any shared game page stops opening, and subscribed calendars stop updating. Nobody is disconnected — switch it back to Families and everything returns.',
          keywords: ['hide schedule', 'staff only', 'turn off', 'stop sharing schedule', 'temporarily'],
          answer: (
            <>
              <p>Set <strong>Schedule visibility</strong> to <strong>Staff only</strong>. Connected families see a short &ldquo;not available right now&rdquo; message, any game page you shared stops opening, and subscribed calendars stop updating.</p>
              <p>Nobody is disconnected — switch it back to <strong>Families</strong> and everything returns.</p>
            </>
          ),
        },
        {
          id: 'faq-family-recap-preview',
          question: 'What is the “Family season recap” on a player’s page?',
          answerText: 'It is what that player\'s connected parent or guardian reads when your season closes, and Preview shows you their actual screen. It is assembled from what you already record: attendance, the focus areas you worked on, each test\'s first and latest reading, awards, and how their playing time sat against your team\'s typical range, plus the team\'s season record. Nothing extra to write. Anything you never recorded is simply absent — a team that logged no tests has no worked-on section at all, not an empty one, and nothing tells the family a section is missing. It never calls a reading an improvement, because only you know whether faster or higher is better for your own test, and it never compares one player to another. You need player-notes access to preview it. It is available while the season is running, which is the point — that is when you can still log a reading or give an award.',
          keywords: ['season recap', 'family season recap', 'player recap', 'preview', 'what parents see', 'what the family sees', 'end of season', 'recap sections missing', 'empty recap', 'no data'],
          popular: true,
          answer: (
            <>
              <p>It&apos;s what that player&apos;s connected parent or guardian reads once your season closes — and <strong>Preview</strong> shows you their actual screen, not a summary of it.</p>
              <p>It&apos;s assembled from what you already record: <strong>attendance</strong>, the <strong>focus areas</strong> you worked on, each test&apos;s <strong>first and latest reading</strong>, <strong>awards</strong>, and how their <strong>playing time</strong> sat against your team&apos;s typical range. Nothing extra to write.</p>
              <p><strong>Anything you never recorded is simply absent.</strong> A team that logged no tests has no &ldquo;worked on&rdquo; section at all — not an empty one — and nothing tells a family a section is missing.</p>
              <p>It never calls a reading an <em>improvement</em> (only you know whether faster or higher is better for your own test), and it never compares one player to another. Previewing needs <strong>roster</strong> and <strong>notes</strong> access.</p>
            </>
          ),
        },
        {
          id: 'faq-family-recap-release',
          question: 'How do I publish the season recaps to families?',
          answerText: 'There is no publish button. Closing your season is what hands recaps to connected families — the same action that produces your Season Wrapped. That is deliberate: once a season is closed nothing in it can be edited, so what you previewed during the season is exactly what families read. Preview each player while the season is still open, because that is when you can still log a last test reading or hand out an award. Note that recaps go to a player\'s connected parent or guardian, and that connection type is not open yet while a privacy review is finished, so nothing reaches a family until it is.',
          keywords: ['publish recap', 'release recap', 'send recap', 'when do families get the recap', 'share recap', 'no publish button'],
          answer: (
            <>
              <p>There isn&apos;t one. <strong>Closing your season</strong> is what hands recaps to connected families — the same action that produces your Season Wrapped.</p>
              <p>That&apos;s deliberate: once a season is closed nothing in it can be changed, so what you previewed <em>during</em> the season is exactly what families read. Preview while the season is still open — that&apos;s when you can still log a last reading or hand out an award.</p>
              <p>Recaps go to a player&apos;s connected <strong>parent or guardian</strong>, and that connection isn&apos;t open yet while the privacy review is finished — so nothing reaches a family until it is.</p>
            </>
          ),
        },
        {
          id: 'faq-family-keepsake',
          question: 'What is the keepsake card?',
          answerText: 'On their child\'s season recap, a family can tap Save keepsake card to get a square picture for their camera roll — the team colours, the season, their child\'s first name and jersey number, their awards and attendance. It carries a first name and a number only, never a surname, and it is drawn on their own phone and handed to their normal share sheet. There is no public web page for it and no link anyone else can open — where it goes is entirely the family\'s choice. It is the same share-card idea as the Season Wrapped picture you can share from Season\'s End.',
          keywords: ['keepsake', 'keepsake card', 'player card', 'share card', 'picture', 'image', 'camera roll', 'save card', 'trading card'],
          answer: (
            <>
              <p>On their child&apos;s recap, a family can tap <strong>Save keepsake card</strong> for a square picture in their camera roll — team colours, the season, their child&apos;s <strong>first name and jersey number</strong>, awards and attendance.</p>
              <p>It carries a first name and a number only — <strong>never a surname</strong> — it&apos;s drawn on their own phone, and it goes to their normal share sheet. There&apos;s <strong>no public page and no link</strong> anyone else can open; where it goes is the family&apos;s choice. Same idea as the <strong>Share your season</strong> picture on your Season&apos;s End page.</p>
            </>
          ),
        },
        {
          id: 'faq-family-guardian-tier',
          question: 'A parent asked to connect to their own child — can they?',
          answerText: 'Not yet on your account. Connecting a parent or guardian to a specific player is built but switched off across the platform while a privacy review covering a child information is finished. A parent who opens your family link is told that plainly and can follow the team instead, which gives them the schedule, results and game updates today. When it opens you will see a guardians card on each player page: parents ask to connect and name their child, you approve and say which player they belong to, up to two per player so a second household fits.',
          keywords: ['parent', 'guardian', 'my child', 'connect to player', 'season recap', 'not available', 'guardians card', 'when will guardians', 'two guardians'],
          answer: (
            <>
              <p>Not yet. Connecting a parent or guardian to a <em>specific player</em> is built, but switched off across the platform while a privacy review covering a child&apos;s information is finished.</p>
              <p>A parent who opens your link is told that plainly and offered the team-follow option instead — which gives them the schedule, results and game updates today.</p>
              <p><strong>What it will look like when it opens:</strong> a <strong>guardians card</strong> on each player&apos;s page. A parent opens your family link, names their child and gives the consents; you approve and say <em>which</em> player they belong to. Up to two per player, so a second household fits. You&apos;ll also be able to invite a parent directly at the email already on that player — and because you chose that address, someone signing in with it connects without needing a second approval from you.</p>
            </>
          ),
        },
        {
          id: 'faq-family-how-many',
          question: 'How many people can follow my team?',
          answerText: 'As many as you approve. There is a high safety ceiling to stop abuse, not a plan limit, and an ordinary team will never reach it. You can remove anyone at any time from the Manage list.',
          keywords: ['how many', 'limit', 'cap', 'maximum followers', 'too many'],
          answer: (
            <p>As many as you approve. There is a high ceiling to stop abuse rather than a plan limit, and an ordinary team will never reach it. You can remove anyone at any time.</p>
          ),
        },
      ],
    },
    {
      // Chunk D Slice 1. Separate from the family-access section because a coach reaches this from
      // the SCHEDULE, not the roster, and will search for "share a game" rather than "family".
      id: 'premium-share-game-link',
      group: 'Premium Coaches Portal',
      heading: 'Sharing one game with people who have no account (Premium)',
      summary: 'Turn a single game into a clean page anyone can open — teams, time, place, directions, and the final score once you enter it.',
      keywords: ['share game', 'share game link', 'share a game', 'game link', 'game page', 'send the game', 'grandparent game', 'no account', 'follow this game', 'public game', 'stop sharing game', 'unshare'],
      searchText: 'share game link single game public page no sign in needed teams time place directions final score grandparent out of town relatives share button event details schedule slide over stop sharing removes the page practices cannot be shared individually staff only blocks it team level only no player names premium coaches portal',
      content: (
        <>
          <p>Open any game on your <strong>Schedule</strong> and choose <strong>Share</strong>. That creates a page for that one game which anyone can open — no account, no app.</p>
          <p>The page shows both teams, the time, the place with directions, and the final score once you enter it. That is all it ever shows: <strong>no player names, no roster, no lineup</strong>. It is the same information as the scoreboard at the field, which is why it is safe to send to anyone.</p>
          <p>Two things worth knowing:</p>
          <ul>
            <li><strong>The page does not exist until you share it.</strong> Nothing is public by default, and <strong>Stop sharing</strong> removes it again.</li>
            <li><strong>Practices can&apos;t be shared this way.</strong> If you want your whole schedule public, that is the <strong>Public link</strong> setting on Team family access instead.</li>
          </ul>
          <p>If your Schedule visibility is set to <strong>Staff only</strong>, sharing is refused with an explanation — a shared page would not open for anyone.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-share-game-who-can-open',
          question: 'Who can open a game link I share?',
          answerText: 'Anyone you send it to. It needs no account and no sign in. It shows both teams, the time, the place with directions, and the final score once entered — never a player name, a roster or a lineup. It is not listed in search engines, so it only reaches the people you send it to.',
          keywords: ['who can see', 'no account', 'public', 'anyone', 'search engine', 'google'],
          answer: (
            <>
              <p>Anyone you send it to — it needs no account and no sign-in. It shows both teams, the time, the place with directions, and the final score once you enter it, and never a player name, roster or lineup.</p>
              <p>It is not listed in search engines, so it reaches the people you send it to and nobody else.</p>
            </>
          ),
        },
        {
          id: 'faq-share-game-undo',
          question: 'Can I take a shared game page back down?',
          answerText: 'Yes. Open the game again and choose Stop sharing — the page stops opening immediately, including for anyone who bookmarked it. Setting Schedule visibility to Staff only also closes every shared game page at once.',
          keywords: ['undo', 'take down', 'stop sharing', 'unshare', 'remove game page'],
          answer: (
            <>
              <p>Yes — open the game and choose <strong>Stop sharing</strong>. The page stops opening immediately, including for anyone who bookmarked it.</p>
              <p>Setting <strong>Schedule visibility</strong> to <strong>Staff only</strong> closes every shared game page at once.</p>
            </>
          ),
        },
      ],
    },
    {
      // Chunk B (P1 #17). Team settings was the one nav destination in the premium portal with no
      // guide at all — so its help icon could only ever have opened the hub, which is a table of
      // contents where the coach expected an answer about this screen. Written rather than linked
      // so the "every door carries help" rule has no exceptions. Deliberately does NOT restate the
      // rollover walkthrough (recipe-start-next-season owns it) — it says what the screen is for and
      // points there.
      id: 'premium-team-settings',
      group: 'Premium Coaches Portal',
      heading: 'Team settings (Premium)',
      summary: 'Your division, the season you are in, the lineup rules Auto-fill follows, how dues behave, book sharing, and — for a standalone team — your link to a club or league.',
      keywords: ['team settings', 'settings', 'setting', 'division', 'change division', 'edit division', 'age group', 'lineup rules', 'lineup settings', 'innings cap', 'pitching cap', 'pitch count', 'arm care', 'max innings', 'minimum innings', 'min play', 'playing time rule', 'rotation', 'auto-fill', 'autofill', 'auto fill rules', 'season status', 'season name', 'start next season', 'parent organization', 'link org', 'join a club', 'transfer team', 'club admin', 'where do i change', 'team options', 'configure team', 'money settings', 'dues settings', 'automatic dues reminders', 'reminders toggle', 'where is the reminders toggle', 'turn off reminder emails', 'stop reminder emails', 'credits reduce', 'credit setting', 'where did the dues settings go', 'settings groups', 'collapsed settings', 'sections are closed', 'share our book', 'club shared book', 'sharing'],
      searchText: 'team settings screen collapsed groups closed until you open them each group shows what it is set to division age group change division club admin manages division standalone team season name status active complete start next season rollover lineup rules season defaults auto-fill max innings at one position rotation pitching innings cap arm care per pitcher player own pitcher cap stricter wins minimum innings per player everyone plays leave blank to turn off override for a single game auto-fill menu money group automatic dues reminders 30 days 7 days see an example credits reduce last payment first next payment first settle at season end where did the dues settings go moved from player dues money access view only sharing club shared book scouting book parent organization link to a club or league recognition transfer team invited by your organization manage organization link premium coaches portal where do i change my division where are lineup caps where is the reminders toggle turn off reminder emails',
      content: (
        <>
          <p><strong>Team settings</strong> is the small set of things that are true about your team for a whole season, rather than about one game or one player. Each group is <strong>closed until you open it</strong>, and shows what it&rsquo;s currently set to on its own line — so you can read how the team is set up without opening anything.</p>
          <p><strong>Division.</strong> The age group or division your team plays in — it labels your team across the portal and on any public page. If your team belongs to a club or league, your <strong>club admin owns this</strong> and you&rsquo;ll see it here read-only; a standalone team sets it themselves.</p>
          <p><strong>Season.</strong> Shows which season you&rsquo;re in and whether it&rsquo;s still open. If you run your own team, this is also where you <strong>start next season</strong> — your roster comes with you and last season becomes read-only history. (Full walkthrough: <em>How to start your next season</em>.)</p>
          <p><strong>Lineup rules.</strong> Season defaults that game-day <strong>Auto-fill</strong> follows — a cap on innings at one position (which forces rotation), a default pitching cap, and a minimum number of innings for every player. <strong>Leave a field blank to turn that rule off</strong>, and you can override any of them for a single game from the Auto-fill menu. A player&rsquo;s own pitching cap still applies on top of the season default, and <strong>the stricter of the two always wins</strong> — a season cap can never loosen a limit you set on an individual arm.</p>
          <p><strong>Money.</strong> Two things about how dues behave all season. <strong>Automatic Dues Reminders</strong> emails families 30 days and 7 days before each due date — <em>See an example</em> shows the exact email. <strong>Credits reduce</strong> decides where fundraising money lands on a family&rsquo;s payment schedule: the last payment first (the default), the next payment first, or not at all until season&rsquo;s end. Player Dues prints whichever you chose under its table, with a link back here. This group appears for coaches with money access; a coach who can only view the books sees the answers without the controls.</p>
          <p><strong>Sharing</strong> (clubs that have turned it on). Whether your scouting book is readable by the club&rsquo;s other sharing teams. You see theirs while you share yours, and stopping removes your book from their pages immediately.</p>
          <p><strong>Parent organization</strong> (standalone teams only). Connect your team to a club or league for recognition, or transfer it across entirely. Most teams are invited by their organization instead — if that happens you&rsquo;ll see it here and on your Overview.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-settings-division-locked',
          question: 'Why can’t I change my division?',
          answerText: 'Because your team belongs to a club or league, and division is managed by your organization admin so it stays consistent across every team they run. Ask them to change it. Standalone teams — ones you set up yourself rather than being invited into — set their own division on this screen.',
          keywords: ['cannot change division', 'division locked', 'division read only', 'club admin', 'greyed out', 'who changes division', 'edit division'],
          answer: (
            <>
              <p>Because your team belongs to a <strong>club or league</strong>, and division is managed by your organization&rsquo;s admin so it stays consistent across every team they run. Ask them to change it.</p>
              <p><strong>Standalone teams</strong> — ones you set up yourself rather than being invited into — set their own division right here.</p>
            </>
          ),
        },
        {
          id: 'faq-settings-dues-moved',
          question: 'Where did the dues reminder and credit settings go?',
          answerText: 'They moved to Team settings, in the Money group. Automatic Dues Reminders and Credits reduce are decisions you make once for the season, so they no longer take up room at the bottom of Player Dues where you go every week to chase payments. Player Dues still tells you what they are set to — a line under the table reads something like "Reminders on — 30 and 7 days before each due date · Credits reduce the last payment first" with a link straight to the setting. Before you have set any dues at all, Player Dues shows both controls inline, because that is when you are deciding how dues will work. In a finished season the line states the policy that was in force but offers no link, since nothing in a past season can be changed.',
          keywords: ['where did the reminders toggle go', 'automatic dues reminders missing', 'credits reduce missing', 'dues settings moved', 'cant find reminders toggle', 'no toggle at the bottom of dues', 'reminder setting gone', 'credit setting gone', 'moved to settings'],
          answer: (
            <>
              <p>They moved to <strong>Team settings → Money</strong>. <strong>Automatic Dues Reminders</strong> and <strong>Credits reduce</strong> are decisions you make once for the season, so they no longer take up room at the bottom of <strong>Player Dues</strong> — the screen you open every week to chase payments.</p>
              <p><strong>Player Dues still tells you what they&rsquo;re set to.</strong> A line under the table reads something like <em>&ldquo;Reminders on — 30 and 7 days before each due date · Credits reduce the last payment first&rdquo;</em>, with a link straight to the setting.</p>
              <p>Two exceptions worth knowing:</p>
              <HelpDefs>
                <HelpDef term="Before you&rsquo;ve set any dues">Player Dues shows both controls inline — that&rsquo;s when you&rsquo;re deciding how dues will work, and nobody owes anything yet.</HelpDef>
                <HelpDef term="In a finished season">The line states the policy that was in force, without a link. Nothing in a past season can be changed.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'faq-settings-lineup-caps',
          question: 'What happens if a season lineup rule conflicts with a player’s own cap?',
          answerText: 'The stricter one wins. Season lineup rules are defaults for the whole team; a pitching cap you set on an individual player is about that player\'s arm. Auto-fill applies whichever is tighter, so a season default can never loosen a limit you set on one player. Leaving a season field blank turns that rule off entirely, and you can override any of them for a single game from the Auto-fill menu.',
          keywords: ['conflict', 'stricter', 'player cap', 'pitching cap', 'season default', 'which cap wins', 'arm care', 'override', 'single game', 'blank'],
          popular: true,
          answer: (
            <>
              <p><strong>The stricter one wins.</strong> Season lineup rules are defaults for the whole team; a pitching cap you set on an individual player is about <em>that player&rsquo;s arm</em>. Auto-fill applies whichever is tighter, so a season default can never loosen a limit you set on one player.</p>
              <p>Leaving a season field <strong>blank turns that rule off</strong> entirely, and you can override any of them for a single game from the Auto-fill menu.</p>
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
      searchText: 'start next season new season next year roll over rollover carry roster forward fee plan fee template planned budget schedule starts fresh previous season read only past seasons history season review insights team settings edit change division head coach year end premium club owned admin manages seasons lineup rules innings cap rotation pitching cap minimum innings min play playing time auto-fill caps this season vs last comparison winning percentage record roster size trend up down improving better than last year are we improving dues collected expenses assistant coaches can see who is earning it awards leaderboard season awards mvp leaderboard award history development history linked bring forward focus areas carry forward development notes',
      content: (
        <>
          <p>In the <strong>Premium</strong> portal, a new <strong>Settings</strong> area lets you run your team from one year to the next yourself — without waiting on an organization admin.</p>
          <p><strong>Start next season.</strong> When a season wraps, open <strong>Settings</strong> and choose <strong>Start next season</strong>. Confirm the new season&apos;s name and year, then pick what to bring over:</p>
          <ul>
            <li>Your <strong>active roster carries forward automatically</strong> — trim or add players from there. Each carried player&apos;s <strong>development history is linked</strong> to last season, and on their profile you&apos;ll get a one-time offer to <strong>bring forward the focus areas they were working on</strong> — or start fresh (readings stay in last season&apos;s archive either way).</li>
            <li>Optionally bring over your <strong>fee plan</strong> (amounts and installments; due dates shift forward a year) and your <strong>planned budget</strong> (your projected buckets).</li>
            <li>The <strong>schedule starts fresh</strong>, and last season&apos;s money — payments, spending, and paid history — stays behind with that season.</li>
          </ul>
          <p>The previous season becomes <strong>read-only history</strong>. Its story is kept in <strong>Season&rsquo;s End</strong> — the wrap-up card, how many families opened their player&rsquo;s recap — and in the <strong>Past seasons</strong> list at the foot of <strong>Insights &rarr; &ldquo;How are we doing?&rdquo;</strong>, where each year shows its record, roster size, tryout acceptance and (with money access) dues and expenses, and links to its own Season Wrapped. There&rsquo;s no year-over-year comparison on purpose: teams change divisions and opponents each year, so the seasons sit side by side as a scrapbook, not a scoreboard.</p>
          <p><strong>Your everyday screens follow the team, not the calendar.</strong> Once the new season starts, Roster, Schedule, Money and the rest describe <em>that</em> season — there&rsquo;s no switch that points them back at last year. In the weeks <em>before</em> you start the next one, they&rsquo;re all still showing the finished season, read-only, from your ordinary menu. You land in the new season with a short summary of what carried over and anything worth a second look — confirming carried-over fee due dates, say, or re-collecting waivers.</p>
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
          id: 'faq-past-seasons-head-coach',
          question: 'Where do I find my team’s earlier years?',
          answerText: 'You can. Every coach on the team\'s current staff sees the season-by-season list — each year\'s record, roster size, tryout acceptance and, if you handle money, that year\'s dues and expenses. Open Insights, then "How are we doing?", and scroll to "Past seasons". Season\'s End also offers "Compare every season", which is the same list. It was briefly head-coach-only; that restriction has been lifted, because only people currently on the staff can open the team at all. If you cannot see it, either the team has no finished seasons yet, or you are no longer on its staff — ask the head coach.',
          keywords: ['past seasons', 'past seasons missing', 'cannot see past seasons', 'no past seasons list', 'where is past seasons', 'compare every season', 'season history', 'head coach only', 'assistant cannot see history', 'team history permission', 'previous years', 'earlier years', 'last year', 'scrapbook', 'look up an old season'],
          answer: (
            <>
              <p><strong>You can.</strong> Every coach on the team&rsquo;s current staff sees it. Open <strong>Insights</strong>, then <em>&ldquo;How are we doing?&rdquo;</em>, and scroll to <strong>Past seasons</strong> — each year&rsquo;s record, roster size, tryout acceptance and, if you handle money, that year&rsquo;s dues and expenses. <strong>Season&rsquo;s End</strong> offers the same list as <em>&ldquo;Compare every season&rdquo;</em>.</p>
              <p>It was briefly head-coach-only. That restriction has been lifted: only people currently on the staff can open the team at all, so there was nothing left for it to protect.</p>
              <p>If you still can&rsquo;t see it, either the team has no finished seasons yet, or you&rsquo;re no longer on its staff — ask the head coach.</p>
            </>
          ),
        },
        {
          id: 'faq-insights-past-season',
          question: 'Can I look at a season that has already finished?',
          answerText: 'Yes, in three places — and there is no longer a season switcher, so you are never in doubt about which year you are reading. First: while your team is BETWEEN seasons, the whole portal is showing that finished season. You land on Season\'s End, your menu is the one you always had, and Roster, Schedule, Money, Documents and Insights all open read-only. Second: Season Wrapped for any year, from the "Past seasons" list at the foot of Insights → "How are we doing?" — each row links to that season\'s wrap-up. Third: that list itself, which puts every year\'s record, roster size, tryout acceptance and money summary side by side. What you will NOT find is a way to point the whole portal at a year your team has already moved past; once the next season starts, your screens describe the season you are running. Two Insights tiles are deliberately missing on a finished season: "Where is playing time going?" and "Who did we play?". Playing-time figures are recalculated from your saved lineups every time you open them, and your opponent notes are the book you keep today, so neither can promise to show that season as you actually saw it back then. The "Ask about your team" bar is live-season only for the same reason. Attendance has no menu line of its own; it is reached through Insights as "Who\'s showing up?", in every season.',
          keywords: ['past season insights', 'last year insights', 'finished season insights', 'old season report', 'previous season report', 'insights past season', 'switch season', 'season switcher gone', 'no season chip', 'cannot change season', 'where is the season dropdown', 'why no playing time last year', 'playing time missing', 'opponents missing', 'no ask bar past season', 'attendance past season', 'season wrapped for an old year', 'look back', 'between seasons'],
          answer: (
            <>
              <p><strong>Yes — in three places.</strong> There&rsquo;s no season switcher any more, so you&rsquo;re never in doubt about which year you&rsquo;re reading.</p>
              <p><strong>1. While your team is between seasons</strong>, the whole portal <em>is</em> that finished season. You land on <strong>Season&rsquo;s End</strong>, your menu is the one you always had, and Roster, Schedule, Money, Documents and Insights all open — read-only, with <em>Complete</em> beside the team name.</p>
              <p><strong>2. Season Wrapped for any year.</strong> Open <strong>Insights → &ldquo;How are we doing?&rdquo;</strong> and scroll to <strong>Past seasons</strong>; each row links to that year&rsquo;s wrap-up.</p>
              <p><strong>3. That list itself</strong> — every year&rsquo;s record, roster size, tryout acceptance and money summary, side by side.</p>
              <p><strong>What you won&rsquo;t find</strong> is a way to point the whole portal at a year your team has already moved past. Once the next season starts, your screens describe the season you&rsquo;re running.</p>
              <p><strong>Two tiles are deliberately missing on a finished season.</strong> <em>&ldquo;Where is playing time going?&rdquo;</em> and <em>&ldquo;Who did we play?&rdquo;</em> don&rsquo;t appear. Playing-time figures are recalculated from your saved lineups each time you open them, and your opponent notes are the book you keep <em>today</em> — neither can promise to show that season as you actually saw it. <strong>Ask about your team</strong> is live-season only for the same reason.</p>
              <p><strong>Attendance has no menu line of its own</strong> — it&rsquo;s reached through Insights as <em>&ldquo;Who&rsquo;s showing up?&rdquo;</em>, in every season.</p>
            </>
          ),
        },
        {
          id: 'faq-results-tag-filter',
          question: 'Can I see my record against just the games I tagged?',
          answerText: 'Yes, in the season you are currently running. Open Insights, then "How are we doing?" Above the game list, a row of tag chips shows every tag you have used this season, each with how many finished games carry it. Tap one to filter the list down to just those games and see the record for that tag — wins, losses, ties, and runs for/against — in place of the season-wide line. Tap "All" to go back. A tag only gets a chip once it has at least one finished game; if your team has not tagged anything yet, this row does not show at all. Tag filtering is not offered in a finished season: tags are a list you keep editing — renaming, merging and deleting them as you go — so filtering an old season by a tag you invented last week would answer a question nobody could have asked that year. The games themselves, and each game\'s tags, are still listed. See "How do I tag a game?" to start tagging.',
          keywords: ['filter by tag', 'record by tag', 'vs tag', 'tag chips', 'rivalry record', 'top in the province', 'tag filter', 'how are we doing tags', 'tags past season', 'no tag chips archive', 'why no tag filter'],
          answer: (
            <>
              <p>Yes — in the season you&rsquo;re currently running. Open <strong>Insights</strong>, then <strong>&ldquo;How are we doing?&rdquo;</strong> Above the game list, a row of <strong>tag chips</strong> shows every tag you&apos;ve used this season, each with how many finished games carry it.</p>
              <p>Tap one to filter the list down to just those games and see the record for that tag — wins, losses, ties, and runs for/against — in place of the season-wide line. Tap <strong>All</strong> to go back.</p>
              <p>A tag only gets a chip once it has at least one finished game; if your team hasn&apos;t tagged anything yet, this row doesn&apos;t show at all. See <strong>&ldquo;How do I tag a game?&rdquo;</strong> to start tagging.</p>
              <p><strong>In a finished season the chips aren&rsquo;t offered.</strong> Tags are a list you keep editing — renaming, merging and deleting them as the season runs — so filtering a past year by a tag you invented last week would answer a question nobody could have asked back then. The games themselves are all still there, and each one still shows the tags it carried.</p>
            </>
          ),
        },
        {
          id: 'faq-awards-leaderboard',
          question: "How do I see who's earned the most awards this season?",
          answerText: 'Open Insights, then "Who\'s earning it?" — a leaderboard ranked by total awards, with a breakdown per player (like "2× MVP · 1× Hustle Award"). Tap an award-type chip above it to see just that award\'s winners, and a full history below lists every award given this season with its note and a link back to the game where there is one. Give an award from a scored game\'s detail screen, or use the "Give an award" button on this page for anything not tied to one game. The count means the season your team is on only — awards from earlier years are not mixed in. When that season has finished it is a record, so there is no Give an award, no Manage award types and no way to remove a row — but you can still print a certificate, and it names the season the award was won in. See "How do I give a player an award?" to get started.',
          keywords: ['who is earning it', 'awards leaderboard', 'season awards', 'mvp leaderboard', 'award history', 'insights awards', 'past season awards', 'last year awards', 'awards from a previous season', 'awards count wrong', 'too many awards', 'awards from other seasons', 'cannot give award past season', 'print certificate past season'],
          answer: (
            <>
              <p>Open <strong>Insights</strong>, then <strong>&ldquo;Who&apos;s earning it?&rdquo;</strong> — a leaderboard ranked by total awards, with a breakdown per player (like &ldquo;2&times; MVP &middot; 1&times; Hustle Award&rdquo;).</p>
              <p>Tap an <strong>award-type chip</strong> above it to see just that award&apos;s winners, and a full <strong>history</strong> below lists every award given this season with its note and a link back to the game where there is one. <strong>&ldquo;This season&rdquo; means exactly that</strong> — if your team has run more than one season, earlier years aren&apos;t mixed into the count.</p>
              <p>Give an award from a scored game&apos;s detail screen, or use the <strong>&ldquo;Give an award&rdquo;</strong> button on this page for anything not tied to one game. See <strong>&ldquo;How do I give a player an award?&rdquo;</strong> to get started.</p>
              <p><strong>Once the season has finished, this becomes a record.</strong> There&rsquo;s no <em>Give an award</em>, no <em>Manage award types</em> and no way to remove a row — but you can still <strong>print a certificate</strong>, and it names the season the award was won in.</p>
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
      summary: 'Download the blank forms your organization publishes, then keep each family’s signed copy on the player it belongs to.',
      keywords: ['documents', 'waiver', 'medical form', 'templates', 'completion', 'premium', 'signed form', 'upload document', 'where do documents go'],
      searchText: 'documents player documents waiver medical consent code of conduct org templates team templates blank forms download hand out signed copy upload a document to a player player profile roster attach paperwork cannot upload my own team template add team form no upload button assistant coach view only documents premium team workspace organization org admin publishes who can see a signed form assistant cannot see documents section documents section missing on player needs both documents and contacts and birthdates contacts and birthdates required for signed forms medical consent privacy assistant cannot open waiver two settings decide this half of it head coaches always have both blank team forms only need documents',
      content: (
        <>
          <p>Documents are part of the <strong>Premium team workspace</strong> (the richer workspace coaches get when their team runs under a FieldLogicHQ organization). The free standalone portal doesn&apos;t include a Documents area.</p>
          <p>There are <strong>two different places</strong> paperwork lives, and it&apos;s worth knowing which is which:</p>
          <ul>
            <li><strong>The Documents page — blank forms to hand out.</strong> Your organization publishes waivers, medical consent forms and codes of conduct here. You <strong>download</strong> them and share them with your families. This page is read-only for coaches: your org admin decides what appears on it, so if you&apos;re expecting a form and don&apos;t see it, ask them.</li>
            <li><strong>The player&apos;s profile — the signed copy that comes back.</strong> Once a family returns a completed form, open that player on your <strong>Roster</strong> and upload it in their <strong>Documents</strong> section. That way the paperwork sits with the player it belongs to, instead of in your inbox.</li>
          </ul>
          <p>Files can be PDF, JPG, PNG or DOCX, up to 10&nbsp;MB each.</p>
          <p><strong>Who else can see a signed form.</strong> Because these are a family&apos;s own paperwork — often medical — an assistant coach needs <strong>both</strong> <em>Documents</em> and <em>Contacts &amp; birthdates</em> access before a player&apos;s Documents section appears for them at all. The head coach grants that pairing on the <strong>Staff</strong> page. Blank team forms are different: those only need <em>Documents</em>. Head coaches and your org admins always have both.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-documents-upload-own-template',
          question: 'Can I add my own blank form for my team?',
          answerText: 'Not from the Documents page — it shows the blank templates your organization publishes, and coaches can download from it but not add to it. Ask your org admin to publish the form if the whole club needs it. If it is just for your team, hand the form out yourself (email, group chat, on paper) and upload each signed copy to that player on your Roster, in their Documents section. That is where the completed paperwork is meant to live anyway, and it is the part that matters for knowing who has handed in what.',
          keywords: ['upload template', 'add my own form', 'team template', 'no upload button', 'cant upload', 'where is upload', 'add a document', 'photo permission form', 'publish a form'],
          answer: (
            <>
              <p>Not from the <strong>Documents</strong> page. That page holds the blank templates your <strong>organization</strong> publishes — coaches download from it, but don&apos;t add to it. If the whole club needs the form, ask your org admin to publish it there.</p>
              <p>If it&apos;s just for your team, hand the form out yourself (email, group chat, on paper) and upload each <strong>signed copy to that player</strong> on your Roster, in their <strong>Documents</strong> section. That&apos;s where completed paperwork is meant to live anyway — and it&apos;s the part that actually tells you who has handed in what.</p>
            </>
          ),
        },
        {
          id: 'faq-documents-assistant-access',
          question: 'Why can’t my assistant coach upload a signed form?',
          answerText: 'Two settings decide this, and which one you need depends on which kind of paperwork you mean. Documents on the Staff page has three levels — off, view, manage — and new assistants start at view, so the Upload and delete controls do not appear for them; switch them to manage if you want them handling paperwork. But for a player’s SIGNED forms on their profile, Documents is only half of it: the assistant also needs Contacts and birthdates. Without both, the Documents section does not appear on the player at all — so if your assistant says they cannot even see it, that is the missing half, not the manage level. Blank team forms on the Documents page only ever need Documents. Head coaches always have both.',
          keywords: ['assistant documents', 'assistant cannot upload', 'document permission', 'view only documents', 'manage documents', 'staff permissions documents', 'assistant cannot see documents', 'documents section missing', 'no documents on player', 'signed form missing', 'cannot see waiver', 'cannot open medical consent'],
          answer: (
            <>
              <p><strong>Two settings decide this</strong>, and which you need depends on which paperwork you mean.</p>
              <p><strong>Documents</strong> on the <strong>Staff</strong> page has three levels — <strong>off</strong>, <strong>view</strong>, <strong>manage</strong>. New assistants start at <strong>view</strong>, so the Upload and delete controls simply don&apos;t appear for them. Switch that assistant to <strong>manage</strong> if you want them handling paperwork.</p>
              <p>But for a player&apos;s <strong>signed</strong> forms on their profile, Documents is only half of it — the assistant also needs <strong>Contacts &amp; birthdates</strong>. Without both, the Documents section <strong>doesn&apos;t appear on the player at all</strong>. So if your assistant says they can&apos;t even see it, that&apos;s the missing half, not the manage level. (Blank team forms on the <strong>Documents</strong> page only ever need Documents.) Head coaches always have both.</p>
            </>
          ),
        },
      ],
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
