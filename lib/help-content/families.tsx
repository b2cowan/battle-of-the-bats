import type { HelpPageContent } from './index';

/**
 * Families — club-admin household records (Families Book P2, 2026-08-17; redrawn as one page with two tabs and a record
 * over the list by Club Tier Stage 5b, 2026-10-17). One guide, two audiences (customer hub + platform-admin mirror).
 * Plan-gated: League Plus and Club bands carry the module; the AREA is also behind a per-member Families permission that
 * is off for every role, and never given to a member limited to some teams.
 * ⚠ The explanations the old family page carried as six footnotes live HERE now (Ask 6) — the record carries facts.
 * Old words ("worklist", "family page", "Possible duplicates") stay as search terms.
 */
const familiesHelp: HelpPageContent = {
  title: 'Families',
  role: 'Club and league administrators with the Families permission',
  intro:
    'Families is your club’s book of households: every parent named anywhere in your programs, ' +
    'their children across rep teams and house league, what they owe, what they’ve agreed to, and ' +
    'how to reach them — including by an email address they no longer use.',
  searchPlaceholder: 'Search: show, duplicates, ask the coaches, opt-out, export…',
  sections: [
    {
      id: 'families-what-it-is',
      group: 'Getting started',
      heading: 'What Families is, and who can open it',
      summary: 'A household book across both programs, behind its own permission.',
      keywords: ['families', 'permission', 'access', 'grant', 'household', 'who can see', 'limited to some teams', 'team group'],
      searchText: 'families area access permission grant module off by default owner members capability what they can open turn on limited member team groups refused why',
      content: (
        <>
          <p>
            Most records in the system belong to a team, a season, or a tournament. Families is the
            one place organized around the <strong>household</strong>: one record per parent, joining
            everything your club holds about their children across rep teams and house league.
          </p>
          <p>
            Because it puts contact details, consent and balances for every family in one searchable
            place, it is <strong>off for everyone by default</strong> &mdash; admins included. Owners
            always have it. Anyone else needs a deliberate, per-person grant:
          </p>
          <ol>
            <li>Open <strong>Organization &rarr; Members</strong> and open the member.</li>
            <li>In <strong>What they can open</strong>, set the <strong>Families</strong> row to <strong>Turn on</strong>.</li>
          </ol>
          <p>
            A member limited to some teams can&rsquo;t be given Families: a family&rsquo;s record spans
            every team its children play on. Their row says so. Without the permission there is no
            Families entry at all. Available on League Plus and Club plans.
          </p>
        </>
      ),
    },
    {
      id: 'families-worklist',
      group: 'Working the book',
      heading: 'The Families tab: Show and Search',
      summary: 'One Show pill picks the list — owed money, missing forms, missing consent, children with no family on file.',
      keywords: ['show', 'worklist', 'owes money', 'missing forms', 'no consent', 'not back', 'no family on file', 'all families', 'chased', 'search', 'former email', 'tabs', 'duplicates tab'],
      searchText: 'families page two tabs families duplicates show pill question list count lens filter chip reminded never not tracked fee not paid registration unpaid search phone former old email address find family search all families load more show more',
      content: (
        <p>
          Families is one page with two tabs, <strong>Families</strong> and <strong>Duplicates</strong>.
          The Families tab answers one question at a time, picked from the <strong>Show</strong> pill.
        </p>
      ),
      subtopics: [
        {
          id: 'families-worklist-show',
          title: 'The six lists in Show',
          content: (
            <>
              <p>Show names the list on screen and its count; open it to pick another. Each list has its count beside it.</p>
              <ul>
                <li><strong>No family on file</strong> &mdash; children whose roster row or registration names no guardian, or an address that can&rsquo;t be emailed. See the next topic.</li>
                <li><strong>Owes money</strong> &mdash; families whose rep dues this season aren&rsquo;t paid, and house-league families with a fee not marked paid.</li>
                <li><strong>Missing forms</strong> &mdash; rep children missing a required team document.</li>
                <li><strong>No consent on file</strong> &mdash; families the club holds no recorded consent for.</li>
                <li><strong>Not back this season</strong> &mdash; families with history but nothing this season: your retention list.</li>
                <li><strong>All families</strong> &mdash; the whole book.</li>
              </ul>
              <p>The list you pick stays in the page&rsquo;s address, so Back and a reload keep it.</p>
            </>
          ),
        },
        {
          id: 'families-worklist-columns',
          title: 'What the columns mean',
          content: (
            <dl>
              <dt><strong>Balance</strong></dt>
              <dd>What the family owes this season: each rep child&rsquo;s balance on their team&rsquo;s Player dues where it is above zero, plus any house-league registration fee not marked paid. A credit one child holds on one team never pays down another child&rsquo;s dues on another team.</dd>
              <dt><strong>Fee not paid</strong></dt>
              <dd>Shown on a house-league child&rsquo;s line when the season&rsquo;s registration fee isn&rsquo;t marked paid. The fee is counted in Balance.</dd>
              <dt><strong>Chased</strong></dt>
              <dd>When a rep dues reminder last reached the family, or <em>Never</em>. It is about dues only: a house-league fee reads <em>Not tracked</em>.</dd>
            </dl>
          ),
        },
        {
          id: 'families-worklist-search',
          title: 'Searching for a family',
          content: (
            <>
              <p>
                Search narrows the list on screen. It matches a parent&rsquo;s name, a child&rsquo;s name, a
                phone number, and <strong>every email address ever seen for the family</strong> &mdash; so a
                parent who changed addresses is still found by the old one.
              </p>
              <p>
                To look across the whole book, pick <strong>All families</strong> first. When a search finds
                nothing in a narrower list, the page offers <strong>Search all families</strong>.
              </p>
            </>
          ),
        },
      ],
    },
    {
      id: 'families-no-family',
      group: 'Working the book',
      heading: 'No family on file, and asking the coaches',
      summary: 'Who can add a guardian to a rep roster, and how the club asks them.',
      keywords: ['no family on file', 'no guardian', 'missing guardian', 'ask the coaches', 'head coach', 'roster', 'guardian email'],
      searchText: 'children with no family no guardian named guardian address unusable rep roster coach adds guardian club cannot edit roster ask the coaches email head coach players with no guardian on file your club notice last sent house league registration open registrations',
      content: (
        <>
          <p>
            <strong>No family on file</strong> lists children, grouped under their team, whose row names no
            guardian &mdash; or names an address that can&rsquo;t be emailed. On a new club it is usually the
            biggest list, and clearing it is what fills the book.
          </p>
          <ul>
            <li><strong>A rep child</strong>: only the team&rsquo;s coaches can add a guardian, on their Roster. The club can&rsquo;t edit a rep roster, so these rows don&rsquo;t open.</li>
            <li><strong>A house-league child</strong>: the registration is the club&rsquo;s own. The row opens the season&rsquo;s registrations, where you fix it.</li>
          </ul>
          <p>
            <strong>Ask the coaches</strong> emails each team&rsquo;s head coach the names of their players with no
            guardian email the club can use, and where to add one. Before you send, it shows each team, its head coach and how
            many players the email names (a team with no head coach reads <em>Nobody to send to</em>), a sample
            email, and when the club last sent one and who sent it. Replies come to you. Each head coach also gets
            a notice under <em>Your club</em>.
          </p>
          <p>Once a guardian is added, the family appears in the book the next time Families loads.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-no-family-on-file',
          question: 'Why does a child show under "No family on file"?',
          answer: (
            <p>
              Their roster row or registration names no guardian email, or the address on it can&rsquo;t be
              used. For a rep child, the team&rsquo;s coaches add it on their Roster &mdash; use <strong>Ask the
              coaches</strong> to ask them. For a house-league child, fix it in the season&rsquo;s registrations.
            </p>
          ),
          answerText:
            'The child’s roster row or registration names no guardian email, or the address is unusable. For a rep child the team’s coaches add it on their Roster — use Ask the coaches. For a house-league child fix it in the season’s registrations.',
          keywords: ['no family', 'missing guardian', 'no guardian', 'fix', 'ask the coaches'],
          popular: true,
        },
      ],
    },
    {
      id: 'families-family-page',
      group: 'Working the book',
      heading: 'A family’s record',
      summary: 'Opens over the list: money, children, contact, forms and history — and Next to the next family.',
      keywords: ['family page', 'family record', 'household', 'balance', 'dues', 'rep dues', 'registration fee', 'opted out', 'club email', 'former address', 'named on', 'history', 'last messaged', 'previous', 'next'],
      searchText: 'open a family record window over the list previous next step through owes money one of five rep dues paid balance band children dues paid balance fundraising other credits handed back league fee paid not paid contact email former phone club email switch opt out unsubscribe named on where to change details no edit forms and consent history show all record a payment',
      content: (
        <p>
          A family opens over the list it came from. Its heading names that list and the family&rsquo;s place in
          it (&ldquo;Owes money &middot; 1 of 5&rdquo;), and <strong>Previous</strong> and <strong>Next</strong> at
          the foot step through it, so you can work a list without going back to it. A copied link opens the
          same family.
        </p>
      ),
      subtopics: [
        {
          id: 'families-family-page-money',
          title: 'The family’s money and children',
          content: (
            <>
              <p>
                At the top, three figures for everything the family owes this season: <strong>Dues</strong>,
                <strong> Paid</strong> and <strong>Balance</strong> &mdash; the Children lines added up. A rep
                child&rsquo;s line is read the way the team&rsquo;s own Player dues reads it, so it matches the
                team&rsquo;s books. Balance is what the family owes, with the children who owe named under it.
              </p>
              <p>
                <strong>Children</strong> lists each child once, with their team or season and their own Dues,
                Paid and Balance. Fundraising, other credits and money handed back appear under a child only when
                they aren&rsquo;t zero. A child who isn&rsquo;t back this season shows the season they were last in.
              </p>
              <p>
                A house-league child shows the season&rsquo;s registration fee in the same three columns. The club
                marks a fee paid or not paid, so Paid is the whole fee or nothing &mdash; a part payment can&rsquo;t
                be shown.
              </p>
            </>
          ),
        },
        {
          id: 'families-family-page-contact',
          title: 'Contact, and where to change it',
          content: (
            <>
              <p>
                Contact lists the current email, any former addresses with when they stopped being used, the phone
                number, the <strong>Club email</strong> switch, when the family was last messaged and by whom, and
                <strong> Named on</strong>: the roster rows and registrations that name this parent.
              </p>
              <p>
                The record reads only. A parent&rsquo;s details are typed on those rows, so that is where they are
                changed &mdash; a rep roster by the team&rsquo;s coaches, a registration by the club.
              </p>
              <p>
                <strong>Club email</strong> is one switch for all family email from your club: On, or Opted out.
                An opt-out holds even when it was recorded under an address the parent no longer uses &mdash; the
                record says so when that&rsquo;s the case.
              </p>
            </>
          ),
        },
        {
          id: 'families-family-page-forms',
          title: 'Forms, consent and history',
          content: (
            <>
              <ul>
                <li><strong>Forms</strong> are each rep child&rsquo;s required team documents, On file or Missing. House league keeps no forms, so a league child has no form rows &mdash; nothing is missing for them.</li>
                <li><strong>Consent</strong> lists what the club has recorded, including a house-league waiver accepted at registration. <em>None on file</em> is a fact about the club&rsquo;s records, not about the family: most consent is captured by rep tryouts and house-league waivers, so a family the club never asked shows none.</li>
                <li><strong>History</strong> shows the five newest things recorded &mdash; registrations, payments as the team recorded them, address changes, consents &mdash; and <strong>Show all</strong>. What a message said is never kept.</li>
              </ul>
              <p>Recording a payment from a family isn&rsquo;t here yet; payments are recorded in the money screens.</p>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-league-no-dollars',
          question: 'How is a house-league child’s fee shown?',
          answer: (
            <p>
              Like any other child: Dues, Paid and Balance. Dues is the season&rsquo;s registration fee. The club
              marks a registration paid or not paid &mdash; there is no installment ledger behind it &mdash; so Paid
              is the whole fee or nothing, and a part payment can&rsquo;t be shown. An unpaid fee counts in the
              family&rsquo;s Balance and puts the family on <strong>Owes money</strong>.
            </p>
          ),
          answerText:
            'Like any other child: Dues, Paid and Balance. Dues is the season registration fee. The club marks a registration paid or not paid, so Paid is the whole fee or nothing and a part payment cannot be shown. An unpaid fee counts in the family Balance and puts the family on Owes money.',
          keywords: ['house league', 'fee', 'registration fee', 'balance', 'paid', 'not paid', 'dues'],
        },
        {
          id: 'faq-optout-old-address',
          question: 'A parent unsubscribed years ago and has a new email now. Will we accidentally email them?',
          answer: (
            <p>
              No. Families checks the opt-out against <strong>every address the person has ever used</strong>,
              so an unsubscribe recorded under an old address still silences the current one. The family&rsquo;s
              Contact says when this is the case.
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
      heading: 'Duplicates: are these the same parent?',
      summary: 'Reviewing suspected duplicate parents, choosing which record survives, and dismissing for good.',
      keywords: ['duplicates', 'possible duplicates', 'merge', 'not the same person', 'keep this record', 'which record survives', 'two records', 'same parent'],
      searchText: 'duplicates tab merge families combine records duplicate review queue remembered surname first name initial phone same child birth date team season email changed keep this record survivor keeper three records one card cannot be undone',
      content: (
        <>
          <p>
            Records are built from email addresses, and addresses drift &mdash; so one parent can arrive as two
            records. The <strong>Duplicates</strong> tab proposes records that may be one parent, with its count
            on the tab. <strong>Nothing merges until you choose.</strong>
          </p>
          <p>Records are proposed when they share a surname, their first names agree (an initial matches the name), and either:</p>
          <ul>
            <li>they share a <strong>phone number</strong>, or</li>
            <li>they name the <strong>same child</strong> &mdash; the same name, and the same birth date where both rows have one, otherwise the same team and season.</li>
          </ul>
          <p>
            A record is also proposed when a guardian&rsquo;s email was changed on a child&rsquo;s row and the
            child moved to a new record. Three or more records that match are one card.
          </p>
          <ul>
            <li><strong>Keep this record</strong> sits on each side. You choose which survives; it starts on the record with children, then the newer one.</li>
            <li><strong>Merge into</strong> the record you kept asks first. The other addresses become former addresses and stay searchable, every child&rsquo;s records stay as they are, and an opt-out on either record stays.</li>
            <li><strong>Not the same person</strong> is remembered, so the card never comes back.</li>
          </ul>
        </>
      ),
      faqs: [
        {
          id: 'faq-undo-merge',
          question: 'Can I undo a merge?',
          answer: (
            <p>
              No. A merge keeps every address searchable and records what was merged and by whom, but it
              can&rsquo;t be split apart afterwards &mdash; so check which record you&rsquo;re keeping, and choose
              <em> Not the same person</em> when you&rsquo;re not sure.
            </p>
          ),
          answerText:
            'No. The merge is recorded and every address stays searchable, but it cannot be split apart afterwards. Check which record you are keeping, and choose Not the same person when unsure.',
          keywords: ['undo', 'unmerge', 'mistake', 'merge'],
        },
      ],
    },
    {
      id: 'families-actions',
      group: 'Working the book',
      heading: 'Messaging a household and exporting their data',
      summary: 'One message to every guardian, replies to you, three a day — and one file answering "what do you hold about me".',
      keywords: ['message family', 'email household', 'export', 'export their data', 'family file', 'privacy request', 'data request', 'data transfer', 'move their data', 'portability', 'what do you hold', 'reply', 'three a day', 'pdf', 'json'],
      searchText: 'send email guardians unsubscribe footer reply to sender limit three messages a day last messaged download pdf json structured file for a data transfer move data elsewhere portability family file privacy answer subject access request administrative file coaching records top of the record',
      content: (
        <>
          <p>
            <strong>Message this family</strong> and <strong>Export</strong> sit at the top of a family&rsquo;s
            record (on a phone, Message and the download icon).
          </p>
          <p>
            Message opens the club&rsquo;s send window. Before you type, it shows who the message reaches &mdash;
            every guardian whose club email is on (one who opted out is listed as not receiving it) &mdash; and
            when the family was last messaged and by whom. <strong>See the email</strong> shows it as the guardian
            will receive it. Replies come to you. A family gets at most <strong>three messages in any 24
            hours</strong> from here; a family that has opted out, or has had its three, has no Message button and
            the record says why. Each send keeps its date and who sent it, never what it said.
          </p>
          <p>
            Export makes the club&rsquo;s file on the family: a <strong>PDF</strong> a parent can read, or
            <strong> For a data transfer</strong> (a JSON file), for when a family asks to move their data to
            another system. Most requests only need the PDF. Its first page lists what it
            holds &mdash; contact and every address used, the club-email setting and how it was recorded, each
            child&rsquo;s registrations with birth date, medical notes and emergency contact, tryout applications
            and their consent, every dues line and payment, documents, waivers and consents, the dates the club
            messaged them, and records joined &mdash; and what it doesn&rsquo;t: coaching records stay with each
            team. Every export is recorded in the club&rsquo;s audit log.
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
