/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';

const accountingHelp: HelpPageContent = {
  title: 'Accounting',
  role: 'Treasurer, Admin, Owner',
  intro: 'The accounting module tracks all financial activity for your organization — tournament budgets, org-wide income and expenses, coach dues schedules, and cost allocations for rep teams.',
  sections: [
    {
      heading: 'Understanding ledgers — tournaments vs. org sub-ledgers',
      content: (
        <>
          <p>All accounting in FieldLogicHQ is organized into <strong>ledgers</strong>. There are two types:</p>
          <ul>
            <li><strong>Tournament ledger</strong> — tracks income and expenses for one specific tournament event. Typically used for registration fees, diamond rentals, umpire fees, prize pools, and other tournament-specific costs.</li>
            <li><strong>Org sub-ledger</strong> — tracks org-wide income and expenses that aren't tied to a single tournament. Use these for sponsorships, grants, general operating expenses, and fundraising revenue.</li>
          </ul>
          <p>Create a tournament ledger as soon as you open a tournament. Create org sub-ledgers whenever you need to track a distinct budget bucket — for example, a capital fund or a bursary fund.</p>
          <p>The Accounting Overview page shows all ledgers side-by-side with their net balance. Use the date filter to see activity within any period.</p>
        </>
      ),
    },
    {
      id: 'recipe-create-ledger',
      group: 'How-to recipes',
      heading: 'How to create the right ledger',
      summary: 'Choose between a tournament ledger and an org sub-ledger before money starts moving.',
      keywords: ['create ledger', 'tournament ledger', 'org sub-ledger', 'budget bucket'],
      searchText: 'create ledger tournament ledger org sub-ledger budget bucket accounting overview income expense sponsorship grant fundraising',
      content: (
        <>
          <p>Create a ledger when you need a distinct financial view for an event, fund, or operating bucket.</p>
          <ol>
            <li>Use a <strong>Tournament ledger</strong> for income and expenses tied to one tournament.</li>
            <li>Use an <strong>Org sub-ledger</strong> for organization-wide money such as grants, sponsorships, operating costs, fundraising, or bursaries.</li>
            <li>Name the ledger in a way your board will recognize in reports.</li>
            <li>Add opening entries only if you are bringing forward balances from another system.</li>
            <li>Review the Accounting Overview to confirm the new ledger appears in the correct group.</li>
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
      summary: 'Record confirmed and expected money with useful descriptions, categories, and statuses.',
      keywords: ['add income', 'add expense', 'entry', 'posted', 'pending', 'category'],
      searchText: 'add income add expense ledger entry posted pending category description date amount receipt invoice tournament fees umpire diamond rental',
      content: (
        <>
          <p>Every ledger entry should be understandable later without needing to remember the context.</p>
          <ol>
            <li>Open the ledger where the money belongs.</li>
            <li>Click the action to add a new entry.</li>
            <li>Choose <strong>Income</strong> for money received or <strong>Expense</strong> for money spent.</li>
            <li>Enter a clear description, date, amount, and category.</li>
            <li>Use <strong>Posted</strong> for confirmed transactions and <strong>Pending</strong> for expected invoices or deposits.</li>
            <li>Save, then confirm the balance summary changed as expected.</li>
          </ol>
          <p>Use consistent category names. It makes exports and year-end reports much easier to filter.</p>
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
          <p>Do not record the same movement as an expense in one ledger and income in another. A transfer keeps the organization total accurate.</p>
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
      searchText: 'board report treasurer report budget vs actual date range categories export pdf csv xlsx variance financial report monthly meeting',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>For a monthly or year-end report, start broad and then drill into details.</p>
          <ol>
            <li>Open <strong>Accounting Overview</strong> and set the date range for the reporting period.</li>
            <li>Review each ledger balance for unexpected pending or voided entries.</li>
            <li>Open the relevant budget or ledger detail view.</li>
            <li>Use consistent categories to group revenue and expenses.</li>
            <li>Export <strong>Budget vs. Actual</strong> when you need a board packet with variance detail.</li>
            <li>Export CSV or Excel when the treasurer needs to do additional spreadsheet analysis.</li>
          </ol>
          <p>Before sharing externally, remove unnecessary personal information and confirm the report period is correct.</p>
        </>
      ),
    },
    {
      heading: 'Creating and managing entries',
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
          <p>To edit an entry, click the pencil icon on the entry row. To remove an entry from totals while keeping the audit trail, use <strong>Void</strong> — voided entries remain in the ledger but are excluded from all calculations.</p>
        </>
      ),
    },
    {
      heading: 'Using categories for filtering and reporting',
      content: (
        <>
          <p>Every entry has an optional <strong>category</strong> field. Categories are free-text, but using consistent names pays off when you need to compare year-over-year or prepare a treasurer's report.</p>
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
          <p>The <strong>Export CSV</strong> button on any ledger detail page exports all visible entries, including the category column, which you can filter in Excel or Google Sheets for reporting.</p>
        </>
      ),
    },
    {
      heading: 'Cost allocations for rep teams',
      content: (
        <>
          <p>When your org incurs shared costs (diamond fees, insurance, association fees), you can allocate a portion of those costs to each rep team using the <strong>Allocations</strong> section under Rep Teams.</p>
          <p>Each allocation is split across the teams you choose, with its own installment schedule. The allocation appears in the coach's Org Allocations view so they can track what their team owes and mark installments paid.</p>
          <p>Allocations are managed by org administrators — coaches can view and acknowledge them, but cannot create or change them.</p>
        </>
      ),
    },
    {
      heading: 'Dues schedules — what they are and how coaches use them',
      content: (
        <>
          <p>Rep team coaches manage player dues directly in their coaching portal. A <strong>dues schedule</strong> defines how much each player owes and when payments are due.</p>
          <p>Coaches can:</p>
          <ul>
            <li>Set a dues schedule for individual players or apply one schedule to all players at once.</li>
            <li>Split the total into <strong>installments</strong> — individual payments due on specific dates.</li>
            <li>Mark installments as paid manually.</li>
            <li>Send payment reminder emails to players with upcoming or overdue installments.</li>
          </ul>
          <p>The Team Accounting overview rolls up dues collected, total expenses, and the net balance so coaches always have a current picture of their team finances.</p>
          <p>As an admin or treasurer, you see the allocation side of team finances — what the org has charged each team. Coaches see the dues side — what players owe the team. These two views complement each other.</p>
        </>
      ),
    },
    {
      id: 'exports',
      heading: 'Exporting accounting data',
      summary: 'Export ledger entries, budget plans, and budget vs. actual reports to Excel, CSV, and PDF.',
      keywords: ['export', 'xlsx', 'csv', 'pdf', 'spreadsheet', 'download', 'board', 'report', 'ledger', 'budget'],
      searchText:
        'export xlsx csv excel pdf spreadsheet download board report ledger budget budget-vs-actual print treasurer',
      links: [
        { label: 'Exports & Downloads guide', href: '../help/exports' },
      ],
      content: (
        <>
          <p>
            Every accounting data table has an <strong>Export</strong> button in the top right.
            Click it to download in Excel (.xlsx) or CSV.
          </p>
          <ul>
            <li>
              <strong>Ledger</strong> — exports all currently visible entries (use the tab filter
              to export only posted or only pending). Columns: date, description, category, type,
              amount, status.
            </li>
            <li>
              <strong>Budget Plan</strong> — exports the full budget by category and line with
              total, allocated, and collected amounts.
            </li>
            <li>
              <strong>Budget vs. Actual</strong> — exports the variance report by category and
              line. The PDF option produces a board-ready financial report.
            </li>
          </ul>
          <p>
            For a full-year picture, set the date range on the Accounting Overview page before
            drilling into individual ledgers — the overview shows your org's aggregate net position
            for the selected period.
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
