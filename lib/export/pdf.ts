import { tournamentToday } from '../timezone';
// ⚠ The call-up word comes from its ONE definition, not a literal. The doc-block on `isCallUp`
// argues the mark must never drift between surfaces — and this is the surface whose own comment
// says it must be unambiguous, so hardcoding it here was the first place it would have.
import { CALL_UP_LABEL } from '../coach-roster-name';
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
/** Ceiling on what ONE column may claim from the shared grid before its cells start wrapping. */
const GRID_DEMAND_CAP_MM = 62;
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

/** One spelling of our own provenance line, wherever a document carries it — the PDF footer,
 *  and the foot of an Excel report (2026-09-05). Governed everywhere by `showBranding`. */
export const BRANDING_TEXT = 'Generated by FieldLogicHQ';
/** mm left/right margin. Exported so the BRACKET — the one drawn document living in its own
 *  file — lines its crest, title and first column up with every other document we print. */
/**
 * One footnote under a report's table — the caveats a screen states, travelling with its figures.
 *
 * Plain text rather than bold runs: see the block that draws these for why the emphasis is dropped
 * and the alert colour is not.
 */
export type PdfNote = { text: string; tone?: 'note' | 'alert' };

export const MARGIN = 14;

/** The identity logo slot, shared by every header that draws one. */
const LOGO_SLOT_W = 24;
const LOGO_SLOT_H = 12;

/**
 * Draw the resolved identity logo ASPECT-FIT inside the header slot (D4): a square crest
 * renders square, never squashed into the slot's 2:1 box. Returns the drawn width (0 when
 * there is no logo or it fails), so the caller can shift the name line past it.
 *
 * ONE implementation, used by the table engine's header AND the bespoke drawn documents
 * (board summary, family dues statement, practice run sheet) — a drawn document must not
 * reinvent the slot, which is how the bracket ended up with its own squashed 20×10 version
 * (its fix belongs to the Posters, cards & brackets pass).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawLogoSlot(doc: any, settings: OrgPdfSettings, x: number, y: number): number {
  if (!settings.logoDataUrl) return 0;
  try {
    const fmt = settings.logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    const props = doc.getImageProperties(settings.logoDataUrl);
    const scale = Math.min(LOGO_SLOT_W / props.width, LOGO_SLOT_H / props.height);
    const w = props.width * scale;
    const h = props.height * scale;
    doc.addImage(settings.logoDataUrl, fmt, x, y + (LOGO_SLOT_H - h) / 2, w, h);
    return w;
  } catch {
    // Logo failed to render — skip silently; the document still downloads.
    return 0;
  }
}

/**
 * Height of the identity band (crest / name / second line) below the top margin, measured
 * exactly the way `drawIdentityBand` draws it — so a CONTINUATION page can reserve precisely
 * what it is about to draw.
 *
 * ⚠ Deliberately tests "is a logo CONFIGURED", not "did a logo actually DRAW" (`drawLogoSlot`
 * returns 0 when an image fails to decode). Self-consistency between page 1 and its
 * continuation pages matters more than that distinction, and the divergence is unreachable in
 * practice: it can only show as ~8mm of dead space when a configured logo is corrupt AND there
 * is no name line at all, and every export surface passes an identity. Reviewed 2026-08-23.
 */
function identityBandHeight(settings: OrgPdfSettings, nameLine: string): number {
  return Math.max(
    settings.logoDataUrl ? LOGO_SLOT_H : 0,
    nameLine || settings.headerLine2 ? (settings.headerLine2 ? 15 : 12) : 4,
  );
}

/**
 * Draw the identity band — crest, whose paper this is, the second line, and the hairline
 * under them — starting at `y`, and return the y immediately below the divider.
 *
 * ONE implementation for the table engine AND every drawn document. Until the Working-sheets
 * pass the board summary and the family statement each hand-carried their own copy of this
 * arithmetic (recorded as debt in QA §86); a fourth copy for the run sheet would have made a
 * shared header that four documents could drift apart on.
 *
 * Exported for the BRACKET, which lives in its own file and until the Posters pass hand-rolled
 * both this band AND the crest — drawing the logo into a fixed 20×10 box, so every square club
 * crest printed stretched to double width on the most public document we produce.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function drawIdentityBand(doc: any, settings: OrgPdfSettings, nameLine: string, y: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const drawnLogoW = drawLogoSlot(doc, settings, MARGIN, y);
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
  const below = y + identityBandHeight(settings, nameLine);
  doc.setDrawColor(210, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, below, pageWidth - MARGIN, below);
  return below;
}

/**
 * What a footer says, and in what order — the org's own line, the export date, the branding.
 * ONE definition, shared by the paginated `stampFooters`, the single-page `drawPosterFooter`,
 * and the BRACKET (which lives in its own file), so a fourth part can never reach one footer
 * and miss another.
 */
