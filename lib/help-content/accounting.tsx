import type { HelpPageContent } from './index';

const accountingHelp: HelpPageContent = {
  title: 'Accounting',
  role: 'Treasurer, Admin, Owner',
  intro: 'Accounting tracks all financial activity for your organization — tournament and org-wide income and expenses, season budgets, and rep-team cost allocations. It is included with the Club plan. Owners and treasurers work here by default; an admin needs the accounting permission granted by the owner.',
  sections: [
    {
      id: 'who-can-use',
      group: 'Getting started',
      heading: 'Who can use Accounting',
      summary: 'Accounting is a Club-plan module; owners and treasurers can record entries, admins need it granted.',
      keywords: ['accounting access', 'club plan', 'add-on', 'treasurer', 'permission', 'access restricted'],
      searchText: 'accounting access club plan add-on enable module treasurer admin owner permission capability access restricted who can use unlock contact owner',
      content: (
        <>
          <p>Accounting is included with the <strong>Club</strong> plan. If your organization doesn&apos;t have it, the Accounting area shows an <strong>Access Restricted</strong> message — ask your organization owner about moving to Club.</p>
          <p>Once it&apos;s enabled, who can do what:</p>
          <ul>
            <li><strong>Owners and treasurers</strong> — full access: create ledgers, record entries, run budgets and reminders.</li>
            <li><strong>Admins</strong> — can use Accounting only if the owner grants them the accounting permission. Without it, the module stays hidden.</li>
          </ul>
        </>
      ),
    },
    {
      group: 'Getting started',
      heading: 'Understanding ledgers — tournaments vs. org sub-ledgers',
      id: 'ledgers',
      summary: 'Every dollar lives in a ledger; choose a tournament ledger or an org sub-ledger.',
      keywords: ['ledger', 'tournament ledger', 'org sub-ledger', 'net position', 'overview'],
      searchText: 'ledger tournament ledger org sub-ledger net position net balance overview date filter period income expense sponsorship grant fundraising',
      content: (
        <>
          <p>All accounting in FieldLogicHQ is organized into <strong>ledgers</strong>. There are two types:</p>
          <ul>
            <li><strong>Tournament ledger</strong> — tracks income and expenses for one specific tournament event. Typically used for registration fees, diamond rentals, umpire fees, prize pools, and other tournament-specific costs.</li>
            <li><strong>Org sub-ledger</strong> — tracks org-wide income and expenses that aren&apos;t tied to a single tournament. Use these for sponsorships, grants, general operating expenses, and fundraising revenue.</li>
          </ul>
          <p>Open a tournament ledger from the <strong>Tournaments without a ledger</strong> list on the Accounting Overview (one click per tournament). Add an org sub-ledger with <strong>+ Add Ledger</strong> whenever you need a distinct budget bucket — for example, a capital fund or a bursary fund.</p>
          <p>The Accounting Overview shows every ledger with its net posted balance, plus org-wide Total Income, Total Expenses, Net Position, and Pending. Set the <strong>Period</strong> dates and click <strong>Apply</strong> to see activity within any date range.</p>
        </>
      ),
    },
    {
      id: 'recipe-create-ledger',
      group: 'How-to recipes',
      heading: 'How to create the right ledger',
      summary: 'Choose between a tournament ledger and an org sub-ledger before money starts moving.',
      keywords: ['create ledger', 'tournament ledger', 'org sub-ledger', 'budget bucket'],
      searchText: 'create ledger tournament ledger org sub-ledger budget bucket accounting overview income expense sponsorship grant fundraising add ledger',
      content: (
        <>
          <p>Create a ledger when you need a distinct financial view for an event, fund, or operating bucket.</p>
          <ol>
            <li>Use a <strong>Tournament ledger</strong> for income and expenses tied to one tournament — open it from the <strong>Tournaments without a ledger</strong> list on the Overview.</li>
            <li>Use an <strong>Org sub-ledger</strong> for organization-wide money such as grants, sponsorships, operating costs, fundraising, or bursaries — use <strong>+ Add Ledger</strong>.</li>
            <li>Name the ledger in a way your board will recognize in reports.</li>
            <li>Add opening entries only if you are bringing forward balances from another system.</li>
            <li>Review the Accounting Overview to confirm the new ledger appears.</li>
          </ol>
          <p>If you are unsure where an entry belongs, choose the ledger that matches the reason the money was collected or spent.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-which-ledger-to-use',
          question: 'Should I use a tournament ledger or an org sub-ledger?',
          answerText: 'Use a tournament ledger for one event. Use an org sub-ledger for broader organization funds, operating costs, grants, sponsorships, or fundraising.',
          keywords: ['ledger type', 'tournament ledger', 'sub-ledger'],
          popular: true,
          answer: (
            <p>Use a <strong>tournament ledger</strong> for one event. Use an <strong>org sub-ledger</strong> for broader organization funds, operating costs, grants, sponsorships, or fundraising.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-add-income-expense',
      group: 'How-to recipes',
      heading: 'How to add income or expenses',
      summary: 'Record confirmed and expected money with descriptions, categories, payees, and statuses.',
      keywords: ['add income', 'add expense', 'entry', 'posted', 'pending', 'category', 'payee', 'payment method'],
      searchText: 'add income add expense ledger entry posted pending category description date amount payee payer payment method notes receipt invoice tournament fees umpire diamond rental',
      content: (
        <>
          <p>Every ledger entry should be understandable later without needing to remember the context.</p>
          <ol>
            <li>Open the ledger where the money belongs and add a new entry.</li>
            <li>Choose <strong>Income</strong> for money received or <strong>Expense</strong> for money spent.</li>
            <li>Enter a clear description, date, amount, and category.</li>
            <li>Optionally record the <strong>Payee/Payer</strong> (an org member or a typed name), the <strong>Payment Method</strong> (e-transfer, cheque, cash, etc.), and internal <strong>Notes</strong>.</li>
            <li>Use <strong>Posted</strong> for confirmed transactions and <strong>Pending</strong> for expected invoices or deposits.</li>
            <li>Save, then confirm the balance summary changed as expected.</li>
          </ol>
          <p>Use consistent category names — it makes exports and year-end reports much easier to filter.</p>
        </>
      ),
    },
    {
      id: 'recipe-transfer-between-ledgers',
      group: 'How-to recipes',
      heading: 'How to transfer money between ledgers',
      summary: 'Move funds without double-counting income or expenses in organization totals.',
      keywords: ['transfer', 'move money', 'ledger transfer', 'double-counting'],
      searchText: 'transfer money between ledgers move funds ledger transfer matching entries double-counting org totals posted pending source destination',
      content: (
        <>
          <p>Use a transfer when money moves from one internal ledger to another.</p>
          <ol>
            <li>Open the source ledger.</li>
            <li>Create a <strong>Transfer</strong> entry.</li>
            <li>Select the destination ledger.</li>
            <li>Enter the amount, date, and description.</li>
            <li>Save and confirm both ledgers show matching transfer entries.</li>
          </ol>
          <p>Do not record the same movement as an expense in one ledger and income in another. A transfer keeps the organization total accurate. Transfer entries can&apos;t be edited after the fact — if one is wrong, void it and create a new one.</p>
        </>
      ),
      faqs: [
        {
          id: 'faq-transfer-vs-income-expense',
          question: 'Why should I use a transfer instead of income and expense entries?',
          answerText: 'Transfers create matching internal entries and avoid double-counting money in organization totals.',
          keywords: ['transfer', 'double-counting', 'income expense'],
          answer: (
            <p>A transfer creates matching internal entries, so organization totals stay accurate. Recording the same movement as separate income and expense can double-count activity.</p>
          ),
        },
      ],
    },
    {
      id: 'recipe-board-report',
      group: 'How-to recipes',
      heading: 'How to prepare a board-ready financial report',
      summary: 'Use date filters, categories, budget vs. actual, and exports to produce a clean treasurer report.',
      keywords: ['board report', 'budget vs actual', 'treasurer report', 'export pdf', 'date range'],
      searchText: 'board report treasurer report budget vs actual date range categories export pdf csv xlsx financial report monthly meeting headroom',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>For a monthly or year-end report, start broad and then drill into details.</p>
          <ol>
            <li>Open <strong>Accounting Overview</strong>, set the <strong>Period</strong> dates, and click <strong>Apply</strong>.</li>
            <li>Review each ledger balance for unexpected pending or voided entries.</li>
            <li>Open the relevant budget or ledger detail view.</li>
            <li>Use consistent categories to group revenue and expenses.</li>
            <li>Export <strong>Budget vs. Actual</strong> for a board packet — the PDF option needs Tournament Plus or above.</li>
            <li>Export Excel or CSV when the treasurer needs to do additional spreadsheet analysis.</li>
          </ol>
          <p>Before sharing externally, remove unnecessary personal information and confirm the report period is correct.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'entries',
      heading: 'Creating and managing entries',
      summary: 'Income, expense, and transfer entries; posted vs. pending; editing and voiding.',
      keywords: ['entry', 'income', 'expense', 'transfer', 'posted', 'pending', 'void', 'edit entry'],
      searchText: 'entry income expense transfer posted pending void edit entry pencil all posted pending tabs balance summary audit trail transfer not editable',
      content: (
        <>
          <p>Inside any ledger, each row is an <strong>entry</strong>. Entries come in three types:</p>
          <ul>
            <li><strong>Income</strong> — money coming in. Increases the ledger balance.</li>
            <li><strong>Expense</strong> — money going out. Decreases the ledger balance.</li>
            <li><strong>Transfer</strong> — moves funds between two ledgers. Creates matching entries in both ledgers automatically, so nothing is double-counted in the org totals.</li>
          </ul>
          <p>Each entry has a <strong>status</strong>:</p>
          <ul>
            <li><strong>Posted</strong> — confirmed and included in all totals.</li>
            <li><strong>Pending</strong> — recorded but not yet confirmed. Shown separately in the pending row of the balance summary. Useful for tracking expected invoices or deposits before they clear.</li>
          </ul>
          <p>Use the <strong>All / Posted / Pending</strong> tabs to filter the entry list. To change an income or expense entry, click the pencil icon on its row. <strong>Transfer entries can&apos;t be edited</strong> — void and re-create them instead. To remove any entry from totals while keeping the audit trail, use <strong>Void</strong> — voided entries stay in the ledger but are excluded from all calculations.</p>
        </>
      ),
    },
    {
      group: 'How accounting works',
      id: 'categories',
      heading: 'Using categories for filtering and reporting',
      summary: 'Free-text categories with suggestions; consistent names power exports and year-end reports.',
      keywords: ['category', 'categories', 'reporting', 'filtering', 'export'],
      searchText: 'category categories reporting filtering export registration fees diamond rental umpire fees sponsorship grant fundraising consistent names suggestions',
      content: (
        <>
          <p>Every entry has an optional <strong>category</strong> field. Categories are free-text, but using consistent names pays off when you need to compare year-over-year or prepare a treasurer&apos;s report.</p>
          <p>Suggested category names for tournament ledgers:</p>
          <ul>
            <li>Registration Fees</li>
            <li>Diamond Rental</li>
            <li>Umpire Fees</li>
            <li>Trophies &amp; Medals</li>
            <li>Prize Pool</li>
            <li>Sponsorship</li>
          </ul>
          <p>Suggested category names for org ledgers:</p>
          <ul>
            <li>Grant Income</li>
            <li>Fundraising</li>
            <li>General Expenses</li>
            <li>Administrative</li>
          </ul>
          <p>When you type in the category field, the platform suggests categories already used across your ledgers — using these keeps naming consistent automatically.</p>
          <p>The ledger&apos;s <strong>Export</strong> menu downloads all visible entries (Excel or CSV), including the category column, which you can filter in Excel or Google Sheets for reporting.</p>
        </>
      ),
    },
    {
      group: 'Rep-team finances',
      id: 'allocations',
      heading: 'Cost allocations for rep teams',
      summary: 'Split shared org costs across rep teams with installment schedules coaches can track.',
      keywords: ['allocation', 'cost allocation', 'rep team', 'shared costs', 'installments'],
      searchText: 'cost allocation rep team shared costs diamond fees insurance association fees installment schedule org allocations coach acknowledge owner treasurer',
      content: (
        <>
          <p>When your org incurs shared costs (diamond fees, insurance, association fees), you can allocate a portion of those costs to each rep team. Allocations are created from the <strong>Org Budget</strong> tool and managed under <strong>Rep Teams → Allocations</strong>.</p>
          <p>Each allocation is split across the teams you choose, with its own installment schedule. The allocation appears in the coach&apos;s Org Allocations view so they can track what their team owes and mark installments paid.</p>
          <p>Allocations are created by <strong>owners and treasurers</strong> only — coaches and admins can view and acknowledge them, but cannot create or change them.</p>
        </>
      ),
    },
    {
      group: 'Rep-team finances',
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
          <p>There are two separate ways coaches track player money, and they often get confused:</p>
          <ul>
            <li><strong>Rep-team dues (Club / Premium team workspace).</strong> Rep-team coaches set a <strong>dues schedule</strong> — how much each player owes, split into installments with due dates — and mark installments paid. This is the side that feeds your allocations and the automated reminders below.</li>
            <li><strong>The free Coaches Portal Fees tool.</strong> A coach running a free, standalone team home tracks fees as simple flat charges (charge everyone or one player, then mark paid). It has no installments or automated reminders. See the <a href="../help/coaches">Coaches Portal guide</a>.</li>
          </ul>
          <p>As an admin or treasurer, you see the <strong>allocation</strong> side — what the org has charged each team. Coaches see the dues side — what players owe the team. The two views complement each other.</p>
        </>
      ),
    },
    {
      group: 'Rep-team finances',
      id: 'reminders',
      heading: 'Automated reminders and planning tools',
      summary: 'Send dues and allocation reminders, and open the Org Budget and Budget vs. Actual tools.',
      keywords: ['reminders', 'dues reminders', 'allocation reminders', 'org budget', 'budget vs actual', 'planning'],
      searchText: 'automated reminders dues reminders 30-day 7-day wave guardians allocation reminders org budget budget vs actual planning tools owner treasurer send reminders',
      content: (
        <>
          <p>The Accounting Overview gives owners and treasurers two planning tools and two reminder actions.</p>
          <p><strong>Planning Tools:</strong></p>
          <ul>
            <li><strong>Org Budget</strong> — plan the season&apos;s budget by category and line, and allocate costs to teams.</li>
            <li><strong>Budget vs. Actual</strong> — track allocation and team collection status (see below).</li>
          </ul>
          <p><strong>Automated Reminders</strong> (owners and treasurers only):</p>
          <ul>
            <li><strong>Dues Reminders</strong> — send a 30-day or 7-day wave of reminder emails to guardians for upcoming rep-team dues installments. This respects each coach&apos;s per-team reminder toggle.</li>
            <li><strong>Allocation Reminders</strong> — email yourself a list of all team allocation installments due within the next 30 days.</li>
          </ul>
        </>
      ),
    },
    {
      group: 'Rep-team finances',
      id: 'budget-vs-actual',
      heading: 'Reading Budget vs. Actual',
      summary: 'See estimated, allocated, and collected amounts per line, plus org headroom and team collection health.',
      keywords: ['budget vs actual', 'estimated', 'allocated', 'collected', 'headroom', 'team collection health'],
      searchText: 'budget vs actual estimated allocated collected unallocated status org headroom org ledger expenses team collection health on track behind overdue per-line mapping future pdf',
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
          <p>The headline <strong>Org Headroom</strong> shows your budgeted total against org ledger expenses. The <strong>Org Ledger Expenses</strong> panel lists posted expenses for the year (per-line mapping to budget items is planned for a future update). The <strong>Team Collection Health</strong> grid shows each team&apos;s collection progress with an On Track / Behind / Overdue status.</p>
          <p>Export this report from the <strong>Export</strong> menu — Excel and CSV are available on all plans; the <strong>PDF</strong> board-packet option needs Tournament Plus or above.</p>
        </>
      ),
    },
    {
      id: 'exports',
      group: 'How accounting works',
      heading: 'Exporting accounting data',
      summary: 'Export ledger entries, budget plans, and budget vs. actual to Excel, CSV, and (on Tournament Plus+) PDF.',
      keywords: ['export', 'xlsx', 'csv', 'pdf', 'spreadsheet', 'download', 'board', 'report', 'ledger', 'budget'],
      searchText:
        'export xlsx csv excel pdf spreadsheet download board report ledger budget budget-vs-actual print treasurer tournament plus',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>Accounting tables have an <strong>Export</strong> menu. Excel (.xlsx) and CSV are available everywhere accounting is; the <strong>PDF</strong> board-packet format (on Budget vs. Actual) needs Tournament Plus or above.</p>
          <ul>
            <li>
              <strong>Ledger</strong> — exports the visible entries (use the All / Posted / Pending
              tabs to scope what you export). Columns include date, description, category, type,
              amount, and status.
            </li>
            <li>
              <strong>Budget Plan</strong> — exports the budget by category and line.
            </li>
            <li>
              <strong>Budget vs. Actual</strong> — exports the estimated / allocated / collected
              report. The PDF option produces a board-ready financial report.
            </li>
          </ul>
          <p>
            For a full-year picture, set the date range on the Accounting Overview before drilling
            into individual ledgers.
          </p>
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
