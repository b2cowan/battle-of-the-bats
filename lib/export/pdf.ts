import { tournamentToday } from '../timezone';
/**
 * lib/export/pdf.ts
 * PDF report builder — jsPDF + jspdf-autotable, lazy-loaded client-side.
 *
 * Interfaces and DEFAULT_PDF_SETTINGS are stable; pages import these directly.
 * Full implementation added in Phase F2.
 *
 * Design decisions: MERGED_EXPORTS_IMPLEMENTATION_PLAN.md Phase E2 / F2
 * - Library: jsPDF + jspdf-autotable (client-side lazy-loaded, ~250KB)
 * - Settings stored as JSONB in organizations.pdf_settings
 * - Free Tournament plan: showBranding is always forced true server-side
 * - Grouping: pass `groups` for per-division page breaks
 */

/**
 * Org-level PDF template settings — persisted in organizations.pdf_settings JSONB.
 * Loaded at export time; falls back to DEFAULT_PDF_SETTINGS if not configured.
 */
export interface OrgPdfSettings {
  /** Organization name as it appears in the report header */
  headerLine1: string;
  /** Optional subtitle line (e.g. "2026 Tournament Season") */
  headerLine2?: string;
  /** Custom footer text (contact email, website, legal note) */
  footerText?: string;
  /** Include "Exported: {date}" stamp in footer. Default: true */
  showDateStamp: boolean;
  /** Include "Page X of Y" in footer. Default: true */
  showPageNumbers: boolean;
  /** Show FieldLogicHQ branding. Force-on for free Tournament plan. Default: true */
  showBranding: boolean;
  /** Page orientation. Default: 'portrait' */
  orientation: 'portrait' | 'landscape';
  /** Header row background colour as hex (#rrggbb). Default: '#1e293b' */
  accentColor: string;
  /** Base64-encoded org logo for PDF header (data URL) */
  logoDataUrl?: string;
  /** Row density. Default: 'readable' */
  reportDensity: 'compact' | 'readable';
  /** Include guardian email/phone columns. Default: true */
  includeGuardianContacts: boolean;
  /** Include player-level notes columns. Default: true */
  includePlayerNotes: boolean;
  /** Include internal admin notes. Default: false — never shown to families */
  includeInternalNotes: boolean;
}

export const DEFAULT_PDF_SETTINGS: OrgPdfSettings = {
  headerLine1:            '',
  headerLine2:            undefined,
  footerText:             undefined,
  showDateStamp:          true,
  showPageNumbers:        true,
  showBranding:           true,
  orientation:            'portrait',
  accentColor:            '#1e293b',
  logoDataUrl:            undefined,
  reportDensity:          'readable',
  includeGuardianContacts: true,
  includePlayerNotes:     true,
  includeInternalNotes:   false,
};

/**
 * D2 (owner ruling 2026-08-21): shape is a property of the REPORT, declared at the call
 * site. A declared field wins over the org-wide preference; an undeclared field means the
 * report honestly fits either way, and the org preference applies. Never mutate a
 * settings object to force a shape — declare it here instead.
 */
export interface ReportShape {
  orientation?: 'portrait' | 'landscape';
  density?: 'compact' | 'readable';
}

/**
 * Fit contract (D2): per-report column priorities. `dropOrder` lists column indices in
 * the order they should be given up first when the page cannot hold every column at the
 * legible floor. Reports with fixed column sets should never trigger this — it exists for
 * customer-shaped tables (rubric categories, settings-driven columns) where the customer,
 * not the code, decides the width.
 */
export interface ReportFit {
  dropOrder?: number[];
}

/**
 * Shorten customer-named column headings to codes, and say what they mean.
 *
 * The fit contract's last resort is dropping a whole column and admitting it. For a table
 * whose columns are the CUSTOMER'S words — a tryout rubric, where the club decides both how
 * many categories there are and how long each name is — there is a better move first: print
 * a code and explain it under the title. A club running ten categories then keeps all ten
 * (owner ruling, Phase 2 Registers pass, chosen from rendered options).
 *
 * The rule has to be predictable, because a coach reads the same club's report every year:
 * a multi-word name becomes its initials ("Game Sense" → GS, "Base Running IQ" → BRI), a
 * single word its first four letters ("Coachability" → Coac), and anything already short
 * enough is left alone — and left out of the legend, because "Bib = Bib" is noise. Two
 * categories that shorten to the same thing get a number, so no two columns share a heading.
 *
 * Returns the codes in the order given, plus the legend line (empty when nothing shortened).
 */
export function abbreviateHeadings(labels: string[]): { codes: string[]; legend: string } {
  const KEEP_AS_IS = 4;
  const used = new Set<string>();
  const explained: string[] = [];

  const codes = labels.map(label => {
    const name = label.trim();
    // A blank heading stays blank and claims nothing: numbering it would print a bare "2" that
    // reads as data, and it would earn a legend entry with nothing after the equals sign.
    if (!name) return '';
    const words = name.split(/\s+/).filter(Boolean);
    let code = name.length <= KEEP_AS_IS
      ? name
      : words.length > 1
        ? words.map(w => w[0].toUpperCase()).join('').slice(0, KEEP_AS_IS)
        : name.slice(0, KEEP_AS_IS);

    // Two categories can legitimately shorten to the same code ("Hitting"/"Hit and run").
    // Numbering the later one keeps every heading unique — an ambiguous heading on a scoring
    // sheet is worse than an ugly one.
    if (used.has(code)) {
      let n = 2;
      while (used.has(`${code}${n}`)) n++;
      code = `${code}${n}`;
    }
    used.add(code);
    if (code !== name) explained.push(`${code} = ${name}`);
    return code;
  });

  return { codes, legend: explained.join('  ·  ') };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Fit contract floors: a column's floor is measured from its real content — the longest
 * single word across header + sampled cells, because linebreak overflow wraps legibly at
 * spaces and degenerates into one-character-per-line confetti exactly when a column is
 * narrower than its tokens. One CELL token's demand is CAPPED: a long email or URL wrapping
 * onto a second line is legible (the approved gallery shows exactly that), so it may not
 * force other columns off the page. The absolute minimum keeps an empty column readable.
 *
 * ⚠ A HEADING'S LONGEST WORD IS NEVER CAPPED, AND IS MEASURED IN THE FACE IT PRINTS IN
 * (bold, half a point up — see `headStyles`). Both halves of that sentence were wrong until
 * the Phase 2 Registers pass, and the two errors compounded: headings were measured in the
 * regular face, so bold ones asked for ~2mm more than was set aside, and the cell cap then
 * held them below even that. Real reports with room to spare printed "Divisio n",
 * "Composit e", "Submitte d At". A heading broken mid-word is never legible and a heading is
 * short by nature — there are only ever as many as there are columns, and the widest word in
 * this product's vocabulary measures under 20mm. If the floors genuinely cannot all fit, a
 * whole column is dropped and the document says so; that is the honest outcome, and a
 * shredded heading is not.
 */
const COL_FLOOR_MIN_MM = 8;
const CELL_TOKEN_CAP_MM = 14;
/** How many rows to sample per column when measuring the floor. */
const FIT_SAMPLE_ROWS = 60;

/** Parse a hex string to { r, g, b } 0-255 values for jsPDF setFillColor. */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return { r, g, b };
}

