/**
 * THE DOCUMENTS THIS PRODUCT PUTS IN A CUSTOMER'S HANDS — one entry per document, each
 * rendered through the REAL renderer with the shape the real screen hands it.
 *
 * ⚠⚠ THE ONE RULE THIS FILE LIVES OR DIES BY: AN EXHIBIT BUILT FROM A FIXTURE YOU WROTE IS
 * EVIDENCE ABOUT YOUR FIXTURE. Three passes have lost findings to it, and §106's entire
 * headline defect — a "missing bracket connector" — was a fixture artifact: hand-written game
 * rows omitted a field production never clears, and fixing it would have put a regression into
 * working code. So wherever the product owns the shape, this file IMPORTS the product's own
 * shape rather than retyping it:
 *   - every coach money document takes its columns from `lib/coach-money-exports.ts` constants,
 *     so adding a column there immediately renders here and the gate says whether it still fits;
 *   - the tournament schedule goes through `buildScheduleDocument`;
 *   - the check-in sheet takes `checkinSheetHeadings` / `checkinTickColumn`;
 *   - the family statements go through `buildFamilyDuesStatements`;
 *   - team paper is resolved by the real `applyTeamLook`, never hand-assembled.
 * What this file supplies is DATA, at realistic customer widths. Nothing else.
 *
 * ⚠ AND THE EMPTY CASE IS WHERE THE DEFECTS LIVE. §102 found a heading that printed as bare
 * separator dots and §106 found a crash on a division with no playoff games — both in the
 * "nothing here yet" path. Every document may therefore declare `edgeCases`, which render the
 * SAME document under awkward data. They are not extra documents; they are the same document
 * on the day it is hardest to draw.
 *
 * Loaded by scripts/check-pdf-documents.mjs, which registers the module loader first.
 */

/* Two crests, inline. A square one and a 2:1 one, because the header's logo slot lays text out
 * around whatever it is given — the geometry of the header changes with the crest, and a
 * document rendered without one is not the document most clubs print. Inline, so this check
 * needs no image toolchain and cannot drift when a stock logo is redrawn. */
const CREST_SQUARE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAMAAACdt4HsAAAAA1BMVEUvazw9DfLsAAAACXBIWXMA' +
  'AAPoAAAD6AG1e1JrAAAAG0lEQVRYw+3BgQAAAADDoPlT3+AEVQEAAAB8AxBAAAEZszF2AAAAAElFTkSuQmCC';
const CREST_WIDE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAABACAMAAADlCI9NAAAAA1BMVEUvazw9DfLsAAAACXBIWXMA' +
  'AAPoAAAD6AG1e1JrAAAAHklEQVRo3u3BAQEAAACCIP+vbkhAAQAAAAAAAADvBiBAAAG/g+AuAAAAAElFTkSuQmCC';

const ORG = 'Riverdale Minor Ball';
const CLUB = 'Riverdale Ridge Baseball Association';
const TEAM = 'Riverdale Ridge U13 AA';
const SEASON = '2026 Season';
const TOURNAMENT = 'Riverdale Summer Classic 2026';

/* ── Realistic customer data. Widths matter more than content: these are the names, categories
 *    and phrases that actually stress a column, taken from the shapes six passes were reviewed
 *    against. A fixture of "Item 1 / Item 2" proves a document fits a table nobody has. */
const KIDS = [
  ['Maya', 'Chen'], ['Liam', 'Tremblay'], ['Ava', 'Okafor'], ['Noah', 'Nguyen'],
  ['Emma', 'MacLeod'], ['Jack', 'Sandhu'], ['Olivia', 'Brière'], ['Ethan', 'Kowalski'],
  ['Sophie', 'Lam'], ['Lucas', 'Fontaine'], ['Chloe', 'Desjardins'], ['Owen', 'Whitfield'],
  ['Isla', 'Marchand'], ['Nathan', 'Oyelaran'], ['Priya', 'Balasubramanian'],
  ['Declan', 'O’Shaughnessy'], ['Amara', 'Mwangi'], ['Elias', 'Vandenberg'],
];
const TEAMS = [
  'Riverdale Rapids', 'Harborview Herons', 'Cedar Falls Comets', 'Maplewood Marlins',
  'Brookside Bobcats', 'Lakeshore Lynx', 'Pinehill Panthers', 'Fairfield Foxes',
];
const POS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const full = (i) => `${KIDS[i % KIDS.length][0]} ${KIDS[i % KIDS.length][1]}`;

