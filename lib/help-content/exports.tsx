import type { HelpPageContent } from './index';

const exportsHelp: HelpPageContent = {
  title: 'Exports & Downloads',
  role: 'Admin, Owner, Staff, Treasurer, Coach',
  searchPlaceholder: 'Search export help...',
  intro:
    'Exports let you take data from FieldLogicHQ and use it in other tools — a spreadsheet, a calendar app, a printed document, or an email attachment. Every export works the same way: find the table you want, click the Export button in the top right of that section, and choose a format. The default is always Excel.',
  sections: [
    // ── Section 1: Format guide ─────────────────────────────────────────────
    {
      id: 'formats',
      heading: 'Export formats — which one to choose',
      summary: 'Excel, CSV, Calendar (.ics), and PDF — when to use each.',
      keywords: ['xlsx', 'csv', 'ical', 'ics', 'pdf', 'format', 'spreadsheet', 'calendar', 'google sheets', 'excel'],
      searchText:
        'xlsx csv excel spreadsheet google sheets apple numbers calendar ics ical pdf report print format choose download',
      content: (
        <>
          <h3>Excel (.xlsx) — the default for almost everything</h3>
          <p>
            Excel is the right choice when you need to sort, filter, calculate totals, or share
            data with someone who will work in a spreadsheet. The file opens directly in Google
            Sheets (no conversion required), Microsoft Excel, Apple Numbers, and most other
            spreadsheet tools.
          </p>
          <p>
            When you click <strong>Export</strong> on any table in FieldLogicHQ, you get an Excel
            file automatically. If you're not sure which format to use, use Excel.
          </p>
          <p>
            <strong>Common uses:</strong> registration check-in lists, results summaries for the
            board, team rosters for insurance submissions, ledger data for accounting review.
          </p>

          <h3>CSV — for importing into other software</h3>
          <p>
            CSV is a plain-text format that every tool can read. Use it when you need to import
            data into another system — a custom database, a form tool, or software that doesn't
            accept xlsx files. CSV doesn't preserve formatting or formulas, but it is universally
            compatible.
          </p>
          <p>
            CSV is always available as the second option in the Export dropdown.
          </p>
          <p>
            <strong>Common uses:</strong> importing registrations into another platform, feeding
            data to a reporting script, compatibility with legacy systems.
          </p>

          <h3>Calendar (.ics) — for adding games to any calendar app</h3>
          <p>
            The Calendar export creates a file that any calendar app can read. When you open it,
            every game or event in the export is added to your calendar as a separate entry — with
            the correct date, time, location, and opponent. Works with Google Calendar, Apple
            Calendar, Microsoft Outlook, and any other app that supports the standard iCal format.
          </p>
          <p>
            Calendar export is available on schedule pages and is free on all plans.
          </p>
          <p>
            <strong>Common uses:</strong> coaches adding a full season schedule to their phone's
            calendar, parents importing tournament game times, officials confirming assigned times.
          </p>

          <h3>PDF — for printing, sharing, or submitting documents</h3>
          <p>
            A PDF export produces a formatted, ready-to-share document. Use it when the output is
            going to a printer, a parent's inbox, an insurance body, or the board. PDF exports use
            your organization's branding — your logo and colours in the header, your name, and
            optional footer text.
          </p>
          <p>
            PDF exports are available on Tournament Plus, League, and Club plans. Free Tournament
            plan organizations get PDFs with default FieldLogicHQ branding.
          </p>
          <p>
            <strong>Common uses:</strong> tournament check-in sheets, team rosters for provincial
            association submissions, budget vs. actual for the board, dues statements for parents.
          </p>
        </>
      ),
    },

    // ── Section 2: Availability table ───────────────────────────────────────
    {
      id: 'availability',
      heading: 'Where exports are available',
      summary: 'Every module and page that has an Export button, and which formats are supported.',
      keywords: ['available', 'which pages', 'modules', 'where', 'registrations', 'schedule', 'roster', 'ledger', 'standings'],
      searchText:
        'export available pages modules tournaments registrations schedule results house league standings teams rep teams roster tryout coaches portal dues accounting ledger budget org members',
      content: (
        <>
          <p>
            Exports are available on every major data table in FieldLogicHQ. If a page shows a
            list of records — registrations, teams, games, rosters, ledger entries, standings — it
            has an Export button. The table below lists each surface, the formats available, and
            the plan required.
          </p>
          <table>
            <thead>
              <tr>
                <th>Module</th>
                <th>Page</th>
                <th>Excel</th>
                <th>CSV</th>
                <th>Calendar (.ics)</th>
                <th>PDF</th>
                <th>Plan required</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Tournaments</strong></td>
                <td>Teams &amp; Registrations</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Tournament Plus</td>
              </tr>
              <tr>
                <td><strong>Tournaments</strong></td>
                <td>Schedule</td>
                <td>✓</td><td>✓</td><td>✓</td><td>✓</td>
                <td>Excel/CSV/iCal: any plan · PDF: Plus</td>
              </tr>
              <tr>
                <td><strong>Tournaments</strong></td>
                <td>Results &amp; Scoring</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Excel/CSV: any plan · PDF: Plus</td>
              </tr>
              <tr>
                <td><strong>House League</strong></td>
                <td>Season Registrations</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>League</td>
              </tr>
              <tr>
                <td><strong>House League</strong></td>
                <td>Season Schedule</td>
                <td>✓</td><td>✓</td><td>✓</td><td>—</td>
                <td>League</td>
              </tr>
              <tr>
                <td><strong>House League</strong></td>
                <td>Season Standings</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>League</td>
              </tr>
              <tr>
                <td><strong>House League</strong></td>
                <td>Season Teams</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>League</td>
              </tr>
              <tr>
                <td><strong>Rep Teams</strong></td>
                <td>Tryout Registrations</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Rep Teams</strong></td>
                <td>Roster (admin view)</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Coaches Portal</strong></td>
                <td>Team Roster</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Coaches Portal</strong></td>
                <td>Player Dues</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Coaches Portal</strong></td>
                <td>Team Schedule</td>
                <td>✓</td><td>✓</td><td>✓</td><td>—</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Accounting</strong></td>
                <td>Ledger</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Accounting</strong></td>
                <td>Budget vs. Actual</td>
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Accounting</strong></td>
                <td>Budget Plan</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Org Admin</strong></td>
                <td>Members</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>Tournament Plus</td>
              </tr>
              <tr>
                <td><strong>Org Admin</strong></td>
                <td>Member Audit Log</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>Owner only</td>
              </tr>
              <tr>
                <td><strong>Org Admin</strong></td>
                <td>Venues</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>Any plan</td>
              </tr>
            </tbody>
          </table>
          <p>
            If a page you expect to have an export doesn't: check your plan level first. If your
            plan includes the module and the Export button is missing, contact support — every data
            table in FieldLogicHQ is designed to have an export option.
          </p>
        </>
      ),
    },

    // ── Section 3: Filters and scope ────────────────────────────────────────
    {
      id: 'filters',
      heading: 'What gets exported — filters and scope',
      summary: 'Exports always match the filters you have applied on screen.',
      keywords: ['filters', 'scope', 'all records', 'missing records', 'pagination'],
      searchText:
        'filter export scope all records full dataset pagination missing records clear filters current view',
      content: (
        <>
          <p>
            Exports always reflect the filters you have applied on screen. If you're viewing the
            Under-15 division in tournament registrations, the export contains only Under-15 teams.
            If you've filtered to Pending status, only pending registrations are exported.
          </p>
          <p>
            This is intentional — it lets you export exactly the slice you need without editing
            the file afterward. To export everything, clear all filters before exporting.
          </p>
          <p>
            For large datasets that span multiple pages, the export downloads all matching records
            — not just what's visible on screen. The export button will indicate "All matching
            records" in those cases.
          </p>
        </>
      ),
    },

    // ── Section 4: Sensitive data ────────────────────────────────────────────
    {
      id: 'privacy',
      heading: 'Sensitive data and privacy',
      summary: 'How guardian contacts, player notes, and internal notes are handled in exports.',
      keywords: ['sensitive', 'privacy', 'contact', 'guardian', 'email', 'phone', 'notes', 'internal notes', 'opt-in'],
      searchText:
        'sensitive privacy guardian contact email phone notes internal notes opt-in excluded default confidential',
      content: (
        <>
          <p>
            Sensitive fields — guardian email addresses, phone numbers, player notes, and internal
            admin notes — are <strong>excluded from exports by default</strong>. The standard
            export contains names, statuses, division assignments, and other non-contact data.
          </p>
          <p>
            When an export surface has optional sensitive data you may need, the Export menu shows
            additional opt-in choices, clearly labelled with what they include:
          </p>
          <ul>
            <li>
              <strong>Excel with contact details</strong> — adds guardian email and phone number
              columns
            </li>
            <li>
              <strong>Excel with internal notes</strong> — adds internal admin notes that the
              registering family never sees
            </li>
          </ul>
          <p>
            These are deliberate choices that require you to select them explicitly. They are never
            the default. Choose only what you need for the task at hand.
          </p>
          <p>
            PDF privacy defaults can be configured in <strong>Org Settings → PDF Settings</strong>
            — set your preferences once and every PDF export follows those defaults unless you
            override them at export time.
          </p>
        </>
      ),
    },

    // ── Section 5: Calendar import instructions ──────────────────────────────
    {
      id: 'calendar-import',
      heading: 'How to import a calendar (.ics) file',
      summary: 'Step-by-step instructions for Google Calendar, Apple Calendar, and Outlook.',
      keywords: ['ical', 'ics', 'calendar', 'google calendar', 'apple calendar', 'outlook', 'import', 'subscribe'],
      searchText:
        'ical ics calendar import google apple outlook subscribe add events phone schedule',
      content: (
        <>
          <p>
            Download the .ics file from the Export menu on any schedule page, then import it into
            your calendar app using the steps below.
          </p>
          <h3>Google Calendar</h3>
          <ol>
            <li>Go to <strong>calendar.google.com</strong>.</li>
            <li>Click the gear icon → <strong>Settings</strong>.</li>
            <li>In the left sidebar, scroll to <strong>Import &amp; Export</strong>.</li>
            <li>Click <strong>Import</strong>, select the .ics file, choose which calendar to add events to, then click <strong>Import</strong>.</li>
          </ol>
          <h3>Apple Calendar (macOS or iOS)</h3>
          <ol>
            <li>Open the downloaded .ics file directly — Calendar opens automatically.</li>
            <li>Calendar will ask which calendar to add the events to and prompt you to confirm.</li>
          </ol>
          <h3>Microsoft Outlook</h3>
          <ol>
            <li>Open the .ics file — Outlook shows a preview and prompts you to add the events.</li>
          </ol>
          <p>
            <strong>Note:</strong> The Calendar export is a snapshot taken at the moment you
            download it. If games are changed or cancelled afterward, your calendar will not update
            automatically. Re-download and re-import to get the latest schedule. A live,
            automatically-updating calendar subscription link is planned for a future release.
          </p>
        </>
      ),
    },

    // ── Section 6: Troubleshooting ───────────────────────────────────────────
    {
      id: 'troubleshooting',
      heading: 'Troubleshooting',
      summary: 'Common issues and how to fix them.',
      keywords: ['troubleshoot', 'problem', 'missing', 'protected view', 'greyed out', 'not working', 'error'],
      searchText:
        'troubleshoot problem missing records protected view greyed out pdf locked upgrade plan xlsx csv error not working',
      content: (
        <></>
      ),
      faqs: [
        {
          id: 'faq-open-xlsx-google',
          question: 'Can I open an xlsx file in Google Sheets?',
          keywords: ['google sheets', 'xlsx', 'open'],
          answer: (
            <p>
              Yes, directly. Go to <strong>drive.google.com</strong>, click New → File upload,
              select the xlsx file. Google Sheets opens it without any conversion step. You can
              also drag the file onto <strong>sheets.google.com</strong>.
            </p>
          ),
          answerText:
            'Yes. Go to drive.google.com, click New → File upload, and select the xlsx file. Google Sheets opens it directly — no conversion needed.',
        },
        {
          id: 'faq-xlsx-protected-view',
          question: 'Excel opens in Protected View — what do I do?',
          keywords: ['protected view', 'excel', 'enable editing'],
          popular: true,
          answer: (
            <p>
              This is a Microsoft Office security feature for files downloaded from the internet.
              Click <strong>Enable Editing</strong> in the yellow bar at the top. The file is safe
              — it was generated directly from your FieldLogicHQ data.
            </p>
          ),
          answerText:
            'Click "Enable Editing" in the yellow bar at the top of the Excel window. This is a standard Microsoft security prompt for files downloaded from the web.',
        },
        {
          id: 'faq-missing-records',
          question: 'My export is missing some records — why?',
          keywords: ['missing', 'records', 'filters'],
          popular: true,
          answer: (
            <p>
              Check the active filters. Exports match what you see on screen — if the list is
              filtered, only filtered records are exported. Clear all filters and export again to
              get the full dataset.
            </p>
          ),
          answerText:
            'Exports match the filters currently applied on screen. Clear all filters and export again to get the full dataset.',
        },
        {
          id: 'faq-exports-update',
          question: 'Do exports update automatically?',
          keywords: ['update', 'automatic', 'live', 'real time'],
          answer: (
            <p>
              No. Exports are snapshots taken at the moment you download. If data changes
              afterward, re-export. Calendar (.ics) exports are also snapshots — a live
              subscribable calendar URL is planned for a future release.
            </p>
          ),
          answerText:
            'No — exports are point-in-time snapshots. Re-export to get updated data. A live subscribable calendar URL is planned for a future release.',
        },
        {
          id: 'faq-pdf-greyed',
          question: 'The PDF option is greyed out — why?',
          keywords: ['pdf', 'greyed', 'locked', 'upgrade', 'plan'],
          popular: true,
          answer: (
            <p>
              PDF exports are available on Tournament Plus, League, and Club plans. If the PDF
              option is disabled, your organization is on the free Tournament plan.{' '}
              <strong>Upgrade to Tournament Plus</strong> for PDF exports and template
              customization.
            </p>
          ),
          answerText:
            'PDF exports require Tournament Plus, League, or Club. The free Tournament plan does not include PDF exports.',
        },
        {
          id: 'faq-who-can-export',
          question: 'Who can export data?',
          keywords: ['who', 'role', 'permission', 'access'],
          answer: (
            <p>
              Anyone who can see the table can export it — there are no extra role restrictions
              beyond what the page already requires to view. Owners and Admins can export across
              all modules they have access to. Treasurers can export accounting data. Coaches can
              export their own team's roster, dues, and schedule from the Coaches Portal. Staff can
              export schedules and results.
            </p>
          ),
          answerText:
            'Anyone who can view the table can export it. No extra role restrictions — export access mirrors view access.',
        },
      ],
    },
  ],
};

export default exportsHelp;