/**
 * Whether an accent fill is "dark" (and therefore takes light ink on the accent band and
 * table headings). EXPORTED for the settings-card paper preview, which must use the same
 * rule the paper is drawn with — deliberately NOT lib/color-contrast's WCAG `pickInk`:
 * converging on that would change what every shipped PDF renders, a Phase-2+ call.
 */
export function accentNeedsLightInk(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  // Perceived luminance formula
  return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
}
const isDark = accentNeedsLightInk;

const BRANDING_TEXT = 'Generated by FieldLogicHQ';
const MARGIN = 14; // mm left/right margin

/**
 * D3: stamp the footer on every page AFTER the document is fully laid out, so "Page X
 * of Y" is true on every page. (The old per-page callback read the running page count
 * while pages were still being created — a 9-page report footed "Page 1 of 1".)
 * Shared by the table engine and the drawn board summary.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stampFooters(doc: any, settings: OrgPdfSettings): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const footerY = doc.internal.pageSize.getHeight() - 8;
  const parts: string[] = [];
  if (settings.footerText) parts.push(settings.footerText);
  if (settings.showDateStamp) parts.push(`Exported: ${tournamentToday()}`);
  if (settings.showBranding) parts.push(BRANDING_TEXT);
  const pageCount: number = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 155);
    if (parts.length > 0) doc.text(parts.join('  ·  '), MARGIN, footerY);
    if (settings.showPageNumbers) {
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - MARGIN, footerY, { align: 'right' });
    }
  }
}

/**
 * Build a jsPDF document from structured data + org PDF settings.
 * Returns the jsPDF instance (caller calls .save(filename) or .output()).
 *
 * @param jsPDFClass - The jsPDF constructor (passed in from the lazy-load caller)
 * @param autoTable  - The autoTable function (passed in from the lazy-load caller)
 * @param options    - Report content and settings
 */