const money = (n) => {
  const s = Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${s}` : `$${s}`;
};

/**
 * A plausible cell for a column, chosen from its LABEL and its declared format.
 *
 * ⚠ Deliberately width-realistic, not minimal. The whole point of driving the money documents
 * off the product's own column constants is that adding a column re-renders here — and that is
 * only evidence if the cells under it are as wide as a coach's real data.
 */
function cellFor(col, i) {
  const label = col.label.toLowerCase();
  if (col.format === 'currency') return money([1450, 275.5, 3200, 89.99, 640][i % 5]);
  if (col.format === 'number') return String([12, 25, 8, 40, 17][i % 5]);
  if (col.format === 'date') return ['Jun 1, 2026', 'Aug 14, 2026', 'Oct 1, 2026', 'Sep 22, 2026', 'Jul 9, 2026'][i % 5];
  if (/player|name|payee|from/.test(label)) return [full(i), 'Harborview Sports Supply', 'Riverdale Minor Ball', full(i + 3), 'Cedar Falls Screenprinting'][i % 5];
  if (/status/.test(label)) return ['Up to date', 'Past due', 'Fully paid', 'Awaiting review', 'Approved'][i % 5];
  if (/kind|direction|method/.test(label)) return ['Team expense', 'Fundraiser', 'Sponsorship', 'e-Transfer', 'Cheque'][i % 5];
  if (/categor/.test(label)) return ['Tournament entry fees', 'Equipment & uniforms', 'Field rental', 'Umpires', 'Team travel'][i % 5];
  if (/tag/.test(label)) return ['Tournament · Equipment', 'Travel', '', 'Uniforms · Spring', 'Umpires'][i % 5];
  if (/item|line|allocation/.test(label)) return ['Provincial qualifier entry', 'Practice jerseys (18)', 'Diamond 3 — Tuesdays', 'Weekend umpire crew', 'Hotel block, 9 rooms'][i % 5];
  if (/description|what|notes|schedule/.test(label)) return ['Balance owing on the provincial qualifier entry', 'Two payments, June and August', 'Invoice 2026-114, net 30', 'Split across the two tournaments', 'Paid at the front office'][i % 5];
  if (/payments/.test(label)) return ['2 of 4 paid', 'Paid in full', 'Monthly ×12', '1 of 2 paid', 'Not started'][i % 5];
  return ['Riverdale Ridge', 'Harborview', 'Cedar Falls', 'Maplewood', 'Brookside'][i % 5];
}

/** Rows for a money document, built from the PRODUCT's column definitions. */
function rowsFor(columns, count) {
  return Array.from({ length: count }, (_, i) =>
    Object.fromEntries(columns.map((c) => [c.key, cellFor(c, i)])),
  );
}

/**
 * Build the whole document set. Async because it loads the repo's real renderers, which the
 * caller must already have made loadable (scripts/lib/pdf-node-loader.mjs).
 */
export async function buildDocuments() {
  const pdf = await import('../lib/export/pdf.ts');
  const { downloadBracketPDF } = await import('../lib/export/bracket-pdf.ts');
  const { applyTeamLook } = await import('../lib/export/resolve-pdf-settings.ts');
  const { buildScheduleDocument } = await import('../lib/export/schedule-document.ts');
  const { checkinSheetHeadings, checkinTickColumn } = await import('../lib/export/tryout-checkin-columns.ts');
  const { buildFamilyDuesStatements } = await import('../lib/coach-dues-statement.ts');
  const money$ = await import('../lib/coach-money-exports.ts');
  const { formatTime } = await import('../lib/utils.ts');
  const {
    DEFAULT_PDF_SETTINGS, downloadPDF, downloadPracticeSheet, downloadDevelopmentSummary,
    downloadTryoutBoardSummary, downloadFamilyDuesStatements, downloadLineupPoster,
    downloadBattingOrderCard, buildPositionLegend,
  } = pdf;

  /* ── The identity ladder, resolved the way the two GET endpoints serve it ───────────────
   *  An untouched org gets its name in the header and nothing else; a branded club gets its
   *  saved look plus a derived crest; team paper is the club's look with the TEAM's name over
   *  it, produced by the real resolver so the fallback order is the product's, not mine. */
  const ADMIN_PLAIN = { ...DEFAULT_PDF_SETTINGS, headerLine1: ORG };
  const ADMIN_BRANDED = {
    ...DEFAULT_PDF_SETTINGS,
    headerLine1: CLUB,
    headerLine2: SEASON,
    footerText: 'riverdaleridge.ca  ·  treasurer@riverdaleridge.ca',
    accentColor: '#2F6B3C',
    logoDataUrl: CREST_SQUARE,
  };
  const COACH_PLAIN = applyTeamLook(ADMIN_PLAIN, TEAM, null, true);
  const COACH_BRANDED = applyTeamLook(ADMIN_BRANDED, TEAM, null, true);
  /** A club whose crest is not square — the header slot lays out differently around it. */
  const ADMIN_WIDE_CREST = { ...ADMIN_BRANDED, logoDataUrl: CREST_WIDE };
  /** Every footer switch off — a real, reachable configuration on a plan that customizes. */
  const BLANK_FOOTER = {
    ...ADMIN_BRANDED,
    footerText: '',
    showDateStamp: false,
    showBranding: false,
    showPageNumbers: false,
  };

  const docs = [];
  /**
   * Declare one document. The defaults are the STRICT case, so a new entry has to opt OUT of
   * being held to the tightest rule rather than remembering to opt in.
   *
   * @param d.entry     which renderer proves this document. Default `downloadPDF`, the table
   *                    engine most documents go through.
   * @param d.columns   'fixed'   — the heading list is a literal in the code, so it fits by
   *                                construction and the drop-and-say-so line is a BUG here.
   *                                THE DEFAULT: a new document is held to this until someone
   *                                argues otherwise.
   *                    'customer'— the headings come from the customer's own data (rubric
   *                                categories, months, tag names), so dropping is the contract
   *                                working, not failing.
   * @param d.pageTotals 'document' (default) every page names the file's true total ·
   *                     'section'  numbering restarts per section (the family statements) ·
   *                     'none'     a single sheet that numbers nothing.
   */
  const doc = (d) => {
    docs.push({ entry: 'downloadPDF', columns: 'fixed', pageTotals: 'document', edgeCases: [], ...d });
  };

  /* ══ Tournament paper ═══════════════════════════════════════════════════════════════ */

  const REG_HEADERS = ['Team', 'Division', 'Coach', 'Email', 'Status', 'Slot / Pool', 'Payment'];
  doc({
    id: 'tournament-registrations',
    label: 'Tournament registrations',
    screens: ['app/[orgSlug]/admin/tournaments/registrations/page.tsx'],
    headings: REG_HEADERS,
    render: (name, settings) => downloadPDF(
      name, 'Tournament Registrations', TOURNAMENT, REG_HEADERS,
      Array.from({ length: 26 }, (_, i) => [
        TEAMS[i % TEAMS.length], ['U11 A', 'U13 AA', 'U15 AAA'][i % 3], full(i),
        `${KIDS[i % KIDS.length][1].toLowerCase()}.family@example.ca`,
        ['Confirmed', 'Awaiting payment', 'Waitlisted'][i % 3],
        `Pool ${'ABCD'[i % 4]} · Slot ${(i % 6) + 1}`, money(675),
      ]),
      settings, { identity: ORG },
    ),
    edgeCases: [
      /**
       * ⚠ A CLUB THAT TURNED THE WHOLE FOOTER OFF. On a plan that allows customization, all four
       * footer switches can be off at once — no text, no date stamp, no branding, no page numbers
       * — and the result is a correct document with nothing along the bottom. The gate had never
       * rendered that shape and would have reported every page of it as a fault. Multi-page on
       * purpose, so the continuation pages are exercised too.
       */
      ['no-footer', (name, settings) => downloadPDF(
        name, 'Tournament Registrations', TOURNAMENT, REG_HEADERS,
        Array.from({ length: 26 }, (_, i) => [
          TEAMS[i % TEAMS.length], ['U11 A', 'U13 AA', 'U15 AAA'][i % 3], full(i),
          `${KIDS[i % KIDS.length][1].toLowerCase()}.family@example.ca`,
          ['Confirmed', 'Awaiting payment', 'Waitlisted'][i % 3],
          `Pool ${'ABCD'[i % 4]} · Slot ${(i % 6) + 1}`, money(675),
        ]),
        settings, { identity: ORG },
      ), { settingsOverride: BLANK_FOOTER }],
    ],
  });

  const schedRows = (games) => games.map((g) => ({
    date: g.date ?? '', time: formatTime(g.time), division: g.division,
    homeTeam: g.homeTeam, awayTeam: g.awayTeam, location: g.location, status: g.status,
  }));
  const GAMES = [];
  for (let i = 0; i < 30; i++) {
    GAMES.push({
      date: ['2026-08-01', '2026-08-02', '2026-08-03'][i % 3],
      time: `${String(8 + (i % 6)).padStart(2, '0')}:00`,
      division: ['U11 A', 'U13 AA', 'U15 AAA'][i % 3],
      homeTeam: TEAMS[i % TEAMS.length], awayTeam: TEAMS[(i + 3) % TEAMS.length],
      location: 'Riverdale Community Park - Diamond 2',
      status: i % 7 === 0 ? 'cancelled' : i < 12 ? 'completed' : 'scheduled',
    });
  }
  doc({
    id: 'tournament-schedule',
    label: 'Tournament schedule',
    screens: ['app/[orgSlug]/admin/tournaments/schedule/page.tsx'],
    render: (name, settings) => {
      const { headers, groups } = buildScheduleDocument(schedRows(GAMES));
      return downloadPDF(name, 'Tournament Schedule', TOURNAMENT, headers, [], settings,
        { identity: ORG, groups, shape: { orientation: 'landscape', density: 'compact' } });
    },
    edgeCases: [
      // A single day long enough to spill, so a section heading has to carry over.
      ['one-long-day', (name, settings) => {
        const day = Array.from({ length: 44 }, (_, i) => ({
          ...GAMES[i % GAMES.length], date: '2026-08-01',
          time: `${String(6 + Math.floor(i / 6)).padStart(2, '0')}:00`, status: 'completed',
        }));
        const { headers, groups } = buildScheduleDocument(schedRows(day));
        return downloadPDF(name, 'Tournament Schedule', TOURNAMENT, headers, [], settings,
          { identity: ORG, groups, shape: { orientation: 'landscape', density: 'compact' } });
      }],
      // A game with no date yet — the group that used to open with bare separator dots (§102).
      ['undated-games', (name, settings) => {
        const mixed = GAMES.map((g, i) => (i % 4 === 0 ? { ...g, date: null, time: null } : g));
        const { headers, groups } = buildScheduleDocument(schedRows(mixed));
        return downloadPDF(name, 'Tournament Schedule', TOURNAMENT, headers, [], settings,
          { identity: ORG, groups, shape: { orientation: 'landscape', density: 'compact' } });
      }],
    ],
  });

  const RESULTS_HEADERS = ['Division', 'Date', 'Home', 'Away', 'Score', 'Result', 'Venue', 'Status'];
  doc({
    id: 'tournament-results',
    label: 'Tournament results',
    screens: ['app/[orgSlug]/admin/tournaments/results/page.tsx'],
    // The results page says so in its own comment: eight columns, landscape, every one clears
    // its floor — "which is what makes the didn't-fit line a bug here rather than a possibility."
    headings: RESULTS_HEADERS,
    render: (name, settings) => downloadPDF(
      name, 'Tournament Results', TOURNAMENT, RESULTS_HEADERS,
      Array.from({ length: 34 }, (_, i) => [
        ['U11 A', 'U13 AA', 'U15 AAA'][i % 3], 'Aug 2, 2026',
        TEAMS[i % TEAMS.length], TEAMS[(i + 5) % TEAMS.length],
        `${4 + (i % 6)} – ${1 + (i % 5)}`, `${TEAMS[i % TEAMS.length]} win`,
        'Riverdale Community Park - Diamond 2', 'Final',
      ]),
      settings, { identity: ORG, shape: { orientation: 'landscape' } },
    ),
  });

  const bracketTeams = TEAMS.map((name, i) => ({ id: `t${i + 1}`, name }));
  const bg = (id, code, h, a, hs, as, ph) => ({
    id, bracketCode: code, isPlayoff: true,
    status: hs != null ? 'completed' : 'scheduled',
    homeTeamId: h, awayTeamId: a, homeScore: hs ?? null, awayScore: as ?? null,
    homePlaceholder: ph?.h ?? null, awayPlaceholder: ph?.a ?? null,
    bracketId: null, bracketLabel: null, roundLabel: null,
  });
  const BRACKET = [
    bg('g1', 'QF1', 't1', 't8', 7, 2, { h: 'Seed #1', a: 'Seed #8' }),
    bg('g2', 'QF2', 't4', 't5', 4, 5, { h: 'Seed #4', a: 'Seed #5' }),
    bg('g3', 'QF3', 't2', 't7', 6, 3, { h: 'Seed #2', a: 'Seed #7' }),
    bg('g4', 'QF4', 't3', 't6', 1, 8, { h: 'Seed #3', a: 'Seed #6' }),
    bg('g5', 'SF1', 't1', 't5', 5, 3, { h: 'Winner QF1', a: 'Winner QF2' }),
    bg('g6', 'SF2', 't2', 't6', null, null, { h: 'Winner QF3', a: 'Winner QF4' }),
    bg('g7', 'FIN', 't1', null, null, null, { h: 'Winner SF1', a: 'Winner SF2' }),
  ];
  doc({
    id: 'tournament-bracket',
    label: 'Playoff bracket',
    // A single sheet somebody holds — it carries a footer but numbers no pages.
    pageTotals: 'none',
    entry: 'downloadBracketPDF',
    screens: ['app/[orgSlug]/admin/tournaments/schedule/page.tsx'],
    render: (name, settings) => downloadBracketPDF(
      name, 'U13 — Playoff Bracket', TOURNAMENT, BRACKET, bracketTeams,
      { ...settings, orientation: 'landscape' }, false,
    ),
    edgeCases: [
      // A division with no playoff games at all — the path that crashed in §106.
      ['no-games', (name, settings) => downloadBracketPDF(
        name, 'U9 — Playoff Bracket', TOURNAMENT, [], bracketTeams,
        { ...settings, orientation: 'landscape' }, false)],
      // Nothing played yet: every slot a placeholder.
      ['nothing-played', (name, settings) => downloadBracketPDF(
        name, 'U13 — Playoff Bracket', TOURNAMENT,
        BRACKET.map((x) => ({
          ...x, status: 'scheduled', homeScore: null, awayScore: null,
          homeTeamId: /^QF/.test(x.bracketCode) ? x.homeTeamId : null,
          awayTeamId: /^QF/.test(x.bracketCode) ? x.awayTeamId : null,
        })),
        bracketTeams, { ...settings, orientation: 'landscape' }, false)],
    ],
  });
  doc({
    id: 'tournament-bracket-blank',
    label: 'Playoff bracket — blank fill-in sheet',
    // A single sheet somebody holds — it carries a footer but numbers no pages.
    pageTotals: 'none',
    entry: 'downloadBracketPDF',
    screens: ['app/[orgSlug]/admin/tournaments/schedule/page.tsx'],
    render: (name, settings) => downloadBracketPDF(
      name, 'U13 — Playoff Bracket (Blank)', TOURNAMENT, BRACKET, bracketTeams,
      { ...settings, orientation: 'landscape' }, true,
    ),
  });

  /* ══ The paper-settings preview ═════════════════════════════════════════════════════ */

  doc({
    id: 'org-paper-preview',
    label: 'Paper settings preview',
    screens: [
      'app/[orgSlug]/admin/org/settings/pdf/page.tsx',
      'app/[orgSlug]/admin/tournaments/settings/pdf/page.tsx',
    ],
    render: (name, settings) => downloadPDF(
      name, 'Sample report', SEASON,
      ['Team', 'Division', 'Contact', 'Status'],
      Array.from({ length: 8 }, (_, i) => [
        TEAMS[i % TEAMS.length], ['U11 A', 'U13 AA'][i % 2], full(i), 'Confirmed',
      ]),
      settings, { identity: ORG },
    ),
  });

  /* ══ House league & rep admin ═══════════════════════════════════════════════════════ */

  const HL_HEADERS = ['Player', 'Date of Birth', 'Division', 'Guardian', 'Email', 'Phone', 'Status'];
  doc({
    id: 'house-league-registrations',
    label: 'House league season registrations',
    screens: ['app/[orgSlug]/admin/house-league/seasons/[seasonId]/registrations/page.tsx'],
    headings: HL_HEADERS,
    render: (name, settings) => downloadPDF(
      name, 'Season Registrations', `Fall House League ${SEASON}`, HL_HEADERS,
      Array.from({ length: 40 }, (_, i) => [
        full(i), '2013-05-14', ['U9', 'U11', 'U13'][i % 3],
        `Pat ${KIDS[i % KIDS.length][1]}`,
        `${KIDS[i % KIDS.length][1].toLowerCase()}.family@example.ca`,
        '(555) 014-3392', ['Registered', 'Awaiting payment'][i % 2],
      ]),
      settings, { identity: ORG, shape: { orientation: 'landscape' } },
    ),
  });

  const REP_ROSTER_HEADERS = ['#', 'Player', 'Primary', 'Secondary'];
  const repRow = (i) => [String(i + 2), full(i), POS[i % 9], POS[(i + 4) % 9]];
  doc({
    id: 'rep-program-year-roster',
    label: 'Rep program-year roster',
    screens: ['app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/page.tsx'],
    headings: REP_ROSTER_HEADERS,
    render: (name, settings) => downloadPDF(
      name, 'Program Year Roster', `${TEAM} — ${SEASON}`, REP_ROSTER_HEADERS, [], settings,
      {
        identity: ORG, shape: { orientation: 'portrait' },
        groups: [
          { label: 'Active · 11', rows: Array.from({ length: 11 }, (_, i) => repRow(i)) },
          { label: 'Inactive · 2', rows: Array.from({ length: 2 }, (_, i) => repRow(i + 11)) },
          { label: 'Released · 1', rows: [repRow(13)] },
        ],
      },
    ),
    edgeCases: [
      // The common case: everybody active, so ONE group carries the whole grid.
      ['all-active', (name, settings) => downloadPDF(
        name, 'Program Year Roster', `${TEAM} — ${SEASON}`, REP_ROSTER_HEADERS, [], settings,
        {
          identity: ORG, shape: { orientation: 'portrait' },
          groups: [{ label: 'Active · 14', rows: Array.from({ length: 14 }, (_, i) => repRow(i)) }],
        })],
    ],
  });

  const APPLICANT_HEADERS = ['Bib', 'Player', 'Date of Birth', 'Guardian', 'Email', 'Phone', 'Decision'];
  doc({
    id: 'rep-tryout-applicants',
    label: 'Rep tryout applicants',
    screens: ['app/[orgSlug]/admin/rep-teams/teams/[teamId]/program-years/[yearId]/tryouts/page.tsx'],
    headings: APPLICANT_HEADERS,
    render: (name, settings) => downloadPDF(
      name, 'Tryout Applicants', `${TEAM} — ${SEASON}`, APPLICANT_HEADERS,
      Array.from({ length: 32 }, (_, i) => [
        String(101 + i), full(i), '2013-05-14', `Pat ${KIDS[i % KIDS.length][1]}`,
        `${KIDS[i % KIDS.length][1].toLowerCase()}.family@example.ca`, '(555) 014-3392',
        ['Offered', 'Not offered', 'Undecided'][i % 3],
      ]),
      settings, { identity: ORG, shape: { orientation: 'landscape' } },
    ),
  });

  /* ══ Tryout day ═════════════════════════════════════════════════════════════════════ */

  const checkinDoc = (blind) => (name, settings) => downloadPDF(
    name, 'Tryout check-in',
    ['Session 2 — Skills · Sat, Sep 12, 9:00 a.m. · Riverdale Park, Diamond 3',
      blind ? 'Blind evaluation — names hidden on purpose' : ''].filter(Boolean).join('  ·  '),
    checkinSheetHeadings(blind),
    Array.from({ length: 28 }, (_, i) => (blind
      ? [String(i + 1), String(12 + (i % 2)), '', '']
      : [String(i + 1), full(i), String(12 + (i % 2)), '', ''])),
    settings,
    { identity: TEAM, shape: { orientation: 'portrait' }, penColumns: [checkinTickColumn(blind)] },
  );
  doc({
    id: 'tryout-check-in',
    label: 'Tryout check-in sheet',
    screens: ['components/rep-teams/TryoutCheckIn.tsx', 'app/[orgSlug]/coaches/teams/[teamId]/tryouts/page.tsx'],
    render: checkinDoc(false),
    // A blind tryout is the same sheet with the names withheld — one column narrower, and the
    // pen box has to move with it.
    edgeCases: [['blind', checkinDoc(true)]],
  });

  const RUBRIC = ['Hitting', 'Fielding', 'Throwing', 'Running', 'Pitching', 'Attitude'];
  doc({
    id: 'tryout-report-full-detail',
    label: 'Tryout report — full detail',
    screens: ['components/rep-teams/TryoutReportCard.tsx'],
    // The rubric categories are the CLUB's own words and there can be a dozen of them, so
    // dropping a column and saying so is this document's contract working.
    columns: 'customer',
    render: (name, settings) => downloadPDF(
      name, 'Tryout report — full detail',
      `${SEASON}  ·  Coaching staff only`,
      ['Bib', 'Player', ...RUBRIC, 'Overall', 'Rank', 'Decision'],
      Array.from({ length: 30 }, (_, i) => [
        String(101 + i), full(i), ...RUBRIC.map((_, r) => (3 + ((i + r) % 3)).toFixed(1)),
        (3.4 + (i % 4) / 10).toFixed(2), String(i + 1), ['Offered', 'Not offered'][i % 2],
      ]),
      settings, { identity: TEAM, shape: { orientation: 'landscape', density: 'compact' } },
    ),
  });

  doc({
    id: 'tryout-board-summary',
    label: 'Tryout board summary',
    entry: 'downloadTryoutBoardSummary',
    screens: ['components/rep-teams/TryoutReportCard.tsx'],
    render: (name, settings) => downloadTryoutBoardSummary(name, {
      identity: TEAM, seasonName: SEASON, finalized: true,
      stats: { candidates: 32, prior: 27, priorSeasonName: '2025 Season', offers: 15, accepted: 13, rosterTotal: 13, returning: 8, newcomers: 5 },
      processLines: [
        'Every candidate was scored by 3 evaluators.',
        'Scores were entered blind — evaluators saw bib numbers, not names.',
        'The rubric weighed 6 categories; weights were set before the first session.',
        '2 sessions were held; 30 of 32 candidates attended both.',
        'Every candidate has a recorded decision.',
      ],
      profile: RUBRIC.map((label, i) => ({ label, avg: 2.8 + (i % 4) * 0.3 })),
      scaleMax: 5,
      rosterNames: Array.from({ length: 13 }, (_, i) => full(i)),
      settings,
    }),
  });

  /* ══ Coach roster ═══════════════════════════════════════════════════════════════════ */

  const rosterPeople = Array.from({ length: 16 }, (_, i) => ({
    number: String(i + 2), name: full(i), primary: POS[i % 9], secondary: POS[(i + 4) % 9],
    dob: '2013-05-14', guardian: `Pat ${KIDS[i % KIDS.length][1]}`,
    email: `${KIDS[i % KIDS.length][1].toLowerCase()}.family@example.ca`,
    phone: '(555) 014-3392', status: i === 15 ? 'Inactive' : 'Active',
  }));
  const WALL_HEADERS = ['#', 'Player', 'Primary', 'Secondary', 'Status'];
  doc({
    id: 'coach-roster-wall',
    label: 'Team roster — wall copy',
    screens: ['app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx'],
    headings: WALL_HEADERS,
    render: (name, settings) => downloadPDF(
      name, 'Team Roster', SEASON, WALL_HEADERS,
      rosterPeople.map((p) => [p.number, p.name, p.primary, p.secondary, p.status]),
      settings, { identity: TEAM, shape: { orientation: 'portrait' } },
    ),
    edgeCases: [
      // A big squad — the wall copy still has to hold its columns.
      ['24-players', (name, settings) => downloadPDF(
        name, 'Team Roster', SEASON, WALL_HEADERS,
        Array.from({ length: 24 }, (_, i) => [String(i + 2), full(i), POS[i % 9], POS[(i + 4) % 9], 'Active']),
        settings, { identity: TEAM, shape: { orientation: 'portrait' } })],
    ],
  });

  const contactsHeaders = (guardians) => ['#', 'Player', 'Date of Birth', 'Primary',
    ...(guardians ? ['Guardian', 'Email', 'Phone'] : []), 'Status'];
  const contactsDoc = (guardians) => (name, settings) => downloadPDF(
    name, 'Team Roster — with contacts', SEASON, contactsHeaders(guardians),
    rosterPeople.map((p) => [p.number, p.name, p.dob, p.primary,
      ...(guardians ? [p.guardian, p.email, p.phone] : []), p.status]),
    settings, { identity: TEAM, shape: { orientation: 'landscape' } },
  );
  doc({
    id: 'coach-roster-contacts',
    label: 'Team roster — contacts sheet',
    screens: ['app/[orgSlug]/coaches/teams/[teamId]/roster/page.tsx'],
    headings: contactsHeaders(true),
    render: contactsDoc(true),
    // The club's guardian-contacts switch turned OFF: three columns go, the birth date stays.
    // It is a genuinely narrower document, so it carries its own heading list.
    edgeCases: [['guardians-off', contactsDoc(false), { headings: contactsHeaders(false) }]],
  });

  /* ══ Coach money — every one of these takes its COLUMNS FROM THE PRODUCT ════════════ */

  /**
   * ⚠⚠ ONLY TWO COACH MONEY SCREENS OFFER A PDF AT ALL, AND GETTING THIS WRONG COST THIS
   * SESSION A FALSE FINDING THAT REACHED THE OWNER.
   *
   * The first version of this file fixtured SIX money documents, because the shared
   * `downloadMoneyExport()` accepts `'pdf'` and every panel calls it. It does — but the panels
   * decide which formats they OFFER, and Budget lines, Payables, Transactions and Fundraisers
   * pass `formats={['xlsx', 'csv']}`. There is no PDF row in their file-type dialog. Their
   * columns are built for a spreadsheet and are never printed.
   *
   * So the gate duly reported that three of them "lose columns on paper" — a defect in
   * documents that do not exist. This is the fixture-artifact trap the plan warns about,
   * arrived at from the opposite direction: not a fixture too NARROW to show a real defect, but
   * a fixture that INVENTED a document and then found a defect in it.
   *
   * The declaration below is what stops it happening again, and it is CHECKED, not trusted:
   * `check-pdf-documents.mjs` reads each screen's own `formats={[...]}` and fails if one of
   * these ever gains a PDF row without a fixture.
   */
  const moneyDoc = (id, label, title, columns, screens, rows) => doc({
    id, label, screens,
    headings: columns.map((c) => c.label),
    render: (name, settings) => money$.downloadMoneyExport('pdf', {
      dataset: id, title, columns, rows: rowsFor(columns, rows),
      orgLabel: 'riverdale-ridge', scopeLabel: SEASON, teamName: TEAM,
      pdfSettings: settings, emptyMessage: `Nothing to export on ${label}.`,
    }),
  });

  moneyDoc('coach-player-dues', 'Player dues team sheet', 'Player Dues',
    money$.DUES_EXPORT_COLUMNS,
    ['app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/accounting/page.tsx'], 16);

  /* ⚠ The PDF is NEVER the month grid. The Months view exports a column per month, which is a
   * spreadsheet shape; for `format === 'pdf'` the panel deliberately swaps in the four-column
   * whole-season statement instead, and announces the swap in the file-type dialog (owner
   * ruling 2026-08-21). Fixturing the month grid here would render a document nobody can get. */
  moneyDoc('coach-budget-vs-actual', 'Budget vs. Actual', 'Budget vs. Actual',
    money$.BVA_EXPORT_COLUMNS,
    ['app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx'], 24);

  const ADMIN_BVA_HEADERS = ['Description', 'Estimated', 'Allocated', 'Collected', 'Unallocated', 'Status'];
  doc({
    id: 'admin-budget-vs-actual',
    label: 'Club Budget vs. Actual',
    screens: ['app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx'],
    headings: ADMIN_BVA_HEADERS,
    render: (name, settings) => downloadPDF(
      name, 'Budget vs. Actual', SEASON, ADMIN_BVA_HEADERS, [], settings,
      {
        identity: ORG, shape: { orientation: 'landscape' },
        groups: ['Money in', 'Money out'].map((label) => ({
          label,
          rows: Array.from({ length: 9 }, (_, i) => [
            ['Tournament entry fees', 'Equipment & uniforms', 'Field rental'][i % 3],
            money(3200), money(2750), money(2400), money(350),
            ['On plan', 'Over', 'Under'][i % 3],
          ]),
        })),
      },
    ),
  });

  doc({
    id: 'coach-family-statements',
    label: 'Family dues statements',
    entry: 'downloadFamilyDuesStatements',
    screens: ['app/[orgSlug]/coaches/teams/[teamId]/accounting/dues/panel.tsx'],
    // ⚠ THIS DOCUMENT NUMBERS ITS PAGES PER FAMILY, BY DESIGN — a household gets "Page 1 of 1"
    // even in a print run of twelve. It is the one document whose footer must NOT name the
    // file's page count, and saying so here is what stops the gate from either crying wolf
    // every run or, worse, being taught to ignore a footer failure it should catch.
    pageTotals: 'section',
    render: (name, settings) => downloadFamilyDuesStatements(name, {
      families: statementFamilies(), teamName: TEAM, seasonLabel: SEASON,
      preparedLabel: 'Aug 23, 2026', settings,
    }),
    edgeCases: [
      // A family that owes nothing — the "nothing here yet" shape of a statement.
      ['paid-up', (name, settings) => downloadFamilyDuesStatements(name, {
        families: statementFamilies().filter((f) => f.paidUp).slice(0, 1),
        teamName: TEAM, seasonLabel: SEASON, preparedLabel: 'Aug 23, 2026', settings,
      })],
    ],
  });

  /** Households, built by the PRODUCT's own assembler from player-shaped rows. */
  function statementFamilies() {
    const player = (over) => ({
      playerLastName: null, familyKey: null, guardianLastName: null,
      schedule: { totalAmount: 1450 }, installments: [], coverage: [],
      payments: [], credits: [], payouts: [],
      paidAmount: 0, outstanding: 0, totalCredits: 0, leftToSend: 0, creditApplied: 0, owedBack: 0,
      ...over,
    });
    return buildFamilyDuesStatements({
      todayISO: '2026-08-23',
      players: [
        player({
          playerId: 'isla', playerFirstName: 'Isla', playerLastName: 'Marchand',
          familyKey: 'fam-marchand', guardianLastName: 'Marchand',
          installments: [
            { id: 'i1', dueDate: '2026-06-01', amount: 500, paidAt: '2026-05-28T12:00:00Z', remainingAmount: 0 },
            { id: 'i2', dueDate: '2026-08-01', amount: 500, paidAt: null, remainingAmount: 300 },
            { id: 'i3', dueDate: '2026-10-01', amount: 450, paidAt: null, remainingAmount: 325, creditApplied: 125 },
          ],
          coverage: [
            { installmentId: 'i1', allocated: 500 },
            { installmentId: 'i2', allocated: 200 },
            { installmentId: 'i3', allocated: 0 },
          ],
          payments: [
            { amount: 500, receivedDate: '2026-05-28', method: 'etransfer', note: null },
            { amount: 200, receivedDate: '2026-08-10', method: 'cash', note: 'At practice' },
          ],
          credits: [{ amount: 125, creditDate: '2026-07-12', description: 'Bottle drive rebate' }],
          paidAmount: 700, outstanding: 750, totalCredits: 125, leftToSend: 625, creditApplied: 125,
        }),
        player({
          playerId: 'emmett', playerFirstName: 'Emmett', playerLastName: 'Marchand',
          familyKey: 'fam-marchand', guardianLastName: 'Marchand',
          installments: [
            { id: 'e1', dueDate: '2026-06-01', amount: 500, paidAt: '2026-05-28T12:00:00Z', remainingAmount: 0 },
            { id: 'e2', dueDate: '2026-08-01', amount: 500, paidAt: '2026-07-30T12:00:00Z', remainingAmount: 0 },
            { id: 'e3', dueDate: '2026-10-01', amount: 450, paidAt: null, remainingAmount: 450 },
          ],
          coverage: [
            { installmentId: 'e1', allocated: 500 },
            { installmentId: 'e2', allocated: 500 },
            { installmentId: 'e3', allocated: 0 },
          ],
          payments: [
            { amount: 500, receivedDate: '2026-05-28', method: 'etransfer', note: null },
            { amount: 500, receivedDate: '2026-07-30', method: 'etransfer', note: null },
          ],
          paidAmount: 1000, outstanding: 450, leftToSend: 450,
        }),
        player({
          playerId: 'maya', playerFirstName: 'Maya', playerLastName: 'Chen',
          familyKey: 'fam-chen', guardianLastName: 'Chen',
          installments: [
            { id: 'm1', dueDate: '2026-06-01', amount: 500, paidAt: '2026-05-28T12:00:00Z', remainingAmount: 0 },
            { id: 'm2', dueDate: '2026-08-01', amount: 500, paidAt: '2026-07-26T12:00:00Z', remainingAmount: 0 },
            { id: 'm3', dueDate: '2026-10-01', amount: 450, paidAt: '2026-08-15T12:00:00Z', remainingAmount: 0 },
          ],
          coverage: [
            { installmentId: 'm1', allocated: 500 },
            { installmentId: 'm2', allocated: 500 },
            { installmentId: 'm3', allocated: 450 },
          ],
          payments: [
            { amount: 500, receivedDate: '2026-05-28', method: 'etransfer', note: null },
            { amount: 500, receivedDate: '2026-07-26', method: 'etransfer', note: null },
            { amount: 450, receivedDate: '2026-08-15', method: 'etransfer', note: 'Paid ahead — thank you' },
          ],
          paidAmount: 1450, outstanding: 0, leftToSend: 0,
        }),
        player({
          playerId: 'olivia', playerFirstName: 'Olivia', playerLastName: 'Brière',
          familyKey: 'fam-briere', guardianLastName: 'Brière',
          installments: [
            { id: 'o1', dueDate: '2026-06-01', amount: 500, paidAt: '2026-05-30T12:00:00Z', remainingAmount: 0 },
            { id: 'o2', dueDate: '2026-08-01', amount: 500, paidAt: null, remainingAmount: 500 },
            { id: 'o3', dueDate: '2026-10-01', amount: 450, paidAt: null, remainingAmount: 450 },
          ],
          coverage: [
            { installmentId: 'o1', allocated: 500 },
            { installmentId: 'o2', allocated: 0 },
            { installmentId: 'o3', allocated: 0 },
          ],
          payments: [{ amount: 500, receivedDate: '2026-05-30', method: 'cheque', note: null }],
          paidAmount: 500, outstanding: 950, leftToSend: 950,
        }),
      ],
    });
  }

  /* ══ Working sheets and handouts ════════════════════════════════════════════════════ */

  const ROTATION = {
    groupNames: ['Group A', 'Group B', 'Group C'],
    rounds: [
      { round: '1 (6:20 p.m.)', stations: ['Tee work', 'Front toss', 'Live BP'] },
      { round: '2 (6:30 p.m.)', stations: ['Live BP', 'Tee work', 'Front toss'] },
      { round: '3 (6:40 p.m.)', stations: ['Front toss', 'Live BP', 'Tee work'] },
    ],
    notes: ['3 rounds of 10 min.',
      'Group C sees Live BP in round 2 while fresh — Chloe and Owen are working steal jumps against a live catcher.'],
    groups: [
      { name: 'Group A', players: 'Maya Chen, Liam Tremblay, Ava Okafor, Noah Nguyen, Emma MacLeod' },
      { name: 'Group B', players: 'Jack Sandhu, Olivia Brière, Ethan Kowalski, Sophie Lam, Lucas Fontaine' },
      { name: 'Group C', players: 'Chloe Desjardins, Owen Whitfield, Isla Marchand, Nathan Oyelaran' },
    ],
  };
  const SQUAD = KIDS.slice(0, 12).map((k) => `${k[0]} ${k[1]}`).join(', ');
  const RUN_SHEET = {
    teamName: TEAM, dateLabel: 'Tue, Aug 25, 2026',
    whereLabel: '6:00 p.m. · Arrive 5:45 p.m. · Riverdale Park, Diamond 2',
    goal: 'Sharper two-strike at-bats; defensive communication loud enough to hear from the fence.',
    practiceTypes: ['Hitting', 'Baserunning'],
    equipment: ['Tees (4)', 'Bucket of game balls', 'Cones', 'Stopwatch'],
    blocks: [
      { time: '6:00 p.m.–6:10 p.m.', title: 'Dynamic warm-up & arm care', duration: '10 min', staff: 'Coach Dana', players: SQUAD,
        notes: 'Bands before anyone touches a ball. Throwing starts at 30 ft — anyone who pitched Sunday caps at 60 ft, no long toss.' },
      { time: '6:10 p.m.–6:20 p.m.', title: 'Throwing progression', duration: '10 min', staff: 'Coach Dana', players: SQUAD, notes: '' },
      { time: '6:20 p.m.–6:50 p.m.', title: 'Hitting circuit — 3 stations', duration: '30 min', staff: 'All staff', players: 'Groups A/B/C',
        notes: 'Rotate on the whistle, ten minutes a station. Tee: inside pitch only, contact point out front. Front toss: two-strike approach.',
        rotation: ROTATION },
      { time: '6:50 p.m.–7:10 p.m.', title: 'First-to-third reads', duration: '20 min', staff: 'Coach Priya', players: SQUAD,
        notes: 'Live reads off front toss. Freeze on a line drive; on a ground ball read the outfielder’s angle, not the coach.' },
      { time: '7:10 p.m.–7:30 p.m.', title: 'Scrimmage innings', duration: '20 min', staff: 'All staff', players: SQUAD,
        notes: 'Situations: runner on 2nd, 1 out.' },
    ],
    focus: [
      { player: 'Maya Chen', focusAreas: 'Backhand pickups — glove out front, work through the ball; two-strike approach at the plate' },
      { player: 'Liam Tremblay', focusAreas: 'First-step quickness on steals; reading the pitcher’s front heel' },
      { player: 'Ava Okafor', focusAreas: 'Changeup command — same arm speed, don’t baby it' },
    ],
  };
  doc({
    id: 'coach-practice-run-sheet',
    label: 'Practice run sheet',
    entry: 'downloadPracticeSheet',
    screens: ['app/[orgSlug]/coaches/teams/[teamId]/practice/[eventId]/page.tsx'],
    render: (name, settings) => downloadPracticeSheet(name, { ...RUN_SHEET, settings }),
    edgeCases: [
      // A block taller than a page. This is the shape that printed ACROSS the footer (§99).
      ['oversize-block', (name, settings) => downloadPracticeSheet(name, {
        ...RUN_SHEET, settings,
        blocks: [
          RUN_SHEET.blocks[0],
          { time: '6:10 p.m.–7:40 p.m.', title: 'Everything block', duration: '90 min', staff: 'All staff', players: SQUAD,
            notes: 'Station coaches stay put and the groups move on the whistle; call the play out loud before every rep so the whole field hears it. '.repeat(26),
            rotation: ROTATION },
          { time: '7:40 p.m.–7:45 p.m.', title: 'Huddle', duration: '5 min', staff: 'Coach Dana', players: SQUAD, notes: 'Two sentences per coach, max.' },
        ],
      })],
      // A rotation the coach started and has not finished — statements, not a grid.
      ['unfinished-rotation', (name, settings) => downloadPracticeSheet(name, {
        ...RUN_SHEET, settings,
        blocks: RUN_SHEET.blocks.map((b) => (b.rotation
          ? { ...b, rotation: { groupNames: [], rounds: [], notes: ['Add how often groups move to see the rotation.'], groups: ROTATION.groups } }
          : b)),
      })],
      // An assistant without the development grant: the focus section is ABSENT, not redacted.
      ['no-focus-grant', (name, settings) => downloadPracticeSheet(name, { ...RUN_SHEET, focus: [], settings })],
    ],
  });

  doc({
    id: 'coach-development-summary',
    label: 'Player development summary',
    entry: 'downloadDevelopmentSummary',
    screens: [
      'components/coaches/PlayerDevelopmentSection.tsx',
      'app/[orgSlug]/coaches/teams/[teamId]/roster/[playerId]/page.tsx',
    ],
    render: (name, settings) => downloadDevelopmentSummary(name, {
      playerName: 'Maya Chen', playerNumber: '#7', teamName: TEAM, seasonLabel: SEASON,
      goals: [
        { focusArea: 'Backhand pickups', status: 'Working on it', note: 'Big improvement since July' },
        { focusArea: 'First-pitch strikes (pitching)', status: 'Achieved', note: '68% over the last four outings' },
      ],
      measurables: [
        { test: 'Home-to-first sprint', reading: '4.74 s', date: 'Aug 13, 2026', note: 'Best of the season' },
        { test: 'Throwing velocity', reading: '55 mph', date: 'Aug 13, 2026', note: null },
      ],
      settings,
    }),
    edgeCases: [
      // A player with nothing recorded yet — the shape a brand-new roster prints.
      ['nothing-recorded', (name, settings) => downloadDevelopmentSummary(name, {
        playerName: 'Declan O’Shaughnessy', playerNumber: '#22', teamName: TEAM, seasonLabel: SEASON,
        goals: [], measurables: [], settings,
      })],
    ],
  });

  const LINEUP_POS = [
    ['P', 'P', 'C', '', 'RF', 'RF', 'Bench'], ['C', 'C', 'P', 'P', '', 'Bench', 'RF'],
    ['SS', 'SS', 'SS', '2B', '2B', '', 'SS'], ['1B', '1B', '', '1B', 'Bench', 'C', 'C'],
    ['2B', '2B', 'LF', 'SS', 'SS', '2B', ''], ['3B', '', '3B', '3B', 'C', 'P', 'P'],
    ['LF', 'LF', 'Bench', 'CF', 'CF', 'LF', 'LF'], ['CF', 'CF', 'CF', 'Bench', 'LF', 'CF', 'CF'],
    ['RF', 'Bench', 'RF', 'RF', '3B', '3B', '3B'], ['Bench', 'RF', '2B', 'LF', '1B', '1B', ''],
    ['', '3B', '1B', 'C', 'P', 'SS', '2B'], ['Bench', 'Bench', 'Bench', 'Bench', '', '', '1B'],
  ];
  const batter = (i, innings) => ({
    battingOrder: String(i + 1), name: `#${i + 2} ${full(i)}`, isSub: false,
    inningPositions: Object.fromEntries(LINEUP_POS[i].slice(0, innings).map((p, n) => [String(n + 1), p])),
  });
  const lineupBase = () => ({
    teamName: TEAM, homeAway: 'home', dateLabel: 'Sat, Aug 29, 2026 · 10:00 a.m.',
    eventName: 'Riverdale Summer Classic', opponent: 'Harborview Herons',
    inningCount: 7, legend: buildPositionLegend(POS),
  });
  doc({
    id: 'coach-lineup-poster',
    label: 'Lineup poster',
    // A single sheet somebody holds — it carries a footer but numbers no pages.
    pageTotals: 'none',
    entry: 'downloadLineupPoster',
    screens: ['app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx'],
    render: (name, settings) => downloadLineupPoster(name, {
      ...lineupBase(), settings, includeNotes: true,
      players: LINEUP_POS.map((_, i) => batter(i, 7)),
      notes: 'Herons bunt early with runners on. Their #4 pulls everything — shade the left side.',
    }),
    edgeCases: [
      // The case that failed worst: nine players, twelve innings, and club names long enough
      // that the headline has to shrink rather than be cut.
      ['nine-long-names', (name, settings) => downloadLineupPoster(name, {
        ...lineupBase(), settings, includeNotes: false, inningCount: 12,
        teamName: 'Riverdale Ridge Thunderbirds U13 AA Select',
        opponent: 'Harborview Herons Athletic Association',
        players: LINEUP_POS.slice(0, 9).map((_, i) => batter(i, 12)),
      })],
      // No opponent at all — an unscheduled game or a practice.
      ['no-opponent', (name, settings) => downloadLineupPoster(name, {
        ...lineupBase(), settings, includeNotes: false, opponent: null,
        players: LINEUP_POS.slice(0, 9).map((_, i) => batter(i, 7)),
      })],
    ],
  });

  doc({
    id: 'coach-batting-card',
    label: 'Batting order card',
    // A single sheet somebody holds — it carries a footer but numbers no pages.
    pageTotals: 'none',
    entry: 'downloadBattingOrderCard',
    screens: ['app/[orgSlug]/coaches/teams/[teamId]/lineups/[eventId]/page.tsx'],
    render: (name, settings) => downloadBattingOrderCard(name, {
      ...lineupBase(), settings,
      players: [
        ...LINEUP_POS.map((_, i) => batter(i, 7)),
        { battingOrder: '', name: '#14 Ruby Ferreira', isSub: true, inningPositions: {} },
        { battingOrder: '', name: '#15 Marcus Ng', isSub: true, inningPositions: {} },
      ],
    }),
    edgeCases: [
      ['nine-long-names', (name, settings) => downloadBattingOrderCard(name, {
        ...lineupBase(), settings,
        teamName: 'Riverdale Ridge Thunderbirds U13 AA Select',
        opponent: 'Harborview Herons Athletic Association',
        players: LINEUP_POS.slice(0, 9).map((_, i) => batter(i, 7)),
      })],
    ],
  });

  return {
    documents: docs,
    /**
     * The identity states each document is rendered in. Not decoration: the header lays text
     * out AROUND the crest, so a branded document has a different geometry from a plain one,
     * and half this product's paper is printed by a club that uploaded a logo.
     */
    looks: {
      admin: [['plain', ADMIN_PLAIN], ['branded', ADMIN_BRANDED], ['wide-crest', ADMIN_WIDE_CREST]],
      coach: [['plain', COACH_PLAIN], ['branded', COACH_BRANDED]],
    },
  };
}

