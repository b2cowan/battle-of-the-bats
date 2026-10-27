import type { HelpPageContent } from './index';
import { HelpSteps, HelpNote } from '@/components/help/HelpBlocks';

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
            <li>In <strong>What they can open</strong>, set the <strong>Families</strong> row to <strong>On</strong>.</li>
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
                <li><strong>Owes money</strong> &mdash; families whose rep dues this season aren&rsquo;t paid, and house-league families with an accepted child whose fee is still owing.</li>
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
              <dd>What the family owes this season: each rep child&rsquo;s balance on their team&rsquo;s Player dues where it is above zero, plus any house-league registration fee still owing on an accepted child. A credit one child holds on one team never pays down another child&rsquo;s dues on another team.</dd>
              <dt><strong>Fee not paid</strong></dt>
              <dd>Shown on a house-league child&rsquo;s line when the registration fee hasn&rsquo;t been marked received. The fee is counted in Balance.</dd>
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
      summary: 'Opens over the list: money, children, notes, contact, forms and history — Record a payment, Message, Export, and Next to the next family.',
      keywords: ['family page', 'family record', 'household', 'balance', 'dues', 'pay by card', 'paid online', 'card payment', 'rep dues', 'registration fee', 'opted out', 'club email', 'former address', 'named on', 'history', 'last messaged', 'previous', 'next', 'record a payment', 'payment', 'cheque', 'house-league fee', 'fee paid', 'sent to coach', 'not received', 'hand off', 'notes', 'family notes', 'staff notes', 'family file', 'paid online', 'pay link sent', 'bank debit', 'view the payment'],
      searchText: 'open a family record window over the list previous next step through owes money one of five rep dues paid balance band children dues paid balance fundraising other credits handed back league fee paid not paid mark received price fixed at sign-up card payment lands by itself pay by card paid online status page record a payment for money received by hand refunded ended child owes nothing contact email former phone club email switch opt out unsubscribe named on where to change details no edit forms and consent history show all record a payment amount received placed left to place whole fee mark a house league fee paid send a rep payment to the head coach to record date received how note cheque number sent to coach not received record it the coach records it money figures move person who sent it is told in their notifications correct a payment where it was written nothing is sent to the family fee permission league registrar league admin owner season is closed no head coach you are the head coach more than a child owes becomes a credit add a note notes staff only signed dated newest first show all edit a note pencil delete a note owner keeps who deleted it never the words a note belongs to the guardian record merged records carry both people notes the family file includes notes paid online card bank debit receipt pay link sent view the payment fee section processing fee not dues',
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
                A house-league child shows the registration fee in the same three columns, with a line under the season saying <em>Price set at sign-up</em> and the day. Dues is the price fixed on that registration, not the season&rsquo;s
                current price, and Paid is what the season&rsquo;s book has received for it after any refund. A child who
                has ended owes nothing. When the club takes card payments, a card payment from the family&rsquo;s status
                page lands here by itself. Money received by hand goes in with <strong>Record a payment</strong> at the
                top of the record.
              </p>
              <p>
                Under the child&rsquo;s season and division, a fee paid online reads <em>Paid online Oct 24 &middot; card &middot; receipt 1043</em> (or <em>bank debit</em>), and a fee still owing reads <em>Pay link sent Oct 20</em> once the club has emailed the pay link. The processing fee is never counted as dues or paid, and a payment the bank took back is not shown as paid online. To open the payment itself, use <strong>View the payment</strong> in the registration&rsquo;s <strong>&hellip;</strong> on Registrations; it opens the child&rsquo;s record at its Fee section.
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
                A parent&rsquo;s details are read-only here. They are typed on those rows, so that is where they are
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
                <li><strong>History</strong> shows the five newest things recorded &mdash; registrations, payments as the team recorded them, payments the club sent to a coach and what came of them, address changes, consents &mdash; and <strong>Show all</strong>. What a message said is never kept.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'families-family-page-payment',
          title: 'Record a payment',
          content: (
            <>
              <p>
                <strong>Record a payment</strong> (on a phone, <strong>Record payment</strong>) sits beside
                <strong> Message this family</strong> and <strong>Export</strong>. It is there only when the family owes
                something and you can do at least one of its lines.
              </p>
              <HelpSteps>
                <li>Type the <strong>Amount received</strong>. It is placed down the children who owe, in the record&rsquo;s order, and two figures keep count: <strong>Placed</strong> and <strong>Left to place</strong>.</li>
                <li>A house-league child: tick <strong>Whole fee</strong>. The fee is marked received in the club&rsquo;s books now, the same as <strong>Mark received</strong> on House league &rsaquo; Registrations. A pay page the family left open for that child closes, so they can&rsquo;t pay twice.</li>
                <li>A rep child: the amount goes to the team&rsquo;s head coach to record. The club never records into a team&rsquo;s own book.</li>
                <li>Set the <strong>Date received</strong> (not after today) and <strong>How</strong>. A house-league fee keeps both in the season&rsquo;s book. Add a <strong>Note</strong> if you want one &mdash; a cheque number goes there.</li>
                <li>Read the line at the bottom. It says what pressing will do, child by child. All of the amount must be placed before the button appears.</li>
              </HelpSteps>
              <p>
                The note travels to the coach. The family never sees it, and nothing is ever sent to the family.
              </p>
            </>
          ),
        },
        {
          id: 'families-family-page-payment-limits',
          title: 'Who can record a payment, and why a line can’t go',
          content: (
            <>
              <p>Anyone given <strong>Families</strong> can open Record a payment. A treasurer without Families sees nothing new, and a member limited to some teams never has Families.</p>
              <ul>
                <li>A <strong>house-league line</strong> also needs the fee permission: only the owner, a club admin, a league admin or a league registrar marks a house-league fee received.</li>
                <li>A line that can&rsquo;t go stays on the list and says why: the team&rsquo;s season is closed, the team has no head coach to send it to, you are that team&rsquo;s head coach (record it on the team&rsquo;s Player dues), or you lack the fee permission.</li>
                <li>More than a child owes is allowed. The team&rsquo;s book turns the extra into a credit when the coach records it.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'families-family-page-payment-after',
          title: 'After you send a payment to a coach',
          content: (
            <>
              <p>
                A rep child shows an amber <strong>Sent to coach</strong> tag until the head coach answers. The coach gets a notice and an email with <strong>Record it</strong> and <strong>Not received</strong>.
              </p>
              <ul>
                <li><strong>The coach records it:</strong> the tag goes, and the money figures move, because they read the team&rsquo;s book.</li>
                <li><strong>The coach says Not received:</strong> the tag turns to a red <strong>Not received</strong>, and the person who sent it is told in their notifications. Nothing is recorded.</li>
                <li><strong>History</strong> lists the send and what came of it.</li>
              </ul>
              <HelpNote variant="info" title="Corrections happen where the payment was written">
                A mistake is corrected where it was written: the coach corrects the receipt on the team&rsquo;s Player dues, and a house-league payment is undone or corrected on Registrations (<strong>Undo</strong>, <strong>Correct the price</strong>).
              </HelpNote>
            </>
          ),
        },
        {
          id: 'families-family-page-notes',
          title: 'Notes about a family',
          content: (
            <>
              <p>
                <strong>Notes</strong> is a section after Children: what the club&rsquo;s staff wrote about the family itself, each note signed and dated, newest first.
              </p>
              <ul>
                <li><strong>Add a note</strong> asks before it saves. A note can be up to 1,000 characters.</li>
                <li>The newest two show; <strong>Show all</strong> lists the rest. Open a note to read it.</li>
                <li>The person who wrote a note can edit it with the pencil; it saves as you type.</li>
                <li>The author or the owner can delete it. It asks once, and the club keeps who deleted it and when &mdash; never the words.</li>
              </ul>
              <p>
                Notes are staff only: they are never on a family&rsquo;s screen, and a family&rsquo;s file includes them. A note belongs to the guardian record it was written on; merging two duplicate records carries both people&rsquo;s notes.
              </p>
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
              Like any other child: Dues, Paid and Balance. Dues is the price fixed on that registration when the family signed up. The club
              marks a registration received on Registrations &mdash; the whole amount owing, with a date and how &mdash; so Paid is
              what the season&rsquo;s book has received after any refund. A fee still owing on an accepted child counts in the
              family&rsquo;s Balance and puts the family on <strong>Owes money</strong>.
            </p>
          ),
          answerText:
            'Like any other child: Dues, Paid and Balance. Dues is the price fixed on that registration when the family signed up. The club marks a registration received on Registrations, so Paid is what the season book has received after any refund. A fee still owing on an accepted child counts in the family Balance and puts the family on Owes money.',
          keywords: ['house league', 'fee', 'registration fee', 'balance', 'paid', 'not paid', 'dues'],
        },
        {
          id: 'faq-family-cheque',
          question: 'A family handed the club a cheque for their child’s dues. Where do I record it?',
          answer: (
            <p>
              On the family&rsquo;s record, with <strong>Record a payment</strong>. A house-league fee is marked received
              in the club&rsquo;s books straight away, with the date and how you set. A rep child&rsquo;s amount is sent to the team&rsquo;s head
              coach to record &mdash; the club never writes into a team&rsquo;s book. Put the cheque number in the
              <strong> Note</strong>; it goes to the coach, and the family never sees it.
            </p>
          ),
          answerText:
            'On the family record, use Record a payment. A house-league fee is marked received in the club books straight away, with the date and how you set. A rep child amount is sent to the team head coach to record; the club never writes into a team book. Put the cheque number in the Note; it goes to the coach and the family never sees it.',
          keywords: ['cheque', 'record a payment', 'payment', 'sent to coach', 'house-league fee', 'fee paid', 'mark received', 'hand off'],
          popular: true,
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
      keywords: ['message family', 'email household', 'export', 'export their data', 'family file', 'privacy request', 'data request', 'data transfer', 'move their data', 'portability', 'what do you hold', 'reply', 'three a day', 'pdf', 'json', 'family notes', 'staff notes', 'notes about the family', 'pinned note'],
      searchText: 'send email guardians unsubscribe footer reply to sender limit three messages a day last messaged download pdf json structured file for a data transfer move data elsewhere portability family file privacy answer subject access request administrative file coaching records top of the record notes about the family a payment the club sent to a coach a coach pinned note about a player is not in the file not in this file',
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
            and their consent, every dues line and payment (including a payment the club sent to a coach), documents,
            waivers and consents, the dates the club messaged them, <strong>Notes about the family</strong>, and
            records joined &mdash; and what it doesn&rsquo;t, under <em>Not in this file</em>: coaching records stay
            with each team, including a coach&rsquo;s pinned note about a player. Every export is recorded in the club&rsquo;s audit log.
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
    {
      id: 'families-email',
      group: 'Working the book',
      heading: 'Emailing many families, and the Emails tab',
      summary: 'Email every family, some rep teams, a house league season or a Families list, each family once. The club sends 3 in any 24 hours; each house league season has its own 3.',
      keywords: ['email families', 'email every family', 'email a season', 'email rep teams', 'email a list', 'emails tab', 'sent emails', 'three emails', '3 emails', 'in any 24 hours', 'allowance', 'season filter', 'club-wide', 'head coach copy', 'send to the ones it missed', 'stopped', 'opted out', 'house league season'],
      searchText: 'email families window emails tab every family some rep teams a house league season families from a list owes money missing forms each family once siblings one email opted out counted skipped replies come to you copy each team’s head coach the club can send three emails in any 24 hours the next can go a house league season counts toward that season’s own 3 not the club’s every season with families any status registration closed finished divisions teams statuses on the season’s own email families message this family never counts emails tab every email from families and every season season named season filter all club-wide one season open an email what it said reached missed opted out stopped partway send to the 1 it missed does not count automatic emails publish teams listed on the season page',
      content: (
        <>
          <p>
            <strong>Email families</strong>, at the top right of the <strong>Emails</strong> tab, writes to many
            families at once: every family, some rep teams, a house league season, or the families on a list such as
            <em> Owes money</em>. Each family gets it once, however many children it has. A family that opted out of
            club email is counted and skipped, replies come to you, and a rep team choice can copy each team&rsquo;s head
            coach.
          </p>
          <ul>
            <li><strong>The club can send 3 emails in any 24 hours.</strong> The window&rsquo;s foot says how many it has sent in the last 24 hours; once all 3 are sent, it says when the next can go.</li>
            <li><strong>A house league season counts toward its own 3</strong>, not the club&rsquo;s. The season choice lists every season with families, whatever its state. For a division, a team or a status, use the season&rsquo;s own <strong>Email families</strong>, in the season&rsquo;s menu.</li>
            <li><strong>Message this family never counts</strong> toward either; a family has its own 3.</li>
          </ul>
          <p>
            The <strong>Emails</strong> tab lists every email sent from Families and from each house league season, a
            season&rsquo;s named with its season (<em>Fall 2026 &middot; Jays</em>). The <strong>Season</strong> filter
            narrows it to <strong>Club-wide</strong> or one season. Open an email to see what it said, how many families
            it reached, and which it missed or who opted out. One that stopped partway offers <strong>Send to the 1 it
            missed</strong>, which doesn&rsquo;t count. A season&rsquo;s automatic emails, like the ones Publish teams
            sends, are listed on that season&rsquo;s own page instead.
          </p>
        </>
      ),
    },
  ],
};

export default familiesHelp;