export function footerParts(settings: OrgPdfSettings): string[] {
  const parts: string[] = [];
  if (settings.footerText) parts.push(settings.footerText);
  if (settings.showDateStamp) parts.push(`Exported: ${tournamentToday()}`);
  if (settings.showBranding) parts.push(BRANDING_TEXT);
  return parts;
}

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
  const parts = footerParts(settings);
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
    /**
     * Columns the READER fills in by hand: their body cells print an empty box to mark,
     * instead of nothing at all. Indices address the top-level `headers` (like `dropOrder`),
     * and a column dropped by the fit contract simply loses its box with the rest of it.
     *
     * Working sheets are the reason this exists — the tryout check-in sheet's tick column
     * printed as a cell with no edges, so there was nothing to aim a pen at. Kept in the
     * shared engine rather than the call site because "a column somebody writes in" is a
     * property of the report, exactly like its shape and its column priorities.
     */
    penColumns?: number[];
    /** When provided, renders one autoTable per group (division page breaks). A group may
     *  carry its own `headers` (falls back to the top-level `headers` when absent) so one
     *  document can hold sections with different columns (e.g. a development summary). */
    groups?: { label: string; headers?: string[]; rows: (string | number | null | undefined)[][] }[];
    /** The report's own footnotes, printed under the table. See the block that draws them. */
    notes?: PdfNote[];
  },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const {
    title, subtitle, headers, rows, settings, identity, shape, fit, groups, penColumns, notes,
  } = options;
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

  /**
   * Where a table resumes on a page it did NOT start on — below the identity band the
   * `didDrawPage` hook redraws there, plus the divider's 4mm.
   *
   * ⚠ Until the Rosters pass, page 2 of any table that overflowed had NO header at all: no
   * crest, no club or team name, nothing. Phase 1's whole promise is that every PDF knows
   * whose paper it is, and it was true only of page 1. The grouped path already redrew the
   * band whenever IT added a page — this makes the same thing happen when autoTable
   * paginates on its own, which is how flat reports (and any single group longer than a
   * page) always broke.
   */
  const continuationTop = MARGIN + identityBandHeight(settings, nameLine) + 4;

  function drawHeader(isFirstPage: boolean) {
    // Accent bar at very top
    drawAccentBar(0, 8);

    // Crest, whose paper this is, and the divider — the shared band (D1/D4).
    let y = drawIdentityBand(doc, settings, nameLine, MARGIN) + 4;

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

  /**
   * Both column measurements a document needs, in ONE pass over the sampled rows:
   *
   *  • `floors` — the no-shred minimum. The heading is measured uncapped in the face it PRINTS in;
   *    a cell's longest token is capped (a long email may wrap, a heading may not).
   *  • `wants` — the width at which nothing wraps at all, capped so one long cell cannot claim the
   *    page. Only the pinned grid uses this; it costs nothing extra to take it here.
   *
   * ⚠ ONE PASS ON PURPOSE. These were two functions walking the same sampled cells with the same
   * sample step and the same bold/normal font switching, differing only in what they measured —
   * so every grouped document paid for the walk twice, and a change to the sampling or the face
   * had to be made in two places to stay in sync.
   */
  function columnMetrics(hdrs: (string | number)[], rws: Cell[][]) {
    // Headings first, in the face they PRINT in — bold, half a point up.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize + 0.5);
    const headToken = hdrs.map(h => longestTokenWidth(h));
    const headWhole = hdrs.map(h => doc.getTextWidth(String(h ?? '')));

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    const step = Math.max(1, Math.ceil(rws.length / FIT_SAMPLE_ROWS));
    const floors: number[] = [];
    const wants: number[] = [];
    hdrs.forEach((_, i) => {
      let cellToken = 0;
      let cellWhole = 0;
      for (let r = 0; r < rws.length; r += step) {
        const cell = rws[r]?.[i];
        const t = longestTokenWidth(cell);
        if (t > cellToken) cellToken = t;
        const w = doc.getTextWidth(String(cell ?? ''));
        if (w > cellWhole) cellWhole = w;
      }
      floors.push(Math.max(
        COL_FLOOR_MIN_MM,
        Math.max(headToken[i], Math.min(cellToken, CELL_TOKEN_CAP_MM)) + padH + 1,
      ));
      wants.push(Math.max(headWhole[i], Math.min(cellWhole, GRID_DEMAND_CAP_MM)) + padH + 1);
    });
    return { floors, wants };
  }

  function fitColumns(hdrs: (string | number)[], rws: Cell[][], dropOrder?: number[]) {
    const empty = {
      hdrs, kept: hdrs.map((_, i) => i), dropped: [] as string[],
      columnStyles: {} as Record<number, { minCellWidth: number }>,
      grid: null as Record<number, { cellWidth: number }> | null,
    };
    if (hdrs.length === 0) return empty;
    const { floors, wants } = columnMetrics(hdrs, rws);
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
      grid: pinnedGrid(kept.map(i => wants[i]), kept.map(i => floors[i])),
    };
  }

  /**
   * ONE column grid for every section of a grouped document.
   *
   * Each group is its own autoTable call, and autoTable sizes columns from the rows it was handed
   * — so a division with short team names laid out narrower columns than the division below it,
   * and a reader comparing two sections of ONE document found the grid moving under them. Widths
   * are therefore measured once across every shared row and pinned with an exact `cellWidth`.
   *
   * ⚠ Applies to shared-header groups ONLY. A group carrying its own headers is a different table
   * on purpose (the development summary's mixed sections, the practice sheet's key/value block),
   * and pinning it to somebody else's grid would be wrong rather than tidy. Flat reports are one
   * table and already consistent — this changes nothing for them.
   *
   * ⚠⚠ AND ONLY WHEN EVERY COLUMN CAN HAVE WHAT IT WANTS. Returns null on a table already wider
   * than its paper, where autoTable's own squeeze is doing real work: the first cut of this
   * pinned those columns to the no-shred FLOOR, which caps a cell's longest token on purpose —
   * so "Maplewood Mustangs" printed as "Maplewoo / d Mustangs" down the tournament results, and
   * the report grew a fifth page doing it. A grid that shreds a word is worse than a grid that
   * shifts. Found by looking at the corpus re-render, not by any test.
   */
  function pinnedGrid(wants: number[], floors: number[]): Record<number, { cellWidth: number }> | null {
    const want = wants.map((w, i) => Math.max(w, floors[i]));
    const total = want.reduce((a, b) => a + b, 0);
    if (total <= 0 || total > contentWidth) return null;

    // Share the leftover out in proportion, so the table fills the paper rather than ending
    // two-thirds across it.
    const slack = contentWidth - total;
    const styles: Record<number, { cellWidth: number }> = {};
    want.forEach((w, i) => { styles[i] = { cellWidth: w + slack * (w / total) }; });
    return styles;
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
  /**
   * Map declared `penColumns` (indices into the top-level `headers`) onto the columns that
   * actually survived the fit — a dropped column takes its box with it.
   */
  function penOutputColumns(kept: number[]): Set<number> {
    const out = new Set<number>();
    for (const src of penColumns ?? []) {
      const outIdx = kept.indexOf(src);
      if (outIdx >= 0) out.add(outIdx);
    }
    return out;
  }

  /**
   * A grouped document's section heading — its label, and the accent rule under it.
   *
   * ⚠ ONE SOURCE FOR MEASURE AND DRAW. `GROUP_HEAD_H` is what this consumes, what the orphan check
   * reserves, and what a continuation page's top margin holds back. The run sheet's page-overflow
   * defect was two copies of the same arithmetic disagreeing (/review, 2026-08-24) — so the height
   * is BUILT FROM the offsets the draw uses rather than being a fourth number that has to agree
   * with them by hand.
   */
  const GROUP_LABEL_BASELINE = 4;   // label baseline below the heading's top
  const GROUP_RULE_OFFSET = 6;      // the accent rule under it
  const GROUP_RULE_GAP = 4;         // clear air between the rule and the first row
  const GROUP_HEAD_H = GROUP_RULE_OFFSET + GROUP_RULE_GAP;
  function drawGroupHeading(label: string, y: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(20, 20, 35);
    doc.text(label, MARGIN, y + GROUP_LABEL_BASELINE);
    doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y + GROUP_RULE_OFFSET, pageWidth - MARGIN, y + GROUP_RULE_OFFSET);
    return y + GROUP_HEAD_H;
  }

  /** Roughly one body row at the current density — for reserving room, never for drawing. */
  const estRowH = cellPadding.top + cellPadding.bottom + fontSize * 0.3528 * 1.15;

  /**
   * @param pen      hand-marked columns, mapped onto the columns that survived the fit
   * @param continues the section label to re-print at the top of any page this table SPILLS onto.
   *   Without it a day that ran past the bottom of a page opened the next one with a bare table:
   *   the reader held a sheet of fifteen games that never said which day they were. Same defect
   *   the identity band had before the Rosters pass, one level down.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function tableStyles(pen?: Set<number>, continues?: string): Record<string, any> {
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
      margin: {
        left: MARGIN, right: MARGIN,
        top: continues ? continuationTop + GROUP_HEAD_H : continuationTop,
      },
      // Redraw the identity band on any page this table SPILLS onto. autoTable's own page
      // counter starts at 1 per call, so page 1 is the page the table started on — which
      // already carries a header (drawn by `drawHeader`, or by the grouped path when it
      // added the page itself). Anything past that is a continuation and would otherwise
      // print a bare table with a footer and no idea whose it is.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didDrawPage: (data: any) => {
        if (!(data?.pageNumber > 1)) return;
        const y = drawHeader(false);
        // The section says its own name again, and admits it is a continuation — so a reader who
        // only ever sees this page still knows what they are holding.
        if (continues) drawGroupHeading(`${continues}   (continued)`, y);
      },
      // A hand-marked column prints an empty box in each body cell — the volunteer's target.
      // Drawn rather than typed because the standard PDF fonts carry no box glyph, and sized
      // to the row so it stays square at either density.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      didDrawCell: (data: any) => {
        if (!pen?.size || data?.section !== 'body' || !pen.has(data.column?.index)) return;
        const side = Math.min(5.5, data.cell.height - 2.4);
        if (side <= 1) return;
        doc.setDrawColor(150, 150, 165);
        doc.setLineWidth(0.35);
        doc.roundedRect(
          data.cell.x + cellPadding.left * 0.6,
          data.cell.y + (data.cell.height - side) / 2,
          side, side, 0.6, 0.6, 'S',
        );
      },
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
    const sharedRows = sharedGroups.flatMap(g => g.rows);
    const sharedFit = sharedGroups.length > 0
      ? fitColumns(headers, sharedRows, fit?.dropOrder)
      : null;
    if (sharedFit && sharedFit.dropped.length > 0) {
      startY = drawFitNotice(sharedFit.dropped, startY + 3);
    }
    // A heading needs its own height plus a head row and a few body rows under it, or it is a
    // widow announcing a section that is really on the next page.
    const groupKeep = GROUP_HEAD_H + estRowH * 4;

    groups.forEach((group, idx) => {
      if (idx > 0 && startY > pageHeight - footerMargin - groupKeep) {
        doc.addPage();
        startY = drawHeader(false);
      }

      startY = drawGroupHeading(group.label, startY);

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
        // A group carrying its OWN headers is a different column set, so a declared pen column
        // (which addresses the top-level headers) says nothing about it — same rule as dropOrder.
        ...tableStyles(group.headers ? undefined : penOutputColumns(fitted.kept), group.label),
        // A shared-header section takes the ONE grid measured across every section's rows; a
        // section carrying its own headers keeps its own floors, because it is deliberately a
        // different table (the development summary's mixed sections, the run sheet's key/value
        // block) and pinning it to somebody else's grid would be wrong rather than tidy.
        columnStyles: ownFit
          ? ownFit.columnStyles
          : (sharedFit!.grid ?? sharedFit!.columnStyles),
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
      ...tableStyles(penOutputColumns(fitted.kept)),
      columnStyles: fitted.columnStyles,
      head: [fitted.hdrs],
      body: projectRows(rows, fitted.kept, headers.length),
      startY,
    });
  }

  /* ── The report's footnotes, under its table (owner ruling 2026-09-05) ──────────────────────
     The caveats a money report states on screen travel with it now: a board reading the emailed
     PDF sees "Total expenses" and, underneath, which costs it deliberately leaves out.

     ⚠ IT FLOWS ONTO A NEW PAGE RATHER THAN OVERPRINTING THE FOOTER. Notes land wherever the table
     happened to finish, which on a long report is three lines from the bottom — the one place a
     block of prose is guaranteed to collide with the stamped footer if nobody checks.

     ⚠ THE BOLD IS DROPPED, DELIBERATELY. jsPDF has no rich-text run inside a wrapped paragraph, so
     honouring the screen's emphasis would mean measuring and placing every run by hand across
     wrapped lines. Quiet prose under a table is the right register for a footnote anyway; the
     ALERT keeps its colour, because that one is a finding rather than an explanation and losing it
     would lose the point. */
  if (notes?.length) {
    const left = MARGIN;
    const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
    const LINE_H = 3.6;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let y = ((doc as any).lastAutoTable?.finalY ?? 40) + 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    // Bottom margin deep enough to clear the stamped footer, whatever page this lands on.
    const floorY = () => doc.internal.pageSize.getHeight() - 18;
    for (const note of notes) {
      let lines: string[] = doc.splitTextToSize(note.text, width);
      if (note.tone === 'alert') doc.setTextColor(140, 47, 30);
      else doc.setTextColor(90, 86, 78);
      /* ⚠ A LOOP, NOT ONE CHECK (/review, 2026-09-05). A single "does it fit? then new page" test is
         right only while every note is a few lines long — which is true of the notes that exist
         today and is not a property of the code. A note longer than a page would have been drawn
         straight off the bottom with nothing to catch it. Drawing what fits and carrying the rest
         forward costs three lines and stops the guarantee depending on the content. */
      while (lines.length > 0) {
        if (y + LINE_H > floorY()) { doc.addPage(); y = 20; }
        const fits = Math.max(1, Math.floor((floorY() - y) / LINE_H));
        doc.text(lines.slice(0, fits), left, y);
        y += Math.min(fits, lines.length) * LINE_H;
        lines = lines.slice(fits);
      }
      y += 2.4;
    }
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
    penColumns?: number[];
    /** The report's own footnotes, printed under the table (owner ruling 2026-09-05). */
    notes?: PdfNote[];
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
//  Practice RUN SHEET (structure decided by the owner 2026-08-22 from rendered
//  exhibits; built in PDF Export Quality Phase 2, pass 4 — Working sheets)
//
//  The sheet a coach carries onto a field at 6pm with a whistle in the other
//  hand, and hands to the assistant running the tee station. Read in glances,
//  in bad light, possibly damp.
//
//  ⚠ IT IS DELIBERATELY OFF THE TABLE ENGINE. A practice plan's payload is
//  mostly PROSE, and the shared report table chopped the coach's sentences into
//  a narrow ribbon, split one mid-sentence across a page break, and spent half
//  the rotation grid on a "Round" column. The decided form — times down a left
//  gutter, an accent spine, full-width prose beside it, and each rotation grid
//  sitting INSIDE the block that owns it — is a drawn layout, in the same family
//  as the tryout board summary and the family dues statement.
//
//  It still rides the SHARED plumbing: `drawIdentityBand` (crest + whose paper
//  this is), `drawLogoSlot`, `stampFooters` (true page totals). No second print
//  pipeline, and never a fork of the table renderer.
//
//  ⚠ THE VOCABULARY IS "PLANNED", NEVER "DONE" (plan §4). This sheet records what was
//  INTENDED. Nothing on it — no tick box, no blank "did it" column, no wording — may
//  suggest anything happened. That rule is easiest to breach on paper, which is why the
//  print path carries it explicitly. (The pen-box column the check-in sheet gained in the
//  same pass is deliberately NOT available here: this document is drawn, and the box has
//  no place on it.)
//
//  ⚠ Coach-generated and hand-carried. NEVER a shareable link: a practice plan names
//  children alongside a date, a start time and a street address.
//
//  ⚠ THE SHEET IS THE PRINT OF THE SCREEN'S DOCUMENT (practices re-evaluation stage 5, owner
//  ruling P2, 2026-09-17). The plan page hands this renderer the document in the ORDER and the
//  WORDS the screen shows — the block's lines, each station as a labelled block, the rotation
//  grid turned to STATION columns exactly as the screen's board reads it (P1 · P8), "Whole team"
//  where the screen says it (P5), every clock through the product's formatter. The rendered
//  check (`npm run check:pdf`) and the renderer contract test hold that agreement. Paper keeps
//  its OWN rights, named here so nobody "fixes" them to match the screen: the stacked clock in
//  the gutter, blocks atomic across pages, the identity band and a true "Page X of Y", the focus
//  section only for a viewer with the grant and only when the plan carries it, a shut block's
//  words still printed, and no doors, pills, toolbar, ghost row or "Edit groups" — paper has no
//  taps.
// ════════════════════════════════════════════════════════════════════════════

/**
 * One block's rotation, already computed by the caller.
 *
 * ⚠ A rotation belongs to the BLOCK it was configured on — it is a property of that block in
 * the plan, so it can never be an orphan, and it always prints inside its own block. (The
 * structure plan's "fall back to after the timeline" case describes something the data model
 * cannot produce; confirmed against the code and reported to the owner 2026-08-23.)
 *
 * ⚠ TURNED TO STATION COLUMNS (stage 5, P1 — ruled in words 2026-09-16, drawn and ruled again
 * 2026-09-17). The paper reads the same way the screen's board has since D6: the block's named
 * stations ACROSS, one row per round with its clock, the group(s) in each cell. The caller
 * assembles it from the screen's own re-key (`rotationByStation`) — never from a round's cells by
 * position — so a hand-arranged round (D14) prints where the coach put each group: two groups
 * stacked in one cell when they share, an empty cell for a station with nobody that round, and a
 * group sitting the round out named in `out`. The grid still turns on its side when the station
 * headings cannot print whole across the page at the smallest size.
 */
export interface PracticeSheetRotation {
  /** The block's NAMED stations, across the top of the grid, in the coach's order. Empty when there is no grid. */
  stationNames: string[];
  /**
   * One row per round. `groups[i]` is the group name(s) at station `i` that round — two when two
   * share it (they stack in the cell), none when nobody is there. `out` names the groups sitting
   * the round out; a "Sitting out" column is drawn only when some round has one.
   */
  rounds: { round: string; groups: string[][]; out: string[] }[];
  /**
   * The honest-arithmetic statements ("Group A won't reach the bullpen tonight"). They print
   * as SENTENCES under the grid, never as grid rows — and they print even when there is no
   * grid at all, which is how an UNFINISHED rotation stops vanishing from the paper.
   */
  notes: string[];
  /** Who is in each group, beside the grid it belongs to. */
  groups: { name: string; players: string }[];
}

/**
 * One station on paper — a LABELLED BLOCK under the block's own words (stage 5, P8), never the
 * " · "-joined prose run it used to be (which wrapped mid-item: "Run by Sam / Assistant"), and
 * never columns. The assistant running the tee holds this sheet, and their station has to be the
 * easiest thing on it to find.
 */
export interface PracticeSheetStation {
  /** The station's name, bold — the caller labels an unnamed one ("Station 2"). */
  name: string;
  /** Who runs it, printed beside the name as " · Run by …". Empty when nobody is named. */
  runBy: string;
  /**
   * What the station says of its OWN when it differs from the block's words — printed first,
   * as the block's own lines are ("Watch for: …", then the doing line). Empty for a station that
   * reads the block's teaching (the caller already decided that with the same resolver the field
   * screen uses).
   */
  words: string[];
  /**
   * Labelled facts in the station modal's order — Setup · Equipment · Players · Tonight ·
   * Rotation — as [label, value] pairs; the caller sends only the ones the station carries, so a
   * line is absent, never empty. The label prints in the muted ink, the value in the prose ink.
   */
  facts: [string, string][];
  /** The station's own coaching points, as "– …" lines. */
  points: string[];
}

export interface PracticeSheetBlock {
  /** Running clock window, pre-formatted by the caller in the org's timezone. */
  time: string;
  title: string;
  duration: string;
  staff: string;
  /** Who is in it — the coach's own list as written, or "Whole team" when nobody was named (P5). */
  players: string;
  /** The coach's own sentences — printed at full width, the whole point of this document. */
  notes: string;
  /** The block's stations, each a labelled block under the notes (P8). */
  stations?: PracticeSheetStation[];
  rotation?: PracticeSheetRotation | null;
}

export interface PracticeSheetOptions {
  teamName: string;
  /** Pre-formatted by the caller in the ORG's timezone — never re-derived here. */
  dateLabel: string;
  /** "6:00 PM · Arrive 5:45 PM · Sherwood Park, Diamond 2" — assembled by the caller. */
  whereLabel?: string | null;
  goal?: string | null;
  /** The coach's paragraph about the practice, under the goal (2026-09-14). */
  description?: string | null;
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
  blocks: PracticeSheetBlock[];
  /**
   * The roster with active focus areas. Printed ONLY when the person generating the sheet can
   * see focus areas (`notes`). An assistant without that grant gets the same sheet with this
   * section ABSENT — not redacted-looking, just not there.
   */
  focus: { player: string; focusAreas: string }[];
  settings: OrgPdfSettings;
}

// ── Run-sheet geometry (the approved candidate's dimensions) ─────────────────
/**
 * The clock column.
 *
 * ⚠ Sized for the REAL clock string, which is not "6:00". The product formats a block's window in
 * the org's own zone — "6:00 p.m.–6:10 p.m." — and the first build of this sheet was measured
 * against a hand-written fixture using bare hours, so on real data the time ran straight through
 * the block title beside it. Found by seeding a real practice and looking at the paper (QA §89).
 * The window is STACKED here (start, then the end beneath it) and auto-fitted, so no locale's
 * time format can overflow and nothing is dropped to make it fit.
 */
const RUN_GUTTER_W = 26;
const RUN_LINE_H = 4.2;       // one wrapped prose line
const RUN_GRID_ROW_H = 6.2;
const RUN_GRID_HEAD_H = 6.6;
const RUN_GROUP_LINE_H = 4.4;
const RUN_ROUND_COL_W = 22;
/** Font sizes a rotation grid may step down through before it turns on its side. */
const RUN_GRID_SIZES = [8, 7.5, 7] as const;
/**
 * A grid HEADING WRAPS to at most this many lines (a stacked cell has no cap — its row simply
 * grows). ⚠ A QA finding turned into a rule (stage 5, P1, 2026-09-17):
 * turning the grid to station columns moved the coach's long strings into the HEAD row, and the fit
 * rule tested a heading's widest WORD then printed the whole heading unwrapped — "Footwork ladder"
 * passed the rule (12.7 + 5 ≤ 22.3mm) and overran its column by 2mm. Headings now wrap at the
 * fitted size, the head row grows by `gridLineH` per extra line, and `gridFit` refuses a size at
 * which any heading needs a third line — the grid turns sideways instead. The per-word test stays,
 * so a word is never shredded.
 */
const RUN_GRID_HEAD_LINES = 2;
/** One extra line inside a grid row or head, in mm, at a given point size (≈ 1.2× the em). */
const gridLineH = (size: number) => size * 0.42;
/** Indent of a station's labelled lines under its name (P8). */
const RUN_STATION_INDENT = 3.6;
const RUN_STATION_LINE_H = 3.9;

/** The ink of the run sheet, named once. */
const RUN_INK: [number, number, number] = [20, 20, 35];
const RUN_MUTED: [number, number, number] = [110, 110, 125];
const RUN_PROSE: [number, number, number] = [50, 50, 65];
const RUN_HAIRLINE: [number, number, number] = [210, 210, 220];
const RUN_ALT_ROW: [number, number, number] = [246, 246, 250];

/**
 * Build the practice run sheet.
 *
 * Exported (rather than only its download wrapper) so the renderer contract tests can read the
 * finished document back without touching the filesystem — the same shape as the family dues
 * statement.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildPracticeRunSheetDoc(jsPDFClass: any, opts: PracticeSheetOptions): any {
  const { settings } = opts;
  const accentRgb = hexToRgb(settings.accentColor);
  const headInk = isDark(settings.accentColor) ? [255, 255, 255] : [15, 15, 20];

  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  // The same floor the table engine holds its rows to (`margin.bottom`), so a drawn document
  // and a table document leave the footer exactly the same clearance.
  const maxY = pageHeight - 18;

  // D1: the same identity contract as every other document — the org's own header line, else
  // whose paper this is (the TEAM's name on coach-portal paper).
  const line1 = settings.headerLine1 || opts.teamName;

  const spineX = MARGIN + RUN_GUTTER_W + 2;
  const proseX = spineX + 4;
  const proseW = pageWidth - MARGIN - proseX;

  let y = 0;

  function accentBar() {
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.rect(0, 0, pageWidth, 8, 'F');
  }

  /**
   * The compact continuation band. ⚠ A DRAWN document does its own paging, so §86's universal
   * continuation identity (a per-page hook in the table engine) does not reach it — this sheet
   * carries its own, exactly one band per page, never both.
   */
  function continuationHeader(): void {
    accentBar();
    const cy = MARGIN + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...RUN_INK);
    doc.text(line1, MARGIN, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...RUN_MUTED);
    doc.text(
      `Practice plan${opts.dateLabel ? ` — ${opts.dateLabel}` : ''} (continued)`,
      pageWidth - MARGIN, cy, { align: 'right' },
    );
    doc.setDrawColor(...RUN_HAIRLINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, cy + 3, pageWidth - MARGIN, cy + 3);
  }
  /** Where content starts on a page this sheet added itself. */
  const continuationTop = MARGIN + 4 + 3 + 6;

  /**
   * What to redraw at the top of a page a BLOCK spills onto — its clock and "(continued)" title.
   * Set while a block is being drawn, cleared after.
   *
   * ⚠ A hook rather than a call at one site: the re-label used to hang off the prose loop alone, so
   * a block whose ROTATION GRID or group lists spilled opened the next page with a bare band and no
   * way to tell which part of the night those rows belonged to (/review, 2026-08-24).
   */
  let continueBlock: (() => void) | null = null;
  function newPage(): void {
    doc.addPage();
    continuationHeader();
    y = continuationTop;
    continueBlock?.();
  }
  function ensureRoom(needed: number): void {
    if (y + needed > maxY) newPage();
  }

  /**
   * A section rule + its small-caps label. `keepWith` is how much of what follows should stay
   * with it — pass the whole section's height when the section is short enough to be worth
   * keeping intact, and the label moves rather than orphaning a two-line tail on the next page.
   */
  function sectionLabel(text: string, keepWith = 8): void {
    ensureRoom(10 + keepWith);
    // A section that lands at the top of a continuation page needs no rule of its own — the
    // band it sits under already drew one, and two hairlines 3mm apart read as a mistake.
    if (y > continuationTop + 0.5) {
      doc.setDrawColor(...RUN_HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, pageWidth - MARGIN, y);
      y += 5;
    } else {
      y += 1;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...RUN_MUTED);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 5;
  }

  // ── Page 1 header ─────────────────────────────────────────────────────────
  accentBar();
  y = drawIdentityBand(doc, settings, line1, MARGIN) + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...RUN_INK);
  doc.text('Practice plan', MARGIN, y);
  y += 5;
  const whenWhere = [opts.dateLabel, opts.whereLabel].filter(Boolean).join('  ·  ');
  if (whenWhere) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 110);
    // Caller-supplied prose (an org's own venue name) — wrapped, never run off the paper.
    const lines: string[] = doc.splitTextToSize(whenWhere, contentWidth);
    doc.text(lines, MARGIN, y);
    y += lines.length * RUN_LINE_H + 1.8;
  }

  // ── Tonight's facts: labelled prose lines, no table, no dark band ─────────
  const facts: [string, string][] = [
    ['Practice', (opts.practiceTypes ?? []).join(', ')],
    ['Goal', opts.goal ?? ''],
    ['About', opts.description ?? ''],
    ['Equipment', (opts.equipment ?? []).join('  ·  ')],
  ];
  const labelW = 26;
  for (const [label, value] of facts) {
    if (!value) continue;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines: string[] = doc.splitTextToSize(value, contentWidth - labelW);
    // The label stays with the first line; the rest breaks between whole lines, the way a
    // block's notes do — "About" is a paragraph (2,000 characters, line breaks allowed), and a
    // one-shot room check for the whole block could paint past the page's foot (/review 2026-09-14).
    ensureRoom(RUN_LINE_H + 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...RUN_MUTED);
    doc.text(label.toUpperCase(), MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...RUN_PROSE);
    for (const [i, line] of lines.entries()) {
      if (i > 0) ensureRoom(RUN_LINE_H);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...RUN_PROSE);
      doc.text(line, MARGIN + labelW, y);
      y += RUN_LINE_H;
    }
    y += 2.2;
  }
  if (facts.some(([, v]) => v)) y += 1;

  // ── The rotation grid ─────────────────────────────────────────────────────

  /**
   * Which grid size keeps every heading WHOLE in a column of `colW` — every WORD fits, and the
   * heading wraps to no more than `RUN_GRID_HEAD_LINES` lines — with each heading's wrapped lines
   * at that size; or null when no size does.
   *
   * ⚠ Station names are CUSTOMER-SHAPED headings — the exact class that cost the roster and the
   * tryout report whole columns in the Registers pass, and the reason this sheet has been
   * printing at compact density as a stop-gap ever since. A heading is never shredded and never
   * truncated: if it cannot fit, the grid turns on its side instead (below). The size and the
   * wrap are decided TOGETHER here so no caller can pick a size and then wrap at a different one.
   */
  /** Each heading's wrapped lines in a column of `colW` at `size`, in the head row's bold face. */
  function wrapHeads(names: string[], colW: number, size: number): string[][] {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    return names.map(n => doc.splitTextToSize(n, colW - 5) as string[]);
  }
  /**
   * `cells` — every string the grid's CELLS will carry (the coach's group names, or sideways the
   * station names): they must fit whole too, since the turn moved customer text into both places.
   * ⚠ Words are split on a plain SPACE, exactly as the wrapper splits them — a name joined by a
   * non-breaking space is one word to both, so it fails the fit and turns the grid rather than
   * being chopped mid-word by the wrapper's long-word fallback (/review, 2026-09-17).
   */
  function gridFit(names: string[], cells: string[], colW: number): { size: number; headLines: string[][] } | null {
    const widestWord = (strings: string[]) =>
      Math.max(0, ...strings.map(n => Math.max(0, ...n.split(' ').map(w => doc.getTextWidth(w)))));
    for (const size of RUN_GRID_SIZES) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      // Measured in the bold face for both — the wider one, so a cell (drawn normal) can only fit.
      if (Math.max(widestWord(names), widestWord(cells)) + 5 > colW) continue;
      const headLines = wrapHeads(names, colW, size);
      if (headLines.some(lines => lines.length > RUN_GRID_HEAD_LINES)) continue;
      return { size, headLines };
    }
    return null;
  }

  /** A grid's finished geometry — what `drawGrid` draws and `measureBlock` sums, from ONE source. */
  type GridLayout = {
    size: number;
    labelColW: number;
    colW: number;
    rowLabelHead: string;
    /** Each heading's wrapped lines, in column order. */
    head: string[][];
    headH: number;
    /** Each row: its label's lines, its cells' stacked lines, and the height they need. */
    rows: { label: string[]; cells: string[][]; h: number }[];
  };

  /**
   * Lay a grid out — headings wrapped, cells stacked, every height decided — WITHOUT drawing it.
   *
   * ⚠⚠ ONE SOURCE FOR MEASURE AND DRAW. The head row grows with a wrapped heading and a row grows
   * with a stacked cell; `measureBlock` and `drawGrid` both read the heights off this object, so
   * the block can never "fit" a page it does not fit (the 2026-08-24 overflow was exactly a
   * second copy of the height arithmetic, and the group lines below carry the same rule).
   */
  function layoutGrid(head: string[], rowLabelHead: string, rows: { label: string; cells: string[][] }[],
    width: number, labelColW: number, fit: { size: number; headLines: string[][] }): GridLayout {
    const colW = (width - labelColW) / Math.max(1, head.length);
    const lineH = gridLineH(fit.size);
    const headH = RUN_GRID_HEAD_H + (Math.max(1, ...fit.headLines.map(l => l.length)) - 1) * lineH;
    const laid = rows.map(r => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(fit.size);
      const label = doc.splitTextToSize(r.label, labelColW - 5) as string[];
      // A cell's names wrap to the column too (the fit proved every WORD fits); a stack of two
      // names that each wrap is four lines, and the row grows to the deepest cell.
      doc.setFont('helvetica', 'normal');
      const cells = r.cells.map(stack => stack.flatMap(name => doc.splitTextToSize(name, colW - 5) as string[]));
      const deepest = Math.max(label.length, 1, ...cells.map(c => c.length));
      return { label, cells, h: RUN_GRID_ROW_H + (deepest - 1) * lineH };
    });
    return { size: fit.size, labelColW, colW, rowLabelHead, head: fit.headLines, headH, rows: laid };
  }

  /** Draw a laid-out grid at `x`: `head` across the top, `rows` down the side. */
  function drawGrid(g: GridLayout, x: number, width: number): void {
    const lineH = gridLineH(g.size);
    ensureRoom(g.headH + (g.rows[0]?.h ?? RUN_GRID_ROW_H));
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.rect(x, y, width, g.headH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(g.size);
    doc.setTextColor(headInk[0], headInk[1], headInk[2]);
    doc.text(g.rowLabelHead, x + 2.5, y + 4.4);
    g.head.forEach((lines, i) =>
      lines.forEach((line, li) => doc.text(line, x + g.labelColW + i * g.colW + 2.5, y + 4.4 + li * lineH)));
    y += g.headH;
    g.rows.forEach((r, ri) => {
      // A grid row is atomic and a header is never orphaned: a grid that runs long simply
      // continues on the next page, under the sheet's own continuation band.
      ensureRoom(r.h);
      if (ri % 2 === 1) {
        doc.setFillColor(...RUN_ALT_ROW);
        doc.rect(x, y, width, r.h, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(g.size);
      doc.setTextColor(...RUN_INK);
      r.label.forEach((line, li) => doc.text(line, x + 2.5, y + 4.3 + li * lineH));
      doc.setFont('helvetica', 'normal');
      r.cells.forEach((stack, i) => {
        const cx = x + g.labelColW + i * g.colW + 2.5;
        // Nobody here this round: a dash in the quiet ink, never a blank that reads as a mistake.
        if (stack.length === 0) {
          doc.setTextColor(...RUN_MUTED);
          doc.text('—', cx, y + 4.3);
          return;
        }
        doc.setTextColor(...RUN_PROSE);
        stack.forEach((line, li) => doc.text(line, cx, y + 4.3 + li * lineH));
      });
      y += r.h;
    });
    y += 2.5;
  }

  /**
   * The rotation grid's layout, or null when there is no grid to draw (an unfinished rotation).
   * Stations across (P1) when their headings fit whole at some size; otherwise sideways.
   */
  function rotationGrid(rot: PracticeSheetRotation, width: number): GridLayout | null {
    if (rot.rounds.length === 0 || rot.stationNames.length === 0) return null;
    // "Sitting out" is a column only when some round has a group out (a hand-arranged grid,
    // D14) — and it is the one heading that is not the coach's own words.
    const anyOut = rot.rounds.some(r => r.out.length > 0);
    const heads = anyOut ? [...rot.stationNames, 'Sitting out'] : rot.stationNames;
    const acrossW = (width - RUN_ROUND_COL_W) / heads.length;
    // Every name the cells will carry — the groups, and the sitters — must fit whole too.
    const groupNames = rot.rounds.flatMap(r => [...r.groups.flat(), ...r.out]);
    const fit = gridFit(heads, groupNames, acrossW);
    if (fit) {
      // The screen's shape: this round, who is where — stations across, the clock down the side.
      // One cell per station column BY INDEX (a short round pads with empties, so the sitters
      // never slide into a station's column), then the sitters.
      return layoutGrid(
        heads, 'Round',
        rot.rounds.map(r => ({
          label: r.round,
          cells: [...rot.stationNames.map((_, i) => r.groups[i] ?? []), ...(anyOut ? [r.out] : [])],
        })),
        width, RUN_ROUND_COL_W, fit,
      );
    }
    // Too many stations (or a name too long) for the coach's own words to print whole across
    // the top — so the grid TURNS ON ITS SIDE. Nothing is dropped and nothing is cut; the
    // question it answers shifts from "this round, who is where" to "where is my station all
    // night", which is the station coach's own question (owner-approved 2026-08-23; kept at P1).
    // ⚠ Turned sideways, a round label becomes a COLUMN HEADING, and the caller's label is a
    // bare ordinal ("1 (6:10 p.m.)") because in the normal orientation it sits under a
    // "Round" heading that supplies the word. Without it here the grid reads "Station | 1 | 2"
    // and never says what the columns are. Guarded so a caller that already spells it out
    // cannot produce "Round Round 1".
    const roundHeads = rot.rounds.map(r =>
      /^round\b/i.test(r.round.trim()) ? r.round : `Round ${r.round}`);
    const labelColW = Math.min(52, Math.max(30, width * 0.32));
    const roundW = (width - labelColW) / Math.max(1, roundHeads.length);
    // Sideways there is nowhere further to turn, so the round headings wrap at the floor size
    // however many lines they need.
    const floor = RUN_GRID_SIZES[RUN_GRID_SIZES.length - 1];
    const sideFit = gridFit(roundHeads, groupNames, roundW) ?? { size: floor, headLines: wrapHeads(roundHeads, roundW, floor) };
    return layoutGrid(
      roundHeads, 'Station',
      [
        ...rot.stationNames.map((name, si) => ({ label: name, cells: rot.rounds.map(r => r.groups[si] ?? []) })),
        ...(anyOut ? [{ label: 'Sitting out', cells: rot.rounds.map(r => r.out) }] : []),
      ],
      width, labelColW, sideFit,
    );
  }

  /** The whole rotation region: grid (when there is one), statements, group membership. */
  function drawRotation(rot: PracticeSheetRotation, x: number, width: number): void {
    const grid = rotationGrid(rot, width);
    if (grid) drawGrid(grid, x, width);

    // The statements travel with the rotation as SENTENCES (D25) — and they print even when
    // there is no grid, which is how a rotation the coach hasn't finished stops disappearing
    // from the paper entirely.
    for (const note of rot.notes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const lines: string[] = doc.splitTextToSize(note, width - 4);
      ensureRoom(lines.length * 3.9 + 2);
      doc.setTextColor(...RUN_PROSE);
      doc.text('•', x + 0.5, y + 3.2);
      doc.text(lines, x + 4, y + 3.2);
      y += lines.length * 3.9 + 1;
    }
    if (rot.notes.length > 0) y += 1.5;

    // Who is in each group, directly beneath the grid it belongs to — an assistant reads one
    // region and has everything, instead of hunting a "Groups" section pages away.
    for (const g of rot.groups) {
      // Measured BEFORE the room check, or the check reserves less than the draw consumes.
      const nameLines = groupLines(g, width);
      ensureRoom(nameLines.length * RUN_GROUP_LINE_H);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...RUN_INK);
      const lead = `${g.name} — `;
      doc.text(lead, x, y + 3.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...RUN_PROSE);
      doc.text(nameLines, x + doc.getTextWidth(lead), y + 3.2);
      y += nameLines.length * RUN_GROUP_LINE_H;
    }
  }

  /**
   * How a rotation's group-membership line wraps, and therefore how tall it is.
   *
   * ⚠⚠ ONE SOURCE FOR MEASURE AND DRAW. This was two copies, and they disagreed: the drawing loop
   * reserved a single line before printing however many the player list actually wrapped to, and
   * `measureBlock` counted one line per group as well. A group holding a dozen full names wraps to
   * three, so the block "fitted" a page it did not fit, and the overflow printed across the footer
   * or off the paper entirely (/review, high-risk tier, 2026-08-24). Anything that measures this
   * line must call this, never re-derive it.
   */
  function groupLines(g: { name: string; players: string }, width: number): string[] {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const leadW = doc.getTextWidth(`${g.name} — `);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    return doc.splitTextToSize(g.players, Math.max(10, width - leadW)) as string[];
  }

  /**
   * A station's lines on paper (P8), laid out once: the name in bold with " · Run by …" beside it,
   * then — indented — what it says of its own, its labelled facts and its points, each wrapped to
   * the indented width. A bare station is its one bold line.
   *
   * ⚠ THE SAME RULE AS `groupLines`: anything that measures a station calls this, and the draw
   * prints exactly these lines. A `label` is drawn in the muted ink ahead of the line's text.
   */
  /** `boldTo` — how much of the line is the NAME (bold ink); the rest is the muted "· Run by". */
  type StationLine = { text: string; label?: string; boldTo?: number; indent: number };
  function stationLines(st: PracticeSheetStation, width: number): StationLine[] {
    const out: StationLine[] = [];
    const inner = Math.max(10, width - RUN_STATION_INDENT);
    // The name line: bold name, muted "· Run by" — wrapped as one string so a long name and a
    // long staff list break where the margin falls, and drawn in two inks on the first line.
    // Measured in the BOLD face (the wider one) so the split can only over-reserve, never overrun.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const runBy = st.runBy ? `  ·  Run by ${st.runBy}` : '';
    const nameLines = doc.splitTextToSize(`${st.name}${runBy}`, width) as string[];
    nameLines.forEach((line, i) => out.push({
      // The first line is the name (bold) up to where the name ends, when the whole name is on it.
      text: line, indent: 0,
      boldTo: i === 0 ? (line.startsWith(st.name) ? st.name.length : line.length) : undefined,
    }));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    for (const w of st.words) {
      for (const line of doc.splitTextToSize(w, inner) as string[]) out.push({ text: line, indent: RUN_STATION_INDENT });
    }
    for (const [label, value] of st.facts) {
      if (!value) continue;
      const lines = doc.splitTextToSize(`${label}  ${value}`, inner) as string[];
      lines.forEach((line, i) => out.push({ text: line, label: i === 0 ? label : undefined, indent: RUN_STATION_INDENT }));
    }
    for (const p of st.points) {
      const lines = doc.splitTextToSize(`– ${p}`, inner) as string[];
      lines.forEach((line, i) => out.push({ text: line, indent: RUN_STATION_INDENT + (i === 0 ? 0 : 2.2) }));
    }
    return out;
  }

  /** Height of a block's station blocks: a gap above the first, the lines, a gap between each. */
  function stationsHeight(stations: PracticeSheetStation[] | undefined, width: number): number {
    if (!stations?.length) return 0;
    return stations.reduce((h, st) => h + stationLines(st, width).length * RUN_STATION_LINE_H + 1.6, 1.4);
  }

  /** Draw a block's stations under its words, line by line so a long one breaks between lines. */
  function drawStations(stations: PracticeSheetStation[], x: number, width: number): void {
    y += 1.4;
    for (const st of stations) {
      for (const line of stationLines(st, width)) {
        ensureRoom(RUN_STATION_LINE_H);
        const lx = x + line.indent;
        // Every line is the prose face; only the name line starts in bold.
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        if (line.boldTo != null) {
          // The name in bold ink; whatever follows it on the same line (" · Run by …") in the
          // muted ink, measured in the bold face so the two halves meet exactly.
          const name = line.text.slice(0, line.boldTo);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...RUN_INK);
          doc.text(name, lx, y);
          if (line.boldTo < line.text.length) {
            const nameW = doc.getTextWidth(name);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(...RUN_MUTED);
            doc.text(line.text.slice(line.boldTo), lx + nameW, y);
          }
        } else if (line.label) {
          doc.setTextColor(...RUN_MUTED);
          doc.text(line.label, lx, y);
          const labelW = doc.getTextWidth(`${line.label}  `);
          doc.setTextColor(...RUN_PROSE);
          doc.text(line.text.slice(line.label.length + 2), lx + labelW, y);
        } else {
          doc.setTextColor(...RUN_PROSE);
          doc.text(line.text, lx, y);
        }
        y += RUN_STATION_LINE_H;
      }
      y += 1.6;
    }
  }

  /**
   * The block's clock, split for the gutter: the start on its own line, the end beneath it.
   * "6:00 p.m.–6:10 p.m." is one string from the caller — as one line it is wider than any
   * sensible gutter, and clipping it would drop the fact it exists to say.
   */
  function clockLines(time: string): string[] {
    const parts = String(time ?? '').split('–');
    if (parts.length < 2) return time ? [time] : [];
    return [parts[0].trim(), `–${parts.slice(1).join('–').trim()}`];
  }

  /** The largest size at which every line of the clock fits the gutter, down to a floor. */
  function clockSize(lines: string[]): number {
    for (const size of [11.5, 10.5, 9.5, 8.5, 7.5]) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(size);
      if (lines.every(l => doc.getTextWidth(l) <= RUN_GUTTER_W - 1.5)) return size;
    }
    return 7.5;
  }

  /**
   * Height of a block's head — its clock in the gutter, its title, and the staff · players line
   * beside it. All three WRAP: a block whose players are the whole roster is a real thing a coach
   * records, and clipping that line to its first line printed a roster that stopped mid-name.
   */
  function blockHeadHeight(b: PracticeSheetBlock): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(b.title, proseW).length;
    const who = [b.staff, b.players].filter(Boolean).join('  ·  ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const whoLines = who ? doc.splitTextToSize(who, proseW).length : 0;
    // Mirrors the draw exactly (5.6 to the title baseline, +0.6 before a staff/players line).
    const beside = 5.6 + titleLines * 4.4 + (whoLines ? 0.6 + whoLines * 3.6 : 0);
    const gutter = clockLines(b.time).length * 4.6 + 4;
    return Math.max(12.6, beside, gutter);
  }

  /** How tall a block wants to be, so an atomic one can be moved whole. */
  function measureBlock(b: PracticeSheetBlock): number {
    let h = blockHeadHeight(b);
    // ⚠ AFTER the head: `blockHeadHeight` leaves the doc at 8pt, and the notes are DRAWN at 9pt —
    // measured at 8pt they wrapped to fewer lines than they printed, so a note-heavy block near
    // the foot "fitted" a page it did not fit (/review, 2026-09-17).
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (b.notes) h += doc.splitTextToSize(b.notes, proseW).length * RUN_LINE_H;
    h += stationsHeight(b.stations, proseW);
    const rot = b.rotation;
    if (rot) {
      // The grid's height is read off the SAME layout the draw uses — a wrapped heading grows
      // the head row and a stacked cell grows its row, and both are already in it.
      const grid = rotationGrid(rot, proseW);
      if (grid) h += 3 + grid.headH + grid.rows.reduce((s, r) => s + r.h, 0) + 2.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      for (const n of rot.notes) h += doc.splitTextToSize(n, proseW - 4).length * 3.9 + 1;
      if (rot.notes.length > 0) h += 1.5;
      for (const g of rot.groups) h += groupLines(g, proseW).length * RUN_GROUP_LINE_H;
    }
    return h;
  }

  // ── The plan ──────────────────────────────────────────────────────────────
  if (opts.blocks.length > 0) {
    sectionLabel('The plan');

    for (const b of opts.blocks) {
      const wanted = measureBlock(b) + 4;
      // Blocks are ATOMIC — one moves whole to the next page rather than starting four lines
      // from the bottom. ⚠ Except when the block is taller than a whole page: it cannot move
      // whole to a page it still will not fit, so it takes a clean page and then FLOWS, breaking
      // only between whole lines (never mid-sentence, which is the failure that killed the old
      // table form) and re-labelling itself where it continues.
      const pageCapacity = maxY - continuationTop;
      if (wanted > pageCapacity) {
        if (y > continuationTop + 1) newPage();
      } else {
        ensureRoom(wanted);
      }

      const top = y;
      const startPage: number = doc.internal.getNumberOfPages();

      // The clock, stacked and auto-fitted so a real "6:00 p.m.–6:10 p.m." cannot run into
      // the title beside it, with the duration quiet underneath.
      const clock = clockLines(b.time);
      const cSize = clockSize(clock);
      let gy = y + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(cSize);
      doc.setTextColor(...RUN_INK);
      for (const line of clock) { doc.text(line, MARGIN, gy); gy += 4.6; }
      if (b.duration) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...RUN_MUTED);
        doc.text(b.duration, MARGIN, gy - 0.4);
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...RUN_INK);
      const titleLines: string[] = doc.splitTextToSize(b.title, proseW);
      doc.text(titleLines, proseX, y + 4);
      let headY = y + 4 + titleLines.length * 4.4;
      // ⚠ WRAPPED, never clipped. A block with no stations carries the coach's own player list,
      // which on a full roster is a dozen names — the first build printed its first line and
      // stopped mid-name, which reads as a shorter roster rather than a longer line.
      const who = [b.staff, b.players].filter(Boolean).join('  ·  ');
      if (who) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...RUN_MUTED);
        const whoLines: string[] = doc.splitTextToSize(who, proseW);
        doc.text(whoLines, proseX, headY + 0.6);
        headY += whoLines.length * 3.6;
      }
      y = Math.max(y + blockHeadHeight(b), headY + 1.6);

      /** Where an oversize block resumes: the clock again, and the title saying it continues. */
      function continuationLabel(): void {
        // Same stacked, auto-fitted clock as the block's own head — drawn as one line here, it
        // ran through the title exactly the way the head used to.
        const cl = clockLines(b.time);
        const cs = clockSize(cl);
        let cy = y + 4;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(cs);
        doc.setTextColor(...RUN_INK);
        for (const line of cl) { doc.text(line, MARGIN, cy); cy += 4.6; }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...RUN_MUTED);
        doc.text('cont’d', MARGIN, cy - 0.4);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...RUN_INK);
        const contLines: string[] = doc.splitTextToSize(`${b.title} (continued)`, proseW);
        doc.text(contLines, proseX, y + 4);
        y += Math.max(8, cl.length * 4.6 + 3, contLines.length * 4.4 + 2);
      }

      continueBlock = continuationLabel;
      if (b.notes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const lines: string[] = doc.splitTextToSize(b.notes, proseW);
        for (const line of lines) {
          // Line by line, so a long note breaks between whole lines and never mid-sentence.
          // The re-label rides `newPage` now, so this is a plain room check.
          ensureRoom(RUN_LINE_H);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(...RUN_PROSE);
          doc.text(line, proseX, y);
          y += RUN_LINE_H;
        }
      }

      // The stations, each a labelled block under the words (P8) — before the grid, as the
      // screen's columns sit above its grid.
      if (b.stations?.length) drawStations(b.stations, proseX, proseW);

      if (b.rotation) {
        y += 3;
        drawRotation(b.rotation, proseX, proseW);
      }

      // The spine, drawn to the block's real height on every page it occupies.
      const endPage: number = doc.internal.getNumberOfPages();
      doc.setDrawColor(accentRgb.r, accentRgb.g, accentRgb.b);
      doc.setLineWidth(0.7);
      if (endPage === startPage) {
        doc.line(spineX, top, spineX, y + 1);
      } else {
        doc.setPage(startPage);
        doc.line(spineX, top, spineX, maxY);
        for (let p = startPage + 1; p < endPage; p++) {
          doc.setPage(p);
          doc.line(spineX, continuationTop, spineX, maxY);
        }
        doc.setPage(endPage);
        doc.line(spineX, continuationTop, spineX, y + 1);
      }
      doc.setPage(startPage);
      doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
      doc.circle(spineX, top + 2.6, 1.1, 'F');
      doc.setPage(endPage);
      continueBlock = null;
      y += 4.5;
    }
  }

  // ── What everyone's working on ────────────────────────────────────────────
  // ⚠ ABSENT, not redacted-looking, when the generator cannot see focus areas — the caller
  // sends an empty list and the data never reached their browser in the first place.
  if (opts.focus.length > 0) {
    const nameW = 36;
    // Measure the whole list first: a short focus list moves to the next page INTACT rather
    // than leaving two names behind and three orphaned under a bare continuation band. A list
    // too long for any single page simply flows, one name at a time, as before.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const focusRowLines = (f: { player: string; focusAreas: string }): number => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const name = doc.splitTextToSize(f.player, nameW - 3).length;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      return Math.max(name, doc.splitTextToSize(f.focusAreas, contentWidth - nameW).length);
    };
    const focusHeight = opts.focus.reduce((h, f) => h + focusRowLines(f) * RUN_LINE_H + 1.5, 0);
    sectionLabel('What everyone’s working on',
      focusHeight <= maxY - continuationTop - 10 ? focusHeight : 8);
    for (const f of opts.focus) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const lines: string[] = doc.splitTextToSize(f.focusAreas, contentWidth - nameW);
      // ⚠ The NAME wraps too. It used to be clipped to its first line — the same defect the block
      // meta line was fixed for, left behind here: a long name printed short with no cue, and the
      // focus text beside it then read as belonging to somebody else (/review 2026-08-24).
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      const nameLines: string[] = doc.splitTextToSize(f.player, nameW - 3);
      const rowLines = Math.max(lines.length, nameLines.length);
      ensureRoom(rowLines * RUN_LINE_H + 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...RUN_INK);
      doc.text(nameLines, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...RUN_PROSE);
      doc.text(lines, MARGIN + nameW, y);
      y += rowLines * RUN_LINE_H + 1.5;
    }
  }

  // Footer on every page, with TRUE page numbers — the shared post-pass (D3).
  stampFooters(doc, settings);
  return doc;
}

