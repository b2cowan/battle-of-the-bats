import type { HelpPageContent } from './index';
import { HelpDefs, HelpDef, HelpSteps, HelpNote } from '@/components/help/HelpBlocks';

const accountingHelp: HelpPageContent = {
  title: 'Accounting',
  role: 'Treasurer, Admin, Owner',
  intro: 'Accounting keeps the club’s own books — the General ledger, a book for each tournament, and any fund you keep apart — and, for a club that runs rep teams, the money between the club and its teams: what the club bills them, and what they ask of it. It is one page with tabs, included with the Club plan. Owners and treasurers work here by default; an admin needs the accounting permission granted by the owner.',
  sections: [
    {
      id: 'who-can-use',
      group: 'Getting started',
      heading: 'Who can use Accounting',
      summary: 'Accounting is a Club-plan module; owners and treasurers work here, admins need it granted.',
      keywords: ['accounting access', 'club plan', 'add-on', 'treasurer', 'permission', 'access restricted', 'cannot see allocations', 'where did allocations go'],
      searchText: 'accounting access club plan add-on enable module treasurer admin owner permission capability access restricted who can use unlock contact owner allocations payment requests moved from rep teams admin with rep teams cannot see allocations',
      content: (
        <>
          <p>Accounting is included with the <strong>Club</strong> plan. If your organization doesn’t have it, the Accounting area shows an <strong>Access Restricted</strong> message — ask your organization owner about moving to Club.</p>
          <p>Once it’s enabled, who can do what:</p>
          <ul>
            <li><strong>Owners and treasurers</strong> — everything: the books, allocations, payment requests, reminders and the budget.</li>
            <li><strong>Admins</strong> — only if the owner grants them the accounting permission. Without it, Accounting stays hidden.</li>
            <li><strong>Coaches</strong> never open Accounting. They see their own side of the same money on their team’s <strong>Club</strong> screen in the Coaches Portal.</li>
          </ul>
          <HelpNote variant="info" title="Allocations and Payment requests live here now">They used to sit under Rep Teams. They are club money, so they moved to Accounting — which means an admin who holds Rep Teams but not the accounting permission no longer sees them. Old links and bookmarks still land on the right page.</HelpNote>
        </>
      ),
    },
    {
      id: 'accounting-tabs',
      group: 'Getting started',
      heading: 'Finding your way: one page, six tabs',
      summary: 'Overview, Ledger, Allocations, Payment requests, Budget and Budget vs. Actual — tabs across the top of one page.',
      keywords: ['tabs', 'overview', 'ledger tab', 'allocations tab', 'payment requests tab', 'budget', 'budget vs actual', 'navigation', 'where is'],
      searchText: 'accounting tabs overview ledger allocations payment requests budget budget vs actual one page tab bar rail where is the ledger where are allocations where are payment requests back arrow one level down team account payees',
      content: (
        <>
          <p>Accounting is one page, and its tabs run across the top:</p>
          <HelpDefs>
            <HelpDef term="Overview">The club’s figures for a period, its books, and what each team owes the club.</HelpDef>
            <HelpDef term="Ledger">One book at a time, read like a bank statement. The <strong>Book</strong> pill switches between the club’s books.</HelpDef>
            <HelpDef term="Allocations">What the club bills its teams, and what is coming due.</HelpDef>
            <HelpDef term="Payment requests">What the teams ask of the club, waiting for your answer.</HelpDef>
            <HelpDef term="Budget">The season’s plan by category and line.</HelpDef>
            <HelpDef term="Budget vs. Actual">The plan against what has been allocated and collected.</HelpDef>
          </HelpDefs>
          <p><strong>Allocations</strong> and <strong>Payment requests</strong> appear only when your club runs rep teams. A page one level down — an allocation, a team’s account, Payees — has no tabs; its back arrow returns you to the tab you came from.</p>
        </>
      ),
    },
    {
      group: 'Getting started',
      heading: 'The club’s books, and the Overview',
      id: 'ledgers',
      summary: 'Every dollar lives in a book: the General ledger, a tournament’s book, or a fund you keep apart.',
      keywords: ['ledger', 'book', 'general ledger', 'tournament ledger', 'org sub-ledger', 'net position', 'overview', 'held by the teams'],
      searchText: 'ledger book general ledger tournament ledger house league book org sub-ledger reserve fund net position net balance overview period from to income expenses pending held by the teams outstanding next due team cash is the coaches',
      content: (
        <>
          <p>The club’s money is kept in <strong>books</strong> (ledgers). Each has a kind:</p>
          <HelpDefs>
            <HelpDef term="Club">The <strong>General ledger</strong>, where the club’s everyday money lives, plus any book you open to keep money apart — an equipment reserve, a bursary fund.</HelpDef>
            <HelpDef term="Tournament">One tournament’s fees, costs and any float the club moves to it.</HelpDef>
            <HelpDef term="House league">A house league season’s registration fees.</HelpDef>
          </HelpDefs>
          <p>The <strong>Overview</strong> tab opens with four figures — <strong>Income</strong>, <strong>Expenses</strong>, <strong>Net position</strong> and <strong>Pending</strong> — for the period in its <strong>From</strong> and <strong>To</strong> boxes. It starts on this calendar year and updates as soon as you change a date. Below them, <strong>The club’s books</strong> lists every book with its kind and its balance; a book opens the Ledger tab on it.</p>
          <p>For a club that runs rep teams, <strong>Held by the teams</strong> lists what each team owes the club and its next due date. A team’s own cash belongs to its coaches — the club reads only what the team owes it. A team opens its <a href="#team-account">account with the club</a>.</p>
        </>
      ),
    },
    {
      id: 'recipe-create-ledger',
      group: 'How-to recipes',
      heading: 'How to add a ledger',
      summary: 'Open a book for a fund you keep apart, or for a tournament that doesn’t have one yet.',
      keywords: ['create ledger', 'add ledger', 'tournament ledger', 'org sub-ledger', 'budget bucket', 'reserve'],
      searchText: 'create ledger add ledger new book tournament ledger org sub-ledger budget bucket reserve fund bursary fund equipment reserve tournament without a ledger open ledger book pill',
      content: (
        <>
          <p>Open a book when money needs its own balance — a fund you keep apart, or a tournament.</p>
          <HelpSteps>
            <li>Press <strong>Add ledger</strong> — on the Overview beside <strong>The club’s books</strong>, or at the foot of the <strong>Book</strong> pill on the Ledger tab.</li>
            <li>Choose <strong>The club — a book of its own</strong> and name it the way your board will recognize it, or choose a tournament that doesn’t have a book yet.</li>
            <li>Press <strong>Add ledger</strong>. The Ledger tab opens on the new book.</li>
          </HelpSteps>
          <p>Add opening entries only if you are bringing balances forward from another system.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-which-ledger-to-use',
          question: 'Should I use a tournament ledger or a club book?',
          answerText: 'Use a tournament ledger for one event. Use the General ledger for the club’s everyday money, and a club book of its own for money you keep apart, such as a reserve or a bursary fund.',
          keywords: ['ledger type', 'tournament ledger', 'sub-ledger', 'general ledger'],
          popular: true,
          answer: (
            <p>Use a <strong>tournament ledger</strong> for one event. Use the <strong>General ledger</strong> for the club’s everyday money, and a <strong>club book of its own</strong> for money you keep apart, such as a reserve or a bursary fund.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-add-income-expense',
      group: 'How-to recipes',
      heading: 'How to add an entry',
      summary: 'Record money in or out on a book, with a category, a payee and how it was paid.',
      keywords: ['add income', 'add expense', 'add entry', 'entry', 'posted', 'pending', 'category', 'payee', 'payment method', 'cheque not cleared'],
      searchText: 'add income add expense add entry ledger entry money in money out the club paid the club received posted pending cheque written not yet cleared category new category description what date amount payee payer paid to paid by how it was paid reference e-transfer cheque number notes receipt invoice umpire diamond rental',
      content: (
        <>
          <p>Every entry should make sense later without anyone needing to remember the context.</p>
          <HelpSteps>
            <li>On the <strong>Ledger</strong> tab, pick the book with the <strong>Book</strong> pill, then press <strong>Add entry</strong>.</li>
            <li>Choose <strong>Out — the club paid</strong> or <strong>In — the club received</strong>, and give the date.</li>
            <li>Say <strong>What</strong> it was, the <strong>Amount</strong> and the <strong>Category</strong> — pick one, or choose <strong>A new category…</strong> and type it.</li>
            <li>Optionally name who it was <strong>Paid to</strong> (or <strong>Paid by</strong>), <strong>How it was paid</strong>, and the cheque or E-Transfer <strong>Reference</strong>.</li>
            <li>Leave the status on <strong>Posted</strong>, or choose <strong>Pending</strong> for a cheque written that hasn’t cleared yet. Then add it.</li>
          </HelpSteps>
          <p>Use the same category names every time — the Ledger’s Category filter and every export read them.</p>
        </>
      ),
    },
    {
      id: 'recipe-transfer-between-ledgers',
      group: 'How-to recipes',
      heading: 'How to transfer money between the club’s books',
      summary: 'Move money from one club book to another without counting it twice.',
      keywords: ['transfer', 'move money', 'ledger transfer', 'double-counting', 'float', 'tournament float'],
      searchText: 'transfer money between ledgers move funds ledger transfer float tournament float both halves double-counting org totals source destination void a transfer tools menu where is transfer',
      content: (
        <>
          <p>Use a transfer when money moves from one of the club’s books to another — a float to a tournament, money set aside into a reserve.</p>
          <HelpSteps>
            <li>On the <strong>Ledger</strong> tab, open the book the money leaves, then <strong>Tools → Transfer</strong>. (On a phone, Tools is the <strong>⋯</strong> beside Export.)</li>
            <li>Choose the book it goes to.</li>
            <li>Enter the amount, the date and what it’s for.</li>
            <li>Save. Both books show their half of the transfer.</li>
          </HelpSteps>
          <p>Don’t record the same movement as an expense in one book and income in another — a transfer keeps the club’s totals honest. A transfer can’t be edited: if one is wrong, open it, choose <strong>Void this transfer</strong> (both halves are voided together), and enter it again.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-transfer-vs-income-expense',
          question: 'Why should I use a transfer instead of income and expense entries?',
          answerText: 'A transfer writes matching halves on both books, so the club’s totals stay accurate. Recording the same movement as separate income and expense counts it twice.',
          keywords: ['transfer', 'double-counting', 'income expense'],
          answer: (
            <p>A transfer writes matching halves on both books, so the club’s totals stay accurate. Recording the same movement as separate income and expense counts it twice.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-board-report',
      group: 'How-to recipes',
      heading: 'How to prepare a board-ready financial report',
      summary: 'Use the Overview’s period, each book’s export, and Budget vs. Actual to produce a clean treasurer report.',
      keywords: ['board report', 'budget vs actual', 'treasurer report', 'export pdf', 'date range'],
      searchText: 'board report treasurer report budget vs actual date range period from to categories export pdf csv xlsx financial report monthly meeting headroom',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>For a monthly or year-end report, start broad and then drill into the detail.</p>
          <HelpSteps>
            <li>On the <strong>Overview</strong>, set <strong>From</strong> and <strong>To</strong> to the report’s period.</li>
            <li>Check each book’s balance, and open any that looks wrong.</li>
            <li>On the <strong>Ledger</strong>, set <strong>Date</strong> to the same period and <strong>Export</strong> each book — every entry in the period, with its totals.</li>
            <li>Export <strong>Budget vs. Actual</strong> for the board packet — the PDF option needs Tournament Plus or above.</li>
          </HelpSteps>
          <p>Before sharing a report outside the board, take out any personal information and check the period once more.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'entries',
      heading: 'Reading the Ledger, and correcting a line',
      summary: 'Oldest first between a starting and an ending balance, each with its date; filters; Tools; editing, voiding, and lines that come from elsewhere.',
      keywords: ['entry', 'income', 'expense', 'transfer', 'posted', 'pending', 'void', 'edit entry', 'starting balance', 'ending balance', 'book pill', 'filters', 'tools'],
      searchText: 'ledger book pill switch books entry income expense transfer posted pending void edit entry saves as you type autosave starting balance ending balance oldest first bank statement running balance money out money in type status category date this month all time filters balance disappears balance column gone balance hidden when filtering category untick posted pending line faint void reason audit trail read only line from an allocation request fee where to change it team book team account tools menu payees transfer where did the payees button go where did the transfer button go year on the balance lines row shows only the day phone card',
      content: (
        <>
          <p>The <strong>Ledger</strong> tab shows one book at a time. The <strong>Book</strong> pill switches books — it opens on the General ledger and shows every book’s balance. <strong>Tools</strong> (⋯, beside Export) holds the rarer jobs: <a href="#recipe-transfer-between-ledgers">Transfer</a> and <a href="#payees">Payees</a>.</p>
          <p>The book reads <strong>oldest first</strong>, like a bank statement: a <strong>Starting balance</strong> at the top and an <strong>Ending balance</strong> at the foot, each named with its full date (<em>Starting balance · Jul 3, 2026</em>), and between them every line with its day (<em>Aug 12</em>), its <strong>Money out</strong>, <strong>Money in</strong> and running <strong>Balance</strong>. The balance for the whole book also sits at the right of the filters. On a phone each line is its own card.</p>
          <HelpDefs>
            <HelpDef term="Type">Expenses, income, team allocations, team support, transfers. Narrowing it hides the Balance column, because a running total of only some lines isn’t a balance of anything.</HelpDef>
            <HelpDef term="Status">Starts on <strong>Posted</strong> and <strong>Pending</strong>. A pending line is faint and keeps the balance before it until it clears. Tick <strong>Void</strong> to see voided lines, each with its reason. Untick <strong>Posted</strong> and the Balance column goes too — posted lines are the ones that move it.</HelpDef>
            <HelpDef term="Category">One or several of your categories. Like Type, it hides the Balance column.</HelpDef>
            <HelpDef term="Date">Starts on <strong>This month</strong>. Pick a preset, your own dates, or <strong>All time</strong>. The Balance column stays: the starting balance carries everything before your dates.</HelpDef>
          </HelpDefs>
          <p><strong>Every line opens.</strong> A line you typed opens ready to edit, and saves as you type. <strong>Void this line</strong> asks why; the line stays on the book, marked void with your reason and your name, and counts nowhere. A line written by an allocation, a payment request or a house league fee is read-only, and says where to change it — undo the payment, or reverse the approval, and both books follow.</p>
          <p>A team’s own book isn’t on the Ledger. The club reads a team through its <a href="#team-account">account</a>.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'payees',
      heading: 'Payees: who the club pays, and who pays it',
      summary: 'Rename a payee, merge two spellings of one, delete one no line uses, and choose which ones the club’s teams can use.',
      keywords: ['payee', 'payees', 'payer', 'vendor', 'merge payees', 'rename payee', 'delete payee', 'two spellings', 'manage payees', 'shared with teams', 'share a payee', 'teams column', 'the club’s own'],
      searchText: 'payee payees payer vendor supplier merge payees two spellings duplicate payee rename payee delete payee manage payees paid to paid by last used tools menu share a payee with teams shared with teams switch teams column the club’s own which payees can teams use team picker shared by your club club sees payments teams cannot rename stop sharing',
      content: (
        <>
          <p><strong>Payees</strong> are the names on the Ledger’s <strong>Paid to</strong> and <strong>Paid by</strong> lines. Open the list from the Ledger’s <strong>Tools → Payees</strong> (on a phone too), or from <strong>Manage payees…</strong>, the last row of the payee picker in any entry.</p>
          <ul>
            <li><strong>Rename</strong> — open a payee and change its name. It saves as you type, and every line that names it follows.</li>
            <li><strong>Merge</strong> — when one supplier has two spellings, open one and choose <strong>Merge into another payee</strong>. Every line moves to the name you keep.</li>
            <li><strong>Delete</strong> — only a payee no line uses, the club’s or a team’s. One that is in use can be merged instead.</li>
            <li><strong>Share with teams</strong> — in a club that runs teams, the <strong>Teams</strong> column says which payees are <strong>Shared with teams</strong> and which are <strong>The club’s own</strong>. Open a payee and turn on <strong>Shared with teams</strong>: every team can pick it as a payee, can’t rename or merge it, and their payee list tells them the club sees payments to it. Turn it off and it leaves their picker; a team record that already names it keeps the name.</li>
          </ul>
          <p>A team’s own payees are its coaches’ to manage, in the Payees window on their own Ledger.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'categories',
      heading: 'Using categories for filtering and reporting',
      summary: 'Pick a category from your list or add a new one; consistent names power the filters and the exports.',
      keywords: ['category', 'categories', 'reporting', 'filtering', 'export', 'new category'],
      searchText: 'category categories reporting filtering export a new category registration fees diamond rental umpire fees sponsorship grant fundraising consistent names',
      content: (
        <>
          <p>Every entry has a <strong>category</strong>. Pick one from the list your books already use, or choose <strong>A new category…</strong> to add one. Consistent names pay off when you compare years or prepare a treasurer’s report.</p>
          <p>Names that work well for a tournament book: Registration Fees, Diamond Rental, Umpire Fees, Trophies &amp; Medals, Prize Pool, Sponsorship. For the club’s books: Grant Income, Fundraising, General Expenses, Administrative.</p>
          <p>The Ledger’s <strong>Category</strong> filter narrows a book to one or several categories, and every export carries the category column.</p>
        </>
      ),
    },
    {
      group: 'The club and its teams',
      id: 'allocations',
      heading: 'Allocations: billing the teams',
      summary: 'Split a shared cost across teams in installments, see what is coming due, and record what arrives.',
      keywords: ['allocation', 'allocations', 'cost allocation', 'rep team', 'shared costs', 'installments', 'coming due', 'record received', 'confirm received', 'undo a payment', 'sent waiting for you to confirm'],
      searchText: 'cost allocation allocations rep team shared costs diamond fees insurance association fees installment schedule new allocation details team splits review by allocation coming due overdue sent waiting for you to confirm due in the next 14 days later show all needs you on track record received confirm received received on how it came reference e-transfer cheque undo a payment returned by the bank reason general ledger voided due again coaches told remind this team open the team account where did allocations go rep teams allocations moved',
      content: (
        <p>An <strong>allocation</strong> splits a shared cost — diamond fees, insurance, association dues — across the teams you choose, each share in installments with due dates. The Allocations tab is where you bill the teams, watch what is coming due, and record what arrives.</p>
      ),
      subtopics: [
        {
          id: 'allocations-create',
          title: 'Billing the teams for a shared cost',
          content: (
            <>
              <p>On the <strong>Allocations</strong> tab, press <strong>New allocation</strong>. Three steps: <strong>Details</strong> (what it is, and the season), <strong>Team Splits</strong> (each team’s share — a set amount, a percentage or by sessions — with one due date or several installments), and <strong>Review</strong>. You can also allocate a budget line to the teams from the <strong>Budget</strong> tab.</p>
              <p>Each team’s coaches see their share on their <strong>Club</strong> screen straight away. They file it under one of their own budget words — that classification is theirs, so two teams may file the same cost differently.</p>
            </>
          ),
        },
        {
          id: 'allocations-coming-due',
          title: 'What is coming due',
          content: (
            <>
              <p>The <strong>View</strong> pill on the Allocations tab reads the bills two ways. <strong>By allocation</strong> lists each allocation with what was allocated, collected and still outstanding. <strong>Coming due</strong> lists every team’s installments by when they need you:</p>
              <HelpDefs>
                <HelpDef term="Overdue">Past its due date and not received, with the total.</HelpDef>
                <HelpDef term="Sent · waiting for you to confirm">The team’s coach says they’ve sent it. Nothing counts until you confirm it arrived.</HelpDef>
                <HelpDef term="Due in the next 14 days">Coming up soon.</HelpDef>
                <HelpDef term="Later">Everything after that — one <strong>Show all</strong> away.</HelpDef>
              </HelpDefs>
              <p>Open an allocation to see its four figures and its teams, in two bands: <strong>Needs you</strong> and <strong>On track</strong>. A team opens its bill: what it was billed, collected and still owes, and each installment with its state. <strong>Previous</strong> and <strong>Next</strong> walk you from team to team.</p>
            </>
          ),
        },
        {
          id: 'allocations-record',
          title: 'Recording money that arrived',
          content: (
            <>
              <p>Money enters the club’s books only when the club says it arrived. On a team’s bill:</p>
              <ul>
                <li><strong>Record received</strong> — on any installment still owed. Give the day it arrived, how it came, and the cheque or E-Transfer reference.</li>
                <li><strong>Confirm received</strong> — when the coach has said they sent it. The window is filled in from what the coach told you; check it against your bank and confirm.</li>
              </ul>
              <p>Either way, the General ledger gets one line, the installment reads <strong>Received</strong>, and the team’s coaches see it and are told.</p>
              <HelpNote variant="info" title="Someone else got there first?">If another treasurer recorded the same installment a moment before you, the window says so in words and the bill refreshes — nothing is counted twice.</HelpNote>
            </>
          ),
        },
        {
          id: 'allocations-undo',
          title: 'Undoing a payment, and reminding a team',
          content: (
            <>
              <p><strong>Undo a payment</strong> sits at the foot of a team’s bill once anything has been received. Choose the payment, and say why — <em>the E-Transfer was returned by the bank</em>. The General ledger line is voided (it stays, marked void, with your reason), the installment is due again, and the team’s coaches see it and are told why. Undo only a payment that didn’t happen or went against the wrong team.</p>
              <p><strong>Remind</strong> on a bill emails that team’s head coaches what is overdue or due in the next 14 days. A team with no head coach yet says so, because there is nobody to remind. For every team at once, see <a href="#reminders">Reminders</a>.</p>
            </>
          ),
        },
      ],
    },
    {
      group: 'The club and its teams',
      id: 'payment-requests',
      heading: 'Payment requests: what the teams ask of the club',
      summary: 'Approve, decline or reverse what a team asks — money to the club, or money from it.',
      keywords: ['payment requests', 'payment request', 'approve', 'decline', 'reverse', 'reimbursement', 'holding up the payout', 'confirm received', 'where did payment requests go'],
      searchText: 'payment requests payment request coach request approve decline deny reason reverse an approval reimbursement money to the club money from the club confirm received approve and pay paid on how reference general ledger waiting on you decided team filter holding up the payout end of season payout families share unanswered request someone already acted refused refresh rep teams payment requests moved',
      content: (
        <>
          <p>A team’s coaches send the club a <strong>payment request</strong> in either direction: money <strong>to the club</strong> (handing back a float, their share of an invoice) or money <strong>from the club</strong> (a permit they paid out of pocket, a cost the club agreed to cover). The tab lists them in two bands — <strong>Waiting on you</strong>, with its total, and <strong>Decided</strong> — and the <strong>Team</strong> filter narrows to one or several teams.</p>
          <p>Open a request to answer it:</p>
          <HelpDefs>
            <HelpDef term="Approve">For money from the club, <strong>Approve</strong> asks the day you paid, how and the reference. For money to the club, the button reads <strong>Confirm … received</strong> and asks when it arrived. Either way, the General ledger gets the line and the coaches are told.</HelpDef>
            <HelpDef term="Decline">Asks for a reason. The coach reads it on their Club screen; nothing touches the books.</HelpDef>
            <HelpDef term="Reverse this approval">On an approved request, with a reason. The General ledger line is voided — it stays, marked void — the request reads <strong>Reversed</strong>, and the coaches are told. It corrects the books; if money really moved, getting it back is between the club and the team.</HelpDef>
          </HelpDefs>
          <HelpNote variant="warning" title="A request can hold up a team’s payout">A team can’t pay families their end-of-season share while a request to the club is unanswered. The request says so in red, and the hub’s morning brief counts how many are holding up a payout — answer those first.</HelpNote>
          <p>If another admin answered the same request a moment before you, the window says so in words and the request refreshes.</p>
        </>
      ),
    },
    {
      group: 'The club and its teams',
      id: 'team-account',
      heading: 'A team’s account with the club',
      summary: 'What one team has been billed, has paid and still owes the club — the club’s own records.',
      keywords: ['team account', 'what does a team owe', 'team statement', 'held by the teams', 'outstanding'],
      searchText: 'team account account with the club what does a team owe team statement held by the teams billed received outstanding next due requests the club own records read only never added to club figures export',
      content: (
        <>
          <p>Open a team from <strong>Held by the teams</strong> on the Overview, or with the <strong>Open … ’s account</strong> button at the foot of its bill on an allocation. Three figures lead — <strong>Outstanding</strong>, <strong>Next due</strong>, and <strong>Paid to the team</strong> on its requests — then the account reads like a statement: what the club billed the team, what the team paid, and what the club paid it.</p>
          <p>These are the club’s own records of the team, read-only here. They are never added into the club’s figures — the team’s money is its coaches’, and this page only says where the team stands with the club. <strong>Export</strong> gives you the statement as a file.</p>
        </>
      ),
    },
    {
      group: 'The club and its teams',
      id: 'rep-team-dues',
      heading: 'Rep-team dues vs. the free coach Fees',
      summary: 'Two different money tools — installment-based rep-team dues, and the simple free-portal Fees tracker.',
      keywords: ['dues', 'installments', 'coach fees', 'player dues', 'reminders'],
      searchText: 'dues schedule installments player dues coach fees rep team premium workspace free coaches portal fees mark paid reminders difference team accounting',
      links: [
        { label: 'Coaches Portal guide', href: '../help/coaches' },
      ],
      content: (
        <>
          <p>Coaches track what families owe in one of two ways, and they often get confused:</p>
          <ul>
            <li><strong>Rep-team dues (Club / Premium team workspace).</strong> The coaches set a <strong>dues schedule</strong> — how much each player owes, split into installments with due dates — and record each payment. Families get the automated dues reminders described below.</li>
            <li><strong>The free Coaches Portal Fees tool.</strong> A coach running a free, standalone team home tracks fees as simple flat charges (charge everyone or one player, then mark paid). It has no installments or automated reminders. See the <a href="../help/coaches">Coaches Portal guide</a>.</li>
          </ul>
          <p>As the club, you see the <strong>allocation</strong> side — what the club has billed each team. The coaches see the dues side — what families owe the team. A team’s dues are its coaches’ to run.</p>
        </>
      ),
    },
    {
      group: 'The club and its teams',
      id: 'reminders',
      heading: 'Reminders, and the budget tabs',
      summary: 'Remind head coaches what their team owes the club; family dues reminders run on their own; plan on the Budget tab.',
      keywords: ['reminders', 'send reminders', 'allocation reminders', 'dues reminders', 'org budget', 'budget vs actual', 'planning', 'add budget item', 'new budget line'],
      searchText: 'send reminders allocation reminders remind coaches what their team owes the club preview who gets one late nobody to send to no head coach one email per team reply comes to you last sent automated dues reminders 30-day 7-day guardians automatic daily runs on its own do i have to click org budget budget vs actual planning tools add a budget line add budget item new item not in the list add to your list item category',
      content: (
        <>
          <p><strong>Send reminders</strong> on the Allocations tab emails each team’s head coaches — and any staff the head coach gave money access — what their team owes the club: anything overdue, and anything due in the next 14 days. It shows you first who gets one and what each email lists, marks the late ones, and names any team with nobody to send to (no head coach yet, or an invitation nobody has answered). Each coach gets one email; a reply comes to you. The window also says when reminders were last sent, and by whom.</p>
          <p><strong>Family dues reminders</strong> go out on their own. Each day, guardians with an upcoming installment get an email — about a month ahead and about a week ahead — for every team whose <strong>Automatic Dues Reminders</strong> switch is on (each coach controls their own team’s switch). A guardian is never emailed twice in the same week for the same installment. You don’t have to do anything to keep this running.</p>
          <p>The <strong>Budget</strong> tab plans the season by category and line, and allocates costs to teams. Each line picks an item from your list; for something new, type its name in the item box, choose <strong>+ Add “…” to your list</strong>, pick its category and click <strong>Add item</strong>. <strong>Budget vs. Actual</strong> is explained below.</p>
        </>
      ),
    },
    {
      group: 'The club and its teams',
      id: 'budget-vs-actual',
      heading: 'Reading Budget vs. Actual',
      summary: 'See estimated, allocated, and collected amounts per line, plus org headroom and team collection health.',
      keywords: ['budget vs actual', 'estimated', 'allocated', 'collected', 'headroom', 'team collection health'],
      searchText: 'budget vs actual estimated allocated collected unallocated status org headroom org ledger expenses team collection health on track behind overdue pdf view allocation',
      content: (
        <>
          <p>Budget vs. Actual compares what you planned against what has been allocated and collected. Each budget line shows:</p>
          <ul>
            <li><strong>Estimated</strong> — the amount you budgeted.</li>
            <li><strong>Allocated</strong> — the amount split out to teams.</li>
            <li><strong>Collected</strong> — what has actually come in.</li>
            <li><strong>Unallocated</strong> — the estimated amount not yet allocated.</li>
            <li><strong>Status</strong> — Allocated or Unallocated.</li>
          </ul>
          <p>The headline <strong>Org Headroom</strong> shows your budgeted total against org ledger expenses. The <strong>Org Ledger Expenses</strong> panel lists the year’s posted expenses as one total; it isn’t matched line by line to the budget. The <strong>Team Collection Health</strong> grid shows each team’s collection progress with an On Track / Behind / Overdue status, and <strong>View Allocation</strong> opens the allocation behind a line.</p>
          <p>Export this report from the <strong>Export</strong> menu — Excel and CSV are available on all plans; the <strong>PDF</strong> board-packet option needs Tournament Plus or above.</p>
        </>
      ),
    },
    {
      id: 'exports',
      group: 'How accounting works',
      heading: 'Exporting accounting data',
      summary: 'Export a book, the allocations, the payment requests, a team’s account, the budget and Budget vs. Actual.',
      keywords: ['export', 'xlsx', 'csv', 'pdf', 'spreadsheet', 'download', 'board', 'report', 'ledger', 'budget', 'allocations export', 'payment requests export'],
      searchText:
        'export xlsx csv excel pdf spreadsheet download board report ledger book whole period signed amount money out negative void marked void left out of totals total money in total money out net allocations coming due allocation payment requests team account statement budget budget-vs-actual print treasurer tournament plus',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Each Accounting page has one <strong>Export</strong> button; Excel comes first, then CSV. The <strong>PDF</strong> board packet (on Budget vs. Actual) needs Tournament Plus or above.</p>
          <HelpDefs>
            <HelpDef term="A book (Ledger)">Every entry in the period you’re reading — not just what’s on screen — whatever the other filters say. One <strong>Amount</strong> column, signed: money out is negative. A void line is kept, marked VOID, and left out of the totals at the foot: total money in, total money out and the net. The menu says all this before it runs.</HelpDef>
            <HelpDef term="Allocations">The list, or the Coming due view, whichever you’re reading.</HelpDef>
            <HelpDef term="An allocation">Every team’s share and every installment, with how each payment came.</HelpDef>
            <HelpDef term="Payment requests">Every request with its decision.</HelpDef>
            <HelpDef term="A team’s account">The team’s statement with the club.</HelpDef>
            <HelpDef term="Budget and Budget vs. Actual">The plan by category and line, and the estimated / allocated / collected report.</HelpDef>
          </HelpDefs>
          <p>
            See the <a href="../help/exports">Exports &amp; Downloads guide</a> for format details,
            plan requirements, and PDF configuration.
          </p>
        </>
      ),
    },
  ],
};

export default accountingHelp;
