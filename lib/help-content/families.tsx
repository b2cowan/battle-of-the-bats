import type { HelpPageContent } from './index';

/**
 * Families — club-admin household records (Families Book P2, 2026-08-17).
 * One guide, two audiences (customer hub + platform-admin mirror).
 * Plan-gated: League Plus and Club bands carry the module; the AREA is also
 * behind a per-member Families permission that is off for every role.
 */
const familiesHelp: HelpPageContent = {
  title: 'Families',
  role: 'Club and league administrators with the Families permission',
  intro:
    'Families is your club’s book of households: every parent named anywhere in your programs, ' +
    'their children across rep teams and house league, what they owe, what they’ve agreed to, and ' +
    'how to reach them — including by an email address they no longer use.',
  searchPlaceholder: 'Search: worklist, duplicates, opt-out, export, guardian…',
  sections: [
    {
      id: 'families-what-it-is',
      group: 'Getting started',
      heading: 'What Families is, and who can open it',
      summary: 'A household book across both programs, behind its own permission.',
      keywords: ['families', 'permission', 'access', 'grant', 'household', 'who can see'],
      searchText: 'families area access permission grant module off by default owner members capability',
      content: (
        <>
          <p>
            Most records in the system belong to a team, a season, or a tournament. Families is the
            one place organized around the <strong>household</strong>: one page per parent, joining
            everything your club holds about their children across rep teams and house league.
          </p>
          <p>
            Because it concentrates contact details, consent, and balances for every family in one
            searchable place, it is <strong>off for everyone by default</strong> &mdash; including
            admins. Owners always have it. Anyone else needs a deliberate, per-person grant:
          </p>
          <ol>
            <li>Open <strong>Organization Admin &rarr; Members</strong>.</li>
            <li>Choose the member and open <strong>Manage member</strong>.</li>
            <li>Under <strong>Module access</strong>, set the <strong>Families</strong> row to <strong>Grant</strong>.</li>
          </ol>
          <p>
            Without the grant there is no Families tile at all &mdash; nothing greyed out, nothing to
            click. Available on League Plus and Club plans.
          </p>
        </>
      ),
    },
    {
      id: 'families-worklist',
      group: 'Working the book',
      heading: 'The worklist: who needs attention',
      summary: 'Lenses for owed money, missing forms, missing consent, and children with no family on file.',
      keywords: ['worklist', 'owes money', 'missing forms', 'no consent', 'not back', 'no family on file', 'chased', 'search', 'former email'],
      searchText: 'lens filter chip reminded never registration unpaid search phone former old email address find family',
      content: (
        <>
          <p>
            The landing page is a set of questions, not an alphabetical list. Each chip is a lens with
            a live count:
          </p>
          <ul>
            <li><strong>No family on file</strong> &mdash; children whose roster row or registration names no guardian (or an address too broken to email). These rows are children, not families; each links to the roster or registration where guardian details are fixed. On a new club this is usually the biggest list, and clearing it is what fills the book.</li>
            <li><strong>Owes money</strong> &mdash; families with unpaid rep dues installments, with a <strong>Chased</strong> column showing when a dues reminder last reached them (or &ldquo;Never&rdquo;). House-league families with unpaid registrations appear here too, shown as &ldquo;registrations unpaid&rdquo; rather than a dollar figure.</li>
            <li><strong>Missing forms</strong> &mdash; rep children missing a required team document (waiver, medical). House league keeps no forms, so league children never appear here.</li>
            <li><strong>No consent on file</strong> &mdash; families for whom the club holds no recorded consent. This is a fact about your records, not the family&rsquo;s behaviour.</li>
            <li><strong>Not back this season</strong> &mdash; families with history but nothing current: your retention list.</li>
          </ul>
          <p>
            Search matches a parent&rsquo;s name, a child&rsquo;s name, a phone number, and <strong>every
            email address ever seen for the family</strong> &mdash; so a parent who changed addresses is
            still found by the old one.
          </p>
        </>
      ),
      faqs: [
        {
          id: 'faq-no-family-on-file',
          question: 'Why does a child show under "No family on file"?',
          answer: (
            <p>
              Their roster row or registration names no guardian email, or the address on it is not
              usable. Add or fix the guardian email where it lives &mdash; the roster row or the
              registration &mdash; and the family appears in the book the next time the area loads.
            </p>
          ),
          answerText:
            'The child’s roster row or registration names no guardian email or the address is unusable. Fix it on the roster or registration and the family appears on the next load.',
          keywords: ['no family', 'missing guardian', 'no guardian', 'fix'],
          popular: true,
        },
      ],
    },
    {
      id: 'families-family-page',
      group: 'Working the book',
      heading: 'The family page: one household, everything held',
      summary: 'Children across both programs, money, contact history, consent, and forms.',
      keywords: ['family page', 'household', 'balance', 'dues', 'registration fee', 'opted out', 'club email', 'former address', 'guardians', 'portal access', 'history'],
      searchText: 'unpaid installments credits paid not paid one email switch opt out unsubscribe siblings children rep league',
      content: (
        <>
          <p>Opening a family shows everything the club holds, in panels:</p>
          <ul>
            <li><strong>Children</strong> &mdash; every registration across rep and house league, joined through the parent. The page never claims two same-named children in different programs are the same child &mdash; only that one parent registered both.</li>
            <li><strong>Money</strong> &mdash; rep dues as real dollar lines (unpaid installments, payments, any credits on file); a house-league child as <strong>Paid / Not paid</strong> with the season fee for context. The two are deliberately never added together &mdash; a house-league fee is a hand-kept flag, not a ledger.</li>
            <li><strong>Guardians</strong> &mdash; who is named, where they were named (roster, registration, tryout), and whether anyone has portal access. Most families show one guardian and no portal access; that is normal, not an error.</li>
            <li><strong>Contact</strong> &mdash; the current email, former addresses with when they lapsed, phone, and <strong>one club-email switch</strong>: On, or Opted out. An opt-out covers all family email from your organization, and it holds even if it was recorded under an address the parent no longer uses.</li>
            <li><strong>Forms &amp; consent</strong> &mdash; recorded consents (including a house-league waiver acceptance), plus each rep child&rsquo;s required documents. Forms are rep-only; league children never show &ldquo;missing&rdquo; forms because none exist to miss.</li>
            <li><strong>History</strong> &mdash; what is actually recorded: registrations, payments, address changes, reminders. Sent emails are not listed, because the system keeps recipient lists private by design.</li>
          </ul>
        </>
      ),
      faqs: [
        {
          id: 'faq-league-no-dollars',
          question: 'Why is there no dollar amount for my house-league child?',
          answer: (
            <p>
              House-league money is a paid / not-paid record against the season&rsquo;s registration
              fee &mdash; there is no installment ledger behind it, so the page shows the honest
              record rather than a number the system cannot stand behind. Rep dues, which do have a
              real ledger, show as dollars.
            </p>
          ),
          answerText:
            'House league money is a paid or not paid flag against the registration fee, not a ledger, so no dollar balance is shown. Rep dues have a real ledger and show dollars.',
          keywords: ['house league', 'fee', 'balance', 'paid', 'not paid'],
        },
        {
          id: 'faq-optout-old-address',
          question: 'A parent unsubscribed years ago and has a new email now. Will we accidentally email them?',
          answer: (
            <p>
              No. The Families area checks the opt-out against <strong>every address the person has
              ever used</strong>, so an unsubscribe recorded under an old address still silences the
              current one. The family page&rsquo;s contact panel says when this is the case.
            </p>
          ),
          answerText:
            'No. Opt-outs are checked against every address the person has ever used, so an unsubscribe under an old email still applies to the new one.',
          keywords: ['opt out', 'unsubscribe', 'changed email', 'suppression'],
          popular: true,
        },
      ],
    },
    {
      id: 'families-duplicates',
      group: 'Working the book',
      heading: 'Possible duplicates: are these the same person?',
      summary: 'Reviewing, merging, and permanently dismissing suspected duplicate parents.',
      keywords: ['duplicates', 'merge', 'not the same person', 'duplicate queue', 'two records', 'same parent'],
      searchText: 'merge families combine records duplicate review queue tombstone remembered surname phone shared child',
      content: (
        <>
          <p>
            Records are built from email addresses, and addresses drift &mdash; so the same parent can
            arrive as two records. The queue proposes pairs that share a surname and a phone number,
            or a surname and a same-named child. <strong>Nothing ever merges on its own</strong>; every
            decision is yours.
          </p>
          <ul>
            <li><strong>Merge</strong> joins the two parent records: the old address stays searchable as a former address, and if either record had opted out of email, the merged family stays opted out. Children&rsquo;s rows are never modified &mdash; a merge joins parents only.</li>
            <li><strong>Not the same person</strong> is remembered permanently. A dismissed pair never comes back, so the queue stays trustworthy.</li>
          </ul>
          <p>An empty queue is the healthy state, not a broken screen.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-undo-merge',
          question: 'Can I undo a merge?',
          answer: (
            <p>
              Not with a button. A merge keeps every address searchable and records exactly what was
              merged and by whom, but splitting a household apart again is a support task &mdash; so
              merge only when you are sure, and use <em>Not the same person</em> when you are not.
            </p>
          ),
          answerText:
            'There is no undo button. The merge is recorded and every address stays searchable, but splitting a merged household again is a support task. When unsure choose Not the same person.',
          keywords: ['undo', 'unmerge', 'mistake', 'merge'],
        },
      ],
    },
    {
      id: 'families-actions',
      group: 'Working the book',
      heading: 'Messaging a household and exporting their data',
      summary: 'One message to every guardian, and one file answering "what do you hold about me".',
      keywords: ['message family', 'email household', 'export', 'privacy request', 'data request', 'what do you hold'],
      searchText: 'send email guardians unsubscribe footer download json privacy answer subject access request',
      content: (
        <>
          <p>
            <strong>Message this family</strong> sends one email to every guardian in the household.
            It goes through the same send system as every other family email: the club is identified,
            an unsubscribe link is included, and an opted-out family is never mailed &mdash; the
            button tells you so instead of sending.
          </p>
          <p>
            <strong>Export their data</strong> downloads one file containing everything the family
            page shows &mdash; children, money, contact history, consents, forms. It exists so a
            privacy request (&ldquo;what do you hold about my family?&rdquo;) is answered from one
            screen in one action instead of a hunt across six.
          </p>
          <p>
            Recording a payment from the family page is coming in a later phase &mdash; today,
            payments are recorded where they always have been, in the money screens.
          </p>
        </>
      ),
      faqs: [
        {
          id: 'faq-families-still-emailed',
          question: 'A parent says they unsubscribed but still got an email. What do I tell them?',
          answerText: 'Check what kind of email it was, because the two are treated differently on purpose. Announcements — a coach message, a league broadcast, a message from this page — are never sent to a family who has opted out, and that holds even if they unsubscribed under an email address they no longer use. Dues reminders are different: they still go out, because a family cannot switch off a bill by unsubscribing from announcements. Those emails say so themselves, naming the club and explaining that they are account notices rather than announcements. Tryouts are not in this category at all — the only tryout email we send is a receipt confirming an application the family submitted themselves; offers, waitlist moves and decisions always come from the club directly, never from us. So the honest answer to the parent is that the unsubscribe is working, and it covers club news and team messages rather than money they owe. If they received an announcement after opting out, that is worth reporting.',
          keywords: ['unsubscribed', 'still got email', 'opted out', 'why did they get', 'unsubscribe not working', 'parent complaint', 'dues reminder', 'account notice'],
          answer: (
            <>
              <p>Check <em>what kind</em> of email it was &mdash; the two are treated differently on purpose.</p>
              <ul>
                <li><strong>Announcements</strong> &mdash; a coach message, a league broadcast, a message from this page &mdash; are never sent to a family who has opted out. That holds even if they unsubscribed under an address they no longer use.</li>
                <li><strong>Dues reminders</strong> still go out. A family can&apos;t switch off a bill by unsubscribing from announcements.</li>
                <li><strong>A tryout application receipt</strong> — the one email a tryout ever sends, confirming a form the family submitted themselves. Offers, waitlist moves and decisions always come from the club directly, never from us.</li>
              </ul>
              <p>Those second ones say so themselves: they name the club and explain that they&apos;re account notices rather than announcements.</p>
              <p>So the honest answer is that the unsubscribe <em>is</em> working &mdash; it covers club news and team messages, not money owed. If they received an <strong>announcement</strong> after opting out, that&apos;s worth reporting.</p>
            </>
          ),
        },
      ],
    },
  ],
};

export default familiesHelp;
