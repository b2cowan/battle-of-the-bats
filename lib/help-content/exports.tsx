/* eslint-disable react/no-unescaped-entities */
import type { HelpPageContent } from './index';
import { HelpNote } from '@/components/help/HelpBlocks';

const exportsHelp: HelpPageContent = {
  title: 'Exports & Downloads',
  role: 'Admin, Owner, Staff, Treasurer, Coach',
  searchPlaceholder: 'Search export help',
  intro:
    'Exports let you take data from FieldLogicHQ and use it in other tools — a spreadsheet, a calendar app, a printed document, or an email attachment. Every export works the same way: find the table you want, click its Export button, and choose a format. The default is always Excel.',
  sections: [
    // ── Section 1: Format guide ─────────────────────────────────────────────
    {
      id: 'formats',
      heading: 'Export formats — which one to choose',
      summary: 'Excel, CSV, Calendar (.ics), and PDF — when to use each.',
      keywords: ['xlsx', 'csv', 'ical', 'ics', 'pdf', 'format', 'spreadsheet', 'calendar', 'google sheets', 'excel', 'logo', 'branding', 'team crest', 'columns missing'],
      searchText:
        'xlsx csv excel spreadsheet google sheets apple numbers calendar ics ical pdf report print format choose download logo branding org name team name crest accent colour color footer how your documents look columns didn\'t fit missing columns page didn\'t fit spreadsheet carries every column premium coaches portal short codes abbreviated headings legend key tryout scorecard categories',
      content: (
        <p>
          Four formats, and the choice comes down to what happens to the file next. When you
          click <strong>Export</strong> on any table you get Excel unless you pick otherwise —
          if you're not sure, that's the right answer.
        </p>
      ),
      subtopics: [
        {
          id: 'export-format-excel',
          title: 'Excel (.xlsx) — the default for almost everything',
          content: (
            <>
              <p>
                Excel is the right choice when you need to sort, filter, calculate totals, or share
                data with someone who will work in a spreadsheet. The file opens directly in Google
                Sheets (no conversion required), Microsoft Excel, Apple Numbers, and most other
                spreadsheet tools.
              </p>
              <p>
                <strong>Common uses:</strong> registration check-in lists, results summaries for the
                board, team rosters for insurance submissions, ledger data for accounting review.
              </p>
            </>
          ),
        },
        {
          id: 'export-format-csv',
          title: 'CSV — for importing into other software',
          content: (
            <>
              <p>
                CSV is a plain-text format that every tool can read. Use it when you need to import
                data into another system — a custom database, a form tool, or software that doesn't
                accept xlsx files. CSV doesn't preserve formatting or formulas, but it is universally
                compatible. It is always available as the second option in the Export dropdown.
              </p>
              <p>
                <strong>Common uses:</strong> importing registrations into another platform, feeding
                data to a reporting script, compatibility with legacy systems.
              </p>
            </>
          ),
        },
        {
          id: 'export-format-calendar',
          title: 'Calendar (.ics) — for adding games to any calendar app',
          content: (
            <>
              <p>
                The Calendar export creates a file that any calendar app can read. When you open it,
                every game or event in the export is added to your calendar as a separate entry — with
                the correct date, time, location, and opponent. Works with Google Calendar, Apple
                Calendar, Microsoft Outlook, and any other app that supports the standard iCal format.
              </p>
              <p>
                Calendar export is available on the schedule pages that support it — the house league
                season schedule and the team schedule in the Coaches Portal. (The tournament schedule
                exports to Excel, CSV, and PDF, not calendar.)
              </p>
              <p>
                <strong>Common uses:</strong> coaches adding a full season schedule to their phone's
                calendar, parents importing tournament game times, officials confirming assigned times.
              </p>
            </>
          ),
        },
        {
          id: 'export-format-pdf',
          title: 'PDF — for printing, sharing, or submitting documents',
          content: (
            <>
              <p>
                A PDF export produces a formatted, ready-to-share document. Use it when the output is
                going to a printer, a parent's inbox, an insurance body, or the board. Every PDF
                carries its owner's identity automatically: documents printed from admin screens show
                your <strong>organization's name and uploaded logo</strong>; documents printed from a
                team's Coaches Portal show the <strong>team's name</strong>, with the team's own crest
                and colours if the coach has set them (in the portal's Team settings, under{' '}
                <em>How your documents look</em>) — or the club's look until they do. Header text,
                accent colour and footer are configured in <strong>Org Settings → PDF Settings</strong>.
              </p>
              <HelpNote variant="warning" title="PDF needs a paid plan">
                <p>
                  Tournament Plus, League Plus, Club, and the Premium Coaches Portal include PDF
                  export and document customization. The free Tournament plan and the Basic Coaches
                  Portal do not.
                </p>
              </HelpNote>
              <p>
                Most PDFs are built to fit the page, so nothing is left off. The exception is a
                table whose columns come from your own setup — a tryout scorecard's categories, for
                instance. There the PDF shortens the column headings to short codes and prints a key
                under the title, so a long scorecard still fits. If a table still can't fit every
                column, the PDF keeps the columns that fit and says which ones it left out, in a
                line under the document's title. Excel and CSV always carry every column, in full.
              </p>
              <p>
                <strong>Common uses:</strong> tournament check-in sheets, team rosters for provincial
                association submissions, budget vs. actual for the board, dues statements for parents.
              </p>
            </>
          ),
        },
      ],
    },

    // ── Section 2: Availability table ───────────────────────────────────────
    {
      id: 'availability',
      heading: 'Where exports are available',
      summary: 'Every module and page that has an Export button, and which formats are supported.',
      keywords: ['available', 'which pages', 'modules', 'where', 'registrations', 'schedule', 'roster', 'ledger', 'standings', 'tryout applicants pdf', 'registrations pdf', 'family statement', 'family dues statement', 'dues statement pdf'],
      searchText:
        'export available pages modules tournaments registrations schedule results house league standings teams rep teams roster tryout applicants coaches portal dues budget vs actual accounting ledger budget org members data tools download where bracket pdf season registrations pdf tryout applicants pdf family dues statement family statements parent statement',
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
                <td>✓</td><td>✓</td><td>—</td><td>✓</td>
                <td>Excel/CSV: any plan · PDF: Plus</td>
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
                <td>League Plus</td>
              </tr>
              <tr>
                <td><strong>House League</strong></td>
                <td>Season Schedule</td>
                <td>✓</td><td>✓</td><td>✓</td><td>—</td>
                <td>League Plus</td>
              </tr>
              <tr>
                <td><strong>House League</strong></td>
                <td>Season Standings</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>League Plus</td>
              </tr>
              <tr>
                <td><strong>House League</strong></td>
                <td>Season Teams</td>
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
                <td>League Plus</td>
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
                <td>✓</td><td>✓</td><td>—</td><td>—</td>
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
                <td>Family dues statements (per-family page — from a player&apos;s record, or every family in one file from the Player Dues Export dialog)</td>
                <td>—</td><td>—</td><td>—</td><td>✓</td>
                <td>Club</td>
              </tr>
              <tr>
                <td><strong>Coaches Portal</strong></td>
                <td>Budget vs. Actual</td>
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
            — not just the rows visible on the current page.
          </p>
        </>
      ),
    },

    // ── Section 4: Sensitive data ────────────────────────────────────────────
    {
      id: 'privacy',
      heading: 'Sensitive data and privacy',
      summary: 'How guardian contacts, player notes, and internal notes are handled in exports.',
      keywords: ['sensitive', 'privacy', 'contact', 'guardian', 'email', 'phone', 'notes', 'internal notes', 'opt-in', 'pdf contact details', 'printed register'],
      searchText:
        'sensitive privacy guardian contact email phone notes internal notes opt-in excluded default confidential pdf leaves out contact details printed register registrations tryout applicants date of birth excel with contact details',
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
            <strong>Printed lists leave contact details out.</strong> The PDF of House League season
            registrations and of rep-team tryout applicants gives you players, dates and status —
            never a date of birth, a guardian name, an email or a phone number. A printed page gets
            forwarded and left on tables, so those columns stay in the spreadsheet exports,
            including <em>Excel with contact details</em>.
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
          keywords: ['pdf', 'greyed', 'locked', 'upgrade', 'plan', 'premium coaches portal'],
          popular: true,
          answer: (
            <p>
              PDF exports are available on Tournament Plus, League Plus, Club, and the Premium
              Coaches Portal. If the PDF option is disabled, your organization is on the free
              Tournament plan (or the team is on the Basic Coaches Portal).{' '}
              <strong>Upgrade to Tournament Plus</strong> — or to the Premium portal for a
              standalone team — for PDF exports and document customization.
            </p>
          ),
          answerText:
            'PDF exports require Tournament Plus, League Plus, Club, or the Premium Coaches Portal. The free Tournament plan and the Basic Coaches Portal do not include PDF exports.',
        },
        {
          id: 'faq-who-can-export',
          question: 'Who can export data?',
          keywords: ['who', 'role', 'permission', 'access'],
          answer: (
            <p>
              Anyone who can see the table can export it — there are no extra role restrictions
              beyond what the page already requires to view. Owners and Admins can export across
              all modules they have access to. Treasurers can export accounting data. Coaches in a
              Club organization can export their team's roster, dues, and schedule from their team
              workspace. Staff can export schedules and results.
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