/** Lazy-loaded download wrapper, same shape as every export entry point here. */
export async function downloadPracticeSheet(filename: string, opts: PracticeSheetOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  buildPracticeRunSheetDoc(jsPDF, opts).save(filename);
}

// ════════════════════════════════════════════════════════════════════════════
//  Player Development handout (Player Development 3D; development lifecycle
//  Phase 3, mockup screen 6 — "A conversation with the player")
//  A hand-delivered handout the coach CHOSE: the goals this conversation is
//  about, a recent observation, selected test results with the attempts behind
//  them, a coach-written next step, and — on request — the full dated result log
//  as an appendix. CURRENT SEASON ONLY, player-vs-self only — no deltas, no
//  percentages, no peer numbers, no tryout material, no internal notes, and never
//  a shareable link (client-side download). Numbers and dates on the first page;
//  the log is an appendix; long content paginates, never shrinks (F13).
// ════════════════════════════════════════════════════════════════════════════

export interface DevelopmentSummaryOptions {
  playerName: string;
  /** e.g. "#7" — rendered beside the name when present. */
  playerNumber?: string | null;
  teamName: string;
  seasonLabel?: string | null;
  /** "Prepared 13 Sep 2026" — the caller formats the date. ⚠ No coach is named: the handout is the
   *  record of a player, not a signed document (owner ruling 2026-09-22). */
  preparedLine: string;
  /** "What we're working on" — the chosen goals: the focus and the goal's own success sentence. */
  goals: { focusArea: string; success: string | null }[];
  /** "A recent observation" — the chosen observations, dates pre-formatted, descriptor and what was seen joined by the caller. */
  observations: { date: string; text: string }[];
  /** "Selected test results" — one row per chosen result: the headline, its date, and how it was read (attempts + method). */
  results: { test: string; result: string; date: string; note: string | null }[];
  /** The coach's own words, and the next review date from the goal when one is set (pre-formatted). */
  nextStep: string | null;
  nextReviewOn: string | null;
  /** The appendix — one line per session, per test — or null when the coach left it out. */
  log: { test: string; lines: string[] }[] | null;
  settings: OrgPdfSettings;
}