export function buildTablePDF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsPDFClass: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable: any,
  options: {
    title: string;
    subtitle?: string;
    headers: string[];
    rows: (string | number | null | undefined)[][];
    settings: OrgPdfSettings;
    /**
     * D1: whose paper this is — the layered identity the header falls back to when the
     * org left `headerLine1` blank: the TEAM's name on coach-portal paper, the ORG's
     * name on admin paper. The header NEVER falls back to the report title (that printed
     * every untouched org's title twice).
     */
    identity?: string;
    /** D2: the report's declared shape; undeclared fields take the org preference. */
    shape?: ReportShape;
    /** Fit contract: per-report column priorities for customer-shaped tables. */
    fit?: ReportFit;
    /** When provided, renders one autoTable per group (division page breaks). A group may
     *  carry its own `headers` (falls back to the top-level `headers` when absent) so one
     *  document can hold sections with different columns (e.g. a development summary). */
    groups?: { label: string; headers?: string[]; rows: (string | number | null | undefined)[][] }[];
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const { title, subtitle, headers, rows, settings, identity, shape, fit, groups } = options;
  const orientation = shape?.orientation
    ?? (settings.orientation === 'landscape' ? 'landscape' : 'portrait');
  const density = shape?.density
    ?? (settings.reportDensity === 'compact' ? 'compact' : 'readable');
  const accentRgb = hexToRgb(settings.accentColor);
  const headerTextColor = isDark(settings.accentColor) ? [255, 255, 255] : [15, 15, 20];

  // ── Table body styles based on density ──────────────────────────────────
  const cellPadding = density === 'compact'
    ? { top: 2, right: 4, bottom: 2, left: 4 }
    : { top: 4, right: 6, bottom: 4, left: 6 };
  const fontSize = density === 'compact' ? 8 : 9;

  const doc = new jsPDFClass({ orientation, unit: 'mm', format: 'letter' });
  const pageWidth  = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;

  // ── Accent bar helper ────────────────────────────────────────────────────
  function drawAccentBar(y: number, barH = 10) {
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.rect(0, y, pageWidth, barH, 'F');
  }

  // ── Header block ─────────────────────────────────────────────────────────
  // D1: the name line is the layered identity (headerLine1, else the team/org identity
  // passed by the caller) — never the report title, which the title block prints below.
  const nameLine = settings.headerLine1 || identity || '';

  function drawHeader(isFirstPage: boolean) {
    let y = MARGIN;

    // Accent bar at very top
    drawAccentBar(0, 8);

    // Logo — drawn ASPECT-FIT inside the slot (D4): a square crest renders square,
    // never squashed into the slot's 2:1 box.
    const logoH = 12;
    const logoW = 24;
    let drawnLogoW = 0;
    if (settings.logoDataUrl) {
      try {
        const fmt = settings.logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        const props = doc.getImageProperties(settings.logoDataUrl);
        const scale = Math.min(logoW / props.width, logoH / props.height);
        const w = props.width * scale;
        const h = props.height * scale;
        doc.addImage(settings.logoDataUrl, fmt, MARGIN, y + (logoH - h) / 2, w, h);
        drawnLogoW = w;
      } catch {
        // Logo failed to render — skip silently
      }
    }

    // Whose paper this is
    const textX = drawnLogoW > 0 ? MARGIN + drawnLogoW + 4 : MARGIN;
    if (nameLine) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 35);
      doc.text(nameLine, textX, y + 6);
    }

    if (settings.headerLine2) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 100);
      doc.text(settings.headerLine2, textX, y + 11);
    }

    y += Math.max(
      drawnLogoW > 0 ? logoH : 0,
      nameLine || settings.headerLine2 ? (settings.headerLine2 ? 15 : 12) : 4,
    );

    // Divider
    doc.setDrawColor(210, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 4;

    // Report title (only on first page)
    if (isFirstPage) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 35);
      doc.text(title, MARGIN, y + 5);
      if (subtitle) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 110);
        // ⚠ WRAPPED, not drawn as one line. A subtitle is caller-supplied prose — a champions
        // callout listing every division, or the tryout report's rubric legend — and the
        // single-line version ran clean off the right edge of the paper with no clue that
        // anything was missing. Anything that can grow with the customer's data has to wrap.
        const lines: string[] = doc.splitTextToSize(subtitle, contentWidth);
        doc.text(lines, MARGIN, y + 10);
        y += 10 + lines.length * 4;
      } else {
        y += 8;
      }
    }

    return y; // return where content begins
  }

  // ── Fit contract (D2) ────────────────────────────────────────────────────
  // Each column's no-shred floor is measured from its real content (longest unbreakable
  // word across header + sampled cells, plus padding). When the floors don't all fit the
  // page, whole columns are given up (declared dropOrder first, else last-first) and the
  // document SAYS SO above the table. The kept floors are then ENFORCED on the layout via
  // per-column minCellWidth — never the silent one-character-per-line shred.
  const padH = cellPadding.left + cellPadding.right;
  type Cell = string | number | null | undefined;

  /** Widest single token in a string, in current-unit width. */
  function longestTokenWidth(value: Cell): number {
    const s = String(value ?? '').trim();
    if (!s) return 0;
    let max = 0;
    for (const token of s.split(/\s+/)) {
      const w = doc.getTextWidth(token);
      if (w > max) max = w;
    }
    return max;
  }

  function columnFloors(hdrs: (string | number)[], rws: Cell[][]): number[] {
    // Headings first, in the face they PRINT in — bold, half a point up.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize + 0.5);
    const headDemand = hdrs.map(h => longestTokenWidth(h));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const step = Math.max(1, Math.ceil(rws.length / FIT_SAMPLE_ROWS));
    return hdrs.map((_, i) => {
      let cellDemand = 0;
      for (let r = 0; r < rws.length; r += step) {
        const w = longestTokenWidth(rws[r]?.[i]);
        if (w > cellDemand) cellDemand = w;
      }
      // The heading is uncapped; a cell token is not (a long email may wrap, a heading may not).
      const demand = Math.max(headDemand[i], Math.min(cellDemand, CELL_TOKEN_CAP_MM));
      return Math.max(COL_FLOOR_MIN_MM, demand + padH + 1);
    });
  }

  function fitColumns(hdrs: (string | number)[], rws: Cell[][], dropOrder?: number[]) {
    const empty = {
      hdrs, kept: hdrs.map((_, i) => i), dropped: [] as string[],
      columnStyles: {} as Record<number, { minCellWidth: number }>,
    };
    if (hdrs.length === 0) return empty;
    const floors = columnFloors(hdrs, rws);
    // De-dupe the DECLARED order too — a repeated index would subtract its floor twice in
    // the drop loop below and let the sum lie about how much width remains.
    const order = [...new Set(
      (dropOrder ?? []).filter(i => Number.isInteger(i) && i >= 0 && i < hdrs.length),
    )];
    for (let i = hdrs.length - 1; i >= 0; i--) if (!order.includes(i)) order.push(i);

    const dropSet = new Set<number>();
    let total = floors.reduce((a, b) => a + b, 0);
    for (const i of order) {
      if (total <= contentWidth || dropSet.size >= hdrs.length - 1) break;
      dropSet.add(i);
      total -= floors[i];
    }

    const kept = hdrs.map((_, i) => i).filter(i => !dropSet.has(i));
    const columnStyles: Record<number, { minCellWidth: number }> = {};
    kept.forEach((srcIdx, outIdx) => { columnStyles[outIdx] = { minCellWidth: floors[srcIdx] }; });
    return {
      hdrs: kept.map(i => hdrs[i]),
      kept,
      dropped: [...dropSet].sort((a, b) => a - b)
        .map(i => String(hdrs[i] ?? '').trim() || `Column ${i + 1}`),
      columnStyles,
    };
  }

  /** Project rows onto the kept columns — the identity case copies nothing. */
  function projectRows(rws: Cell[][], kept: number[], totalCols: number) {
    return kept.length === totalCols
      ? rws.map(r => r.map(c => c ?? ''))
      : rws.map(r => kept.map(i => r[i] ?? ''));
  }

  /** The honest admission: what was left off this paper, and where the whole table lives. */
  function drawFitNotice(dropped: string[], yy: number): number {
    const names = dropped.length === 1 ? dropped[0]
      : dropped.length === 2 ? `${dropped[0]} and ${dropped[1]}`
      : `${dropped.slice(0, -1).join(', ')} and ${dropped[dropped.length - 1]}`;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 125);
    const lines: string[] = doc.splitTextToSize(
      `${names} didn’t fit this page — the spreadsheet export carries every column.`,
      contentWidth,
    );
    doc.text(lines, MARGIN, yy);
    return yy + lines.length * 3.4 + 2;
  }

  // ── Shared autoTable options ──────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function tableStyles(): Record<string, any> {
    return {
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize,
        cellPadding,
        overflow: 'linebreak',
        textColor: [20, 20, 35],
      },
      headStyles: {
        fillColor: [accentRgb.r, accentRgb.g, accentRgb.b],
        textColor: headerTextColor,
        fontStyle: 'bold',
        fontSize: fontSize + 0.5,
      },
      alternateRowStyles: {
        fillColor: [248, 248, 252],
      },
      columnStyles: {},
      tableWidth: 'auto',
      margin: { left: MARGIN, right: MARGIN },
      tableLineColor: [220, 220, 230],
      tableLineWidth: 0.2,
      // Fit contract: a row never splits across a page break (the orphaned cell
      // fragments on Results p2 were rows continuing mid-cell onto the next page).
      rowPageBreak: 'avoid',
    };
  }

  // ── Render: grouped mode ─────────────────────────────────────────────────
  if (groups && groups.length > 0) {
    let startY = drawHeader(true);
    const footerMargin = 18; // leave room for footer

    // Groups that use the top-level headers (division-style documents) share ONE fit,
    // measured over all their rows together: every division keeps the SAME columns, and
    // the honest "didn't fit" line belongs to the document — once, under the title —
    // never repeated beneath every division heading. Only a group carrying its own
    // headers (mixed-column documents like the development summary) fits individually.
    const sharedGroups = groups.filter(g => !g.headers);
    const sharedFit = sharedGroups.length > 0
      ? fitColumns(headers, sharedGroups.flatMap(g => g.rows), fit?.dropOrder)
      : null;
    if (sharedFit && sharedFit.dropped.length > 0) {
      startY = drawFitNotice(sharedFit.dropped, startY + 3);
    }

    groups.forEach((group, idx) => {
      // Section label
      if (idx > 0) {
        // Check if there's enough room; if not, add a page
        if (startY > pageHeight - footerMargin - 30) {
          doc.addPage();
          startY = drawHeader(false);
        }
      }

      // Group heading
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 35);
      doc.text(group.label, MARGIN, startY + 4);
      doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b);
      doc.setLineWidth(0.5);
      doc.line(MARGIN, startY + 6, pageWidth - MARGIN, startY + 6);
      startY += 10;

      // Own-header groups fit themselves (last-column-first — the declared dropOrder
      // speaks about the top-level columns only).
      const ownFit = group.headers ? fitColumns(group.headers, group.rows, undefined) : null;
      if (ownFit && ownFit.dropped.length > 0) startY = drawFitNotice(ownFit.dropped, startY);
      const fitted = ownFit ?? sharedFit!;
      const totalCols = (group.headers ?? headers).length;
      // A group whose headers are all blank is a key/value block (the practice sheet's
      // "Tonight"), not a table with columns — drawing its head row painted an empty
      // dark band. No titles, no head row.
      const hasHeadRow = fitted.hdrs.some(h => String(h).trim() !== '');
      autoTable(doc, {
        ...tableStyles(),
        columnStyles: fitted.columnStyles,
        head: hasHeadRow ? [fitted.hdrs] : undefined,
        body: projectRows(group.rows, fitted.kept, totalCols),
        startY,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      startY = (doc as any).lastAutoTable.finalY + 8;
    });
  } else {
    // ── Render: flat mode ──────────────────────────────────────────────────
    let startY = drawHeader(true);
    const fitted = fitColumns(headers, rows, fit?.dropOrder);
    if (fitted.dropped.length > 0) startY = drawFitNotice(fitted.dropped, startY + 3);
    autoTable(doc, {
      ...tableStyles(),
      columnStyles: fitted.columnStyles,
      head: [fitted.hdrs],
      body: projectRows(rows, fitted.kept, headers.length),
      startY,
    });
  }

  // D3: footers stamped in one pass over the finished document — true totals everywhere.
  stampFooters(doc, settings);

  return doc;
}