/**
 * Screens that CAN reach a renderer but deliberately produce no PDF — so the import-graph
 * discovery finds them and would otherwise demand a fixture for a document that does not exist.
 *
 * ⚠ EVERY ENTRY IS VERIFIED, NOT TRUSTED. The checker reads each file's own `formats={[...]}`
 * and fails if one gains a `'pdf'` row. That is what makes this a declaration rather than a
 * place to hide a document — a screen that starts printing has to be fixtured before it ships.
 */
export const NO_PDF_SCREENS = [
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx',
    reason: 'Budget lines export as xlsx/csv only — six columns built for a spreadsheet, never printed.',
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx',
    reason: 'Payables (and its Transactions + Scheduled datasets) export as xlsx/csv only.',
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx',
    reason: 'The club allocations and payment-request datasets export as xlsx/csv only.',
  },
  {
    file: 'app/[orgSlug]/coaches/teams/[teamId]/accounting/fundraisers/panel.tsx',
    reason: 'Fundraisers and sponsorships export as xlsx/csv only — eleven columns for a pivot table.',
  },
];

/**
 * Shared plumbing the discovery legitimately reaches, which is not a screen and prints nothing
 * on its own. Safe to declare without verification: any SCREEN that uses one of these is
 * discovered separately and must still be claimed.
 */
export const PLUMBING_SCREENS = [
  {
    file: 'components/coaches/MoneyExportButton.tsx',
    reason: 'The shared coach money export dialog. It dispatches whatever formats its CALLER offers; it owns no document of its own.',
  },
];

/** Documents printed on team paper — everything a coach hands out. The rest is admin paper. */
export const COACH_DOCUMENTS = new Set([
  'coach-player-dues', 'coach-budget-vs-actual', 'coach-family-statements',
  'coach-roster-wall', 'coach-roster-contacts', 'coach-practice-run-sheet',
  'coach-development-summary', 'coach-lineup-poster', 'coach-batting-card',
  'tryout-check-in', 'tryout-report-full-detail', 'tryout-board-summary',
]);
