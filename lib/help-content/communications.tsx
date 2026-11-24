import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef, HelpNote } from '@/components/help/HelpBlocks';

/**
 * Club Communications Stage 1 (Close, /docs, 2026-11-22). The one guide for the club's group email: to families, to
 * coaches, to the board, and the list of what was sent. Names come from lib/club-group-email-words.ts (PLACE, GROUP, WINDOW,
 * RECORD, SAY): change a name there and change it here.
 *
 * ⚖ Legal checklist §4 (docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md): never say an admin opens household records, never
 * call board email a notice, never say board email can be turned off, say names only (never "nobody sees an email address"),
 * and say the 12 and 24 months only the way the privacy policy does.
 */
const communicationsHelp: HelpPageContent = {
  title: 'Communications',
  role: 'Owner, Admin, League admin, League registrar, Treasurer',
  searchPlaceholder: 'Search Communications help',
  intro:
    'Communications is where the club writes to its families, its coaches and its board, and where every email it has sent is listed with who it reached. It sits in the Club group of the sidebar.',
  sections: [
    // ── Who can use it ──────────────────────────────────────────────────────
    {
      id: 'comms-who',
      group: 'Getting started',
      heading: 'Who can use Communications',
      summary: 'Owners and admins write to families, coaches and the board; league admins and registrars to house-league coaches and the board; a treasurer to the board.',
      keywords: ['communications', 'who can email', 'who can send', 'email families', 'email coaches', 'email the board', 'new email', 'to families', 'to coaches', 'to the board', 'sidebar', 'club group', 'treasurer', 'league admin', 'league registrar', 'families book', 'do not see communications'],
      searchText: 'communications page sidebar club group new email button only choice names it email families email coaches email the board owner admin league admin registrar treasurer staff volunteer coach limited to some team groups families book not needed admin emails families without families access the list of what was sent tournament teams coaches emailed from the tournament switch off members manage',
      content: (
        <>
          <p>
            Communications shows while group email is on for your club. What a person can write depends on their seat, and <strong>New email</strong> offers only those choices (when there is just one, the button names it, such as <strong>Email families</strong>).
          </p>
          <HelpDefs>
            <HelpDef term="Owner and club admins"><strong>To families</strong>, <strong>To coaches</strong> and <strong>To the board</strong>. An admin does not need the Families book to email families. They read every email in the list.</HelpDef>
            <HelpDef term="League admin and league registrar"><strong>To coaches</strong>, house-league coaches only, and <strong>To the board</strong>. They write to a season&rsquo;s families from the season&rsquo;s own <strong>Email families</strong> tab, and they read the emails that reached house-league people.</HelpDef>
            <HelpDef term="Treasurer"><strong>To the board</strong> only. Their list holds the board emails they sent or received.</HelpDef>
            <HelpDef term="Everyone else">Staff, volunteers, coaches, and anyone limited to some team groups don&rsquo;t see Communications.</HelpDef>
          </HelpDefs>
          <HelpNote variant="info" title="Coaches of a tournament's teams">
            The coaches of the teams in a tournament are not a coach group here. They are emailed from the tournament, and Communications says so while one is running.
          </HelpNote>
        </>
      ),
      faqs: [
        {
          id: 'faq-comms-no-families-book',
          question: 'Do I need Families access to email families?',
          answer: <p>No. The owner and club admins email families from Communications without it. Only <strong>Families from a list</strong>, such as <em>Owes money</em>, needs the Families book, because the list itself comes from it.</p>,
          answerText: 'No. The owner and club admins email families from Communications without Families access. Only Families from a list, such as Owes money, needs the Families book, because the list comes from it.',
          keywords: ['families book', 'families access', 'admin', 'email families'],
        },
        {
          id: 'faq-comms-not-in-sidebar',
          question: "I can't see Communications in the sidebar. Why?",
          answer: <p>The owner may have turned Communications off for you (see <a href="#comms-switch">The Communications switch</a>), your seat has nothing to write to, or you are limited to some team groups. Ask the owner.</p>,
          answerText: 'The owner may have turned Communications off for you, your seat has nothing to write to, or you are limited to some team groups. Ask the owner.',
          keywords: ['missing', 'no communications', 'not in the sidebar', 'where is communications'],
        },
      ],
    },

    // ── Writing an email ────────────────────────────────────────────────────
    {
      id: 'comms-new-email',
      group: 'Writing',
      heading: 'Writing a new email',
      summary: 'Pick who it goes to, write it, check it, send. Each person gets their own email.',
      keywords: ['new email', 'write an email', 'send an email', 'email families', 'email coaches', 'email the board', 'all coaches', 'rep coaches', 'house-league coaches', 'coaches you pick', 'everyone on the board', 'board members you pick', 'replies', 'replies come to me', 'copy to the club inbox', 'see the email', 'see who gets it', 'just sent', 'recount', 'invited', 'no email on file'],
      searchText: 'new email button to families to coaches to the board window every family some rep teams a house league season a families list owes money each family once opted out skipped three emails in any 24 hours head coach copy all coaches rep coaches everyone on the staff head coaches only house-league coaches every division coaches you pick tick the people for this email only the pick is not saved everyone on the board board members you pick people with an account only you are not counted organization the board seat is the membership reply to the sender replies go to the club replies come to me the club contact address public site copy of the email to the club inbox not on the board see the email first name hi see who gets it invited coaches have not accepted no email on file who this reaches changed while you were writing nothing was sent this was just sent still going out add your name to your account keep it to the club own business do not sell or promote a sponsor',
      content: (
        <p>
          <strong>New email</strong> opens a window for who you are writing to. Every person gets their own email, so nobody sees who else received it, and every email is written in the club&rsquo;s name: <em>{'{Club}'} via FieldLogicHQ</em>.
          The window&rsquo;s foot says how many people it reaches and, in the same breath, who it leaves out.
        </p>
      ),
      subtopics: [
        {
          id: 'comms-t-families',
          title: 'Email families',
          content: (
            <>
              <p>
                <strong>To families</strong> writes to many families at once: every family, some rep teams, a house league season, or the families on a list such as <em>Owes money</em>. On a Families list that names families, <strong>Email these families</strong> opens the same window with that list chosen. Each family gets it once, however many children it has. A family that opted out of club email is counted and skipped. A rep team choice can copy each team&rsquo;s head coach.
              </p>
              <ul>
                <li><strong>The club can send 3 emails in any 24 hours.</strong> The window&rsquo;s foot says how many it has sent in the last 24 hours; once all 3 are sent, it says when the next can go.</li>
                <li><strong>A house league season counts toward its own 3</strong>, not the club&rsquo;s. The season choice lists every season with families, whatever its state. For a division, a team or a status, use the season&rsquo;s own <strong>Email families</strong> tab.</li>
                <li><strong>Message this family never counts</strong> toward either; a family has its own 3.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'comms-t-coaches',
          title: 'Email coaches',
          content: (
            <>
              <p><strong>To coaches</strong> offers the groups your seat may write to, each person once however many teams they coach. There is no daily limit on coach email.</p>
              <HelpDefs>
                <HelpDef term="All coaches">Rep team staff and house-league coaches, each person once. Shown only when you can write to more than one group.</HelpDef>
                <HelpDef term="Rep coaches">Everyone on the staff, or <strong>Head coaches only</strong>, of every rep team that isn&rsquo;t archived.</HelpDef>
                <HelpDef term="House-league coaches">A season under way, and one division or <strong>Every division</strong>.</HelpDef>
                <HelpDef term="Coaches you pick">Tick the people. <em>For this email only. The pick isn&rsquo;t saved.</em></HelpDef>
              </HelpDefs>
              <p>A coach who was invited and hasn&rsquo;t accepted yet, and a coach with no email on file, are left out and counted in the foot. A league admin or registrar can write only to house-league coaches.</p>
            </>
          ),
        },
        {
          id: 'comms-t-board',
          title: 'Email the board',
          content: (
            <>
              <p>
                <strong>To the board</strong> writes to the people who hold a board seat here: the owner, admins, league admins, league registrars and the treasurer, the same list as <strong>Organization &rsaquo; The board</strong>. Choose <strong>Everyone on the board</strong> or <strong>Board members you pick</strong>. Only people with an account are included, and you are never counted.
              </p>
              <ul>
                <li>Each email says why the person got it: that they are on the club&rsquo;s board in FieldLogicHQ, as their seat.</li>
                <li><strong>Board email can&rsquo;t be switched off.</strong> A board seat is the membership. A board member who thinks an email isn&rsquo;t for them replies and tells the sender; the owner changes the seat.</li>
                <li>Everyone you send it to, and the club&rsquo;s owner and admins, can read it afterwards, so leave out a child&rsquo;s or a family&rsquo;s details unless everyone on the board should see them.</li>
                <li>There is no copy to the club&rsquo;s inbox on a board email, and the window opens on <strong>Replies come to me</strong>.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'comms-t-replies',
          title: "Where replies go, and the copy to the club's inbox",
          content: (
            <>
              <p>
                <strong>Replies go to the club</strong>, at the contact address on its public site, and the email names the club, not you. Choose <strong>Replies come to me</strong> and replies reach you instead; the email then says who sent it. The choice is the same for every message of one send. A club with no contact address on its public site offers only <strong>Replies come to me</strong>.
              </p>
              <p>
                On an email to families or coaches, tick <strong>Send a copy to the club&rsquo;s inbox</strong> for one extra copy to that address. It isn&rsquo;t counted as someone the email reached, and it is skipped when the club&rsquo;s address is already on the list.
              </p>
            </>
          ),
        },
        {
          id: 'comms-t-check',
          title: 'Before you send, and what stops a send',
          content: (
            <>
              <ul>
                <li><strong>See the email</strong> shows it as it will arrive: each person&rsquo;s first name is added, or &ldquo;Hi,&rdquo; when there is none. It carries no link of ours and no unsubscribe link; it says who sent it, why the person got it, and that they can reply to say it isn&rsquo;t right for them.</li>
                <li><strong>See who gets it</strong> lists the people, with those it won&rsquo;t reach last: an invitation not accepted yet, or no email on file.</li>
                <li>Under the message box: keep it to the club&rsquo;s own business, and don&rsquo;t use it to sell or promote anything, for you or for a sponsor.</li>
                <li><strong>Who this reaches changed while you were writing.</strong> If anyone was added or taken off, nothing is sent. Check the list and send again.</li>
                <li><strong>An email to this group was sent a moment ago or is still going out.</strong> The same group can&rsquo;t be sent twice within a minute, or while an earlier send is still going out. Check <strong>Last sent</strong> before you send another.</li>
                <li>Your account needs your name. Emails from the club say who sent them.</li>
              </ul>
            </>
          ),
        },
      ],
      faqs: [
        {
          id: 'faq-comms-board-off',
          question: 'Can a board member turn board email off?',
          answer: <p>No. A board seat is the membership, so there is no switch for receiving board email. A board member who thinks an email isn&rsquo;t for them replies and tells the sender, and the owner can change their seat on <strong>Organization &rsaquo; The board</strong>.</p>,
          answerText: 'No. A board seat is the membership, so there is no switch for receiving board email. A board member replies and tells the sender, and the owner can change their seat on Organization, The board.',
          keywords: ['unsubscribe', 'opt out', 'mute', 'board email', 'turn off'],
        },
        {
          id: 'faq-comms-reply-wrong',
          question: 'Replies are going to the wrong place. How do I change it?',
          answer: <p>Before you send, the <strong>Replies</strong> choice under the message box says where they go: <em>Replies go to {'{Club}'}</em> or <em>Replies come to me</em>. It can&rsquo;t be changed after an email is sent. The record says where replies went.</p>,
          answerText: 'Before you send, the Replies choice under the message box says where they go: Replies go to the club or Replies come to me. It cannot be changed after an email is sent. The record says where replies went.',
          keywords: ['reply to', 'replies', 'club address', 'my address'],
        },
      ],
    },

    // ── The list ────────────────────────────────────────────────────────────
    {
      id: 'comms-list',
      group: 'After you send',
      heading: 'The list of what was sent',
      summary: 'Every email to families, coaches and the board, with who sent it and how many it reached; open one to see what it said and who it missed.',
      keywords: ['sent emails', 'list of emails', 'last sent', 'filter', 'sent to', 'season', 'who it went to', 'stopped', 'send to the ones it missed', 'mark it finished', 'send again to these people', 'didn’t go', 'not sent', 'reached', 'missed', 'automatic emails'],
      searchText: 'communications list newest first sender how many reached filter sent to families coaches the board season tick more than one show more open an email what it said who it went to sent didn’t go not sent sending the mail service accepted it cannot tell whether it was read people are named as they were when it went replies went to a copy went to the club’s inbox stopped partway still sending 15 minutes send to the 3 it missed does not count mark it finished closes the email and sends nothing everyone it was sent to has it send again to these people the same people a new email subject only automatic emails publish teams listed on the season page last sent line emails tab moved from families',
      content: (
        <p>
          Communications lists every email the club has sent to its families, its coaches and its board, newest first, each with who sent it, who it went to and how many it reached. A season&rsquo;s emails are named with the season (<em>Fall 2026 &middot; Jays</em>). A season&rsquo;s automatic emails, like the ones Publish teams sends, are listed on that season&rsquo;s own page instead.
        </p>
      ),
      subtopics: [
        {
          id: 'comms-t-list',
          title: 'Reading the list, Filter and an email',
          content: (
            <>
              <p>
                Once the club has sent more than one kind, <strong>Filter</strong> narrows the list by who it was sent to (<strong>Families</strong>, <strong>Coaches</strong>, <strong>The board</strong>) and by season; tick more than one to see them together. <strong>Show more</strong> loads older emails.
              </p>
              <p>
                Open an email to see what it said, who sent it, and <strong>Who it went to</strong>: each person as <strong>Sent</strong>, <strong>Didn&rsquo;t go</strong> or <strong>Not sent</strong>, named as they were when it went. <strong>Sent</strong> means the mail service accepted it; it can&rsquo;t tell whether it was read. The record also says where replies went and whether a copy went to the club&rsquo;s inbox.
              </p>
            </>
          ),
        },
        {
          id: 'comms-t-stopped',
          title: 'An email that stopped partway',
          content: (
            <>
              <p>
                An email still going out 15 minutes after it was sent reads as <strong>Stopped</strong>. Open it and choose <strong>Send to the 3 it missed</strong> (the number is the people it missed). It sends the same email to those people and nobody else, and it doesn&rsquo;t count toward a family email&rsquo;s 3 in 24 hours. A person who has since left the group isn&rsquo;t sent it and shows as <strong>Didn&rsquo;t go</strong>.
              </p>
              <ul>
                <li>When everyone it was sent to already has it and only the last mark is missing, the button reads <strong>Mark it finished</strong>. It closes the email and sends nothing.</li>
                <li>Anyone who can write to that same group now can finish it. A board email can be finished only by its sender, the owner or an admin; anyone else is told who can.</li>
                <li>If the finish gets no answer, it may still be sending. Check the email in a few minutes before you try again.</li>
                <li>Once the words are deleted (see <a href="#comms-kept">How long the words are kept</a>), a stopped email can&rsquo;t be finished.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'comms-t-again',
          title: 'Send again to these people',
          content: (
            <p>
              <strong>Send again to these people</strong>, on an email&rsquo;s record, opens a new email to the same people with the subject filled in and an empty message. Anyone who can&rsquo;t be picked now (they left the group, or your seat can&rsquo;t write to them) is left out, and the window says how many. It can&rsquo;t be used once the list of who it went to has been deleted.
            </p>
          ),
        },
      ],
    },

    // ── Who reads ───────────────────────────────────────────────────────────
    {
      id: 'comms-who-reads',
      group: 'After you send',
      heading: 'Who can read a sent email',
      summary: 'Owners and admins read everything; a league admin or registrar reads what reached house-league people; a board email only its sender, its recipients, and owners and admins.',
      keywords: ['who can read', 'who can see', 'read a sent email', 'privacy', 'board email readers', 'registrar sees', 'league admin sees', 'rep coach names', 'treasurer sees'],
      searchText: 'who can read a sent email owner admin every email board emails league admin registrar house-league emails every family email names withheld wider family email rep coaches counted not named a pick that includes a rep coach cannot open treasurer only board emails they sent or received board email sender recipients owner admins nobody else a seat added later switch off suspended',
      content: (
        <>
          <HelpDefs>
            <HelpDef term="Owner and club admins">Every email in the list, including board email they weren&rsquo;t sent.</HelpDef>
            <HelpDef term="League admin and league registrar">Every email to a house league season, and every email to every family or all coaches. A coach pick made only of house-league coaches. They see their own house-league coaches by name; any rep coaches it reached are counted (<em>7 rep coaches</em>), never named. A wider family email shows its message and counts, with no family names. A pick that included a rep coach, even one who also coaches house league, is not theirs to read.</HelpDef>
            <HelpDef term="Treasurer">Only board emails they sent or received.</HelpDef>
            <HelpDef term="Board email, for everyone else">Readable only by its sender, the people it went to, and the club&rsquo;s owner and admins. A board member added later reads it only if they are the owner or an admin.</HelpDef>
          </HelpDefs>
          <p>An email you can&rsquo;t read isn&rsquo;t in your list at all, and opening its address finds nothing. A person whose seat has ended, or whose Communications switch is off, reads nothing.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-comms-cant-open',
          question: "An email isn't in my list, or I can't open it. Why?",
          answer: <p>Each seat reads only some emails (see above). A league admin or registrar doesn&rsquo;t see an email that reached a rep coach, and a board email is only for its sender, its recipients, and the owner and admins. Ask the owner or an admin.</p>,
          answerText: 'Each seat reads only some emails. A league admin or registrar does not see an email that reached a rep coach, and a board email is only for its sender, its recipients, and the owner and admins. Ask the owner or an admin.',
          keywords: ['missing email', 'cannot open', 'not in the list', 'not found'],
        },
      ],
    },

    // ── How long ────────────────────────────────────────────────────────────
    {
      id: 'comms-kept',
      group: 'After you send',
      heading: 'How long the words are kept',
      summary: 'The subject and message are deleted 12 months after the send, and who it went to 24 months after.',
      keywords: ['retention', 'how long', 'deleted', '12 months', '24 months', 'keep', 'delete emails', 'words deleted', 'privacy'],
      searchText: 'how long sent emails are kept the subject and message are deleted 12 months after the email is sent the names of the people it went to 24 months after the date sender group and counts are kept while the organization exists deleting an organization deletes these records its words were deleted so it can’t be sent again who it went to was deleted can’t be sent to the same people again privacy policy',
      content: (
        <>
          <p>
            The subject and message are deleted 12 months after the email is sent, and the names of the people it went to 24 months after. The date, sender, group and counts are kept while the organization exists, and deleting an organization deletes these records with it.
          </p>
          <p>
            An email whose words are gone reads <em>The subject and message were deleted 12 months after it was sent</em> and can&rsquo;t be sent again. One whose list of people is gone can&rsquo;t be sent to the same people again.          </p>
        </>
      ),
    },

    // ── The switch ──────────────────────────────────────────────────────────
    {
      id: 'comms-switch',
      group: 'Setting it up',
      heading: 'The Communications switch',
      summary: 'The owner turns Communications on or off for each member, in Members, Manage.',
      keywords: ['communications switch', 'turn off communications', 'turn on communications', 'members manage', 'what they can open', 'access', 'group email off'],
      searchText: 'the owner turns communications on or off for a member in members manage what they can open writes group email and reads what was sent off no group email from communications or a season’s email families practice reminder and team change notice still go set messages board email sent to them still arrives a board seat is the membership only the owner changes what a member can open admin league admin registrar treasurer',
      content: (
        <>
          <p>
            In <strong>Members &rarr; Manage</strong>, under what the member can open, the owner turns <strong>Communications</strong> on or off. It is on unless the owner turns it off. Only the owner changes it.
          </p>
          <p>
            With it off, the member can&rsquo;t write group email in Communications or in a season&rsquo;s <strong>Email families</strong> tab, and can&rsquo;t read the list of what was sent. Board email sent to them still arrives: a board seat is the membership.
          </p>
          <p>
            The switch covers email a person writes. The practice reminder and the team-change notice are set messages the house-league screens send for an action, so they still go when it is off.
          </p>
        </>
      ),
    },
  ],
};

export default communicationsHelp;
