import type { HelpPageContent } from './index';
import { HelpNote } from '@/components/help/HelpBlocks';

const repTeamsHelp: HelpPageContent = {
  title: 'Rep Teams',
  role: 'Admin, Owner',
  intro: 'Rep Teams is where your club runs its competitive teams. The club owns each team — its name, group, seasons and coaches — and each team’s coaches run it day-to-day in their Coaches Portal. It is part of the Club plan, which includes the Premium Coaches Portal for your whole coaching staff — every team, no per-team fee. (A coach can also run a single team independently on the standalone Premium Coaches Portal.)',
  sections: [
    {
      id: 'franchise-model',
      group: 'Getting started',
      heading: 'What the club runs, and what the coach runs',
      summary: 'The club owns each team, its seasons and its coaches; the team’s coaches run it day-to-day in their portal.',
      keywords: ['franchise model', 'what the club sees', 'club owns', 'coach runs', 'rep team', 'oversight', 'attendance', 'lineups', 'what can the club see'],
      searchText: 'franchise model what the club sees yours to run the coach’s and you can read it the coach’s alone club owns team name division colour group seasons coaches tryout sign-ups documents allocations payment requests roster schedule results attendance lineups awards development opponents scouting practice plans cannot see attendance',
      content: (
        <>
          <p>Every team page has a <strong>What the club sees</strong> panel that says this in three columns:</p>
          <ul>
            <li><strong>Yours to run</strong> — the team&apos;s name, division, colour and group; its seasons (start, close, reopen); its coaches; tryout sign-ups; the documents families sign; allocations and payment-request decisions.</li>
            <li><strong>The coach&apos;s, and you can read it</strong> — the roster, the schedule and results, payment requests, how many families are connected, and a closed season&apos;s record, roster and staff.</li>
            <li><strong>The coach&apos;s alone</strong> — attendance, lineups, awards, player development, opponents and scouting, and practice plans.</li>
          </ul>
          <p>A team&apos;s coaches never get season buttons: the club starts and closes a club team&apos;s seasons, and the coaches are told each time.</p>
        </>
      ),
    },
    {
      id: 'plans-access',
      group: 'Getting started',
      heading: 'Plans and access',
      summary: 'Rep Teams is a Club-plan module; owners and admins run teams, seasons and coaches.',
      keywords: ['club plan', 'add-on', 'access', 'owner', 'treasurer', 'admin', 'coach access', 'team manager', 'registrar'],
      searchText: 'rep teams club plan add-on access owner treasurer admin permission cost allocation owner treasurer only coach scoped team group limit registrar team manager',
      content: (
        <>
          <p>Rep Teams is included with the <strong>Club</strong> plan. If your org doesn&apos;t have it, the module is hidden.</p>
          <ul>
            <li><strong>Owners and admins</strong> — add teams, start and close seasons, invite coaches, run tryout sign-ups and publish document templates. An admin limited to some team groups sees only those groups&apos; teams.</li>
            <li><strong>Owners and treasurers only</strong> — create and change <strong>cost allocations</strong>.</li>
            <li><strong>Coaches</strong> — run their own team in their Coaches Portal and see only that team. A coach is never made a club admin to get their team.</li>
          </ul>
          <p>A rep club doesn&apos;t need a registrar: the paperwork a registrar does elsewhere belongs to each team&apos;s <strong>team manager</strong>, whom the head coach adds from the team&apos;s Staff page.</p>
        </>
      ),
    },
    {
      id: 'team-board',
      group: 'Getting started',
      heading: 'Reading the Teams board',
      summary: 'One row per team: its season and record, head coach, roster, next event and documents — and what only the club can fix, in red.',
      keywords: ['teams board', 'health board', 'no head coach', 'no players', 'invited', 'documents column', 'next event', 'team list'],
      searchText: 'rep teams board health board one row per team season live closed record head coach no head coach invited roster no players next event documents signed of players band rows groups ungrouped archived filter phone cards',
      content: (
        <>
          <p><strong>Rep Teams</strong> lists every team, grouped by team group, one row each:</p>
          <ul>
            <li><strong>Season</strong> — Live (a season is running) or Closed, with the record (12-8-1) under it.</li>
            <li><strong>Head coach</strong> — who is in place. A red <strong>No head coach</strong> means nobody is; an amber <strong>Invited</strong> means an invitation is waiting for an answer.</li>
            <li><strong>Roster</strong> — the players on the live season. A live season with nobody on it shows a red <strong>No players</strong>.</li>
            <li><strong>Next event</strong> — the next thing on the coach&apos;s schedule.</li>
            <li><strong>Documents</strong> — how many players on the live season have signed every club template that applies to the team. A new season starts at zero, because families sign again each season.</li>
          </ul>
          <p>The team&apos;s name opens its page, and so does the arrow at the end of the row. Use the filter to see one group, <strong>Ungrouped</strong>, or <strong>Archived</strong> teams.</p>
        </>
      ),
    },
    {
      id: 'recipe-create-team-program-year',
      group: 'How-to recipes',
      heading: 'How to add a team and start its first season',
      summary: 'Add the team once, start its first season, then invite its head coach.',
      keywords: ['create rep team', 'add team', 'first season', 'program year', 'season', 'team setup', 'team details', 'archive team', 'bring back'],
      searchText: 'create rep team add team first season start the first season program year season name year public address slug sport division colour group description team details autosave saved archive team bring back team places plan limit',
      content: (
        <>
          <ol>
            <li>Go to <strong>Rep Teams</strong> and press <strong>Add team</strong>. Enter the name, public address, sport, division, group, colour and an optional description, then <strong>Add team</strong>. At your plan&apos;s team limit you&apos;re offered the larger plan, or you can archive a team you no longer run.</li>
            <li>Open the team. With no season yet, press <strong>Start the first season</strong> and give it a name and a year.</li>
            <li>Invite the team&apos;s head coach from <strong>Coaches</strong> (see How to invite a coach).</li>
          </ol>
          <p>Change a team&apos;s name, group, division, colour, sport or description in <strong>Team details</strong> on its page — it saves as you type. The division is what coaches see in their Team settings; only the club changes it. <strong>Archive team</strong> sits there too: it hides the team from your lists and frees its place on your plan, keeps its seasons and history, and <strong>Bring back</strong> undoes it.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-rep-team-vs-program-year',
          question: 'What is the difference between a team and a season?',
          answerText: 'The team is the long-running franchise. A season is one year of it, with its own roster, tryouts, schedule, documents and money. A team has one live season at a time; a closed season is kept as a record you and its coaches can open any time.',
          keywords: ['team', 'season', 'program year'],
          popular: true,
          answer: (
            <p>The <strong>team</strong> is the long-running franchise. A <strong>season</strong> is one year of it, with its own roster, tryouts, schedule, documents and money. A team has one live season at a time; a closed season is kept as a record you and its coaches can open any time.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-seasons',
      group: 'How-to recipes',
      heading: 'How to start the next season, close one, or reopen it',
      summary: 'Start next season carries the team forward; Close the season ends it for a team that isn’t coming back; Reopen undoes a close.',
      keywords: ['start next season', 'close the season', 'reopen', 'season end', 'rollover', 'what carries over', 'unsettled money', 'two seasons open'],
      searchText: 'start next season close the season reopen closed this by mistake season end rollover roll forward what carries over roster budget plan fee plan opening balance returning players history staff stays schedule tryouts documents start fresh unsettled money families owe dues money waiting to go back warns never blocks coaches are told notification two seasons open',
      content: (
        <>
          <p>A club team&apos;s seasons are the club&apos;s to change. The team page carries the doors, and the team&apos;s coaches are told each time.</p>
          <ul>
            <li><strong>Start next season</strong> closes the current season and starts the next one with the team in it: the roster, the budget plan and the fee plan (both optional), the opening balance, and each returning player&apos;s history. The coaching staff stays. The schedule, tryouts and player documents start fresh.</li>
            <li><strong>Close the season</strong> ends it and starts nothing — for a team that isn&apos;t coming back. Nothing is deleted; the season becomes a record.</li>
            <li><strong>Reopen</strong> — on a closed team&apos;s page, &ldquo;Closed this by mistake?&rdquo; brings the season back. It&apos;s offered only while no season is live.</li>
          </ul>
          <p>If families still owe dues, or money is waiting to go back to them, the window says how many before you go ahead — it never stops you. The head coach settles those in the Coaches Portal. Starting a season can&apos;t be undone, so the window says what it closes first.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-two-seasons-open',
          question: 'Why does a team say it has two seasons open?',
          answerText: 'An older way of adding a season could leave two open at once. A club team’s next season can’t start while two are open, so the team page asks you to close one of them first. Nothing was changed.',
          keywords: ['two seasons open', 'cannot start', 'close one'],
          answer: (
            <p>An older way of adding a season could leave two open at once. A club team&apos;s next season can&apos;t start while two are open, so the team page asks you to close one of them first. Nothing was changed.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-open-tryouts-review-applicants',
      group: 'How-to recipes',
      heading: 'How to open tryouts and review applicants',
      summary: 'Tryouts run on the team’s live season: open sign-ups, share the team’s link, and decide in each applicant’s window.',
      keywords: ['tryouts', 'open sign-ups', 'close sign-ups', 'applicants', 'offer', 'waitlist', 'accept', 'decline', 'consent', 'compliance', 'no emails to families', 'tell families yourself', 'tryouts are open', 'tryout link', 'too many attempts', 'copy link'],
      searchText: 'open tryouts review applicants sign-ups open sign-ups close sign-ups copy link team tryout address public tryout form tryouts are open card front page where do families apply family cannot submit too many attempts pending review extend offer waitlist add to roster decline final mark withdrawn add applicant consent guardian privacy PIPEDA CASL export no emails sent to families decisions recorded only you tell families yourself closed season record coach runs the tryout same list',
      content: (
        <>
          <p>A tryout belongs to the team&apos;s <strong>live season</strong> — the same list the coach sees in their portal, where they run the sessions, scoring and decisions.</p>
          <ol>
            <li>Open the team and go to <strong>Tryouts</strong>. In <strong>Sign-ups</strong>, press <strong>Open sign-ups</strong>. While they are open, your club&apos;s public front page shows a <strong>Tryouts are open</strong> card, and <strong>Copy link</strong> gives you the team&apos;s own tryout address — it names the team, so it keeps working from one season to the next.</li>
            <li>Applications arrive in <strong>Pending review</strong>. Open one to decide: <strong>Extend offer</strong>, <strong>Waitlist</strong>, <strong>Add to roster</strong> once the family says yes, or <strong>Decline</strong>. A decline is final, so it asks first. Every decision is recorded and <strong>nothing is emailed</strong> — you reach the family yourself.</li>
            <li>Press <strong>Close sign-ups</strong> when you&apos;re done; the address then tells families sign-ups aren&apos;t open.</li>
          </ol>
          <p>A closed season&apos;s tryout is a record: no sign-ups and no decisions. To take sign-ups for next year, start the next season first. The list shows each family&apos;s <strong>Consent</strong> date, and <strong>Export</strong> gives the consent record too. Use <strong>Add applicant</strong> for someone who applied outside the form (they carry no form consent).</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tryout-consent',
          question: 'Do families consent to us collecting their information?',
          answerText: 'Yes. The public tryout form requires the parent or guardian to confirm two things before they can submit: consent to data collection, and that they are the guardian and the player is eligible to try out. Emails about club news and future seasons are a separate OPTIONAL box, unchecked by default — Canada\'s anti-spam rules (CASL) treat that as marketing consent, and it is never a condition of applying. The only email the form sends is one confirmation that the application was received — transactional, so it goes regardless of that optional box, and the form says so plainly. Offers, waitlist moves and decisions are never emailed by us; you reach the family directly. The Tryouts list shows a Consent column with the date, and the applicant export includes the consent record plus the news-email answer. Applicants you enter manually with Add applicant do not carry a form consent record.',
          keywords: ['consent', 'privacy', 'PIPEDA', 'CASL', 'compliance', 'guardian consent', 'data collection', 'consent record', 'marketing consent', 'news email', 'optional email', 'anti-spam'],
          answer: (
            <>
              <p>Yes. The public tryout form requires the parent or guardian to confirm <strong>two</strong> things before they can submit: consent to data collection, and that they&apos;re the guardian and the player is eligible to try out.</p>
              <p>Emails about <strong>club news and future seasons</strong> are a separate <strong>optional</strong> box, unchecked by default — Canada&apos;s anti-spam rules (CASL) treat that as marketing consent, and it&apos;s never a condition of applying. The only email the form sends is <strong>one confirmation that the application was received</strong> — transactional, so it goes regardless of that box, and the form says so plainly. Offers, waitlist moves and decisions are <strong>never</strong> emailed by us; you reach the family directly.</p>
              <p>The <strong>Tryouts</strong> list shows a <strong>Consent</strong> column with the date, and the <strong>applicant export</strong> includes the consent record plus the news-email answer. Applicants you enter manually with <strong>Add applicant</strong> won&apos;t carry a form consent record.</p>
            </>
          ),
        },
        {
          id: 'faq-tryout-too-many-attempts',
          question: 'A family says the tryout form told them “Too many attempts.” What happened?',
          answerText: 'The public tryout form limits how many times it can be sent from one internet connection, and how many confirmation emails one address can receive, within an hour. It stops automated abuse, such as someone using the form to flood a stranger\'s inbox. A family normally only meets it when many applications go in from the same connection in a short time, for example several families applying on one shared tablet, or the same email address sent again and again. Ask them to wait a few minutes and try again. If you are taking applications in person on one device, enter them yourself with Add applicant, which has no such limit (manually added applicants do not carry a form consent record).',
          keywords: ['too many attempts', 'try again later', 'form limit', 'cannot submit', 'form blocked', 'rate limit'],
          answer: (
            <>
              <p>The public tryout form limits how many times it can be sent from one internet connection, and how many confirmation emails one address can receive, within an hour. It stops automated abuse, such as someone using the form to flood a stranger&apos;s inbox.</p>
              <p>A family normally meets it only when many applications go in from the same connection in a short time (several families on one shared tablet, say) or the same email address is sent again and again. Ask them to wait a few minutes and try again.</p>
              <p>Taking applications in person on one device? Enter them yourself with <strong>Add applicant</strong>, which has no such limit. Manually added applicants don&apos;t carry a form consent record.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-accept-player-to-roster',
      group: 'How-to recipes',
      heading: 'How to accept a player onto a rep roster',
      summary: 'Add to roster in the applicant’s window puts the player on the live season’s roster in one step. Fees are set later, from Money.',
      keywords: ['accept player', 'add to roster', 'roster', 'offer extended', 'coach portal', 'tryout applicant', 'fees', 'dues'],
      searchText: 'accept player add to roster tryout applicant offered coach portal missing player pending review roster visibility one step no fees at accept fees are set later dues from money depends on roster size live season',
      content: (
        <>
          <ol>
            <li>Open the team&apos;s <strong>Tryouts</strong> and open the applicant.</li>
            <li>If they&apos;re still pending, <strong>Extend offer</strong> first if your club works that way.</li>
            <li>Press <strong>Add to roster</strong> once the family says yes. The player is on the live season&apos;s roster at once, and the coach sees them.</li>
          </ol>
          <p><strong>No fees are set here</strong> — what a family owes usually depends on the final roster size, so dues are set afterwards from the team&apos;s Money screens, for everyone at once. Declined and offered players don&apos;t appear on the roster.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-coach-missing-rep-player',
          question: 'Why can a coach not see a player on the roster?',
          answerText: 'The player may still be pending or only offered. They must be added to the roster from their tryout window. Tryouts and the roster both belong to the team’s live season, so the coach and the club always look at the same one.',
          keywords: ['missing roster', 'coach portal', 'accepted player'],
          popular: true,
          answer: (
            <p>Check the team&apos;s <strong>Tryouts</strong>: the player must be added to the roster, not just offered or pending. Tryouts and the roster both belong to the team&apos;s live season, so the coach and the club always look at the same one.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-assign-coach-access',
      group: 'How-to recipes',
      heading: 'How to invite a coach',
      summary: 'Invite a head coach or an assistant from the team’s Coaches page. They get an email; their access starts when they accept.',
      keywords: ['invite a coach', 'head coach', 'assistant coach', 'coach access', 'assign coach', 'coaches portal', 'remove coach', 'no head coach', 'resend', 'cancel invitation'],
      searchText: 'invite a coach head coach assistant coach coaches page who are they email link 7 days access starts when they accept between seasons pending invitation resend cancel remove coach last head coach no head coach team managers treasurers helpers staff page require admin approval assistant coaches coach access coach role members',
      content: (
        <>
          <ol>
            <li>Open the team and go to <strong>Coaches</strong>, then press <strong>Invite a coach</strong>.</li>
            <li>Enter their email and choose <strong>Who are they?</strong> — <strong>Head coach</strong> (everything in the team&apos;s Coaches Portal) or <strong>Assistant coach</strong> (the portal&apos;s everyday tools; the head coach can change what they open). Press <strong>Send invite</strong>.</li>
            <li>They get an email with a link that works for 7 days. When they accept, they land on the team. Someone who already has a FieldLogicHQ account can also accept from their home page.</li>
          </ol>
          <p>It works between seasons, because coaches belong to the team, not to a season. A waiting invitation shows <strong>Resend</strong> and <strong>Cancel</strong>. Open a person to see their role and what they can open, and to <strong>Remove</strong> them — it asks first, and says so when the team would be left with no head coach. Team managers, treasurers and helpers are added by the head coach from the team&apos;s Staff page. There is no Coach role on the Members page.</p>
        </>
      ),
    },
    {
      // Club Tier Stage 2, B04 / Ask 2 (2026-09-29): was Organization › "Coaches portal links" (help
      // org.tsx recipe-review-team-link-request) — the Basic visibility link and the FieldLogicHQ step
      // are retired. ⚖ The coach's own plan: "won't be charged again", never a refund (owner 2026-09-28).
      id: 'recipe-bring-in-coach-team',
      group: 'How-to recipes',
      heading: 'How to bring a coach’s own team into the club',
      summary: 'When a coach already runs their team on their own Coaches Portal, bring the whole team in: its records, and its staff with what each of them can open.',
      keywords: ['bring in a coach’s team', 'coach’s own team', 'own coaches portal', 'standalone portal', 'join the club', 'move a team', 'coaches portal links', 'coach bridge', 'team place', 'waiting on you'],
      searchText: 'bring in a coachs team coach runs their own coaches portal standalone premium team join the club move a team into the club send request coach email waiting on you approve type the team name decline withdraw team place plan limit included everything comes with it seasons roster schedule results practices lineups attendance awards development tryouts documents money records staff cannot be undone coaches portal links',
      links: [
        { label: 'Bring in a coach’s team', href: '../rep-teams/bring-in' },
      ],
      content: (
        <>
          <p>A coach who runs their team on their own FieldLogicHQ Coaches Portal can bring it into the club. Everything the team built comes with it — its seasons, roster, schedule and results, practices, lineups, attendance, awards, player development, tryouts, documents and money records — and its staff, with what each of them can open.</p>
          <ol>
            <li>Open <strong>Rep Teams › Bring in a coach&apos;s team</strong>.</li>
            <li>Under <strong>Ask a coach to bring in their team</strong>, enter the coach&apos;s email and press <strong>Send request</strong>. The coach answers from their own portal.</li>
            <li>If the coach asks first, the request waits under <strong>Waiting on you</strong>. Before any button it shows what it costs the club (one of your team places, included in your plan), what happens to the coach&apos;s own plan, and what comes with the team.</li>
            <li>Press <strong>Approve and bring in</strong>, type the team&apos;s name to confirm, and the team moves in there and then.</li>
          </ol>
          <p>Nothing moves until both of you say yes, and the move can&apos;t be undone. The coach keeps coaching the team, now as one of the club&apos;s teams, and from then on the club starts and closes its seasons.</p>
          <p>Adding a new coach to a team you already have is different: use <strong>Invite a coach</strong> on that team&apos;s Coaches page.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-bring-in-coach-plan',
          question: 'What happens to the coach’s own Coaches Portal plan?',
          answerText: 'The coach won’t be charged for their own Coaches Portal again. It stops the moment the move completes, and the team is included in your plan from then on.',
          keywords: ['coach plan', 'coach subscription', 'charged', 'coach billing'],
          popular: true,
          answer: (
            <p>The coach won&apos;t be charged for their own Coaches Portal again. It stops the moment the move completes, and the team is included in your plan from then on.</p>
          ),
        },
        {
          id: 'faq-bring-in-at-limit',
          question: 'What if we are at our plan’s team limit?',
          answerText: 'Bringing a team in uses one of your plan’s team places. At the limit, Approve offers the move to a larger plan, or you can archive a team you no longer run first.',
          keywords: ['team limit', 'team places', 'cap', 'full'],
          answer: (
            <p>Bringing a team in uses one of your plan&apos;s team places. At the limit, <strong>Approve</strong> offers the move to a larger plan, or you can archive a team you no longer run first.</p>
          ),
        },
        {
          id: 'faq-bring-in-tournament-waits',
          question: 'Why is there no Approve button on a request?',
          answerText: 'The coach’s own tournament is still running. It stays with the coach’s own portal and does not move, so the move waits until it is finished or archived.',
          keywords: ['no approve', 'tournament', 'waiting'],
          answer: (
            <p>The coach&apos;s own tournament is still running. It stays with the coach&apos;s own portal and does not move, so the move waits until it is finished or archived.</p>
          ),
        },
        {
          id: 'faq-bring-in-who',
          question: 'Who can bring a coach’s team into the club?',
          answerText: 'The club’s owner and admins. On the coach’s side, the team’s head coach.',
          keywords: ['who can', 'owner', 'admin', 'head coach'],
          answer: (
            <p>The club&apos;s owner and admins. On the coach&apos;s side, the team&apos;s head coach.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-publish-document-templates',
      group: 'How-to recipes',
      heading: 'How to publish document templates for coaches',
      summary: 'Upload a form once and say which teams it applies to — every team, or one. It stays in force, season after season, until you switch it off.',
      keywords: ['document templates', 'waiver', 'medical form', 'medical consent', 'code of conduct', 'coach documents', 'publish template', 'applies to', 'switch off', 'every team'],
      searchText: 'publish document templates upload template waiver medical consent code of conduct applies to every team one team switch off switch on download delete families sign again each season documents column board signed',
      content: (
        <>
          <ol>
            <li>Open <strong>Rep Teams › Document templates</strong> and press <strong>Upload template</strong>.</li>
            <li>Give it a name and a type, choose <strong>Applies to</strong> — <strong>Every team</strong>, or one of your teams — and pick the file (PDF, JPG, PNG or Word, up to 10 MB). Press <strong>Upload</strong>.</li>
            <li>The coaches of every team it applies to see it in their team&apos;s Documents area, to share with families.</li>
          </ol>
          <p>A template isn&apos;t tied to a season: it applies until you switch it off. Families sign again each season, which is why the board&apos;s Documents count starts at zero on a new season. Open a template to <strong>Download</strong> it, change who it applies to, <strong>Switch off</strong> or on, or <strong>Delete</strong> it (which asks first).</p>
        </>
      ),
    },
    {
      id: 'team-groups',
      group: 'Org-level tools',
      heading: 'Organizing teams into groups',
      summary: 'Group teams by competitive tier (e.g. AA, A, Select) to filter and organize the list.',
      keywords: ['team groups', 'groups', 'competitive tier', 'filter teams', 'ungrouped'],
      searchText: 'team groups competitive tier AA A select boys girls filter organize teams create rename delete group assign team to group change a team group team details ungrouped archived teams without a group no group all groups band rows cannot delete group with teams',
      content: (
        <>
          <p>If you run many teams, use team groups to organize them by tier or category (for example Boys and Girls, or AA and A). On Rep Teams, <strong>Team groups</strong> adds, renames and deletes groups; the board shows each group as its own band, and the filter shows one group, <strong>Ungrouped</strong>, or <strong>Archived</strong> teams. Pick a new team&apos;s group when you add it, or change a team&apos;s group in <strong>Team details</strong> on its page. A group that still holds a team can&apos;t be deleted — move its teams first.</p>
        </>
      ),
    },
    {
      id: 'shared-library',
      group: 'Org-level tools',
      heading: 'Shared library: tags, awards & opponent books',
      summary: 'Curate game tags, money tags, and award types that every team shares — and decide whether your teams may share their opponent scouting books with each other.',
      keywords: ['shared library', 'shared tags', 'shared awards', 'org tags', 'org award types', 'standardize tags', 'organization wide tags', 'game tags', 'money tags', 'award types',
        // Club Shared Book — an admin looks for this by what a coach asked them for ("let the
        // teams share scouting"), not by the feature's name. Search reads keywords, not prose.
        'share opponent books', 'club shared book', 'teams share scouting', 'scouting across teams',
        'opponent book sharing', 'let coaches see each other', 'club scouting memory'],
      searchText: 'shared library shared tags shared awards org tags organization wide tags money tags game tags award types standardize vocabulary across teams provincials rivalry winter dome mvp hustle blue chip curate rename merge retire admin owner shared tag every team picker teams can share their opponent books with each other club shared book scouting across teams opponent book sharing switch off by default two switches admin enables head coach opts in each team decides read only cannot edit another team notes labelled with team and writer see theirs while sharing yours stop sharing immediately never leaves the organization club plan only',
      content: (
        <>
          <p>Coaches build their own <strong>tags</strong> (labels on games and expenses) and <strong>award types</strong> (MVP, Hustle, etc.) team by team. If you&apos;d rather every team use the same vocabulary — one &ldquo;Provincials&rdquo; game tag, one &ldquo;Winter dome&rdquo; money tag, one league-wide &ldquo;MVP&rdquo; award — curate them once in the <strong>Shared library</strong>.</p>
        </>
      ),
      subtopics: [
        {
          id: 'shared-library-curate',
          title: 'Curating the shared set',
          content: (
            <>
              <p>Open <strong>Rep Teams → Shared Library</strong>. Three lists sit side by side: <strong>Game tags</strong>, <strong>Money tags</strong>, and <strong>Award types</strong>. Add, rename, merge, or delete tags; add award types (with an icon), edit them, and retire or restore them — the same tools a coach has for their own, but applied org-wide.</p>
              <p>Managing the shared library is limited to <strong>owners and admins</strong>. It replaces the idea of a coach &ldquo;promoting&rdquo; their own tag — instead of collecting tags from many teams, you author the shared set from one place.</p>
              <p>Coaches can <strong>see</strong> the shared set from their side — shared tags are listed <strong>read-only</strong> in every team&apos;s tag manager and under the team&apos;s <strong>Settings → Tags</strong>, each marked &ldquo;Shared by your club&rdquo; — so a rename here reaches them with no surprises.</p>
            </>
          ),
        },
        {
          id: 'shared-library-coach-view',
          title: 'What coaches see, and what they can change',
          content: (
            <p>A shared tag or award type reaches every coach in the organization the moment you create it. It appears in <strong>every team&apos;s</strong> picker in <strong>blue</strong> (each team&apos;s own private tags stay green, with a small legend). Coaches can <strong>apply</strong> shared tags and hand out shared awards, but they can&apos;t rename or remove them — that stays with you. A team&apos;s own tags keep working exactly as before, right alongside the shared ones.</p>
          ),
        },
        {
          id: 'shared-library-opponent-books',
          title: 'Opponent books: letting your teams pool what they know (Club plan)',
          content: (
            <>
              <p>At the top of the same page sits <strong>&ldquo;Teams can share their opponent books with each other&rdquo;</strong>. Off by default. Turn it on and each head coach gets a switch of their own in <strong>Team settings</strong> — nothing is shared until a coach opts their team in, so no coach&apos;s candid notes become club-visible by surprise.</p>
              <p>Once two teams are sharing, each sees a labelled, <strong>read-only</strong> &ldquo;From your club&rdquo; section on an opponent&apos;s page: the other team&apos;s record, book line and observations, each signed with the team and the writer. No team can edit or delete another team&apos;s notes — curation stays with the coach who wrote them. A coach sees the club&apos;s books only <em>while</em> sharing their own, and switching off removes their book from everyone else&apos;s pages straight away.</p>
              <HelpNote variant="info" title="It never crosses your organization">Another club&apos;s books are never visible here, and yours are never visible there. This switch is part of the <strong>Club plan</strong>; on other plans it isn&apos;t shown.</HelpNote>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-shared-library',
          question: 'How do I make one set of tags or awards for every team?',
          answer: (
            <p>Go to <strong>Rep Teams → Shared Library</strong> and add them under <strong>Game tags</strong>, <strong>Money tags</strong>, or <strong>Award types</strong>. Anything you add shows in every team&apos;s picker in <strong>blue</strong>; coaches can apply it but only you (an owner or admin) can rename, merge, retire, or remove it. Each team&apos;s own tags still work alongside the shared ones. This is the org-wide alternative to each team inventing its own near-duplicate labels.</p>
          ),
          answerText: 'Go to Rep Teams then Shared Library and add them under Game tags, Money tags, or Award types. Anything you add shows in every team\'s picker in blue; coaches can apply it but only an owner or admin can rename, merge, retire, or remove it. Each team\'s own tags still work alongside the shared ones. This is the org-wide alternative to each team inventing its own near-duplicate labels. Managing the shared library is limited to owners and admins.',
          keywords: ['shared library', 'org wide tags', 'standardize tags', 'shared awards', 'every team same tags', 'promote tag'],
        },
        {
          id: 'faq-club-book-sharing',
          question: 'A coach asked me to let our teams see each other’s scouting notes. How?',
          answer: (
            <>
              <p>Go to <strong>Rep Teams → Shared Library</strong> and turn on <strong>&ldquo;Teams can share their opponent books with each other&rdquo;</strong>. That switch alone shares nothing — it gives each head coach a switch of their own in <strong>Team settings</strong>, and only the teams that opt in take part.</p>
              <p>Once two teams are sharing, each sees the other&apos;s record, book line and observations on an opponent&apos;s page, labelled with the team and the writer, and <strong>read-only</strong> — nobody can edit or delete another team&apos;s notes. A coach sees the club&apos;s books only while sharing their own, and switching off removes their book from everyone else&apos;s pages straight away.</p>
              <p>It never crosses your organization, and it&apos;s part of the <strong>Club plan</strong> — on other plans the switch isn&apos;t shown.</p>
            </>
          ),
          answerText: 'Go to Rep Teams then Shared Library and turn on "Teams can share their opponent books with each other". That switch alone shares nothing — it gives each head coach a switch of their own in Team settings, and only the teams that opt in take part. Once two teams are sharing, each sees the other\'s record, book line and observations on an opponent\'s page, labelled with the team and the writer, and read-only: nobody can edit or delete another team\'s notes. A coach sees the club\'s books only while sharing their own, and switching off removes their book from everyone else\'s pages straight away. It never crosses your organization, and it is part of the Club plan — on other plans the switch is not shown. Only owners and admins can change it.',
          keywords: ['share opponent books', 'teams share scouting', 'club shared book', 'scouting across teams', 'let coaches see each other', 'opponent book sharing', 'club scouting memory'],
        },
      ],
    },
    {
      id: 'cost-allocations',
      group: 'Org-level tools',
      heading: 'Cost allocations',
      summary: 'Split a shared expense across teams with installments — created by owners and treasurers.',
      keywords: ['cost allocation', 'shared expense', 'team splits', 'installments', 'collected', 'outstanding'],
      searchText: 'cost allocation shared expense diamond rental insurance tournament fees team splits fixed dollar percentage sessions installments due dates collected outstanding owner treasurer',
      content: (
        <>
          <p>Cost allocations split a shared expense (diamond rental, insurance, tournament fees) across one or more teams for a program year. Creating allocations is limited to <strong>owners and treasurers</strong>.</p>
          <p>Go to <strong>Cost Allocations</strong> and click <strong>New Allocation</strong>. The wizard has three steps:</p>
          <ol>
            <li><strong>Details</strong> — enter a description and the total shared amount. Optionally link it to an org ledger entry.</li>
            <li><strong>Team splits</strong> — assign each team&apos;s share as a fixed dollar amount, a percentage of the total, or by number of sessions. Set a due date, or break it into multiple installments with their own dates.</li>
            <li><strong>Review</strong> — confirm before saving.</li>
          </ol>
          <p>Once created, each coach sees their team&apos;s allocation as a budget target. The Allocations list shows total, collected, and outstanding amounts so you can track payment status across all teams.</p>
        </>
      ),
    },
    {
      id: 'payment-requests',
      group: 'Org-level tools',
      heading: 'Payment requests',
      summary: 'Review money-to-org and reimbursement requests coaches submit, and approve or deny each.',
      keywords: ['payment requests', 'reimbursement', 'approve', 'deny', 'coach request'],
      searchText: 'payment requests reimbursement coach submit money to org money from org approve deny reason queue review',
      content: (
        <>
          <p>Coaches can submit <strong>payment requests</strong> to the org — for example, money owed to the organization or a reimbursement they&apos;re owed. The Payment Requests page is your queue to review each request and <strong>approve</strong> or <strong>deny</strong> it (with a reason). It keeps the money conversation with coaches in one auditable place instead of email.</p>
        </>
      ),
    },
    {
      id: 'coach-finances',
      group: 'Org-level tools',
      heading: 'What coaches manage (and what you see)',
      summary: 'Coaches run roster, schedule, and team finances; admins oversee allocations and can view rosters.',
      keywords: ['coach', 'team finances', 'dues', 'budget', 'who does what', 'roster'],
      searchText: 'coach manages roster schedule team finances player dues installments expenses fundraisers budget season refund payment requests admin view roster allocations who does what print the roster printable roster roster pdf export program year roster grouped by standing counts no dates of birth no guardian contacts club paper',
      links: [
        { label: 'Coaches Portal guide', href: '../help/coaches' },
      ],
      content: (
        <>
          <p>After a player is accepted through tryouts, the coach sees and manages them from their team workspace. Coaches run the day-to-day:</p>
          <ul>
            <li>Team schedule (games, practices, events) and the roster.</li>
            <li>Team finances — player dues and installments, expenses, fundraisers, a season budget, and payment requests to the org.</li>
          </ul>
          <p>As an admin you oversee the structure: team and program-year setup, tryouts, document templates, and program-year status. <strong>Cost allocations are owner/treasurer-only.</strong> Admins can view rosters but coaches own the day-to-day team operations. For the coach&apos;s view, see the <a href="../help/coaches">Coaches Portal guide</a>.</p>
          <p>The program-year roster exports as a spreadsheet or as a <strong>printable roster</strong> on your club&apos;s paper — numbers, names and positions, grouped by each player&apos;s standing with a count on every heading. Like the applicant list, it carries <strong>no dates of birth and no guardian contacts</strong>; those stay in the spreadsheet.</p>
        </>
      ),
    },
    {
      // Chunk D Slice 3. The club's only window onto family adoption. Deliberately documented
      // as COUNTS — an admin who expects to click through to a list of parents needs to be told
      // plainly that there isn't one, and why.
      id: 'family-adoption',
      group: 'Org-level tools',
      heading: 'Seeing which teams have families connected',
      summary: 'Each team card shows how many families are connected and whether anyone is waiting on a coach — counts only, never who.',
      keywords: ['families', 'family', 'connected families', 'guardians', 'waiting', 'requests waiting', 'family access', 'adoption', 'which teams are using it', 'parents connected', 'rep teams list'],
      searchText: 'families connected count per team rep teams list card guardians waiting requests pending a coach club wide line how many families across teams adoption read only counts never names never email addresses coaches keep the contacts premium coaches portal family access hidden when zero',
      links: [
        { label: 'Coaches Portal guide — families and the season recap', href: '../help/coaches#premium-family-access' },
      ],
      content: (
        <>
          <p>On your <strong>Rep Teams</strong> list, a team that has started connecting families shows two extra numbers on its card:</p>
          <ul>
            <li><strong>Families</strong> — how many parents or guardians are connected to that team&apos;s players.</li>
            <li><strong>Waiting</strong> — a connection that needs the coach&apos;s say-so before it&apos;s live (a parent who accepted an invite from a different email address than the one the coach sent it to). Rare, but worth a glance: it&apos;s the only place a stalled connection is visible from outside the team.</li>
          </ul>
          <p>A club-wide line under the page title totals the same thing across every team, so you can see at a glance how far the feature has actually spread.</p>
          <p><strong>These are counts, and only counts.</strong> No name, email address or relationship appears here, and there&apos;s nothing to click through to — the club sees adoption, the coach keeps the contacts. The numbers are hidden on a team that hasn&apos;t connected anyone, so a list of teams that never turned it on isn&apos;t a column of zeros.</p>
          <p>Family access is a <strong>Premium Coaches Portal</strong> feature and is set up by the coach on their own team — see the <a href="../help/coaches#premium-family-access">Coaches Portal guide</a>.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-family-adoption-who',
          question: 'Can I see which families are connected to a team?',
          answerText: 'No. The Rep Teams list shows counts only — how many families are connected to each team, and how many requests are waiting on a coach. There is no list of names or email addresses behind those numbers, by design: the coach approves and manages their own team\'s families, and the club sees whether it is being used, not who is in it. If you need to reach a family, that goes through their coach.',
          keywords: ['who is connected', 'list of families', 'family names', 'parent emails', 'see the families'],
          answer: (
            <>
              <p>No. The list shows <strong>counts only</strong> — how many families each team has connected, and how many requests are waiting on a coach. There&apos;s no list of names or addresses behind those numbers.</p>
              <p>That&apos;s deliberate: the coach approves and manages their own team&apos;s families, and the club sees <em>whether</em> it&apos;s being used, not <em>who</em> is in it. If you need to reach a family, that goes through their coach.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'team-urls-past',
      group: 'Org-level tools',
      heading: 'Team URLs and past seasons',
      summary: 'Rename team URLs in bulk, and review archived program years from past seasons.',
      keywords: ['rename team url', 'slug', 'past teams', 'archived', 'history'],
      searchText: 'rename team url slug bulk rename past teams archived program years history previous seasons',
      content: (
        <>
          <p>Two housekeeping tools live alongside the team list:</p>
          <ul>
            <li><strong>Rename Team URLs</strong> — update team URL slugs (in bulk) when names or branding change, so public links stay tidy.</li>
            <li><strong>Past program years</strong> — review archived seasons. Completed and archived program years keep their rosters, schedules, and finances as history.</li>
          </ul>
        </>
      ),
    },
  ],
};

export default repTeamsHelp;
