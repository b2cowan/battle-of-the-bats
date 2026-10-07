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
      keywords: ['tabs', 'overview', 'board summary', 'ledger tab', 'allocations tab', 'payment requests tab', 'budget', 'budget vs actual', 'navigation', 'where is'],
      searchText: 'accounting tabs overview ledger allocations payment requests budget budget vs actual one page tab bar rail where is the ledger where are allocations where are payment requests back arrow one level down team account payees',
      content: (
        <>
          <p>Accounting is one page, and its tabs run across the top:</p>
          <HelpDefs>
            <HelpDef term="Overview">The board summary: where the club stands today, the year against the budget, the teams and the club’s books.</HelpDef>
            <HelpDef term="Ledger">One book at a time, read like a bank statement. The <strong>Book</strong> pill switches between the club’s books.</HelpDef>
            <HelpDef term="Allocations">What the club bills its teams, and what is coming due.</HelpDef>
            <HelpDef term="Payment requests">What the teams ask of the club, waiting for your answer.</HelpDef>
            <HelpDef term="Budget">The year’s plan, revenue first and then expenses, line by line.</HelpDef>
            <HelpDef term="Budget vs. Actual">The year’s plan against what the club’s books actually moved.</HelpDef>
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
      keywords: ['ledger', 'book', 'general ledger', 'tournament ledger', 'org sub-ledger', 'overview', 'board summary', 'where the club stands', 'cash on hand', 'owed by the teams', 'waiting on you', 'held by the team', 'board report', 'year pill'],
      searchText: 'ledger book general ledger tournament ledger house league book org sub-ledger reserve fund overview board summary board report where the club stands today cash on hand owed by the teams waiting on you year pill the year against the budget teams table allocated collected outstanding requests held by the team lock team cash is the coaches never added to the club figures export board report excel pdf',
      content: (
        <>
          <p>The club’s money is kept in <strong>books</strong> (ledgers). Each has a kind:</p>
          <HelpDefs>
            <HelpDef term="Club">The <strong>General ledger</strong>, where the club’s everyday money lives, plus any book you open to keep money apart — an equipment reserve, a bursary fund.</HelpDef>
            <HelpDef term="Tournament">One tournament’s fees, costs and any float the club moves to it.</HelpDef>
            <HelpDef term="House league">A house league season’s registration fees.</HelpDef>
          </HelpDefs>
          <p>The <strong>Overview</strong> tab is the board summary. The <strong>Year</strong> pill picks the year; <strong>Export</strong> writes the whole summary as a board report (Excel first, then CSV or PDF). Top to bottom:</p>
          <HelpDefs>
            <HelpDef term="Where the club stands · today">Three figures: <strong>Cash on hand</strong> (the club’s own books, never a team’s), <strong>Owed by the teams</strong> (what is overdue, and what a team says it has sent that you haven’t confirmed) and <strong>Waiting on you</strong> (payment requests, and how many are holding up a payout).</HelpDef>
            <HelpDef term="The year against the budget">Revenue (with what came from the teams, on allocations and on request), expenses (with what was paid to teams on request, and any <strong>off-plan</strong> spending), and the <strong>net for the year</strong>, each against its plan. One sentence says how much <strong>headroom</strong> is left. <strong>Budget vs. Actual</strong> below it opens the full report. On a phone this is one row that opens Budget vs. Actual.</HelpDef>
            <HelpDef term="The teams">One row per team: <strong>Allocated</strong>, <strong>Collected</strong>, <strong>Outstanding</strong>, <strong>Requests</strong>, and the team’s <strong>Cash on hand · held by the team</strong> with a lock. A team opens its <a href="#team-account">account with the club</a>.</HelpDef>
            <HelpDef term="The club’s books">Every book with its kind and balance, ending on <strong>Cash on hand</strong>. A book opens the Ledger tab on it.</HelpDef>
          </HelpDefs>
          <p>A team’s cash is read from its coaches’ own records. It is shown for information, never added into the club’s figures: the closing row of the teams table leaves it blank, and its total sits in its own band, <em>Held by the teams · not the club’s money</em>.</p>
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
      keywords: ['add income', 'add expense', 'add entry', 'entry', 'posted', 'pending', 'filed under', 'payee', 'payment method', 'cheque not cleared'],
      searchText: 'add income add expense add entry ledger entry money in money out the club paid the club received posted pending cheque written not yet cleared filed under budget word on this year’s plan off-plan description what date amount payee payer paid to paid by how it was paid reference e-transfer cheque number notes receipt invoice umpire diamond rental',
      content: (
        <>
          <p>Every entry should make sense later without anyone needing to remember the context.</p>
          <HelpSteps>
            <li>On the <strong>Ledger</strong> tab, pick the book with the <strong>Book</strong> pill, then press <strong>Add entry</strong>.</li>
            <li>Choose <strong>Out — the club paid</strong> or <strong>In — the club received</strong>, and give the date.</li>
            <li>Say <strong>What</strong> it was, the <strong>Amount</strong> and what it is <strong>Filed under</strong> (required) — pick a budget word. Money out offers the money-out words, money in the money-in words, and a hint says whether the word is on this year’s plan.</li>
            <li>Optionally name who it was <strong>Paid to</strong> (or <strong>Paid by</strong>), <strong>How it was paid</strong>, and the cheque or E-Transfer <strong>Reference</strong>.</li>
            <li>Leave the status on <strong>Posted</strong>, or choose <strong>Pending</strong> for a cheque written that hasn’t cleared yet. Then add it.</li>
          </HelpSteps>
          <p>The word you pick decides where the line reports on Budget vs. Actual. A word with no line on the year’s plan still saves, and counts as off-plan. See <a href="#categories">Filing a line under a budget word</a>.</p>
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
      keywords: ['board report', 'budget vs actual', 'treasurer report', 'export pdf', 'year pill'],
      searchText: 'board report treasurer report overview export board report budget vs actual year pill categories export pdf csv xlsx financial report monthly meeting where the club stands held by the team',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>For a monthly or year-end report, start broad and then drill into the detail.</p>
          <HelpSteps>
            <li>On the <strong>Overview</strong>, pick the year with the <strong>Year</strong> pill and read where the club stands.</li>
            <li>Press <strong>Export</strong> for the board report — Excel first, then CSV or PDF. It carries the position, the year against the budget, the teams and the books, as at today.</li>
            <li>Check each book’s balance, and open any that looks wrong.</li>
            <li>On the <strong>Ledger</strong>, set <strong>Date</strong> to the report’s period and <strong>Export</strong> each book — every entry in the period, with its totals.</li>
            <li>Export <strong>Budget vs. Actual</strong> for the board packet — the PDF option needs Tournament Plus or above (on Months the PDF is the whole-year statement).</li>
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
      keywords: ['entry', 'income', 'expense', 'transfer', 'posted', 'pending', 'void', 'edit entry', 'starting balance', 'ending balance', 'book pill', 'filters', 'tools', 'filter button', 'reset filters', 'not filed', 'filed under', 'item', 'budget item'],
      searchText: 'ledger book pill switch books entry income expense transfer posted pending void edit entry saves as you type autosave starting balance ending balance oldest first bank statement running balance money out money in type status category item budget item item column not filed filed under date this month all time filters balance disappears balance column gone balance hidden when filtering category untick posted pending line faint void reason audit trail read only line from an allocation request fee where to change it team book team account tools menu payees transfer where did the payees button go where did the transfer button go year on the balance lines row shows only the day phone card filter button phone filter sheet filters on a phone where did the filters go reset filters',
      content: (
        <>
          <p>The <strong>Ledger</strong> tab shows one book at a time. The <strong>Book</strong> pill switches books — it opens on the General ledger and shows every book’s balance. <strong>Tools</strong> (⋯, beside Export) holds the rarer jobs: <a href="#recipe-transfer-between-ledgers">Transfer</a> and <a href="#payees">Payees</a>.</p>
          <p>The book reads <strong>oldest first</strong>, like a bank statement: a <strong>Starting balance</strong> at the top and an <strong>Ending balance</strong> at the foot, each named with its full date (<em>Starting balance · Jul 3, 2026</em>), and between them every line with its day (<em>Aug 12</em>), the <strong>Category</strong> and <strong>Item</strong> it is filed under, its <strong>Money out</strong>, <strong>Money in</strong> and running <strong>Balance</strong>. The balance for the whole book also sits at the right of the filters. On a phone each line is its own card.</p>
          <HelpDefs>
            <HelpDef term="Type">Expenses, income, team allocations, team support, transfers. Narrowing it hides the Balance column, because a running total of only some lines isn’t a balance of anything.</HelpDef>
            <HelpDef term="Status">Starts on <strong>Posted</strong> and <strong>Pending</strong>. A pending line is faint and keeps the balance before it until it clears. Tick <strong>Void</strong> to see voided lines, each with its reason, or <strong>All</strong> for every line. Untick <strong>Posted</strong> and the Balance column goes too — posted lines are the ones that move it.</HelpDef>
            <HelpDef term="Category">One or several budget categories, or <strong>Not filed</strong>. Like Type, it hides the Balance column.</HelpDef>
            <HelpDef term="Item">One or several budget items, the second half of the word a line is filed under. An allocation’s lines carry the allocation’s name. Like Category, it hides the Balance column.</HelpDef>
            <HelpDef term="Date">Starts on <strong>This month</strong>. Pick a preset, your own dates, or <strong>All time</strong>. The Balance column stays: the starting balance carries everything before your dates.</HelpDef>
          </HelpDefs>
          <p><strong>On a phone the filters sit behind one Filter button</strong>, beside the balance. It opens a sheet showing what each filter is set to. A number on the button counts the ones you’ve changed; <strong>Reset filters</strong> puts them back.</p>
          <p><strong>Every line opens.</strong> A line you typed opens ready to edit, and saves as you type (its <strong>Filed under</strong> too). An older line reads <strong>Not filed</strong> until someone files it. <strong>Void this line</strong> asks why; the line stays on the book, marked void with your reason and your name, and counts nowhere. A line written by an allocation, a payment request or a house league fee files itself, read-only, and says where to change it — undo the payment, or reverse the approval, and both books follow.</p>
          <p>A team’s own book isn’t on the Ledger. The club reads a team through its <a href="#team-account">account</a>.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'payees',
      heading: 'Payees: who the club pays, and who pays it',
      summary: 'Rename a payee, merge two spellings of one, delete one no line uses, and choose which ones the club’s teams can use.',
      keywords: ['payee', 'payees', 'payer', 'vendor', 'merge payees', 'rename payee', 'delete payee', 'two spellings', 'manage payees', 'shared with teams', 'share a payee', 'teams column', 'the club’s own', 'shared payee', 'what the teams paid', 'what the teams recorded paying it'],
      searchText: 'payee payees payer vendor supplier merge payees two spellings duplicate payee rename payee delete payee manage payees paid to paid by last used tools menu share a payee with teams shared with teams switch teams column the club’s own which payees can teams use team picker shared by your club club sees payments teams cannot rename stop sharing shared payee report what the teams recorded paying it what the teams paid nothing recorded year pill',
      content: (
        <>
          <p><strong>Payees</strong> are the names on the Ledger’s <strong>Paid to</strong> and <strong>Paid by</strong> lines. Open the list from the Ledger’s <strong>Tools → Payees</strong> (on a phone too), or from <strong>Manage payees…</strong>, the last row of the payee picker in any entry.</p>
          <ul>
            <li><strong>Rename</strong> — open a payee and change its name. It saves as you type, and every line that names it follows.</li>
            <li><strong>Merge</strong> — when one supplier has two spellings, open one and choose <strong>Merge into another payee</strong>. Every line moves to the name you keep.</li>
            <li><strong>Delete</strong> — only a payee no line uses, the club’s or a team’s. One that is in use can be merged instead.</li>
            <li><strong>Share with teams</strong> — in a club that runs teams, the <strong>Teams</strong> column says which payees are <strong>Shared with teams</strong> and which are <strong>The club’s own</strong>. Open a payee and turn on <strong>Shared with teams</strong>: every team can pick it as a payee, can’t rename or merge it, and their payee list tells them the club sees payments to it. Turn it off and it leaves their picker; a team record that already names it keeps the name.</li>
            <li><strong>What the teams recorded paying it</strong> — open a payee you share and this opens the shared-payee report: each team’s payments in the year (a team folds open to its dates), with a <strong>Year</strong> pill and <strong>Export</strong>, then the teams that recorded nothing. Only payments recorded after you shared the payee count, and they are the teams’ own records, not proof that a payment was made. A team’s other payees and other spending never show.</li>
          </ul>
          <p>A team’s own payees are its coaches’ to manage, in the Payees window on their own Ledger.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'categories',
      heading: 'Filing a line under a budget word',
      summary: 'Every ledger line is filed under one of the budget’s words; that is what puts it on Budget vs. Actual.',
      keywords: ['filed under', 'not filed', 'category', 'categories', 'item', 'budget item', 'budget word', 'off-plan', 'reporting', 'filtering', 'export'],
      searchText: 'filed under not filed budget word category categories item budget item item column off-plan on the plan money out money in words reporting filtering export filed by where it came from team allocations team support registration fees',
      content: (
        <>
          <p>Every entry is <strong>Filed under</strong> one of the budget’s words — the same words the Budget plans with. Money out is filed under a money-out word and money in under a money-in word, and a hint says whether the word is on this year’s plan. A word with no plan line still saves; it counts as <strong>off-plan</strong> on Budget vs. Actual. Add or rename words from the Budget tab’s <strong>Tools → Categories</strong>.</p>
          <p>Lines the money loop writes — allocations, payment requests, registration fees — file themselves, and show their word read-only. Lines typed before this change keep their old text and read <strong>Not filed</strong> until someone files them; open one and choose its word.</p>
          <p>The Ledger shows both halves of the word, <strong>Category</strong> and <strong>Item</strong>, and filters by either. Its export carries both columns.</p>
        </>
      ),
    },
    {
      group: 'The club and its teams',
      id: 'allocations',
      heading: 'Allocations: billing the teams',
      summary: 'Split a shared cost across teams in installments, see what is coming due, and record what arrives.',
      keywords: ['allocation', 'allocations', 'cost allocation', 'rep team', 'shared costs', 'installments', 'coming due', 'due filter', 'record received', 'confirm received', 'undo a payment', 'sent waiting for you to confirm', 'allocate from a line'],
      searchText: 'allocate from a line allocate from the budget cost allocation allocations rep team shared costs diamond fees insurance association fees installment schedule new allocation details team splits review by allocation coming due overdue days late sent waiting for you to confirm due in the next 14 days later due filter next 30 days rest of the season where did show all go head coach filter button on a phone needs you on track record received confirm received received on how it came reference e-transfer cheque undo a payment returned by the bank reason general ledger voided due again coaches told remind this team open the team account where did allocations go rep teams allocations moved',
      content: (
        <p>An <strong>allocation</strong> splits a shared cost — diamond fees, insurance, association dues — across the teams you choose, each share in installments with due dates. The Allocations tab is where you bill the teams, watch what is coming due, and record what arrives.</p>
      ),
      subtopics: [
        {
          id: 'allocations-create',
          title: 'Billing the teams for a shared cost',
          content: (
            <>
              <p>On the <strong>Allocations</strong> tab, press <strong>New allocation</strong>. Three steps: <strong>Details</strong> (what it is, and the season), <strong>Team Splits</strong> (each team’s share — a set amount, a percentage or by sessions — with one due date or several installments), and <strong>Review</strong>. There is one way to bill teams: <strong>New allocation</strong>. From a cost line on the <strong>Budget</strong> tab, <strong>Allocate $X</strong> opens New allocation already filled in from the line — the amount can be up to what is left on the line, and <strong>Back</strong> returns you to the Budget.</p>
              <p>Each team’s coaches see their share on their <strong>Club</strong> screen straight away. They file it under one of their own budget words — that classification is theirs, so two teams may file the same cost differently.</p>
            </>
          ),
        },
        {
          id: 'allocations-coming-due',
          title: 'What is coming due',
          content: (
            <>
              <p>The <strong>View</strong> pill on the Allocations tab reads the bills two ways. <strong>By allocation</strong> lists each allocation with what was allocated, collected and still outstanding. <strong>Coming due</strong> lists every team’s installments by when they need you, each team with its head coach under its name:</p>
              <HelpDefs>
                <HelpDef term="Overdue">Past its due date and not received, with the total. Each row says how many days late it is, beside its due date.</HelpDef>
                <HelpDef term="Sent · waiting for you to confirm">The team’s coach says they’ve sent it — the day, how, and the reference are under the installment. Nothing counts until you confirm it arrived.</HelpDef>
                <HelpDef term="Due in the next 14 days">Coming up soon — the same 14 days the Overview counts.</HelpDef>
                <HelpDef term="Later">What falls due after that, when the <strong>Due</strong> pill looks further ahead.</HelpDef>
              </HelpDefs>
              <p>The <strong>Due</strong> pill beside View sets how far ahead Coming due looks: <strong>Next 14 days</strong> (where it opens), <strong>Next 30 days</strong>, or <strong>Rest of the season</strong>. Each choice shows the dates it covers. Overdue and sent installments always show, whatever you pick, and the 14-day group never changes; a wider window adds a <strong>Later</strong> group at the foot. Export writes what the window shows. On a phone, Due is behind the <strong>Filter</strong> button.</p>
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
      keywords: ['team account', 'what does a team owe', 'team statement', 'held by the team', 'cash on hand', 'outstanding'],
      searchText: 'team account account with the club what does a team owe team statement held by the team cash on hand lock between seasons last closed season closing figure the coaches records billed received outstanding next due requests the club own records read only never added to club figures export',
      content: (
        <>
          <p>Open a team from <strong>The teams</strong> on the Overview, or with the <strong>Open … ’s account</strong> button at the foot of its bill on an allocation. Four cards lead — <strong>Outstanding</strong>, <strong>Next due</strong>, <strong>Paid to the team</strong> on its requests, and <strong>Cash on hand</strong>, marked with a lock as held by the team — then the account reads like a statement: what the club billed the team, what the team paid, and what the club paid it.</p>
          <p>The three club figures are the club’s own records of the team, read-only here. <strong>Cash on hand</strong> is the one figure read from the coaches’ records: it is today’s figure while the team has a live season, and a team between seasons shows its last closed season’s closing figure, dated. It is never added into the club’s figures — the team’s money is its coaches’, and the rest of this page says where the team stands with the club. <strong>Export</strong> gives you the statement as a file.</p>
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
      heading: 'Reminders',
      summary: 'Remind head coaches what their team owes the club; family dues reminders run on their own.',
      keywords: ['reminders', 'send reminders', 'allocation reminders', 'dues reminders'],
      searchText: 'send reminders allocation reminders remind coaches what their team owes the club preview who gets one late nobody to send to no head coach one email per team reply comes to you last sent automated dues reminders 30-day 7-day guardians automatic daily runs on its own do i have to click',
      content: (
        <>
          <p><strong>Send reminders</strong> on the Allocations tab emails each team’s head coaches — and any staff the head coach gave money access — what their team owes the club: anything overdue, and anything due in the next 14 days. It shows you first who gets one and what each email lists, marks the late ones, and names any team with nobody to send to (no head coach yet, or an invitation nobody has answered). Each coach gets one email; a reply comes to you. The window also says when reminders were last sent, and by whom.</p>
          <p><strong>Family dues reminders</strong> go out on their own. Each day, guardians with an upcoming installment get an email — about a month ahead and about a week ahead — for every team whose <strong>Automatic Dues Reminders</strong> switch is on (each coach controls their own team’s switch). A guardian is never emailed twice in the same week for the same installment. You don’t have to do anything to keep this running.</p>
        </>
      ),
    },
    {
      group: 'The club and its teams',
      id: 'budget',
      heading: 'The Budget: planning the year',
      summary: 'The year’s plan, revenue first and then expenses; a line opens to read, the pencil edits it, and a cost line can be allocated to the teams.',
      keywords: ['budget', 'plan', 'budget line', 'add line', 'by period', 'start from last year’s plan', 'allocate from a line', 'from the teams', 'opening balance', 'closing balance', 'categories', 'words your teams use', 'year pill'],
      searchText: 'budget plan the year budget line add line year pill view list by period when filter no date yet columns months quarters export excel csv tools categories words your teams use revenue first from the teams worked out from the allocations never typed expenses planned allocated collected opening balance net for the year closing balance a line opens to read pencil edits saves as you type allocate from a line allocate remove a line only while it has no allocations start from last year’s plan start from this year’s plan empty year no plan yet one way to bill teams new allocation',
      content: (
        <p>The <strong>Budget</strong> tab is the club’s plan for one year. Every line here is something the club expects to take in or spend, and Budget vs. Actual later reads the year’s real books against it.</p>
      ),
      subtopics: [
        {
          id: 'budget-reading',
          title: 'Reading the plan',
          content: (
            <>
              <p>The <strong>Year</strong> pill picks the year. <strong>View</strong> reads the plan as a <strong>List</strong> or <strong>By period</strong>; By period adds a <strong>Columns</strong> choice of <strong>Months</strong> or <strong>Quarters</strong>, and on a phone it opens scrolled to this month. While any line has no date, a <strong>When</strong> filter (All, No date yet, Dated) appears on the List. <strong>Export</strong> writes the plan as it reads on screen, as Excel or CSV.</p>
              <HelpDefs>
                <HelpDef term="Revenue first">The plan opens with money coming in. <strong>From the teams</strong> is a row worked out from the allocations — it is never typed — and it opens to the allocations that add up to it.</HelpDef>
                <HelpDef term="Then expenses">Each line shows <strong>Planned</strong>, <strong>Allocated</strong> and <strong>Collected</strong>. A part-billed cost line says how much is not allocated: the club pays that part itself unless you allocate it.</HelpDef>
                <HelpDef term="The closing rows">An <strong>Opening balance</strong> read from the club’s books on the year’s first day, the <strong>Net for the year</strong>, and the <strong>Closing balance</strong>. The opening is worked out from the books, never typed.</HelpDef>
              </HelpDefs>
            </>
          ),
        },
        {
          id: 'budget-lines',
          title: 'Adding and changing a line',
          content: (
            <>
              <p>Press <strong>Add line</strong> to plan something new. A line opens to <strong>read</strong> first; the pencil turns the whole line into a form, and it saves as you type. A line’s total can’t be set below what is already allocated from it.</p>
              <p>A line can be removed only while it has no allocations. The <strong>Tools</strong> menu holds <strong>Categories</strong> (rename the club’s shared headings) and <strong>Words your teams use</strong> (publish a team’s word to every team).</p>
              <HelpNote variant="info" title="A new year starts from the last one">An empty year offers <strong>Start from last year’s plan</strong> (the button names the year): last year’s lines, amounts and dates moved a year on. Nothing is billed to a team until you allocate.</HelpNote>
            </>
          ),
        },
        {
          id: 'budget-allocate',
          title: 'Allocating a cost line to the teams',
          content: (
            <>
              <p>Open a cost line and its <strong>Allocated to teams</strong> section lists every allocation drawn from it. When part of the line is not allocated yet, <strong>Allocate $X</strong> opens <strong>New allocation</strong> already filled in from the line.</p>
              <p>The amount can be up to what is left on the line, and there is no ledger-entry box to fill. <strong>Back</strong> returns you to the Budget. This is the one way to bill teams: the old separate Allocate page is gone.</p>
            </>
          ),
        },
      ],
    },
    {
      group: 'The club and its teams',
      id: 'budget-vs-actual',
      heading: 'Reading Budget vs. Actual',
      summary: 'The year’s plan against what the club’s books moved: Collected, Spent, Off-plan and Cash on hand, as a Statement or by month.',
      keywords: ['budget vs actual', 'statement', 'months', 'compare', 'whole year', 'to date', 'showing', 'scheduled', 'collected', 'spent', 'off-plan', 'cash on hand', 'open these lines in the ledger', 'expand all'],
      searchText: 'budget vs actual statement months view compare whole year to date showing budget scheduled cash difference actual this year only expand all collapse all collected spent off-plan nobody budgeted this cash on hand the club’s books budgeted figure opens the plan line actual figure opens the lines behind it open these lines in the ledger not filed export excel csv pdf year pill',
      content: (
        <>
          <p>Budget vs. Actual reads the year’s plan against what the club’s books moved. A band across the top gives <strong>Collected</strong>, <strong>Spent</strong>, <strong>Off-plan</strong> (spending nobody budgeted, shown only when there is some) and <strong>Cash on hand</strong> (the club’s books, as of today).</p>
          <HelpDefs>
            <HelpDef term="View">The <strong>Year</strong> pill picks the year. <strong>View</strong> switches between <strong>Statement</strong> and <strong>Months</strong>.</HelpDef>
            <HelpDef term="Statement">Revenue, then expenses, each category folding open to its lines, with the plan, <strong>Actual</strong> and <strong>Variance</strong>. <strong>Compare</strong> reads the plan for the <strong>Whole year</strong> or <strong>To date</strong>. <strong>Expand all</strong> and <strong>Collapse all</strong> fold every category at once.</HelpDef>
            <HelpDef term="Months">The year month by month, with a running balance. <strong>Showing</strong> picks <strong>Budget</strong>, <strong>Scheduled</strong> (this year only), <strong>Cash</strong> or <strong>Difference</strong>. It opens with every category folded; <strong>Expand all</strong> opens them all at once. On a phone it opens scrolled to this month.</HelpDef>
          </HelpDefs>
          <p><strong>Every figure opens what is behind it.</strong> A budgeted figure opens the plan line; an actual figure opens the actual lines, with <strong>Open these lines in the Ledger</strong>. Money filed under no budget word sits in a <strong>Not filed</strong> row until someone files it.</p>
          <p>Export from the <strong>Export</strong> menu — Excel and CSV are available on all plans; the <strong>PDF</strong> needs Tournament Plus or above, and is always the whole-year statement.</p>
        </>
      ),
    },
    {
      id: 'exports',
      group: 'How accounting works',
      heading: 'Exporting accounting data',
      summary: 'Export a book, the allocations, the payment requests, a team’s account, the budget and Budget vs. Actual.',
      keywords: ['export', 'xlsx', 'csv', 'pdf', 'spreadsheet', 'download', 'board', 'board report', 'report', 'ledger', 'budget', 'allocations export', 'payment requests export'],
      searchText:
        'export xlsx csv excel pdf spreadsheet download board report ledger book whole period signed amount money out negative void marked void left out of totals total money in total money out net allocations coming due allocation payment requests team account statement budget budget-vs-actual print treasurer tournament plus board report overview shared payee report what the teams recorded paying it',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Each Accounting page has one <strong>Export</strong> button; Excel comes first, then CSV. The <strong>PDF</strong> (on the Overview’s board report and on Budget vs. Actual) needs Tournament Plus or above.</p>
          <HelpDefs>
            <HelpDef term="A book (Ledger)">Every entry in the period you’re reading — not just what’s on screen — whatever the other filters say. One <strong>Amount</strong> column, signed: money out is negative. A void line is kept, marked VOID, and left out of the totals at the foot: total money in, total money out and the net. The menu says all this before it runs.</HelpDef>
            <HelpDef term="Allocations">The list, or the Coming due view, whichever you’re reading.</HelpDef>
            <HelpDef term="An allocation">Every team’s share and every installment, with how each payment came.</HelpDef>
            <HelpDef term="Payment requests">Every request with its decision.</HelpDef>
            <HelpDef term="A team’s account">The team’s statement with the club.</HelpDef>
            <HelpDef term="The Overview">The board report: where the club stands, the year against the budget, the teams (with each team’s cash held by the team) and the books, as at today.</HelpDef>
            <HelpDef term="The Budget">The plan as it reads on screen — the List, or By period at the columns you chose. Excel and CSV.</HelpDef>
            <HelpDef term="Budget vs. Actual">The Statement or Months you are reading. The PDF is always the whole-year statement.</HelpDef>
            <HelpDef term="A shared payee">What the teams recorded paying it, for the year you are reading.</HelpDef>
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