/**
 * Full implementation: build and save a PDF from table data + org settings.
 * Lazy-loads jsPDF and jspdf-autotable to keep the initial bundle small.
 *
 * @param filename - Full filename including .pdf extension
 * @param title    - Report title shown in the document header
 * @param subtitle - Optional subtitle shown below the title
 * @param headers  - Column header labels
 * @param rows     - Data rows (used when groups is absent)
 * @param settings - Org PDF settings (falls back to DEFAULT_PDF_SETTINGS)
 * @param report   - The report's own contract, one optional bag: `groups` (one table per group
 *                   with a section label; a group may carry its own `headers` for a mixed-column
 *                   document such as the development summary), `identity` (whose paper this is —
 *                   team name on coach paper, org name on admin paper; the resolved settings
 *                   already stamp headerLine1, so this only matters for the window before the
 *                   settings fetch lands or when it fails — pass it anyway, belt and braces),
 *                   declared `shape`, and `fit` priorities.
 */
export async function downloadPDF(
  filename: string,
  title: string,
  subtitle: string | undefined,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  settings: OrgPdfSettings = DEFAULT_PDF_SETTINGS,
  report?: {
    groups?: { label: string; headers?: string[]; rows: (string | number | null | undefined)[][] }[];
    identity?: string;
    shape?: ReportShape;
    fit?: ReportFit;
  },
): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = buildTablePDF(jsPDF, autoTable, { title, subtitle, headers, rows, settings, ...report });
  doc.save(filename);
}

/**
 * Fetch a resolved-settings endpoint (the admin route with `?resolve=1`, or the coach team
 * route) and unwrap its `{ settings }` envelope. Null on ANY failure — every consumer falls
 * back to DEFAULT_PDF_SETTINGS, so branding degrades and the export still downloads. The
 * envelope contract lives here, once, instead of copy-pasted at every export surface.
 */