/**
 * Save the development handout — a DRAWN document (the practice run sheet's idiom, not the
 * `downloadPDF`/`buildTablePDF` multi-header `groups` engine this used until 2026-09-16), because
 * this paper is read as a short conversation, not a report: a coach's own goal/success prose, one
 * observation sentence, a light three-column result list and a quoted next step, laid out exactly
 * as `DevelopmentHandoutPreview.tsx`'s on-screen paper draws them — ONE model prints both (chart
 * rule 8's spirit). The `groups` engine's per-section filled header row read as a generic report
 * (dark bands unrelated to the coach portal's own warm paper) for a document that is supposed to
 * read as a personal note. Current season only, no deltas — unchanged from the table-engine build.
 */
export async function downloadDevelopmentSummary(filename: string, opts: DevelopmentSummaryOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const settings = opts.settings;
  const accentRgb = hexToRgb(settings.accentColor);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const maxY = pageHeight - 18;

  // The same warm paper the on-screen preview draws with (`DevelopmentHandoutPreview.module.css`'s
  // `--paper-ink` / `--paper-muted` / `--paper-line`, token-exempt there for the same reason this
  // is hardcoded here: this page previews PAPER, not the app's own light/dark theme).
  const INK: [number, number, number] = [31, 31, 36];
  const MUTED: [number, number, number] = [90, 86, 81];
  const HAIRLINE: [number, number, number] = [217, 214, 207];
  const LINE_H = 4.5;

  const line1 = settings.headerLine1 || opts.teamName;
  const nameLine = [line1, opts.seasonLabel].filter(Boolean).join(' · ');

  let y = 0;

  function accentBar(): void {
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.rect(0, 0, pageWidth, 8, 'F');
  }

  /** The compact continuation band — a drawn document pages itself (the practice sheet's idiom). */
  function continuationHeader(): void {
    accentBar();
    const cy = MARGIN + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(nameLine, MARGIN, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Player development — ${opts.playerName} (continued)`, pageWidth - MARGIN, cy, { align: 'right' });
    doc.setDrawColor(...HAIRLINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, cy + 3, pageWidth - MARGIN, cy + 3);
  }
  const continuationTop = MARGIN + 4 + 3 + 6;

  function newPage(): void {
    doc.addPage();
    continuationHeader();
    y = continuationTop;
  }
  function ensureRoom(needed: number): void {
    if (y + needed > maxY) newPage();
  }

  /** A section's small-caps label — `.section h3`'s look (muted, uppercase). No rule: the on-screen
   *  paper separates sections by space alone, only the letterhead above draws a line. */
  function sectionLabel(text: string): void {
    ensureRoom(10 + LINE_H); // the label plus room for at least its first line, so it is never orphaned alone at a page's foot
    y += y > continuationTop + 0.5 ? 5 : 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 5;
  }

  /** One wrapped paragraph, line by line so a long one breaks between whole lines and never runs off the page. */
  function paragraph(text: string, p: { bold?: boolean; italic?: boolean; size?: number; color?: [number, number, number]; x?: number; width?: number } = {}): void {
    const { bold = false, italic = false, size = 9, color = INK, x = MARGIN, width = contentWidth - (x - MARGIN) } = p;
    doc.setFont('helvetica', italic ? 'italic' : bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(text, width);
    for (const line of lines) {
      ensureRoom(LINE_H);
      doc.setFont('helvetica', italic ? 'italic' : bold ? 'bold' : 'normal');
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(line, x, y);
      y += LINE_H;
    }
  }

  // ── Letterhead, eyebrow, the player's own name as the real headline ──
  accentBar();
  y = drawIdentityBand(doc, settings, nameLine, MARGIN) + 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('PLAYER DEVELOPMENT', MARGIN, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text(opts.playerName, MARGIN, y);
  if (opts.playerNumber) {
    const nameW = doc.getTextWidth(opts.playerName);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...MUTED);
    doc.text(` ${opts.playerNumber}`, MARGIN + nameW, y);
  }
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(opts.preparedLine, MARGIN, y);
  y += 3;

  // ── What we're working on: bold focus line, the success sentence beneath it — prose, no table ──
  if (opts.goals.length > 0) {
    sectionLabel('What we’re working on');
    for (const g of opts.goals) {
      paragraph(g.focusArea, { bold: true });
      if (g.success) paragraph(g.success);
      y += 1.5;
    }
  }

  // ── A recent observation: one sentence per observation, date folded in ──
  if (opts.observations.length > 0) {
    sectionLabel(opts.observations.length === 1 ? 'A recent observation' : 'Recent observations');
    for (const o of opts.observations) {
      paragraph(`${o.date} · ${o.text}`);
      y += 1.5;
    }
  }

  // ── Selected test results: a light three-column list, a hairline under each row — no filled
  //    header band. "How it was read" prints as a footnote under the list, per test, not a fourth
  //    squeezed column (the on-screen paper's own layout). ──
  if (opts.results.length > 0) {
    sectionLabel(opts.results.length === 1 ? 'Selected test result' : 'Selected test results');
    const dateColW = 24;
    const resultColW = 42;
    const testColW = contentWidth - dateColW - resultColW;
    const testX = MARGIN, resultX = MARGIN + testColW, dateX = resultX + resultColW;

    function tableHeadRow(): void {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text('Test', testX, y);
      doc.text('Result', resultX, y);
      doc.text('Date', dateX, y);
      y += 2;
      doc.setDrawColor(...HAIRLINE);
      doc.setLineWidth(0.3);
      doc.line(MARGIN, y, MARGIN + contentWidth, y);
      y += 4;
    }
    /** A row is atomic; a table that spills onto a new page redraws its column heads there, so a
     *  continuation page never reads as an unlabelled column of numbers. */
    function ensureRow(rowH: number): void {
      if (y + rowH > maxY) { newPage(); tableHeadRow(); }
    }
    tableHeadRow();
    for (const r of opts.results) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const testLines: string[] = doc.splitTextToSize(r.test, testColW - 3);
      const resultLines: string[] = doc.splitTextToSize(r.result, resultColW - 3);
      const rowLines = Math.max(testLines.length, resultLines.length, 1);
      const rowH = rowLines * LINE_H;
      ensureRow(rowH + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(testLines, testX, y);
      doc.text(resultLines, resultX, y);
      doc.text(r.date, dateX, y);
      y += rowH;
      doc.setDrawColor(...HAIRLINE);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y, MARGIN + contentWidth, y);
      y += 3;
    }
    y += 1;
    for (const r of opts.results) {
      if (!r.note) continue;
      paragraph(opts.results.length > 1 ? `${r.test}: ${r.note}` : r.note, { size: 8, color: MUTED });
      y += 0.8;
    }
  }

  // ── Next step: the coach's own words as a quoted, indented line; the review date plain beneath it ──
  if (opts.nextStep || opts.nextReviewOn) {
    sectionLabel('Next step');
    if (opts.nextStep) {
      const quoteX = MARGIN + 3.5;
      const quoteW = contentWidth - 3.5;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      const lines: string[] = doc.splitTextToSize(opts.nextStep, quoteW);
      ensureRoom(lines.length * LINE_H + 2); // atomic: a 600-character quote still fits well under one page
      const barTop = y - 3;
      for (const line of lines) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text(line, quoteX, y);
        y += LINE_H;
      }
      doc.setDrawColor(...HAIRLINE);
      doc.setLineWidth(1);
      doc.line(MARGIN + 1.5, barTop, MARGIN + 1.5, y - LINE_H + 3);
      y += 1.5;
    }
    if (opts.nextReviewOn) paragraph(`We’ll look at this together again on ${opts.nextReviewOn}.`);
  }

  // ── Full dated result log — the appendix, oldest → newest per test ──
  if (opts.log && opts.log.length > 0) {
    sectionLabel(`Full dated result log${opts.seasonLabel ? ` · ${opts.seasonLabel}` : ''}`);
    for (const t of opts.log) {
      ensureRoom(LINE_H + 2);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(t.test, MARGIN, y);
      y += LINE_H;
      for (const line of t.lines) paragraph(line, { size: 8 });
      y += 1.5;
    }
  }

  if (opts.goals.length === 0 && opts.observations.length === 0 && opts.results.length === 0
    && !opts.nextStep && !opts.nextReviewOn && !(opts.log && opts.log.length > 0)) {
    y += 3;
    paragraph('Nothing was recorded for this conversation.', { italic: true, color: MUTED });
  }

  // The purpose line the on-screen paper's own foot carries (`.paperFoot`) — printed on the page,
  // unlike the org footer band below it (page numbers and branding, PDF-only, on every document).
  y += 2;
  ensureRoom(LINE_H + 4);
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, MARGIN + contentWidth, y);
  y += 4;
  paragraph('For this player’s development conversation · A record of this season’s coaching', { size: 8, color: MUTED });

  // Footer on every page, with TRUE page numbers — the shared post-pass (D3).
  stampFooters(doc, settings);
  doc.save(filename);
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
  // First-page y is set by the crest header block below; continuation pages set their own.
  let y = 0;

  // Neither the rubric's category count nor the roster size is bounded, so the "one-pager" must
  // still page-break rather than silently run content off the bottom (/simplify altitude finding).
  // Continuation pages carry a compact identity header — a page 2 handed to a board must still
  // say whose report it is (/review finding).
  // D1: same identity contract as the table engine — headerLine1, else whose paper this is.
  const line1 = settings.headerLine1 || opts.identity;
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
  // The crest, drawn at last (Phase 2 Statements pass, decision 5): this is the page a coach
  // hands a CLUB BOARD, and it received the resolved logo all along without drawing it — the
  // plan's own inventory called that out. Same shared aspect-fit slot as every table document.
  y = drawIdentityBand(doc, settings, line1, MARGIN) + 7;

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
//  Family dues statement (PDF Export Quality Phase 2 — Statements & handouts,
//  owner picks 2026-08-23: the drawn one-pager, from the player's drawer AND
//  as a whole-team print run)
//
//  The reader is a PARENT. A drawn document in the board summary's family —
//  headline stat band first, "What's next" in sentences, then the record as
//  compact tables — on the shared identity/logo/footer plumbing, never a
//  renderer fork.
//
//  ⚠ ONE HOUSEHOLD PER STATEMENT. In the batch file every family starts on its
//  own page, page numbers restart per family ("Page 1 of 1" on the Nguyens'
//  page, not "Page 5 of 12"), and a continuation page names its household —
//  a page 2 loose in a print stack must still say whose money it describes.
// ════════════════════════════════════════════════════════════════════════════

/** One household's statement, pre-assembled and pre-formatted by
 *  lib/coach-dues-statement.ts `buildFamilyDuesStatements` (strings throughout —
 *  this renderer draws, it never computes money). */
export interface FamilyDuesStatementRender {
  /** "the Marchands" — the addressee sentence. */
  label: string;
  /** "Marchand family" — continuation headers and filenames. */
  receiptLabel: string;
  /** "Isla and Emmett". */
  childrenLine: string;
  /** When the label IS the children ("Isla and Emmett's family"), the addressee line skips
   *  naming them a second time. */
  labelledByPlayer?: boolean;
  stats: { billed: string; dues?: string; fundraising?: string; otherCredits?: string; balance?: string; received: string; credits: string; handedBack: string; leftToSend: string };
  billBreakdown?: string[][];
  adjustments?: string[][];
  fundraisingCredits?: string[][];
  otherCredits?: string[][];
  next: string[];
  schedules: { label: string; rows: string[][] }[];
  payments: string[][];
  credits: string[][];
  payouts: string[][];
}

export interface FamilyDuesStatementsOptions {
  /** One per household. One = the drawer's single download; many = the print run. */
  families: FamilyDuesStatementRender[];
  /** Whose paper this is (D1) — the header falls back to it when headerLine1 is blank. */
  teamName: string;
  seasonLabel?: string | null;
  /** "Aug 23, 2026" — formatted by the caller in the org's zone, like every date here. */
  preparedLabel: string;
  settings: OrgPdfSettings;
}

const STATEMENT_SCHEDULE_HEAD = ['Payment', 'Due date', 'Amount', 'Received', 'Credit', 'Still to send', 'Status'];
const STATEMENT_PAYMENT_HEAD = ['Date', 'Player', 'Amount', 'How it arrived', 'Note'];
// Same columns, opposite direction — a payout row is money LEAVING the team, so its method
// column may not read "How it arrived" (/review finding).
const STATEMENT_PAYOUT_HEAD = ['Date', 'Player', 'Amount', 'How it was sent', 'Note'];
const STATEMENT_CREDIT_HEAD = ['Date', 'Player', 'Amount', 'Where it came from'];

/** Exported for the contract tests — the download wrapper injects real jsPDF/autoTable. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFamilyDuesStatementsDoc(jsPDFClass: any, autoTable: any, opts: FamilyDuesStatementsOptions): any {
  const { families, teamName, seasonLabel, preparedLabel, settings } = opts;
  const accentRgb = hexToRgb(settings.accentColor);
  const headerTextColor = isDark(settings.accentColor) ? [255, 255, 255] : [15, 15, 20];

  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const maxY = pageHeight - 18; // clear of the footer band
  const line1 = settings.headerLine1 || teamName;

  let y = 0;
  /** Pages that already carry a header (full or continuation) — the autoTable page-break
   *  hook consults this so a table flowing onto a new page still names the household. */
  const headeredPages = new Set<number>();

  function accentBar() {
    doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b);
    doc.rect(0, 0, pageWidth, 8, 'F');
  }

  /** The compact continuation header — whose paper, and WHOSE MONEY, on every overflow page. */
  function continuationHeader(family: FamilyDuesStatementRender) {
    accentBar();
    const cy = MARGIN + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 35);
    doc.text(line1, MARGIN, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 125);
    doc.text(`Dues statement — ${family.receiptLabel} (continued)`, pageWidth - MARGIN, cy, { align: 'right' });
    headeredPages.add(doc.internal.getNumberOfPages());
  }

  function ensureRoom(needed: number, family: FamilyDuesStatementRender) {
    if (y + needed <= maxY) return;
    doc.addPage();
    continuationHeader(family);
    y = MARGIN + 11;
  }

  function sectionLabel(text: string, family: FamilyDuesStatementRender) {
    ensureRoom(20, family); // label + at least a first line stay together
    doc.setDrawColor(210, 210, 220);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, pageWidth - MARGIN, y);
    y += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 125);
    doc.text(text.toUpperCase(), MARGIN, y);
    y += 4;
  }

  function table(head: string[], body: string[][], family: FamilyDuesStatementRender) {
    autoTable(doc, {
      theme: 'plain',
      styles: {
        font: 'helvetica', fontSize: 8,
        cellPadding: { top: 2, right: 4, bottom: 2, left: 4 },
        overflow: 'linebreak', textColor: [20, 20, 35],
      },
      headStyles: {
        fillColor: [accentRgb.r, accentRgb.g, accentRgb.b],
        textColor: headerTextColor, fontStyle: 'bold', fontSize: 8.5,
      },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      tableLineColor: [220, 220, 230],
      tableLineWidth: 0.2,
      // Top margin reserves the continuation header's band on any page autoTable creates.
      margin: { left: MARGIN, right: MARGIN, top: MARGIN + 11, bottom: 18 },
      rowPageBreak: 'avoid',
      head: [head],
      body,
      startY: y,
      // A table that flows onto a page of its own still names the household.
      didDrawPage: () => {
        const page = doc.internal.getNumberOfPages();
        if (!headeredPages.has(page)) continuationHeader(family);
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 5.5;
  }

  const familyPageStart: number[] = [];

  families.forEach((family, idx) => {
    if (idx > 0) doc.addPage();
    const firstPage = doc.internal.getNumberOfPages();
    familyPageStart.push(firstPage);
    headeredPages.add(firstPage);

    // ── Header: the shared identity block, drawn ────────────────────────────
    accentBar();
    y = drawIdentityBand(doc, settings, line1, MARGIN) + 6;

    // ── Title + addressee ───────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 35);
    doc.text('Dues statement', MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 110);
    const who = family.labelledByPlayer
      ? `Prepared for ${family.label}`
      : `Prepared for ${family.label} — ${family.childrenLine}`;
    const addressee = [who, seasonLabel, preparedLabel].filter(Boolean).join('  ·  ');
    doc.text(addressee, MARGIN, y);
    y += 8.5;

    // ── The headline band: the four numbers a parent came for ──────────────
    const stats = family.stats.dues !== undefined ? [
      { n: family.stats.dues, label: 'dues' },
      ...(family.stats.fundraising && family.stats.fundraising !== '$0.00' ? [{ n: family.stats.fundraising, label: 'fundraising' }] : []),
      ...(family.stats.otherCredits && family.stats.otherCredits !== '$0.00' ? [{ n: family.stats.otherCredits, label: 'other credits' }] : []),
      { n: family.stats.received, label: 'paid' },
      ...(family.stats.handedBack !== '—' ? [{ n: family.stats.handedBack, label: 'handed back' }] : []),
      { n: family.stats.balance ?? family.stats.leftToSend, label: 'balance' },
    ] : [
      { n: family.stats.billed, label: 'billed this season' },
      // No thank-you for zero — a family that hasn't sent anything yet is not being thanked,
      // and a family that has must be.
      { n: family.stats.received, label: family.stats.received === '$0.00' ? 'received' : 'received — thank you' },
      { n: family.stats.credits, label: 'credits' },
      // Only a household that was actually refunded gets the fifth tile — everyone else keeps the
      // four-tile band they compare against last month's copy (dues ladder, review 2026-09-07).
      ...(family.stats.handedBack !== '—' ? [{ n: family.stats.handedBack, label: 'handed back' }] : []),
      { n: family.stats.leftToSend, label: 'left to send' },
    ];
    const colW = contentWidth / stats.length;
    stats.forEach((s, i) => {
      const x = MARGIN + i * colW;
      const clamp = (t: string) => (doc.splitTextToSize(t, colW - 3) as string[])[0] ?? '';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 20, 35);
      doc.text(clamp(s.n), x, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 125);
      doc.text(clamp(s.label), x, y + 4.5);
    });
    y += 11;

    // ── What's next — sentences, never cells ────────────────────────────────
    sectionLabel("What's next", family);
    for (const lineText of family.next) {
      const wrapped: string[] = doc.splitTextToSize(`•  ${lineText}`, contentWidth);
      ensureRoom(wrapped.length * 5 + 2, family);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 65);
      doc.text(wrapped, MARGIN, y + 4);
      y += wrapped.length * 5;
    }
    y += 3;

    // ── The record ──────────────────────────────────────────────────────────
    for (const sched of family.schedules) {
      sectionLabel(sched.label, family);
      table(STATEMENT_SCHEDULE_HEAD, sched.rows, family);
    }
    if (family.adjustments?.length) {
      sectionLabel('Adjustments & forgiveness', family);
      table(['Date', 'Player', 'Amount', 'Reason'], family.adjustments, family);
    }
    if (family.billBreakdown?.length) {
      sectionLabel('How your dues were calculated', family);
      table(['', 'Amount'], family.billBreakdown, family);
    }
    if (family.fundraisingCredits !== undefined && family.otherCredits !== undefined) {
      if (family.fundraisingCredits.length) {
        sectionLabel(`Fundraising — ${family.stats.fundraising}`, family);
        table(STATEMENT_CREDIT_HEAD, family.fundraisingCredits, family);
      }
      if (family.otherCredits.length) {
        sectionLabel(`Other credits — ${family.stats.otherCredits}`, family);
        table(STATEMENT_CREDIT_HEAD, family.otherCredits, family);
      }
    } else if (family.credits.length > 0) {
      sectionLabel('Credits earned', family);
      table(STATEMENT_CREDIT_HEAD, family.credits, family);
    }
    if (family.payments.length > 0) {
      sectionLabel('Payments received — thank you', family);
      table(STATEMENT_PAYMENT_HEAD, family.payments, family);
    }
    if (family.payouts.length > 0) {
      sectionLabel('Handed back to you', family);
      table(STATEMENT_PAYOUT_HEAD, family.payouts, family);
    }

    // ── The door back to a human ────────────────────────────────────────────
    // Its clearance is measured to the FOOTER, not to the table floor — the general floor
    // (maxY) holds sections back conservatively, and applying it here sent a one-line closing
    // onto a page of its own by a fraction of a millimetre.
    const closing = `Questions about a payment or a credit? Talk to your coach — this statement reflects the team’s records as of ${preparedLabel}.`;
    const closingLines: string[] = doc.splitTextToSize(closing, contentWidth);
    if (y + closingLines.length * 4 + 2 > pageHeight - 13) {
      doc.addPage();
      continuationHeader(family);
      y = MARGIN + 11;
    }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 125);
    doc.text(closingLines, MARGIN, y + 2);
  });

  // ── Footers: PER FAMILY, not per file ─────────────────────────────────────
  // Each statement is its own document that happens to share a file with its neighbours in the
  // print run — the Nguyens' page says "Page 1 of 1", never "Page 5 of 12".
  const totalPages = doc.internal.getNumberOfPages();
  const footerY = pageHeight - 8;
  const parts: string[] = [];
  if (settings.footerText) parts.push(settings.footerText);
  if (settings.showDateStamp) parts.push(`Exported: ${tournamentToday()}`);
  if (settings.showBranding) parts.push(BRANDING_TEXT);
  familyPageStart.forEach((start, idx) => {
    const end = idx + 1 < familyPageStart.length ? familyPageStart[idx + 1] - 1 : totalPages;
    for (let p = start; p <= end; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 155);
      if (parts.length > 0) doc.text(parts.join('  ·  '), MARGIN, footerY);
      if (settings.showPageNumbers) {
        doc.text(`Page ${p - start + 1} of ${end - start + 1}`, pageWidth - MARGIN, footerY, { align: 'right' });
      }
    }
  });

  return doc;
}

/** Lazy-loaded download wrapper, same shape as every export entry point here. */
export async function downloadFamilyDuesStatements(filename: string, opts: FamilyDuesStatementsOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = buildFamilyDuesStatementsDoc(jsPDF, autoTable, opts);
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
  /**
   * Jersey number WITHOUT the "#" ('' or absent when the player has none). Printed in its own
   * column (owner, 2026-09-19). It used to be folded into `name` as "#12 Jane Smith", under a
   * column headed "#" whose value was the batting slot — two different numbers sharing one
   * symbol on every row, and no column a coach could run a finger down.
   */
  number?: string;
  /** Display name WITHOUT the number, e.g. "Jane Smith". */
  name: string;
  /** True for a 9-player-mode non-starter (rendered after the order, below the Subs rule). */
  isSub: boolean;
  /**
   * True for a CALL-UP — a player borrowed for this game only (mig 309).
   *
   * ⚠ Printed as the word "(Call-up)" after the name rather than as a tint or a chip, deliberately:
   * this sheet goes on a dugout wall and onto a scorekeeper's clipboard, is very often photocopied
   * or printed in greyscale, and the one question it has to answer without ambiguity is who is on
   * this team. A colour that survives the screen and dies in the photocopier is not an answer.
   */
  isCallUp?: boolean;
  /** inning(string) → position code. '' = blank (prints an empty cell); 'Bench' = sit. */
  inningPositions: Record<string, string>;
}

/** The poster's turn: landscape for the dugout wall, portrait for the clipboard. */
export type LineupPosterOrientation = 'landscape' | 'portrait';

export interface LineupPosterOptions {
  teamName: string;
  opponent?: string | null;
  /** Drives the matchup separator ('away' → "@", everything else → "vs") and the HOME / AWAY
   *  mark on the date line (neutral prints no mark). */
  homeAway?: 'home' | 'away' | 'neutral' | null;
  /** Pre-formatted date/time line, e.g. "Sat, Jun 28, 2026 · 10:00 a.m." */
  dateLabel: string;
  /** Shown on the date line after the HOME / AWAY mark. */
  eventName?: string;
  inningCount: number;
  players: LineupPosterPlayer[];
  legend: { code: string; label: string }[];
  /** When set, the coach's lineup notes print at the foot of the poster (e.g. opponent scouting). */
  includeNotes?: boolean;
  notes?: string | null;
  /**
   * Poster only (the card is always portrait). Defaults to landscape — the shape the poster
   * has always come in — so every existing caller prints what it printed. The lineup screen
   * passes the coach's remembered choice, whose FIRST-TIME default is portrait (owner decision
   * D2, 2026-09-19: most coaches carry a clipboard, and the taller rows are the better pen
   * sheet at seven or nine innings).
   */
  orientation?: LineupPosterOrientation;
  /**
   * The Sport Pack's word for the order — "Batting order" / "Playing order" — which titles the
   * card. Defaults to "Batting order". The poster's own headings are sport-neutral by
   * construction (Order · No. · Player).
   */
  orderLabel?: string;
  /**
   * The RESOLVED identity — crest, whose paper this is, footer, date stamp, accent (D4).
   *
   * ⚠ These two documents took only `accentColor` + `showBranding` until the Posters pass, and
   * so were the only paper in the product carrying no crest and no club name. They were never
   * unbranded by design: the lineups screen already resolves the full identity at export time
   * and simply had nowhere to hand it (owner decision 1, 2026-08-25).
   */
  settings: OrgPdfSettings;
}

/** Matchup separator: away games read "@ Opponent", home/neutral read "vs Opponent". */
function matchupSeparator(homeAway?: 'home' | 'away' | 'neutral' | null): string {
  return homeAway === 'away' ? '@' : 'vs';
}

/**
 * The name as it prints, with the call-up mark when there is one (mig 309). ONE place, so the
 * poster's name column, the card and the subs line can never disagree about whether a borrowed
 * player is identified — the same reason `isCallUp` is one predicate on the screen side.
 */
function posterPlayerName(p: LineupPosterPlayer): string {
  return p.isCallUp ? `${p.name} (${CALL_UP_LABEL})` : p.name;
}

/** "#12 Jane Smith" — the one-string form the card and the subs line still print. */
function posterPlayerLabel(p: LineupPosterPlayer): string {
  const name = posterPlayerName(p);
  return p.number ? `#${p.number} ${name}` : name;
}

// ⚰ `clampNum` was deleted 2026-09-22 with the poster's position legend — it existed only to keep
// that legend's baseline between the grid's bottom and the page margin, and had no other caller.

/** Shorten text to fit a max width in the current font, adding an ellipsis. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitText(doc: any, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** A size ladder from `top` down to `floor`, in half-point steps — the run of sizes a cell or
 *  headline may shrink through before anything is allowed to be cut. */
function sizeLadder(top: number, floor: number): number[] {
  const out: number[] = [];
  for (let s = top; s > floor; s -= 0.5) out.push(s);
  out.push(floor);
  return out;
}

/**
 * A single-line CELL that keeps its whole value where it can: step the type down through
 * `sizes` until the text fits, and only ellipsise once the smallest size still can't hold it.
 * Sets the chosen size on the doc and returns the string to draw.
 *
 * The grid sibling of `fitHeadline` — a table cell can't wrap without moving every row, so it
 * shrinks instead. Without this a long name like "Priya Balasubramanian" printed clipped in a
 * fixed-width column that had two whole sizes of headroom available.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitCell(doc: any, text: string, maxW: number, sizes: number[]): string {
  for (const size of sizes) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxW) return text;
  }
  doc.setFontSize(sizes[sizes.length - 1]);
  return fitText(doc, text, maxW);
}

/**
 * A HEADLINE that never loses a word: step the type down through `sizes`, and only once the
 * smallest size still doesn't fit, wrap onto a second line (owner decision 4, 2026-08-25).
 *
 * ⚠ Truncation is the one behaviour that loses information SILENTLY — the reader cannot tell
 * anything is missing. The poster and the card both used to ellipsis the matchup, so a club
 * with a long name printed "vs Harborview Herons Athleti…" on the one line that IS the page.
 *
 * Returns the chosen size and the lines to draw; the caller owns the leading. Measure and draw
 * share this one source — do not re-derive either half.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fitHeadline(doc: any, text: string, maxW: number, sizes: number[], maxLines = 2): { size: number; lines: string[] } {
  // Only the font SIZE is touched, and every caller re-applies the returned size before
  // drawing — so there is deliberately nothing to save and restore here.
  for (const size of sizes) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxW) return { size, lines: [text] };
  }
  // Smallest size still too wide → wrap it. A single word longer than the column still cannot
  // fit, so the last line is ellipsised rather than bleeding past the margin.
  const size = sizes[sizes.length - 1];
  doc.setFontSize(size);
  const wrapped: string[] = doc.splitTextToSize(text, maxW);
  const lines = wrapped.slice(0, maxLines);
  if (wrapped.length > maxLines) lines[maxLines - 1] = fitText(doc, lines[maxLines - 1], maxW);
  return { size, lines };
}

/** The headline's size ladder — shared by the one-string and the segmented forms. */
const MATCHUP_SIZES = sizeLadder(20, 13);
/** The separator ("vs" / "@") is set at this fraction of the names' size, in the accent. */
const MATCHUP_SEP_RATIO = 0.6;
/** Air either side of the separator, mm. */
const MATCHUP_SEP_GAP = 2.5;

/**
 * The matchup headline both documents lead with — DRAWN IN SEGMENTS: the two names in bold
 * ink, the "vs" / "@" between them smaller and in the accent (owner note 3, 2026-09-19). It
 * used to be one bold string, "Team   vs   Opponent", and the separator read as a third name.
 *
 * Fit follows `fitHeadline`'s rule exactly — shrink through the ladder, and only once the floor
 * still will not fit, wrap; never truncate. When it wraps, the team takes the first line alone
 * and the separator leads the opponent on the next, which may itself run to a second line.
 * Returns the baseline y of the LAST line drawn, so the caller advances from there.
 */
function drawMatchupHeadline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any, team: string, sep: string, opponent: string | null | undefined,
  x: number, y: number, maxW: number, accent: { r: number; g: number; b: number },
): number {
  const ink = () => doc.setTextColor(15, 15, 25);
  const bold = (size: number) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(size); };
  const sepFace = (size: number) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(size * MATCHUP_SEP_RATIO); };
  const drawName = (s: string, size: number, nx: number, ny: number) => { bold(size); ink(); doc.text(s, nx, ny); };
  const drawSep = (size: number, sx: number, sy: number) => {
    sepFace(size); doc.setTextColor(accent.r, accent.g, accent.b); doc.text(sep, sx, sy);
  };

  if (!opponent) {
    bold(MATCHUP_SIZES[0]);
    const head = fitHeadline(doc, team, maxW, MATCHUP_SIZES);
    const lead = head.size * 0.42;
    head.lines.forEach((line, i) => drawName(line, head.size, x, y + i * lead));
    return y + (head.lines.length - 1) * lead;
  }

  for (const size of MATCHUP_SIZES) {
    bold(size);
    const wTeam = doc.getTextWidth(team);
    const wOpp = doc.getTextWidth(opponent);
    sepFace(size);
    const wSep = doc.getTextWidth(sep);
    if (wTeam + MATCHUP_SEP_GAP + wSep + MATCHUP_SEP_GAP + wOpp <= maxW) {
      drawName(team, size, x, y);
      drawSep(size, x + wTeam + MATCHUP_SEP_GAP, y);
      drawName(opponent, size, x + wTeam + MATCHUP_SEP_GAP + wSep + MATCHUP_SEP_GAP, y);
      return y;
    }
  }

  // The floor still doesn't hold it on one line → the team alone, then "vs" leading the
  // opponent, wrapped to at most two lines. Only a single WORD wider than the page can still
  // be cut, and then only its tail.
  const size = MATCHUP_SIZES[MATCHUP_SIZES.length - 1];
  const lead = size * 0.42;
  bold(size);
  drawName(fitText(doc, team, maxW), size, x, y);
  sepFace(size);
  const wSep = doc.getTextWidth(sep);
  const oppX = x + wSep + MATCHUP_SEP_GAP;
  const oppW = maxW - wSep - MATCHUP_SEP_GAP;
  bold(size);
  const wrapped: string[] = doc.splitTextToSize(opponent, oppW);
  const lines = wrapped.slice(0, 2);
  if (wrapped.length > 2) lines[1] = fitText(doc, lines[1], oppW);
  const ly = y + lead;
  drawSep(size, x, ly);
  lines.forEach((line, i) => drawName(line, size, oppX, ly + i * lead));
  return ly + (lines.length - 1) * lead;
}

