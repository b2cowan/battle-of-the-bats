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
      searchText: 'accounting tabs overview ledger allocations payment requests budget budget vs actual one page tab bar rail where is the ledger where are allocations where are payment requests back arrow one level down team account payees payees window allocation window opens over the tab where did the payees page go where did the allocation page go',
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
          <p><strong>Allocations</strong> and <strong>Payment requests</strong> appear only when your club runs rep teams. <strong>Payees</strong> and an <strong>allocation</strong> open as windows over the tab you are on, and closing one puts you back where you were. A team’s account is a page one level down, with no tabs; its back arrow returns you to the tab you came from.</p>
        </>
      ),
    },
    {
      group: 'Getting started',
      heading: 'The club’s books, and the Overview',
      id: 'ledgers',
      summary: 'Every dollar lives in a book: the General ledger, a tournament’s book, or a fund you keep apart.',
      keywords: ['ledger', 'book', 'general ledger', 'tournament ledger', 'org sub-ledger', 'overview', 'board summary', 'where the club stands', 'cash on hand', 'owed by the teams', 'waiting on you', 'held by the team', 'board report', 'fiscal year pill', 'still open', 'year-end report'],
      searchText: 'ledger book general ledger tournament ledger house league book org sub-ledger reserve fund overview board summary board report where the club stands today cash on hand owed by the teams waiting on you fiscal year pill year pill the year against the budget teams table allocated collected outstanding requests held by the team lock team cash is the coaches never added to the club figures export board report excel pdf still open from last year from 2025–26 still open unpaid installments waiting requests from a closed year year-end report close the year ended still open',
      content: (
        <>
          <p>The club’s money is kept in <strong>books</strong> (ledgers). Each has a kind:</p>
          <HelpDefs>
            <HelpDef term="Club">The <strong>General ledger</strong>, where the club’s everyday money lives, plus any book you open to keep money apart — an equipment reserve, a bursary fund.</HelpDef>
            <HelpDef term="Tournament">One tournament’s fees, costs and any float the club moves to it.</HelpDef>
            <HelpDef term="House league">A house league season’s registration fees.</HelpDef>
          </HelpDefs>
          <p>The <strong>Overview</strong> tab is the board summary. The <strong>Fiscal year</strong> pill picks the year; <strong>Export</strong> writes the whole summary as a board report (Excel first, then PDF or CSV), or on a closed year the <a href="#fiscal-year-papers">year-end report</a>. After a year ends, one line at the top offers to <a href="#fiscal-year-close">close it</a>. Top to bottom:</p>
          <HelpDefs>
            <HelpDef term="Where the club stands · today">Three figures: <strong>Cash on hand</strong> (the club’s own books, never a team’s), <strong>Owed by the teams</strong> (what is overdue, and what a team says it has sent that you haven’t confirmed) and <strong>Waiting on you</strong> (payment requests, and how many are holding up a payout).</HelpDef>
            <HelpDef term="From 2025–26, still open">After a year is closed, what it left unpaid or waiting, each row opening the page that settles it, until the last is settled.</HelpDef>
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
      keywords: ['add income', 'add expense', 'add entry', 'entry', 'posted', 'pending', 'filed under', 'payee', 'payment method', 'cheque not cleared', 'date refused', 'closed year'],
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
          <p>A date in a <a href="#fiscal-year-closed">closed fiscal year</a> is refused as soon as you pick it: the date field says why, with the two ways out — date it on or after the first open day, or reopen the year first — and the entry can’t be added until you change it. The same goes for a transfer.</p>
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
            <li>On the <strong>Overview</strong>, pick the year with the <strong>Fiscal year</strong> pill and read where the club stands.</li>
            <li>Press <strong>Export</strong> for the board report — Excel first, then PDF or CSV. It carries the position, the year against the budget, the teams and the books, as at today. On a <a href="#fiscal-year-papers">closed year</a> it writes the year-end report instead.</li>
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
      searchText: 'ledger book pill switch books entry income expense transfer posted pending void edit entry saves as you type autosave starting balance ending balance oldest first bank statement running balance money out money in type status category item budget item item column not filed filed under date this month all time filters balance disappears balance column gone balance hidden when filtering category untick posted pending line faint void reason audit trail read only line from an allocation request fee where to change it team book team account tools menu payees transfer where did the payees button go where did the transfer button go year on the balance lines row shows only the day phone card filter button phone filter sheet filters on a phone where did the filters go reset filters closed fiscal year locked line no void no edit it cleared today pending cheque from a closed year written on',
      content: (
        <p>The <strong>Ledger</strong> tab shows one book at a time. The <strong>Book</strong> pill switches books — it opens on the General ledger and shows every book’s balance. <strong>Tools</strong> (⋯, beside Export) holds the rarer jobs: <a href="#recipe-transfer-between-ledgers">Transfer</a> and <a href="#payees">Payees</a>.</p>
      ),
      subtopics: [
        {
          id: 'entries-reading',
          title: 'Reading a book',
          content: (
            <>
              <p>The book reads <strong>oldest first</strong>, like a bank statement: a <strong>Starting balance</strong> at the top and an <strong>Ending balance</strong> at the foot, each named with its full date (<em>Starting balance · Jul 3, 2026</em>), and between them every line with its day (<em>Aug 12</em>), the <strong>Category</strong> and <strong>Item</strong> it is filed under, its <strong>Money out</strong>, <strong>Money in</strong> and running <strong>Balance</strong>. The balance for the whole book also sits at the right of the filters. On a phone each line is its own card.</p>
              <p>A team’s own book isn’t on the Ledger. The club reads a team through its <a href="#team-account">account</a>.</p>
            </>
          ),
        },
        {
          id: 'entries-filters',
          title: 'Narrowing the book: Type, Status, Category, Item and Date',
          content: (
            <>
              <p>The filters sit above the book, with its balance at their right.</p>
              <HelpDefs>
              <HelpDef term="Type">Expenses, income, team allocations, team support, transfers. Narrowing it hides the Balance column, because a running total of only some lines isn’t a balance of anything.</HelpDef>
              <HelpDef term="Status">Starts on <strong>Posted</strong> and <strong>Pending</strong>. A pending line is faint and keeps the balance before it until it clears. Tick <strong>Void</strong> to see voided lines, each with its reason, or <strong>All</strong> for every line. Untick <strong>Posted</strong> and the Balance column goes too — posted lines are the ones that move it.</HelpDef>
              <HelpDef term="Category">One or several budget categories, or <strong>Not filed</strong>. It lists only the categories on the lines in your dates, so change the dates and the list follows. Like Type, it hides the Balance column.</HelpDef>
              <HelpDef term="Item">One or several budget items, the second half of the word a line is filed under, again only those in your dates. An allocation’s lines carry the allocation’s name. Pick a category first and Item lists only that category’s items. Anything you’ve already ticked stays on its list. Like Category, it hides the Balance column.</HelpDef>
              <HelpDef term="Date">Starts on <strong>This month</strong>. Pick a preset, your own dates, or <strong>All time</strong>. The Balance column stays: the starting balance carries everything before your dates.</HelpDef>
              </HelpDefs>
              <p><strong>On a phone the filters sit behind one Filter button</strong>, beside the balance. It opens a sheet showing what each filter is set to. A number on the button counts the ones you’ve changed; <strong>Reset filters</strong> puts them back.</p>
            </>
          ),
        },
        {
          id: 'entries-correcting',
          title: 'Opening, correcting and voiding a line',
          content: (
            <>
              <p><strong>Every line opens.</strong> A line you typed opens ready to edit, and saves as you type (its <strong>Filed under</strong> too). An older line reads <strong>Not filed</strong> until someone files it. <strong>Void this line</strong> asks why; the line stays on the book, marked void with your reason and your name, and counts nowhere. A line written by an allocation, a payment request or a house league fee files itself, read-only, and says where to change it — undo the payment, or reverse the approval, and both books follow.</p>
              <p>A line dated in a <a href="#fiscal-year-closed">closed fiscal year</a> opens to read, with one locked sentence where its Edit and Void were. A cheque still pending from a closed year keeps one action, <strong>It cleared today</strong>: it posts on the day it clears, in the open year, and keeps the day it was written.</p>
            </>
          ),
        },
      ],
    },
    {
      group: 'How accounting works',
      id: 'payees',
      heading: 'Payees: who the club pays, and who pays it',
      summary: 'Rename a payee, merge two spellings of one, delete one no line uses, and choose which ones the club’s teams can use.',
      keywords: ['payee', 'payees', 'payer', 'vendor', 'merge payees', 'rename payee', 'delete payee', 'two spellings', 'manage payees', 'shared with teams', 'share a payee', 'teams column', 'the club’s own', 'shared payee', 'what the teams paid', 'what the teams recorded paying it'],
      searchText: 'payee payees payer vendor supplier merge payees two spellings duplicate payee rename payee delete payee manage payees paid to paid by last used tools menu share a payee with teams shared with teams switch teams column the club’s own which payees can teams use team picker shared by your club club sees payments teams cannot rename stop sharing what the teams recorded inside the payee window what the teams paid nothing recorded fiscal year pill reads first pencil edit payee where did the payee report go payees page payees window over the ledger back to payees previous next manage payees keeps my entry typing kept where did the payees page go',
      content: (
        <>
          <p><strong>Payees</strong> are the names on the Ledger’s <strong>Paid to</strong> and <strong>Paid by</strong> lines. The list opens as a window over the Ledger, from <strong>Tools → Payees</strong> (on a phone too); close it and the Ledger is as you left it: the same book, filters and dates. You can also open it from <strong>Manage payees…</strong>, the last row of the payee picker in any entry. There it opens over the entry you are typing, and closing it takes you back to that entry with everything you typed still there. If you merge away the payee the entry had picked, the entry switches to the one you kept.</p>
          <p>A payee opens inside the same window. <strong>← Payees</strong> (on a phone, the arrow at the top left) goes back to the list, and <strong>Previous</strong> and <strong>Next</strong> at the foot walk through it.</p>
          <ul>
            <li><strong>Rename</strong> — a payee opens to read: whether it is shared, and how many of the club’s entries name it. The pencil turns its name (and the Shared with teams switch) into a form; the name saves as you type, and every line that names it follows.</li>
            <li><strong>Merge</strong> — when one supplier has two spellings, open one and choose <strong>Merge into another payee</strong>. Every line moves to the name you keep.</li>
            <li><strong>Delete</strong> — only a payee no line uses, the club’s or a team’s, at the end of the payee’s window. It asks first. One that is in use can be merged instead.</li>
            <li><strong>Share with teams</strong> — in a club that runs teams, the <strong>Teams</strong> column says which payees are <strong>Shared with teams</strong> and which are <strong>The club’s own</strong>. Open a payee and turn on <strong>Shared with teams</strong>: every team can pick it as a payee, can’t rename or merge it, and their payee list tells them the club sees payments to it. Turn it off and it leaves their picker; a team record that already names it keeps the name.</li>
            <li><strong>What the teams recorded</strong> — a payee you share shows it inside its own window: each team’s payments in the fiscal year (a team folds open to its dates), the total, then the teams that recorded nothing. A small <strong>Fiscal year</strong> pill appears only when it has records in more than one year. Only payments recorded after you shared the payee count, and they are the teams’ own records, not proof that a payment was made. A team’s other payees and other spending never show. There is no separate report page or export.</li>
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
      searchText: 'allocate from a line allocate from the budget cost allocation allocations rep team shared costs diamond fees insurance association fees installment schedule new allocation one window bill from off-plan bill split evenly by amount by percentage by sessions pay by one payment installments teams table tick a team season share due nothing left over own payments no open season between seasons not running a season team groups group heading tick a group all none split by group 60 40 bill teams bill 7 teams why was it refused reason beside the button create allocation where did the three steps go program year by allocation coming due overdue days late sent waiting for you to confirm due in the next 14 days later due filter next 30 days rest of the season where did show all go head coach filter button on a phone needs you on track record received confirm received received on how it came reference e-transfer cheque undo a payment returned by the bank reason general ledger voided due again coaches told remind this team open the team account where did allocations go rep teams allocations moved allocation window allocation page where did the allocation page go name and note rename an allocation the club’s note no note closed year counts in which is closed back to the allocation open the allocation from the budget line from the ledger from the overview from a team’s account from a notification',
      content: (
        <p>An <strong>allocation</strong> splits a shared cost — diamond fees, insurance, association dues — across the teams you choose, each share in installments with due dates. The Allocations tab is where you bill the teams, watch what is coming due, and record what arrives.</p>
      ),
      subtopics: [
        {
          id: 'allocations-create',
          title: 'Billing the teams for a shared cost',
          content: (
            <>
              <p>New allocation is one window. From a cost line on the <strong>Budget</strong>, <strong>Allocate $X</strong> turns the line’s window into it; on the <strong>Allocations</strong> tab, <strong>New allocation</strong> opens it and asks first what it bills from — a cost line on this year’s plan with something left, or an off-plan bill.</p>
              <HelpSteps>
                <li>Give it a <strong>Name</strong> and an <strong>Amount</strong> — from a line, up to what is left on it.</li>
                <li>Choose the <strong>Split</strong> once for the whole bill: <strong>Evenly</strong>, <strong>By amount</strong>, <strong>By percentage</strong> or <strong>By sessions</strong>.</li>
                <li>Choose <strong>Pay by</strong>: one payment, or installments, with their due dates.</li>
                <li>Tick the teams to bill. They sit under your team groups, in the order Rep Teams shows them: tick a group’s heading to bill every team in it, or use <strong>All</strong> and <strong>None</strong> beside Team. Each team shows its season beside its name and its <strong>Share</strong> (a box to fill under By amount, By percentage or By sessions). The closing row adds the ticked teams and says what is left over.</li>
                <li>Press <strong>Bill</strong>: the button says how many teams and how much (“Bill 7 teams · $1,500.00”; on a phone, “Bill 7 teams”). From a line, the window returns to the line with the new allocation listed. If something is missing, the reason appears beside the button.</li>
              </HelpSteps>
              <p><strong>Splitting by group.</strong> Under By percentage or By amount, a group’s heading takes a figure of its own: type 60 on one group and 40 on another, and each figure is shared evenly among that group’s ticked teams. Then change any team’s figure by hand. The group is only a quicker way to fill the boxes, so each team still gets its own share of the bill.</p>
              <p>A team pays differently? Open its row with the arrow at its end and give it its own payments; its <strong>Due</strong> then says so. Only a team’s running season can be billed: teams between seasons are left out of the list, and the line under it (“2 teams aren’t running a season”) names them and when their season closed.</p>
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
              <p>A row opens its allocation’s window over the tab — at the allocation from By allocation, at that team’s bill from Coming due. See <a href="#allocations-window">An allocation’s window</a>.</p>
            </>
          ),
        },
        {
          id: 'allocations-window',
          title: 'An allocation’s window',
          content: (
            <>
              <p>An allocation opens as a window wherever you are, and closing it puts you back where you were:</p>
              <ul>
                <li><strong>From a tab</strong> (the Allocations list, Coming due, the Overview’s still-open bills, a Budget vs. Actual figure, a team’s account): the window opens over the tab.</li>
                <li><strong>From another window</strong> (a budget line, From the teams, a Ledger line, what is behind a figure): that window turns into the allocation’s, and closing it turns it back.</li>
                <li><strong>From a notification or an old link</strong>: the Allocations tab opens with the window already open.</li>
              </ul>
              <p>It reads the bill first. Above its name: the budget line it bills from and the fiscal year it counts in (<em>Off-plan</em> when it has no line). Then its four figures, <strong>Allocated</strong>, <strong>Collected</strong>, <strong>Outstanding</strong> and <strong>Overdue</strong>; its schedule; its teams, in two bands, <strong>Needs you</strong> and <strong>On track</strong>; and the club’s <strong>Note</strong>. Opened from the Allocations list, <strong>Previous</strong> and <strong>Next</strong> at its foot walk the list. <strong>Export</strong>, at its foot, writes one row per installment: the team, the amount and due date, its state, and once received the day, how it came, the reference and who recorded it.</p>
              <p><strong>The pencil</strong> changes the allocation’s <strong>Name</strong> and its <strong>Note</strong>, and nothing else: each team’s share, the schedule and which teams it bills never change once it is made. Both save as you type. The new name shows on each team’s Club page and on the bill’s Ledger lines, the club’s and the teams’; notices already sent keep the old name. A note is for the club’s own reference; teams don’t see it.</p>
              <p>An allocation that counts in a <a href="#fiscal-year-closed">closed fiscal year</a> has no pencil and one locked line that says so. Its unpaid installments can still be recorded as received.</p>
              <p>A team opens its bill inside the same window: what it was billed, collected and still owes, and each installment with its state. The back link above the team’s name, which names the allocation (on a phone, the arrow at the top left), goes back up to the whole allocation, and <strong>Previous</strong> and <strong>Next</strong> walk you from team to team. To remind every team at once, use <strong>Send reminders</strong> on the Allocations tab; a team’s bill has its own <strong>Remind</strong>.</p>
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
              <p><strong>Undo a payment</strong> sits at the foot of a team’s bill once anything has been received. Choose the payment, and say why — <em>the E-Transfer was returned by the bank</em>. The General ledger line is voided (it stays, marked void, with your reason), the installment is due again, and the team’s coaches see it and are told why. Undo only a payment that didn’t happen or went against the wrong team. A payment recorded in a <a href="#fiscal-year-closed">closed fiscal year</a> has no Undo; one locked sentence says to reopen that year first.</p>
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
            <HelpDef term="Reverse this approval">On an approved request, with a reason. The General ledger line is voided — it stays, marked void — the request reads <strong>Reversed</strong>, and the coaches are told. It corrects the books; if money really moved, getting it back is between the club and the team. On an approval recorded in a <a href="#fiscal-year-closed">closed fiscal year</a>, Reverse is absent: reopen the year to reverse it.</HelpDef>
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
      searchText: 'team account account with the club what does a team owe team statement held by the team cash on hand lock between seasons last closed season closing figure the coaches records billed received outstanding next due requests the club own records read only never added to club figures export four cards figures band open a bill',
      content: (
        <>
          <p>Open a team from <strong>The teams</strong> on the Overview, or with the <strong>Open … ’s account</strong> button at the foot of its bill on an allocation. Four figures lead, side by side — <strong>Outstanding</strong>, <strong>Next due</strong>, <strong>Paid to the team</strong> on its requests, and <strong>Cash on hand</strong>, marked with a lock as held by the team — then the account reads like a statement: what the club billed the team, what the team paid, and what the club paid it. A billed or received line opens that team’s bill in its allocation’s window, over the account; a request opens on Payment requests.</p>
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
      keywords: ['budget', 'plan', 'budget line', 'add line', 'by period', 'start from last year’s plan', 'allocate from a line', 'from the teams', 'opening balance', 'closing balance', 'categories', 'words your teams use', 'fiscal year pill', 'quarters'],
      searchText: 'budget plan the year budget line add line year pill view list by period when filter no date yet columns months quarters export excel csv tools categories words your teams use revenue first from the teams worked out from the allocations never typed expenses planned allocated collected opening balance net for the year closing balance a line opens to read pencil edits saves as you type allocate from a line allocate remove a line only while it has no allocations start from last year’s plan start from this year’s plan empty year no plan yet one way to bill teams new allocation in the line window fiscal year pill lock dot short year 8 months quarters from the first month opening balance locked carried from last year the club paid it',
      content: (
        <p>The <strong>Budget</strong> tab is the club’s plan for one year. Every line here is something the club expects to take in or spend, and Budget vs. Actual later reads the year’s real books against it.</p>
      ),
      subtopics: [
        {
          id: 'budget-reading',
          title: 'Reading the plan',
          content: (
            <>
              <p>The <strong>Fiscal year</strong> pill picks the year: a lock marks a closed year, a dot the year today falls in, and a short year says how many months it runs. <strong>View</strong> reads the plan as a <strong>List</strong> or <strong>By period</strong>; By period adds a <strong>Columns</strong> choice of <strong>Months</strong> or <strong>Quarters</strong> (three months at a time from the year’s first month), and on a phone it opens scrolled to this month. While any line has no date, a <strong>When</strong> filter (All, No date yet, Dated) appears on the List. <strong>Export</strong> writes the plan as it reads on screen, as Excel or CSV.</p>
              <HelpDefs>
                <HelpDef term="Revenue first">The plan opens with money coming in. <strong>From the teams</strong> is a row worked out from the allocations — it is never typed — and it opens to the allocations that add up to it.</HelpDef>
                <HelpDef term="Then expenses">Each line shows <strong>Planned</strong>, <strong>Allocated</strong> and <strong>Collected</strong>. A part-billed cost line says how much is not allocated: the club pays that part itself unless you allocate it.</HelpDef>
                <HelpDef term="The closing rows">An <strong>Opening balance</strong> read from the club’s books on the year’s first day, the <strong>Net for the year</strong>, and the <strong>Closing balance</strong>. The opening is worked out from the books, never typed; once the year before is closed it is that year’s closing, locked, and says so.</HelpDef>
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
              <p>Open a cost line and its <strong>Allocated to teams</strong> section lists every allocation drawn from it. When part of the line is not allocated yet, <strong>Allocate $X</strong> turns the line’s window into <a href="#allocations-create">New allocation</a>, filled in from the line; the amount can be up to what is left on it.</p>
              <p><strong>Bill</strong> (the button names the teams and the amount) brings the window back to the line, with the new allocation listed and Allocated updated. <strong>Cancel</strong> brings it back with nothing made. There is no separate page.</p>
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
      keywords: ['budget vs actual', 'statement', 'months', 'compare', 'whole year', 'to date', 'against last year', 'this year against last year', 'change', 'showing', 'scheduled', 'collected', 'spent', 'off-plan', 'cash on hand', 'open these lines in the ledger', 'expand all', 'last year’s bills paid this year'],
      searchText: 'budget vs actual statement months view compare whole year to date showing budget scheduled cash difference actual this year only expand all collapse all collected spent off-plan nobody budgeted this cash on hand the club’s books budgeted figure opens the plan line actual figure opens the lines behind it open these lines in the ledger not filed export excel csv pdf year pill',
      content: (
        <>
          <p>Budget vs. Actual reads the year’s plan against what the club’s books moved. A band across the top gives <strong>Collected</strong>, <strong>Spent</strong>, <strong>Off-plan</strong> (spending nobody budgeted, shown only when there is some) and <strong>Cash on hand</strong> (the club’s books, as of today — on a closed year, its closing at its last day).</p>
          <p>Money the club bills in one year often arrives in the next. A payment against last year’s bill counts in the year it arrives, on its own line under From the teams (<em>2025–26’s bills, paid this year</em>), with its Budgeted blank: it was planned in its own year.</p>
          <HelpDefs>
            <HelpDef term="View">The <strong>Fiscal year</strong> pill picks the year. <strong>View</strong> switches between <strong>Statement</strong> and <strong>Months</strong>.</HelpDef>
            <HelpDef term="Statement">Revenue, then expenses, each category folding open to its lines, with the plan, <strong>Actual</strong> and <strong>Variance</strong>. <strong>Compare</strong> reads the plan for the <strong>Whole year</strong> or <strong>To date</strong>, or, once last year has money recorded in those months, sets this year <strong>Against</strong> last year: this year’s Actual, last year’s and the <strong>Change</strong>, over the same months a year apart (each heading says which). <strong>Expand all</strong> and <strong>Collapse all</strong> fold every category at once.</HelpDef>
            <HelpDef term="Months">The year month by month, with a running balance. <strong>Showing</strong> picks <strong>Budget</strong>, <strong>Scheduled</strong> (this year only), <strong>Cash</strong> or <strong>Difference</strong>. It opens with every category folded; <strong>Expand all</strong> opens them all at once. On a phone it opens scrolled to this month.</HelpDef>
          </HelpDefs>
          <p><strong>Every figure opens what is behind it.</strong> A budgeted figure opens the plan line; an actual figure opens the actual lines, with <strong>Open these lines in the Ledger</strong>. Money filed under no budget word sits in a <strong>Not filed</strong> row until someone files it.</p>
          <p>Export from the <strong>Export</strong> menu — Excel and CSV are available on all plans; the <strong>PDF</strong> needs Tournament Plus or above, and is always the whole-year statement.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'fiscal-year',
      heading: 'The fiscal year: setting it, closing it, and the year that opens',
      summary: 'The club’s year — when it starts and its name; closing a year so its figures stop moving; reading a closed year; reopening it.',
      keywords: ['fiscal year', 'fiscal year pill', 'first month', 'starts in', 'short year', 'close the year', 'close 2025–26', 'year-end', 'reopen', 'closed year', 'locked', 'year-end report', 'still open', 'carried', 'carries into', 'closing balance', 'opening balance locked'],
      searchText: 'fiscal year club year when does the year start first month starts in september august year name rename the year short year 8 months the year that changes plan lines move ledger lines never move set the fiscal year new club budget tools fiscal year close the year close 2025–26 ended and still open close question still open installments owed requests waiting lines not filed lines not cleared warns never blocks what it locks what carries locks closing balance carries into opening balance locked since last close same as last close reopened by year-end report annual meeting papers board closed year read in place locked lock on the pill writes absent date refused reopen the latest closed year reason why kept with the year from 2025–26 still open last year’s bills paid this year',
      content: (
        <p>The club’s <strong>fiscal year</strong> is the period its plan and its books are read in: twelve months from a first month you choose, named from its months (<em>2026</em>, or <em>2026–27</em> when it crosses a New Year). Every money tab reads one fiscal year at a time, on the <strong>Fiscal year</strong> pill.</p>
      ),
      subtopics: [
        {
          id: 'fiscal-year-set',
          title: 'Setting when the year starts, and its name',
          content: (
            <>
              <p>Open <strong>Budget → Tools → Fiscal year</strong>. It reads first: when the year starts, this year’s dates, next year, and the closed years. The pencil, for the owner, treasurer or an admin with Accounting, turns it into a form.</p>
              <ul>
                <li><strong>Starts in</strong> — the month each year begins. Changing it asks first, and shows what changes before anything saves: a year that has begun keeps its months, and the year after it is the short one. Plan lines dated past the short year’s end move to the next year’s plan with their dates; ledger lines never move. You can change it until the first year is closed.</li>
                <li><strong>This year’s name</strong> — saves as you type, while the year is open. A closed year’s name is part of its papers.</li>
              </ul>
              <p>A new club meets the year on its first, empty plan: one line under it, <strong>Set the fiscal year</strong>, opens the same window. Nothing has to move yet, so the year starts on the month you pick.</p>
            </>
          ),
        },
        {
          id: 'fiscal-year-close',
          title: 'Closing a year',
          content: (
            <>
              <p>From the day after a year ends, the Overview shows one line naming it, with <strong>Close 2025–26</strong> (for the owner, treasurer or an admin with Accounting). Closing stops the year’s figures moving before you print its year-end report. It deletes nothing.</p>
              <p>The question reads in the order you decide, with the figure first:</p>
              <HelpDefs>
                <HelpDef term="Locks">The year: every line dated in it on every book the club owns, and its plan. A team’s own book is its coaches’ and is never touched.</HelpDef>
                <HelpDef term="Closing balance">The figure the close fixes, in large type. On a year that was reopened, it says how far it moved since the last close, and a line above it names who reopened the year and why.</HelpDef>
                <HelpDef term="Carries into">The next year, which opens on the closing balance, locked. What was still open stays the closed year’s own, and the open year’s Overview lists it until it is settled.</HelpDef>
                <HelpDef term="Still open">Installments the teams still owe, requests waiting on you, lines not filed under a word, and lines not cleared: one line each, with its count and amount, opening the page that settles it. None of them stop the close; a bill a team pays next month is fine to leave open.</HelpDef>
              </HelpDefs>
              <p>Years close oldest first.</p>
            </>
          ),
        },
        {
          id: 'fiscal-year-closed',
          title: 'Reading a closed year',
          content: (
            <>
              <p>Pick a closed year on the <strong>Fiscal year</strong> pill — it wears a lock. Budget, Budget vs. Actual and the Overview read it where they always do, with one line under the toolbar saying who closed it and when. Everything that would change it is gone: no Add line, no pencil, no Allocate.</p>
              <ul>
                <li>A date in a closed year is refused under the date field, with the two ways out: date it in the open year, or reopen the year.</li>
                <li>A closed year’s Undo, Reverse and Void are absent, with one locked sentence in their place.</li>
                <li>A bill a team still owes can still be received: the money arrives today, in the open year.</li>
                <li>A cheque still pending from a closed year can still clear, dated the day it clears.</li>
              </ul>
            </>
          ),
        },
        {
          id: 'fiscal-year-reopen',
          title: 'Reopening a year',
          content: (
            <>
              <p><strong>Reopen</strong> sits on the latest closed year’s line on the <strong>Budget</strong> and the <strong>Overview</strong>, for the owner, treasurer or an admin with Accounting. It asks why; the reason is kept with the year, and its line says who reopened it, when and why. An older closed year can’t be reopened before the ones after it.</p>
              <p>While it is open, its books and plan unlock, and next year’s opening follows the books again. Close it again from the Overview: the question says what changed since the last close.</p>
            </>
          ),
        },
        {
          id: 'fiscal-year-papers',
          title: 'The year-end report, and this year against last year',
          content: (
            <>
              <p>On a closed year, the Overview’s <strong>Export</strong> writes the <strong>year-end report</strong>, Excel first, then PDF: the year’s dates and who closed it, the year at a glance, the year against its budget and against last year, the club’s books at both ends, the teams’ standing with the club at the close, and what was still open and carried. It reads only locked figures, so the copy the board reads is the copy you printed.</p>
              <p>Each team’s own cash is its coaches’ money and is left out of the year-end report; one line says so. For the year against last year on screen, use Budget vs. Actual’s <strong>Compare → Against</strong> last year.</p>
            </>
          ),
        },
      ],
    },
    {
      id: 'exports',
      group: 'How accounting works',
      heading: 'Exporting accounting data',
      summary: 'Export a book, the allocations, the payment requests, a team’s account, the budget and Budget vs. Actual.',
      keywords: ['export', 'xlsx', 'csv', 'pdf', 'spreadsheet', 'download', 'board', 'board report', 'report', 'ledger', 'budget', 'allocations export', 'payment requests export'],
      searchText:
        'export xlsx csv excel pdf spreadsheet download board report ledger book whole period signed amount money out negative void marked void left out of totals total money in total money out net allocations coming due allocation payment requests team account statement budget budget-vs-actual print treasurer tournament plus board report overview year-end report against last year',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Each Accounting page has one <strong>Export</strong> button; Excel comes first, then CSV. The <strong>PDF</strong> (on the Overview’s board report and on Budget vs. Actual) needs Tournament Plus or above.</p>
          <HelpDefs>
            <HelpDef term="A book (Ledger)">Every entry in the period you’re reading — not just what’s on screen — whatever the other filters say. One <strong>Amount</strong> column, signed: money out is negative. A void line is kept, marked VOID, and left out of the totals at the foot: total money in, total money out and the net. The menu says it is the whole period, and how many entries, before it runs.</HelpDef>
            <HelpDef term="Allocations">The list, or the Coming due view, whichever you’re reading.</HelpDef>
            <HelpDef term="An allocation">Every team’s share and every installment, with how each payment came.</HelpDef>
            <HelpDef term="Payment requests">Every request with its decision.</HelpDef>
            <HelpDef term="A team’s account">The team’s statement with the club.</HelpDef>
            <HelpDef term="The Overview">The board report: where the club stands, the year against the budget, the teams (with each team’s cash held by the team) and the books, as at today. On a closed fiscal year it is the <a href="#fiscal-year-papers">year-end report</a> instead, Excel or PDF.</HelpDef>
            <HelpDef term="The Budget">The plan as it reads on screen — the List, or By period at the columns you chose. Excel and CSV.</HelpDef>
            <HelpDef term="Budget vs. Actual">The Statement or Months you are reading — Against last year too. The PDF is always the whole-year statement.</HelpDef>
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