export async function fetchResolvedPdfSettings(url: string): Promise<OrgPdfSettings | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return ((await res.json())?.settings ?? null) as OrgPdfSettings | null;
  } catch {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Practice plan sheet (Practice Plans 1a)
//  The one-page sheet a coach hand-carries to the field, and hands to the assistant
//  running the tee station. It is what makes slice 1a usable on its own, before the
//  field screen exists.
//
//  ⚠ THE VOCABULARY IS "PLANNED", NEVER "DONE" (plan §4). This sheet records what was
//  INTENDED. Nothing on it — no tick box, no blank "did it" column, no wording — may
//  suggest anything happened. That rule is easiest to breach on paper, which is why the
//  print path carries it explicitly.
//
//  ⚠ Coach-generated and hand-carried. NEVER a shareable link: a practice plan names
//  children alongside a date, a start time and a street address.
// ════════════════════════════════════════════════════════════════════════════

export interface PracticeSheetOptions {
  teamName: string;
  /** Pre-formatted by the caller in the ORG's timezone — never re-derived here. */
  dateLabel: string;
  /** "6:00 PM · Arrive 5:45 PM · Sherwood Park, Diamond 2" — assembled by the caller. */
  whereLabel?: string | null;
  goal?: string | null;
  /**
   * What the practice is ABOUT ("Hitting", "Fielding"…) — coach-typed, never a fixed,
   * sport-specific list.
   *
   * ⚠ Since Phase 3 the caller passes the practice's TAG NAMES from the team's shared vocabulary,
   * followed by any legacy free-text labels a plan written before tags still carries. Both are the
   * coach's own words, so nothing changes here — but the field is no longer fed by a single
   * free-text control, and the sheet must go on describing what was PLANNED, never what was done.
   */
  practiceTypes?: string[];
  equipment?: string[];
  /** One row per block: running time window, title, duration, staff, who, notes. */
  blocks: { time: string; title: string; duration: string; staff: string; players: string; notes: string }[];
  /** One table per rotation: the computed group × round grid, plus its plain statements. */
  rotations: { label: string; groupNames: string[]; rounds: { round: string; stations: string[] }[]; notes: string[] }[];
  /** Group membership, so whoever runs a station knows who is in front of them. */
  groups: { label: string; group: string; players: string }[];
  /**
   * The roster with active focus areas. Printed ONLY when the person generating the sheet can
   * see focus areas (`notes`). An assistant without that grant gets the same sheet with this
   * section ABSENT — not redacted-looking, just not there.
   */
  focus: { player: string; focusAreas: string }[];
  settings: OrgPdfSettings;
}

/**
 * Save the one-page practice sheet. Built on the shared `downloadPDF`/`buildTablePDF` report
 * engine via its multi-header `groups` mode, so org header/footer/branding stay in ONE place —
 * there is deliberately no second print pipeline in this feature.
 */
export async function downloadPracticeSheet(filename: string, opts: PracticeSheetOptions): Promise<void> {
  const groups: { label: string; headers: string[]; rows: (string | number | null | undefined)[][] }[] = [];

  const practiceTypes = (opts.practiceTypes ?? []).join(', ');
  const equipment = (opts.equipment ?? []).join(', ');
  if (opts.goal || practiceTypes || equipment) {
    groups.push({
      label: 'Tonight',
      headers: ['', ''],
      rows: [
        ...(practiceTypes ? [['Practice', practiceTypes]] : []),
        ...(opts.goal ? [['Goal', opts.goal]] : []),
        ...(equipment ? [['Equipment', equipment]] : []),
      ],
    });
  }

  groups.push({
    // "The plan" — not "what we did". The heading carries the vocabulary rule too.
    label: 'The plan',
    headers: ['Time', 'Block', 'Length', 'Staff', 'Players', 'Notes'],
    rows: opts.blocks.map(b => [b.time, b.title, b.duration, b.staff, b.players, b.notes]),
  });

  for (const rotation of opts.rotations) {
    groups.push({
      label: rotation.label,
      headers: ['Round', ...rotation.groupNames],
      rows: [
        ...rotation.rounds.map(r => [r.round, ...r.stations]),
        // The honest-arithmetic statements travel onto paper with the grid (D25) — a coach
        // reading only the sheet must still learn that Group C won't reach a station.
        ...rotation.notes.map(n => [n, ...rotation.groupNames.map(() => '')]),
      ],
    });
  }

  if (opts.groups.length > 0) {
    groups.push({
      label: 'Groups',
      headers: ['Rotation', 'Group', 'Players'],
      rows: opts.groups.map(g => [g.label, g.group, g.players]),
    });
  }

  if (opts.focus.length > 0) {
    groups.push({
      label: 'What everyone’s working on',
      headers: ['Player', 'Focus areas'],
      rows: opts.focus.map(f => [f.player, f.focusAreas]),
    });
  }

  // D1: the header carries the team's name (the identity), so the subtitle no longer
  // repeats it — just when and where.
  const subtitle = [opts.dateLabel, opts.whereLabel].filter(Boolean).join('  ·  ') || undefined;
  await downloadPDF(filename, 'Practice plan', subtitle, [], [], opts.settings, {
    groups,
    identity: opts.teamName,
    /* ⚠ COMPACT IS A REGRESSION GUARD, NOT A DESIGN CHOICE (Phase 2 Registers pass) — the same
       one the team roster carries, for the same reason. A rotation grid's headings are the
       coach's own GROUP NAMES, up to twelve of them across a portrait page, and once headings
       were measured honestly (bold, uncapped) a coach who had renamed a group to one long word
       started losing a whole station column that used to print. Measured at 6 / 8 / 12 groups,
       compact restores the exact column count this sheet had before that fix, at every size,
       while keeping the names unbroken.

       ⚠ It deliberately stops there. Abbreviating station names, or anything else about how this
       document is SHAPED, belongs to the Working-sheets pass that rebuilds it as the run sheet —
       whose approved spec already puts rotation grids "compact inside their owning blocks", so
       this guard points the same way rather than pre-empting it. */
    shape: { density: 'compact' },
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  Player Development summary (Player Development 3D)
//  A one-page, hand-delivered family handout: the player's focus areas and their
//  dated measurable log. CURRENT SEASON ONLY, player-vs-self only — no deltas, no
//  percentages, no peer numbers, and never a shareable link (client-side download).
// ════════════════════════════════════════════════════════════════════════════

export interface DevelopmentSummaryOptions {
  playerName: string;
  /** e.g. "#7" — rendered beside the name when present. */
  playerNumber?: string | null;
  teamName: string;
  seasonLabel?: string | null;
  /** Status pre-labelled by the caller ("Working on it" / "Achieved" / "Parked"). */
  goals: { focusArea: string; status: string; note: string | null }[];
  /** One row per reading, grouped by test by the caller, dates pre-formatted. */
  measurables: { test: string; reading: string; date: string; note: string | null }[];
  settings: OrgPdfSettings;
}

/**
 * Save the one-page development summary — the report title/subtitle is the player identity
 * and season, the sections are Focus areas + Measurables (each with its own columns). Built
 * on the shared `downloadPDF`/`buildTablePDF` report engine via its multi-header `groups`
 * mode, so org header/footer/branding stay in ONE place. Current season only, no deltas.
 */
export async function downloadDevelopmentSummary(filename: string, opts: DevelopmentSummaryOptions): Promise<void> {
  const groups: { label: string; headers: string[]; rows: (string | null)[][] }[] = [];
  if (opts.goals.length > 0) {
    groups.push({
      label: 'Focus areas', headers: ['Focus area', 'Status', 'Note'],
      rows: opts.goals.map(g => [g.focusArea, g.status, g.note]),
    });
  }
  if (opts.measurables.length > 0) {
    // Parent-facing labels (D6 /marketing pass): the printed handout uses "Test results"
    // and "Result" — plainer than the in-app coach term "Measurables"/"Reading".
    groups.push({
      label: 'Test results', headers: ['Test', 'Result', 'Date', 'Note'],
      rows: opts.measurables.map(m => [m.test, m.reading, m.date, m.note]),
    });
  }
  const title = `Development summary — ${opts.playerName}${opts.playerNumber ? `  ${opts.playerNumber}` : ''}`;
  // D1: the header carries the team's name; the subtitle keeps only the season.
  const subtitle = opts.seasonLabel || undefined;
  await downloadPDF(filename, title, subtitle, [], [], opts.settings, {
    groups,
    identity: opts.teamName,
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  Tryout Report — board-safe summary (Tryout Insights Phase 1, ruling R1)
//  A drawn one-pager, NOT a table report: aggregates + the fairness receipt +
//  roster names only. Nothing per-candidate — no score, no decision, no bias
//  flag (R2) may appear here; the full-detail variant goes through the normal
//  downloadPDF table path behind its own confirm.
// ════════════════════════════════════════════════════════════════════════════

export interface TryoutBoardSummaryOptions {
  /** Whose paper this is — the TEAM's name (D1); the header falls back to it when the org
   *  left `headerLine1` blank. Same contract as the table engine's `identity`. */
  identity: string;
  seasonName: string;
  finalized: boolean;
  stats: {
    candidates: number;
    /** Prior-season turnout; null = first recorded tryout. */
    prior: number | null;
    priorSeasonName: string | null;
    offers: number;
    accepted: number;
    rosterTotal: number | null;
    returning: number | null;
    newcomers: number | null;
  };
  /** Pre-assembled truthful receipt lines (lib/tryout-report fairnessReceiptLines). Empty = omit section. */
  processLines: string[];
  /** Class profile; null/empty = omit section. */
  profile: { label: string; avg: number | null }[] | null;
  scaleMax: number | null;
  /** Final roster display names; empty = omit section. */
  rosterNames: string[];
  settings: OrgPdfSettings;
}

export async function downloadTryoutBoardSummary(filename: string, opts: TryoutBoardSummaryOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const settings = opts.settings;
  const accentRgb = hexToRgb(settings.accentColor);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const maxY = pageHeight - 18; // keep clear of the footer band

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
  doc.rect(0, 0, pageWidth, 8, 'F');
  let y = MARGIN + 4;

  // Neither the rubric's category count nor the roster size is bounded, so the "one-pager" must
  // still page-break rather than silently run content off the bottom (/simplify altitude finding).
  // Continuation pages carry a compact identity header — a page 2 handed to a board must still
  // say whose report it is (/review finding).
  // D1: same identity contract as the table engine — headerLine1, else whose paper this is.
  const line1 = settings.headerLine1 || opts.identity;
  const line2 = settings.headerLine2 ?? '';
  function ensureRoom(needed: number) {
    if (y + needed <= maxY) return;
    doc.addPage();
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.rect(0, 0, pageWidth, 8, 'F');
    y = MARGIN + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 35);
    doc.text(line1, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 125);
    doc.text(`${opts.seasonName} Tryout Report — Board Summary (continued)`, pageWidth - MARGIN, y, { align: 'right' });
    y += 7;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 35);
  doc.text(line1, MARGIN, y);
  y += 5;
  if (line2) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 100);
    doc.text(line2, MARGIN, y);
  }
  y += 6;
  doc.setDrawColor(210, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, pageWidth - MARGIN, y);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 35);
  doc.text(`${opts.seasonName} Tryout Report — Board Summary`, MARGIN, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(110, 110, 125);
  doc.text(opts.finalized ? 'Final — every candidate has a decision' : 'In progress — decisions are still being made', MARGIN, y);
  y += 9;

  // ── Headline stats ────────────────────────────────────────────────────────
  const stats: { n: string; label: string }[] = [
    { n: String(opts.stats.candidates), label: 'candidates' },
  ];
  if (opts.stats.prior != null) {
    const d = opts.stats.candidates - opts.stats.prior;
    stats.push({
      n: d === 0 ? 'level' : `${d > 0 ? '+' : ''}${d}`,
      label: opts.stats.priorSeasonName ? `vs ${opts.stats.priorSeasonName}` : 'vs last season',
    });
  } else {
    stats.push({ n: '—', label: 'first recorded tryout' });
  }
  stats.push({ n: String(opts.stats.offers), label: 'offers' });
  stats.push({ n: String(opts.stats.accepted), label: 'accepted' });
  if (opts.stats.rosterTotal != null) stats.push({ n: String(opts.stats.rosterTotal), label: 'on the roster' });
  if (opts.stats.returning != null && opts.stats.newcomers != null && opts.stats.rosterTotal != null && opts.stats.rosterTotal > 0) {
    stats.push({ n: `${opts.stats.returning} / ${opts.stats.newcomers}`, label: 'returning / new' });
  }
  const colW = contentWidth / stats.length;
  stats.forEach((s, i) => {
    const x = MARGIN + i * colW;
    // Labels can carry free text (an org's own season name) and up to six columns share the row —
    // clamp each cell to its column so a long label can't run into its neighbour (/review finding).
    const clamp = (text: string) => (doc.splitTextToSize(text, colW - 3) as string[])[0] ?? '';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(20, 20, 35);
    doc.text(clamp(s.n), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 125);
    doc.text(clamp(s.label), x, y + 4.5);
  });
  y += 13;

  function sectionLabel(text: string) {
    ensureRoom(18); // label + at least one content line stay together
    doc.setDrawColor(210, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 125);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 5.5;
  }

  // ── Evaluation process (the fairness receipt) ─────────────────────────────
  if (opts.processLines.length > 0) {
    sectionLabel('Evaluation process');
    for (const line of opts.processLines) {
      ensureRoom(5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 65);
      doc.text(`•  ${line}`, MARGIN, y);
      y += 5;
    }
    y += 3;
  }

  // ── Class profile bars ────────────────────────────────────────────────────
  if (opts.profile && opts.profile.length > 0 && opts.scaleMax) {
    sectionLabel(`Class profile (category averages, scale 1–${opts.scaleMax})`);
    const labelW = 58;
    const valueW = 12;
    const barW = contentWidth - labelW - valueW - 4;
    for (const cat of opts.profile) {
      ensureRoom(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(50, 50, 65);
      doc.text(cat.label, MARGIN, y);
      // Track
      doc.setFillColor(235, 235, 242);
      doc.rect(MARGIN + labelW, y - 3, barW, 3.6, 'F');
      if (cat.avg != null) {
        const w = Math.max(0, Math.min(1, cat.avg / opts.scaleMax)) * barW;
        doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
        doc.rect(MARGIN + labelW, y - 3, w, 3.6, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(20, 20, 35);
      doc.text(cat.avg != null ? cat.avg.toFixed(1) : '—', pageWidth - MARGIN, y, { align: 'right' });
      y += 6.5;
    }
    y += 2;
  }

  // ── Roster ────────────────────────────────────────────────────────────────
  if (opts.rosterNames.length > 0) {
    sectionLabel(`${opts.seasonName} roster — ${opts.rosterNames.length} player${opts.rosterNames.length === 1 ? '' : 's'}`);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 65);
    const wrapped: string[] = doc.splitTextToSize(opts.rosterNames.join(' · '), contentWidth);
    for (const line of wrapped) {
      ensureRoom(5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 65);
      doc.text(line, MARGIN, y);
      y += 5;
    }
  }

  // Footer on every page, with TRUE page numbers — the shared post-pass (D3).
  stampFooters(doc, settings);

  doc.save(filename);
}

// ════════════════════════════════════════════════════════════════════════════
//  Dugout-wall lineup posters (Coach Lineup Builder Phase 3)
//  A high-contrast, pen-fillable poster — NOT the generic report table. Blank
//  cells print as empty boxes the coach fills in by hand at the field; an
//  explicitly-benched cell prints "BN". Drawn with jsPDF primitives for exact
//  control over fixed row heights, thick grid lines, and empty boxes.
// ════════════════════════════════════════════════════════════════════════════

/** Bench sentinel stored in a lineup cell (matches lib/lineup-analysis BENCH_POSITION). */
const POSTER_BENCH = 'Bench';
const POSTER_MARGIN = 13; // mm — a touch tighter than reports to win grid width

/** Full-name labels for diamond position codes, used in the poster legend. Driven by the
 *  Sport Pack's `positions` for *which* codes appear; this only supplies human names.
 *  A future non-diamond sport would supply its own labels (codes fall back to themselves). */
const DIAMOND_POSITION_LABELS: Record<string, string> = {
  P: 'Pitcher', C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base',
  SS: 'Shortstop', LF: 'Left field', CF: 'Center field', RF: 'Right field',
  OF: 'Outfield', DH: 'Designated hitter', EH: 'Extra hitter',
};

/** Build the `{ code, label }[]` legend from a Sport Pack's position codes. */
export function buildPositionLegend(codes: string[]): { code: string; label: string }[] {
  return codes.map(code => ({ code, label: DIAMOND_POSITION_LABELS[code] ?? code }));
}

export interface LineupPosterPlayer {
  /** Batting slot number as a string ('' for a 9-player-mode bench/sub with no slot). */
  battingOrder: string;
  /** Display name, e.g. "#12 Jane Smith". */
  name: string;
  /** True for a 9-player-mode non-starter (rendered after the order, tagged "sub"). */
  isSub: boolean;
  /** inning(string) → position code. '' = blank (prints an empty box); 'Bench' = sit. */
  inningPositions: Record<string, string>;
}

export interface LineupPosterOptions {
  teamName: string;
  opponent?: string | null;
  /** Drives the matchup separator: 'away' → "@", everything else → "vs". */
  homeAway?: 'home' | 'away' | 'neutral' | null;
  /** Pre-formatted date/time line, e.g. "Sat, Jun 28, 2026 · 10:00 a.m." */
  dateLabel: string;
  /** Shown on the batting-order card (not the poster). */
  eventName?: string;
  inningCount: number;
  players: LineupPosterPlayer[];
  legend: { code: string; label: string }[];
  /** When set, the coach's lineup notes print at the foot of the poster (e.g. opponent scouting). */
  includeNotes?: boolean;
  notes?: string | null;
  /** Header accent colour (org PDF accent); text auto-contrasts. */
  accentColor: string;
  showBranding: boolean;
}

/** Matchup separator: away games read "@ Opponent", home/neutral read "vs Opponent". */
function matchupSeparator(homeAway?: 'home' | 'away' | 'neutral' | null): string {
  return homeAway === 'away' ? '@' : 'vs';
}

const clampNum = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Shorten text to fit a max width in the current font, adding an ellipsis. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitText(doc: any, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
  return t + '…';
}

/**
 * Build the dugout-wall poster (landscape): team/opponent/date header, a
 * batting-order × innings grid with empty boxes for blank cells, and a position
 * legend along the bottom. Returns the jsPDF doc (caller saves it).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildLineupPosterDoc(jsPDFClass: any, opts: LineupPosterOptions): any {
  const doc = new jsPDFClass({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = POSTER_MARGIN;
  const accent = hexToRgb(opts.accentColor || '#1e293b');
  const headText = isDark(opts.accentColor || '#1e293b') ? [255, 255, 255] : [20, 20, 30];

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageW, 4, 'F');

  let y = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 15, 25);
  const title = opts.opponent
    ? `${opts.teamName}   ${matchupSeparator(opts.homeAway)}   ${opts.opponent}`
    : opts.teamName;
  doc.text(fitText(doc, title, pageW - 2 * M - 60), M, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(70, 70, 90);
  doc.text(opts.dateLabel, pageW - M, y, { align: 'right' });

  y += 5;
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(0.6);
  doc.line(M, y, pageW - M, y);

  // ── Optional coach notes (printed at the foot) — measured first so the grid reserves room ──
  const notesText = opts.includeNotes && opts.notes ? opts.notes.trim() : '';
  let notesLines: string[] = [];
  if (notesText) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    notesLines = doc.splitTextToSize(notesText, pageW - 2 * M);
    if (notesLines.length > 6) {
      notesLines = notesLines.slice(0, 6);
      notesLines[5] = fitText(doc, `${notesLines[5]} …`, pageW - 2 * M);
    }
  }
  const notesReserve = notesLines.length ? notesLines.length * 4 + 7 : 0;

  // ── Grid geometry ─────────────────────────────────────────────────────────
  const gridTop = y + 5;
  const legendReserve = 18 + notesReserve; // legend + branding (+ optional notes) below the grid
  const gridBottom = pageH - M - legendReserve;
  const gridArea = gridBottom - gridTop;

  const inningCount = Math.max(1, opts.inningCount); // defensive: UI constrains to 1–12
  const colNumW = 13;
  const colNameW = 56;
  const innW = (pageW - 2 * M - colNumW - colNameW) / inningCount;
  const totalW = pageW - 2 * M;
  const headerRowH = 9;
  const n = Math.max(1, opts.players.length);
  const bodyRowH = clampNum((gridArea - headerRowH) / n, 6, 13);
  const gridEnd = gridTop + headerRowH + bodyRowH * opts.players.length;

  const colNameX = M + colNumW;
  const innX = (i: number) => M + colNumW + colNameW + innW * i; // left of inning i (0-based)

  // ── Header row ────────────────────────────────────────────────────────────
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(M, gridTop, totalW, headerRowH, 'F');
  doc.setTextColor(headText[0], headText[1], headText[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const hMid = gridTop + headerRowH / 2;
  doc.text('#', M + colNumW / 2, hMid, { align: 'center', baseline: 'middle' });
  doc.text('Batter', colNameX + 3, hMid, { align: 'left', baseline: 'middle' });
  for (let i = 0; i < inningCount; i++) {
    doc.text(String(i + 1), innX(i) + innW / 2, hMid, { align: 'center', baseline: 'middle' });
  }

  // ── Body: zebra fills + text ──────────────────────────────────────────────
  opts.players.forEach((p, k) => {
    const top = gridTop + headerRowH + k * bodyRowH;
    const mid = top + bodyRowH / 2;
    if (k % 2 === 1) {
      doc.setFillColor(247, 247, 250);
      doc.rect(M, top, totalW, bodyRowH, 'F');
    }
    // batting number
    if (p.battingOrder) {
      doc.setTextColor(20, 20, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(p.battingOrder, M + colNumW / 2, mid, { align: 'center', baseline: 'middle' });
    }
    // name
    doc.setFont('helvetica', p.isSub ? 'normal' : 'bold');
    doc.setFontSize(10);
    doc.setTextColor(p.isSub ? 90 : 20, p.isSub ? 90 : 20, p.isSub ? 110 : 30);
    const nm = p.isSub ? `${p.name}  (sub)` : p.name;
    doc.text(fitText(doc, nm, colNameW - 5), colNameX + 3, mid, { align: 'left', baseline: 'middle' });
    // innings — blank stays an empty box; Bench → "BN"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 35);
    for (let i = 0; i < inningCount; i++) {
      const raw = p.inningPositions[String(i + 1)] || '';
      if (!raw) continue;
      const label = raw === POSTER_BENCH ? 'BN' : raw;
      if (raw === POSTER_BENCH) doc.setTextColor(150, 150, 165);
      doc.text(label, innX(i) + innW / 2, mid, { align: 'center', baseline: 'middle' });
      if (raw === POSTER_BENCH) doc.setTextColor(25, 25, 35);
    }
  });

  // ── Grid lines (drawn over fills/text; thin enough not to obscure) ─────────
  doc.setDrawColor(30, 30, 40);
  // horizontal: top, header/body split, each body row, bottom
  const hLines: number[] = [gridTop, gridTop + headerRowH];
  for (let k = 1; k <= opts.players.length; k++) hLines.push(gridTop + headerRowH + k * bodyRowH);
  hLines.forEach((ly, idx) => {
    doc.setLineWidth(idx === 0 || idx === hLines.length - 1 ? 0.8 : 0.3);
    doc.line(M, ly, M + totalW, ly);
  });
  // vertical: outer + structural separators (after #, after Batter) + inning dividers
  for (let i = 0; i <= inningCount; i++) {
    const vx = innX(i);
    doc.setLineWidth(i === inningCount ? 0.8 : 0.3);
    doc.line(vx, gridTop, vx, gridEnd);
  }
  doc.setLineWidth(0.8); doc.line(M, gridTop, M, gridEnd);              // left edge
  doc.setLineWidth(0.6); doc.line(colNameX, gridTop, colNameX, gridEnd); // after #
  doc.line(colNameX + colNameW, gridTop, colNameX + colNameW, gridEnd);  // after Batter

  // ── Legend (kept above any notes block) ────────────────────────────────────
  const legendY = clampNum(gridEnd + 6, gridTop, pageH - M - 8 - notesReserve);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 100);
  const parts = opts.legend.map(l => `${l.code} ${l.label}`);
  parts.push('BN Bench');
  const legendStr = `Positions:   ${parts.join('     ')}     ·     Blank box = fill in at the field`;
  const lines = doc.splitTextToSize(legendStr, totalW);
  doc.text(lines, M, legendY);

  // ── Optional coach notes block (bottom-anchored, e.g. opponent scouting) ────
  if (notesLines.length) {
    const notesTop = pageH - M - notesReserve + 4;
    doc.setDrawColor(210, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(M, notesTop - 3, M + totalW, notesTop - 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 110);
    doc.text('NOTES', M, notesTop);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 55);
    doc.text(notesLines, M, notesTop + 4.5);
  }

  if (opts.showBranding) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 165);
    doc.text('Generated by FieldLogicHQ', pageW - M, pageH - 5, { align: 'right' });
  }

  return doc;
}

/**
 * Build the stripped batting-order card (portrait): team/opponent/date and a
 * large-type batting order for the scorekeeper / dugout. Subs listed at the foot.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildBattingOrderCardDoc(jsPDFClass: any, opts: LineupPosterOptions): any {
  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  const accent = hexToRgb(opts.accentColor || '#1e293b');

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageW, 5, 'F');

  let y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 15, 25);
  const title = opts.opponent
    ? `${opts.teamName} ${matchupSeparator(opts.homeAway)} ${opts.opponent}`
    : opts.teamName;
  doc.text(fitText(doc, title, pageW - 2 * M), pageW / 2, y, { align: 'center' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 110);
  doc.text([opts.dateLabel, opts.eventName].filter(Boolean).join('  ·  '), pageW / 2, y, { align: 'center' });

  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text('BATTING ORDER', pageW / 2, y, { align: 'center' });
  y += 4;
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(0.6);
  doc.line(M, y, pageW - M, y);

  const batters = opts.players.filter(p => p.battingOrder);
  const subs = opts.players.filter(p => p.isSub || !p.battingOrder);

  const listTop = y + 6;
  const listBottom = pageH - M - (subs.length ? 22 : 10);
  const rowH = clampNum((listBottom - listTop) / Math.max(1, batters.length), 9, 18);

  batters.forEach((p, k) => {
    const top = listTop + k * rowH;
    const mid = top + rowH / 2;
    if (k % 2 === 1) {
      doc.setFillColor(247, 247, 250);
      doc.rect(M, top, pageW - 2 * M, rowH, 'F');
    }
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(p.battingOrder, M + 4, mid, { align: 'left', baseline: 'middle' });
    doc.setTextColor(20, 20, 30);
    doc.setFontSize(15);
    doc.text(fitText(doc, p.name, pageW - 2 * M - 24), M + 18, mid, { align: 'left', baseline: 'middle' });
    doc.setDrawColor(225, 225, 232);
    doc.setLineWidth(0.2);
    doc.line(M, top + rowH, pageW - M, top + rowH);
  });

  if (subs.length) {
    const sy = pageH - M - 14;
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(0.4);
    doc.line(M, sy, pageW - M, sy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 110);
    doc.text('Subs', M, sy + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 55);
    doc.text(fitText(doc, subs.map(s => s.name).join(',  '), pageW - 2 * M - 18), M + 16, sy + 6);
  }

  if (opts.showBranding) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 165);
    doc.text('Generated by FieldLogicHQ', pageW - M, pageH - 6, { align: 'right' });
  }

  return doc;
}

/** Lazy-load jsPDF and save the dugout-wall positions-by-inning poster. */
export async function downloadLineupPoster(filename: string, opts: LineupPosterOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  buildLineupPosterDoc(jsPDF, opts).save(filename);
}

/** Lazy-load jsPDF and save the stripped batting-order card. */
export async function downloadBattingOrderCard(filename: string, opts: LineupPosterOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  buildBattingOrderCardDoc(jsPDF, opts).save(filename);
}