/**
 * The band the poster and the card open with: the crest, then the matchup headline BESIDE it
 * (owner note 2, 2026-09-19). Returns the baseline of the headline's last line and the x the
 * lines below it should start from.
 *
 * ⚠ THE IDENTITY TEXT LINE IS GONE ON TEAM PAPER, AND THAT IS THE POINT. Team paper always
 * stamps the TEAM'S NAME as its identity line (`applyTeamLook`), and the matchup headline
 * opens with the same words — so every team's poster and card printed its own name twice, 8mm
 * apart, and the club's name nowhere (it is cleared on team paper). The name is drawn ABOVE
 * the headline only when it is genuinely something else — club paper, should either document
 * ever be generated with it — so the helper stays honest about whose paper it is.
 */
function drawMatchupBand(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any, opts: LineupPosterOptions, m: number, top: number, pageW: number,
  accent: { r: number; g: number; b: number },
): { y: number; x: number } {
  const settings = opts.settings;
  const logoW = drawLogoSlot(doc, settings, m, top);
  const x = logoW > 0 ? m + logoW + 4 : m;
  const maxW = pageW - m - x;
  const identity = (settings.headerLine1 ?? '').trim();
  const duplicate = identity.toLowerCase() === opts.teamName.trim().toLowerCase();
  let y = top;
  if (identity && !duplicate) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 100);
    doc.text(fitText(doc, identity, maxW), x, y + 4.5);
    y += 7;
  }
  // With no line above it the headline's baseline sits three-quarters down the crest slot, so
  // a one-line matchup and a 12mm crest read as one band.
  const headY = identity && !duplicate ? y + 6 : y + 9;
  const last = drawMatchupHeadline(doc, opts.teamName, matchupSeparator(opts.homeAway), opts.opponent, x, headY, maxW, accent);
  return { y: Math.max(last, top + LOGO_SLOT_H - 2), x };
}

