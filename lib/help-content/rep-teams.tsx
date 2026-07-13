import type { HelpPageContent } from './index';

const repTeamsHelp: HelpPageContent = {
  title: 'Rep Teams',
  role: 'Admin, Owner',
  intro: 'Rep Teams manages competitive travel teams through a franchise model — your org creates and oversees teams at the top level, while coaches operate their teams day-to-day from their team workspace. It is part of the Club plan, which includes the Premium Coaches Portal for your whole coaching staff — every team, no per-team fee. (A coach can also run a single team independently on the standalone Premium Coaches Portal.)',
  sections: [
    {
      id: 'franchise-model',
      group: 'Getting started',
      heading: 'The franchise model explained',
      summary: 'Org HQ sets up and oversees teams; coaches operate their own team day-to-day.',
      keywords: ['franchise model', 'org hq', 'coach operator', 'rep team', 'oversight'],
      searchText: 'franchise model org hq coach operator rep team oversight tryouts allocations documents program year coaches portal scoped team',
      content: (
        <>
          <p>FieldLogicHQ separates rep team management into two layers:</p>
          <ul>
            <li><strong>Org HQ (you)</strong> — creates teams, runs tryouts, sets cost allocations, publishes document templates, and controls the program-year lifecycle.</li>
            <li><strong>Coach operators</strong> — manage their assigned team day-to-day from their team workspace: roster, schedule, and team finances. Coaches see only their own team.</li>
          </ul>
          <p>This separation keeps org-level decisions centralized while giving coaches the autonomy they need to operate efficiently.</p>
        </>
      ),
    },
    {
      id: 'plans-access',
      group: 'Getting started',
      heading: 'Plans and access',
      summary: 'Rep Teams is a Club-plan module; some actions are owner/treasurer-only.',
      keywords: ['club plan', 'add-on', 'access', 'owner', 'treasurer', 'admin', 'coach access'],
      searchText: 'rep teams club plan add-on access owner treasurer admin permission cost allocation owner treasurer only coach scoped per-team billing entitlement module',
      content: (
        <>
          <p>Rep Teams is included with the <strong>Club</strong> plan. If your org doesn&apos;t have it, the module is hidden.</p>
          <p>Within the module, access varies by role:</p>
          <ul>
            <li><strong>Owners and admins</strong> — create teams and program years, run tryouts, publish document templates, and move program years through their lifecycle.</li>
            <li><strong>Owners and treasurers only</strong> — create and change <strong>cost allocations</strong>. Admins can view allocations but not create them.</li>
            <li><strong>Coaches</strong> — operate their assigned team from their team workspace, scoped to that team and program year. You don&apos;t need to make a coach a full admin to give them their team.</li>
          </ul>
        </>
      ),
    },
    {
      id: 'recipe-create-team-program-year',
      group: 'How-to recipes',
      heading: 'How to create a rep team and program year',
      summary: 'Set up the team once, then create a program year for each competitive season.',
      keywords: ['create rep team', 'program year', 'season', 'team setup', 'active year', 'team billing'],
      searchText: 'create rep team add team program year competitive season slug active draft completed archived roster tryouts documents coaches description group per-team billing club',
      content: (
        <>
          <p>Use a team record for the long-running franchise, and a program year for each season of activity.</p>
          <ol>
            <li>Go to <strong>Rep Teams</strong> and click <strong>Add Team</strong>.</li>
            <li>Enter the team name, URL slug, sport, division, colour, and an optional description. If you use team groups, pick the group here too.</li>
            <li>Open the team and create a <strong>Program Year</strong> for the upcoming season.</li>
            <li>Keep the program year in <strong>Draft</strong> while you prepare tryouts, coaches, documents, and cost allocations.</li>
            <li>Move it to <strong>Active</strong> when coaches and families should begin using it; only one program year per team should be Active at a time.</li>
            <li>At season&apos;s end, complete and archive the program year instead of overwriting it.</li>
          </ol>
          <p>On the Club plan, creating teams beyond your included count shows a prorated billing confirmation before the team is created — so you always see the cost first.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-rep-team-vs-program-year',
          question: 'What is the difference between a team and a program year?',
          answerText: 'The team is the long-running franchise. The program year is one competitive season with its own roster, tryouts, documents, schedule, and finances.',
          keywords: ['team', 'program year', 'season'],
          popular: true,
          answer: (
            <p>The <strong>team</strong> is the long-running franchise. The <strong>program year</strong> is one season with its own roster, tryouts, documents, schedule, and finances.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-open-tryouts-review-applicants',
      group: 'How-to recipes',
      heading: 'How to open tryouts and review applicants',
      summary: 'Turn on the public tryout form, process applications, and close registration when evaluations are done.',
      keywords: ['tryouts', 'open registration', 'applicants', 'offer', 'accept', 'decline', 'consent', 'compliance'],
      searchText: 'open tryouts review applicants public tryout form registration pending review extend offer accept decline close registration add applicant offer extended consent guardian consent privacy data collection PIPEDA CASL compliance consent column consent record export',
      content: (
        <>
          <p>Tryout registration belongs to a specific team program year.</p>
          <ol>
            <li>Open the team and select the correct program year, then go to <strong>Tryouts</strong>.</li>
            <li>Turn on <strong>Open Registration</strong> so families can apply from your org&apos;s public page.</li>
            <li>Review incoming applicants in <strong>Pending Review</strong>.</li>
            <li>Use <strong>Extend Offer</strong> to invite a player — the guardian gets a club-branded email with no-login <strong>Accept/Decline</strong> buttons (good for 7 days). The applicant panel then shows where the family stands: <em>awaiting response</em>, <em>family accepted</em>, <em>declined</em>, or <em>expired</em>. A family&apos;s response is recorded but never rosters the player on its own — you still confirm.</li>
            <li>Use <strong>Accept</strong> once the player is confirmed (typically after the family accepts) — this opens a short drawer that adds them to the roster (and, optionally, sets up their fees) in one step, and makes them visible to the coach. <strong>Decline</strong> sends a warm release note; <strong>Waitlist</strong> sends a waitlist note.</li>
            <li>Close registration when tryouts finish so the public form goes offline.</li>
          </ol>
          <p>The applicant list shows a <strong>Consent</strong> column: when a family submits the public form they confirm consent to data collection and email contact, and the date is captured for your records. Include it in the <strong>applicant export</strong> when you need a documented consent record.</p>
          <p>If an applicant registered outside the form, use <strong>Add Applicant</strong> so the decision history stays with the program year — note that manually added applicants won&apos;t carry a form consent record.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-tryout-consent',
          question: 'Do families consent to us collecting their information?',
          answerText: 'Yes. The public tryout form requires the parent or guardian to confirm consent before they can submit — to data collection, to email contact, and that they are the guardian and the player is eligible to try out. The Tryouts list shows a Consent column with the date it was given, and you can include the consent record in the applicant export when you need it for compliance. Applicants you enter manually with Add Applicant do not carry a form consent record.',
          keywords: ['consent', 'privacy', 'PIPEDA', 'CASL', 'compliance', 'guardian consent', 'data collection', 'consent record'],
          answer: (
            <>
              <p>Yes. The public tryout form requires the parent or guardian to confirm consent before they can submit — to data collection, to email contact, and that they are the guardian and the player is eligible to try out.</p>
              <p>The <strong>Tryouts</strong> list shows a <strong>Consent</strong> column with the date it was given, and you can include the consent record in the <strong>applicant export</strong> when you need it for compliance. Applicants you enter manually with <strong>Add Applicant</strong> won&apos;t carry a form consent record.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'recipe-accept-player-to-roster',
      group: 'How-to recipes',
      heading: 'How to accept a player onto a rep roster',
      summary: 'Move a player from tryout application to coach-visible roster — with their fees set up in the same step.',
      keywords: ['accept player', 'roster', 'offer extended', 'coach portal', 'tryout applicant', 'fees', 'dues', 'standard fee'],
      searchText: 'accept player roster tryout applicant offer extended accepted coach portal missing player pending review roster visibility accept drawer fees dues standard fee schedule installments prefilled editable optional atomic no card charge',
      content: (
        <>
          <p>A player becomes visible to the coach only after the application reaches the accepted state.</p>
          <ol>
            <li>Open the program year&apos;s <strong>Tryouts</strong> tab.</li>
            <li>Find the applicant by player name or guardian email.</li>
            <li>If the player is still pending, extend an offer first if your workflow requires it.</li>
            <li>Click <strong>Accept</strong> when the player is confirmed. A drawer opens with their details already filled in from their registration; add an optional number/position/jersey size, and choose whether to attach fees.</li>
            <li>When your team already charges dues, the drawer pre-fills your <strong>standard fee schedule</strong> (the amount and installment plan the rest of the team pays) — edit it, or turn fees off to add them later on the coach&apos;s Dues page. Fees only record what&apos;s owed; no card is charged.</li>
            <li>Confirm. The roster entry and the fee schedule save together — nothing half-finishes. Open the roster or ask the coach to refresh their workspace.</li>
            <li>If the player is still missing, confirm you accepted them in the same program year the coach is viewing.</li>
          </ol>
          <p>Declined and offer-only players do not appear on the active roster. Standalone Premium head coaches can also accept players directly from their own Decision board — the same one-step flow.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-coach-missing-rep-player',
          question: 'Why can a coach not see a player on the roster?',
          answerText: 'The player may still be pending or only offered, or the coach may be looking at a different program year. The player must be Accepted, and the coach must be viewing the same program year.',
          keywords: ['missing roster', 'coach portal', 'accepted player'],
          popular: true,
          answer: (
            <p>Check the Tryouts tab. The player must be <strong>Accepted</strong>, not just offered or pending. Also confirm the coach is viewing the same program year.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-assign-coach-access',
      group: 'How-to recipes',
      heading: 'How to give a coach access to their team',
      summary: 'Invite the coach, assign them to the correct team, and verify they only see their own program year.',
      keywords: ['coach access', 'assign coach', 'coaches portal', 'member invite', 'team access'],
      searchText: 'coach access assign coach invite coach coaches portal team program year member role missing team cannot access coach portal scoped',
      content: (
        <>
          <p>Coach access has two parts: the person needs a member account, and that account needs to be assigned to the team/program year.</p>
          <ol>
            <li>Invite the person from <strong>Members</strong> using the <strong>Coach</strong> role if they do not already have an account.</li>
            <li>Open the rep team program year and go to the coaches area.</li>
            <li>Add the coach to the correct team/program year.</li>
            <li>Ask the coach to sign in and open their team workspace.</li>
            <li>If they cannot see the team, confirm their invite was accepted and that they were assigned to the active program year.</li>
          </ol>
          <p>Coaches should not be made full admins just to operate a team. The coach assignment keeps their access scoped to the team they manage.</p>
        </>
      ),
    },
    {
      id: 'recipe-publish-document-templates',
      group: 'How-to recipes',
      heading: 'How to publish document templates for coaches',
      summary: 'Create reusable document requirements and publish them to a program year.',
      keywords: ['document templates', 'waiver', 'medical form', 'coach documents', 'publish template'],
      searchText: 'publish document templates coach documents player waiver medical consent code of conduct upload program year org-wide team-specific',
      content: (
        <>
          <p>Use document templates for forms every team or player needs.</p>
          <ol>
            <li>Open <strong>Document Templates</strong> from the Rep Teams page.</li>
            <li>Create or upload a template for the document type — waiver, medical form, code of conduct, and so on.</li>
            <li>Publish it for the appropriate program year. You can publish org-wide templates or ones scoped to a specific team.</li>
            <li>Coaches then see the published templates in their team&apos;s Documents area and can download them to share with families.</li>
          </ol>
          <p>Templates are program-year specific. Re-publish or recreate them for the next season when requirements carry forward.</p>
        </>
      ),
    },
    {
      id: 'team-groups',
      group: 'Org-level tools',
      heading: 'Organizing teams into groups',
      summary: 'Group teams by competitive tier (e.g. AA, A, Select) to filter and organize the list.',
      keywords: ['team groups', 'groups', 'competitive tier', 'filter teams'],
      searchText: 'team groups competitive tier AA A select filter organize teams create rename delete group assign team to group',
      content: (
        <>
          <p>If you run many teams, use <strong>Team Groups</strong> to organize them by tier or category (for example, AA, A, and Select). From the Rep Teams page you can create, rename, and delete groups, assign a team to a group when you create it, and filter the team list by group.</p>
        </>
      ),
    },
    {
      id: 'shared-library',
      group: 'Org-level tools',
      heading: 'Shared tags & awards library',
      summary: 'Curate game tags, money tags, and award types that every team shares — so your whole club or league speaks one vocabulary.',
      keywords: ['shared library', 'shared tags', 'shared awards', 'org tags', 'org award types', 'standardize tags', 'organization wide tags', 'game tags', 'money tags', 'award types'],
      searchText: 'shared library shared tags shared awards org tags organization wide tags money tags game tags award types standardize vocabulary across teams provincials rivalry winter dome mvp hustle blue chip curate rename merge retire admin owner shared tag every team picker',
      content: (
        <>
          <p>Coaches build their own <strong>tags</strong> (labels on games and expenses) and <strong>award types</strong> (MVP, Hustle, etc.) team by team. If you&apos;d rather every team use the same vocabulary — one &ldquo;Provincials&rdquo; game tag, one &ldquo;Winter dome&rdquo; money tag, one league-wide &ldquo;MVP&rdquo; award — curate them once in the <strong>Shared library</strong>.</p>
          <p>Open <strong>Rep Teams → Shared Library</strong>. Three lists sit side by side: <strong>Game tags</strong>, <strong>Money tags</strong>, and <strong>Award types</strong>. Add, rename, merge, or delete tags; add award types (with an icon), edit them, and retire or restore them — the same tools a coach has for their own, but applied org-wide.</p>
          <p>Whatever you add here appears in <strong>every team&apos;s</strong> picker in <strong>blue</strong> (each team&apos;s own private tags stay green, with a small legend). Coaches can <strong>apply</strong> shared tags and hand out shared awards, but they can&apos;t rename or remove them — that stays with you. A team&apos;s own tags keep working exactly as before, right alongside the shared ones.</p>
          <p>Managing the shared library is limited to <strong>owners and admins</strong>. It replaces the idea of a coach &ldquo;promoting&rdquo; their own tag — instead of collecting tags from many teams, you author the shared set from one place.</p>
        </>
      ),
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
      searchText: 'coach manages roster schedule team finances player dues installments expenses fundraisers budget season refund payment requests admin view roster allocations who does what',
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
        </>
      ),
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
