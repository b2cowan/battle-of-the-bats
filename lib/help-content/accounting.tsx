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