/**
 * The date line under the headline: the date, then a HOME / AWAY mark, then the event name
 * (owner note 3, 2026-09-19 — the bench wants to know who bats first; a neutral site prints no
 * mark). The mark is a small FILLED pill so it survives a grey photocopy; it is not a pen
 * target and draws nothing a coach writes into.
 */
function drawDateLine(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any, opts: LineupPosterOptions, x: number, y: number, maxW: number,
  accent: { r: number; g: number; b: number }, accentText: number[],
): void {
  const grey = () => { doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(85, 85, 105); };
  const mark = opts.homeAway === 'home' ? 'HOME' : opts.homeAway === 'away' ? 'AWAY' : '';
  const pillW = 13.5;
  let cx = x;
  if (opts.dateLabel) {
    grey();
    // The date gives way before the mark does: it is fitted to the width LEFT after the pill, so
    // a long date can shorten itself but never push HOME / AWAY off the line (/review, 2026-09-20).
    const label = fitText(doc, opts.dateLabel, maxW - (mark ? pillW + 3 : 0));
    doc.text(label, cx, y);
    cx += doc.getTextWidth(label) + 3;
  }
  if (mark && cx + pillW <= x + maxW) {
    const pillH = 4.6;
    doc.setFillColor(accent.r, accent.g, accent.b);
    doc.roundedRect(cx, y - 3.4, pillW, pillH, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(accentText[0], accentText[1], accentText[2]);
    doc.text(mark, cx + pillW / 2, y - 1.1, { align: 'center', baseline: 'middle' });
    cx += pillW + 3;
  }
  if (opts.eventName && cx < x + maxW - 8) {
    grey();
    doc.text(fitText(doc, `·  ${opts.eventName}`, x + maxW - cx), cx, y);
  }
}

/**
 * Build the dugout-wall poster: crest + matchup + date header, an order × innings grid with
 * empty cells for blank innings, and a position legend along the bottom. Landscape for the
 * wall, portrait for the clipboard — ONE document turned, not two (owner decision D1,
 * 2026-09-19); the geometry below reads the page it was given. Returns the jsPDF doc (caller
 * saves it).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildLineupPosterDoc(jsPDFClass: any, opts: LineupPosterOptions): any {
  const orientation: LineupPosterOrientation = opts.orientation ?? 'landscape';
  const portrait = orientation === 'portrait';
  const doc = new jsPDFClass({ orientation, unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = POSTER_MARGIN;
  const settings = opts.settings;
  const accentHex = settings.accentColor || '#1e293b';
  const accent = hexToRgb(accentHex);
  const headText = isDark(accentHex) ? [255, 255, 255] : [20, 20, 30];

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageW, 4, 'F');

  const band = drawMatchupBand(doc, opts, M, 7, pageW, accent);
  let y = band.y + 6.5;
  drawDateLine(doc, opts, band.x, y, pageW - M - band.x, accent, headText);

  y += 3.5;
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
  const gridTop = y + 4;
  // ⚠ Was 18 while the position legend printed here (legend + branding). The legend went on
  // 2026-09-22 and its ~8mm goes to the GRID, which is what a clipboard sheet is for — taller rows
  // to write in. The 10 that remain are the branding strip's, which still prints.
  const legendReserve = 10 + notesReserve; // branding (+ optional notes) below the grid
  const gridBottom = pageH - M - legendReserve;
  const gridArea = gridBottom - gridTop;

  const inningCount = Math.max(1, opts.inningCount); // defensive: UI constrains to 1–12
  // Order · No. · Player. The jersey column is printed only when somebody HAS a number — an
  // empty column would repeat nothing but its own heading — and its width goes back to the
  // name when it is absent. Portrait gives the innings the width the names give up.
  const hasNumbers = opts.players.some(p => p.number);
  const colOrderW = portrait ? 11 : 12;
  const colNoW = hasNumbers ? (portrait ? 10 : 11) : 0;
  const colNameW = (portrait ? 48 : 52) + (hasNumbers ? 0 : (portrait ? 10 : 11));
  const colsW = colOrderW + colNoW + colNameW;
  const innW = (pageW - 2 * M - colsW) / inningCount;
  const totalW = pageW - 2 * M;
  const headerRowH = 10;
  const n = Math.max(1, opts.players.length);
  // ⚠ NO UPPER CAP (owner decision 3): rows take the room the sheet actually has. The old
  // 13mm ceiling meant a nine-player lineup — the ordinary case — stopped two-thirds down and
  // left a third of a DUGOUT POSTER blank, on the one document whose whole job is big type.
  const bodyRowH = Math.max(6, (gridArea - headerRowH) / n);
  const gridEnd = gridTop + headerRowH + bodyRowH * opts.players.length;
  /** Type scales with the row it sits in, so a short lineup reads bigger rather than looser. */
  const scaled = (base: number, max: number) => Math.min(max, base + Math.max(0, bodyRowH - 9) * 0.4);
  // Row-invariant, so built once rather than per player.
  const nameLadder = sizeLadder(scaled(10, 13), 7.5);
  const orderSize = scaled(12, 16);
  const numberSize = scaled(11, 13);
  // …and the position codes no wider than the cell they sit in: at twelve innings on a portrait
  // page an inning is ~10mm, and a row-scaled 14pt "CF" filled one edge to edge (seen on the
  // rendered sheet, 2026-09-20). Measured against the widest code the sheet can print.
  const codes = [...opts.legend.map(l => l.code), 'BN'];
  const widestCode = (size: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(size);
    return Math.max(...codes.map(c => doc.getTextWidth(c)));
  };
  let positionSize = scaled(11, 14);
  while (positionSize > 9 && widestCode(positionSize) > innW - 3) positionSize -= 0.5;

  const colNoX = M + colOrderW;
  const colNameX = colNoX + colNoW;
  const innX = (i: number) => M + colsW + innW * i; // left of inning i (0-based)

  // ── Header row ────────────────────────────────────────────────────────────
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(M, gridTop, totalW, headerRowH, 'F');
  doc.setTextColor(headText[0], headText[1], headText[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const hMid = gridTop + headerRowH / 2;
  doc.text('Order', M + colOrderW / 2, hMid, { align: 'center', baseline: 'middle' });
  if (hasNumbers) doc.text('No.', colNoX + colNoW / 2, hMid, { align: 'center', baseline: 'middle' });
  doc.text('Player', colNameX + 3, hMid, { align: 'left', baseline: 'middle' });
  // The numerals a coach scans across to find "inning 4" — at least as large as the positions
  // they head (owner note 4). They were 9.5pt over 12–14pt cells: the smallest type on the grid.
  doc.setFontSize(positionSize);
  for (let i = 0; i < inningCount; i++) {
    doc.text(String(i + 1), innX(i) + innW / 2, hMid, { align: 'center', baseline: 'middle' });
  }

  // ── Body: zebra fills + text ──────────────────────────────────────────────
  const firstSub = opts.players.findIndex(p => p.isSub);
  opts.players.forEach((p, k) => {
    const top = gridTop + headerRowH + k * bodyRowH;
    const mid = top + bodyRowH / 2;
    if (k % 2 === 1) {
      // ~6% grey. The old 3% (247) printed as white on most office lasers, so the striping a
      // wide grid relies on vanished on paper (owner note 5). Neutral, never a tint of the
      // accent: colour under a pencilled "SS" reads as a correction.
      doc.setFillColor(242, 242, 246);
      doc.rect(M, top, totalW, bodyRowH, 'F');
    }
    // batting number — or, on the first row below the rule, the word for the section
    if (p.battingOrder) {
      doc.setTextColor(20, 20, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(orderSize);
      doc.text(p.battingOrder, M + colOrderW / 2, mid, { align: 'center', baseline: 'middle' });
    } else if (k === firstSub) {
      doc.setTextColor(110, 110, 132);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('Subs', M + colOrderW / 2, mid, { align: 'center', baseline: 'middle' });
    }
    // jersey number — its own column, a shade quieter than the order
    if (hasNumbers && p.number) {
      doc.setTextColor(70, 70, 90);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(numberSize);
      doc.text(p.number, colNoX + colNoW / 2, mid, { align: 'center', baseline: 'middle' });
    }
    // name — shrinks through two steps before it will ever clip a kid's name
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 30);
    const drawn = fitCell(doc, posterPlayerName(p), colNameW - 5, nameLadder);
    doc.text(drawn, colNameX + 3, mid, { align: 'left', baseline: 'middle' });
    // innings — Bench → "BN"; an unassigned inning is left EMPTY, because the ruled grid cell
    // is already the box.
    //
    // ⚠⚠ DO NOT DRAW A BOX IN HERE. It was tried and rejected on sight (owner, 2026-08-26).
    // The working-sheets rule — "a column somebody fills in by hand gets a real drawn box" —
    // was written for the tryout check-in sheet, whose tick column had NO cell borders at all,
    // so a volunteer had nothing to aim at. This grid is the opposite: thick outer rule, a line
    // between every row and every inning. An inner rectangle there is a box inside a box, and
    // it makes the writable area SMALLER than the cell — a coach pencilling "SS" at the field
    // either squeezes inside it or crosses its edge, and both look like a mistake. The rule
    // applies where a cell has no edges, not wherever something is written by hand.
    for (let i = 0; i < inningCount; i++) {
      const raw = p.inningPositions[String(i + 1)] || '';
      if (!raw) continue;
      const benched = raw === POSTER_BENCH;
      doc.setFont('helvetica', benched ? 'normal' : 'bold');
      doc.setFontSize(positionSize);
      doc.setTextColor(benched ? 140 : 25, benched ? 140 : 25, benched ? 158 : 35);
      doc.text(benched ? 'BN' : raw, innX(i) + innW / 2, mid, { align: 'center', baseline: 'middle' });
    }
  });

  // ── Grid lines (drawn over fills/text; thin enough not to obscure) ─────────
  doc.setDrawColor(30, 30, 40);
  // horizontal: top, header/body split, each body row, bottom — and a HEAVY rule above the
  // first sub (9-player mode), the same separation the card makes at its foot (owner note 6).
  const hLines: number[] = [gridTop, gridTop + headerRowH];
  for (let k = 1; k <= opts.players.length; k++) hLines.push(gridTop + headerRowH + k * bodyRowH);
  hLines.forEach((ly, idx) => {
    const heavy = idx === 0 || idx === hLines.length - 1 || (firstSub > 0 && idx === firstSub + 1);
    doc.setLineWidth(heavy ? 0.8 : 0.3);
    doc.line(M, ly, M + totalW, ly);
  });
  // vertical: outer + structural separators (after Order, after No., after Player) + inning dividers
  for (let i = 0; i <= inningCount; i++) {
    const vx = innX(i);
    doc.setLineWidth(i === inningCount ? 0.8 : 0.3);
    doc.line(vx, gridTop, vx, gridEnd);
  }
  doc.setLineWidth(0.8); doc.line(M, gridTop, M, gridEnd);              // left edge
  doc.setLineWidth(0.6); doc.line(colNoX, gridTop, colNoX, gridEnd);    // after Order
  if (hasNumbers) doc.line(colNameX, gridTop, colNameX, gridEnd);       // after No.

  // ⚰ THE POSITION LEGEND AND ITS "Blank = fill in at the field" LINE WERE REMOVED 2026-09-22
  // (owner: "let's remove this description from the bottom of the printout").
  //
  // It spelled out "P Pitcher  C Catcher  1B First base …" across the foot of every poster, for an
  // audience that has never needed it: the people who read this sheet are a coach and a scorekeeper
  // at a diamond, and the codes it defined are the ones they use out loud. The two lines cost
  // roughly 8mm at the bottom of the page, which the GRID now takes instead — the taller rows are
  // the whole point of a clipboard sheet.
  //
  // ⚠ `opts.legend` is still in `LineupPosterOptions` and still supplied: `abbreviateHeadings`
  // builds the same shape for the roster and tryout exports, where a legend IS earned because the
  // codes there are column headings a parent may never have seen. Do not "tidy up" the field.

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

  // A real footer at last: the club's own line, the date stamp, and the branding — the same
  // three parts, in the same order, as every other document (this was the one page in the
  // product whose footer held nothing but "Generated by FieldLogicHQ").
  drawPosterFooter(doc, settings, M, pageW, pageH);

  return doc;
}

/**
 * The poster/card footer. Mirrors `stampFooters`' parts and order, but drawn once and
 * left-aligned: these are single-page documents with no page numbers to stamp.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPosterFooter(doc: any, settings: OrgPdfSettings, m: number, pageW: number, pageH: number): void {
  const parts = footerParts(settings);
  if (!parts.length) return;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 165);
  doc.text(fitText(doc, parts.join('  ·  '), pageW - 2 * m), m, pageH - 5);
}

/**
 * Build the stripped batting-order card (portrait): crest + matchup + date and a large-type
 * order for the scorekeeper / dugout. Subs listed at the foot. ⚠ ONE FULL PAGE by owner
 * ruling (decision 6, 2026-08-25) — do not re-open the page-shape question on the way past.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildBattingOrderCardDoc(jsPDFClass: any, opts: LineupPosterOptions): any {
  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 18;
  const settings = opts.settings;
  const accentHex = settings.accentColor || '#1e293b';
  const accent = hexToRgb(accentHex);
  const headText = isDark(accentHex) ? [255, 255, 255] : [20, 20, 30];

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, pageW, 5, 'F');

  // Whose paper this is — a card is handed to an UMPIRE and to the opposing coach, so it is
  // the more public of the two. The crest sits beside the matchup, the same band as the poster.
  const band = drawMatchupBand(doc, opts, M, 10, pageW, accent);
  let y = band.y + 6.5;
  drawDateLine(doc, opts, band.x, y, pageW - M - band.x, accent, headText);

  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(accent.r, accent.g, accent.b);
  // The Sport Pack's own word — "BATTING ORDER" for a diamond, "PLAYING ORDER" for a court
  // (owner note 9). It was hard-coded to the diamond for every sport.
  doc.text((opts.orderLabel || 'Batting order').toUpperCase(), M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 160);
  doc.text('POS', pageW - M, y, { align: 'right' });
  y += 3.5;
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(0.6);
  doc.line(M, y, pageW - M, y);

  const batters = opts.players.filter(p => p.battingOrder);
  const subs = opts.players.filter(p => p.isSub || !p.battingOrder);

  const listTop = y + 5;
  const listBottom = pageH - M - (subs.length ? 20 : 8);
  // ⚠ NO UPPER CAP (owner decision 3, option A): the order fills the page it was given. The
  // old 18mm ceiling is why twelve names left a third of a letter sheet blank and nine left
  // nearly half — on a document the coach hands somebody.
  const rowH = Math.max(9, (listBottom - listTop) / Math.max(1, batters.length));
  const numW = 14;
  const posW = 20;

  batters.forEach((p, k) => {
    const top = listTop + k * rowH;
    const mid = top + rowH / 2;
    if (k % 2 === 1) {
      doc.setFillColor(242, 242, 246);
      doc.rect(M, top, pageW - 2 * M, rowH, 'F');
    }
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(p.battingOrder, M + 4, mid, { align: 'left', baseline: 'middle' });
    doc.setTextColor(20, 20, 30);
    doc.text(fitCell(doc, posterPlayerLabel(p), pageW - 2 * M - numW - posW - 6, sizeLadder(15, 9)), M + numW, mid, { align: 'left', baseline: 'middle' });
    // Where they START (owner decision 2, option A) — the umpire's copy names the position,
    // which is the one fact the old card omitted entirely. Read from the first inning; a
    // lineup that hasn't assigned one yet simply leaves it blank rather than inventing one.
    const start = p.inningPositions['1'] || '';
    if (start) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(105, 105, 125);
      doc.text(start === POSTER_BENCH ? 'BN' : start, pageW - M - 3, mid, { align: 'right', baseline: 'middle' });
    }
    doc.setDrawColor(225, 225, 232);
    doc.setLineWidth(0.2);
    doc.line(M, top + rowH, pageW - M, top + rowH);
  });

  if (subs.length) {
    const sy = pageH - M - 13;
    doc.setDrawColor(accent.r, accent.g, accent.b);
    doc.setLineWidth(0.4);
    doc.line(M, sy, pageW - M, sy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 110);
    doc.text('Subs', M, sy + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 55);
    doc.text(fitText(doc, subs.map(posterPlayerLabel).join(',  '), pageW - 2 * M - 18), M + 16, sy + 6);
  }

  drawPosterFooter(doc, settings, M, pageW, pageH);

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
