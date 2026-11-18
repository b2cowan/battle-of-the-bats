/**
 * lib/export/rules-pdf.ts — THE PRINTABLE RULES (Public tournament pages Stage 10).
 *
 * A visitor's copy of the public Rules page, letter size, in the PDF kit's own header and footer: the 8 mm bar in the look's
 * colour, the event's band, a stamp box (when the copy was made, the page's "subject to change" sentence, the live address
 * and a QR code back to it), then each section the page is showing, numbered as the page numbers it, then the downloads.
 * The drawing is the spec: `docs/projects/active/PUBLIC_TOURNAMENT_STAGE10_RULES_PDF_DRAWINGS.html`, asks A1–A12 ruled
 * 2026-11-18. WHAT prints is `lib/public-rules-shape.ts` (the page reads the same function); this file only draws it.
 *
 * Made on the SERVER, at the page's own address (`app/[orgSlug]/[tournamentSlug]/rules/pdf/route.ts`), which hands in the
 * look and the QR. `downloadRulesPdf` is the browser-shaped entry the PDF check renders through (every drawn document has
 * one); the product itself calls `buildRulesPdfDoc`.
 *
 * Paging (the drawing's rules): a point never splits unless it alone is longer than a page; a section that splits keeps at
 * least two points on each side, or moves whole; a heading never ends a page; every later page carries the compact
 * continuation band, and a continued section repeats its title with "(continued)" and no icon.
 */
import { MARGIN, RUN_HAIRLINE, RUN_INK, drawIdentityBand, hexToRgb, stampFooters, type OrgPdfSettings } from './pdf';
import { contrastRatio } from '../color-contrast';
import { CLUB_NEAR_BLACK } from '../club-colour-roles';
import { formatOrgShortWeekdayDay, utcToZonedInputs } from '../timezone';
import { formatTime } from '../utils';
import { RULES_SUBJECT_TO_CHANGE, type PublicRulesSection } from '../public-rules-shape';

/** The page's fixed note, word for word (A3) — it lives with the page's shape, so the page reads it without this kit. */
export { RULES_SUBJECT_TO_CHANGE };
/** A7: an uploaded file cannot be printed; the reader is sent to it. */
export const RULES_FILE_ON_PAGE = 'A file on the Rules page. Scan the code on page 1 to open it.';
const RULES_FILE_ON_PAGE_NO_CODE = 'A file on the Rules page.';
export const RULES_DOWNLOADS_HEADING = 'Downloads & Resources';

export interface RulesPdfResource {
  label: string;
  url: string;
  /** An upload to our own storage (it prints the sentence, not an address). */
  isFile: boolean;
}

export interface RulesPdfOptions {
  eventName: string;
  /** "Nov 21–23, 2026", as the band spells it; null when the event has no dates. */
  dates: string | null;
  /** "Riverdale Minor Ball" when the frame says "Hosted by" (only then — the frame's one rule), else null. */
  hostedBy: string | null;
  /** The division the page is narrowed to (A1), or null for the whole book. */
  narrowedTo: string | null;
  sections: PublicRulesSection[];
  resources: RulesPdfResource[];
  /** The download's moment, an ISO instant (A3: "Rules as of Wed, Nov 18, 2026, 3:12 p.m." on the org clock). */
  stampedAt: string;
  /** The Rules page's live address as printed, without the scheme ("www.fieldlogichq.ca/club/event/rules"). */
  liveAddress: string;
  /** A PNG data URL of the QR to the Rules page with `?view=all` (A4), or null when it could not be made. */
  qrDataUrl: string | null;
  /**
   * The look and the footer: `accentColor` is the bar's colour (the band's fill), `logoDataUrl` the event's logo (none on a
   * plan without tournament branding), and the footer switches. The name lines are this file's own.
   */
  settings: OrgPdfSettings;
}

const PT = 0.3528; // mm per point
const INK: [number, number, number] = [17, 17, 17]; // #111111 — every rule prints black (A5)
const NUMBER_INK: [number, number, number] = [68, 68, 68]; // #444444
const STAMP_INK: [number, number, number] = [34, 34, 34]; // #222222
const STAMP_EDGE: [number, number, number] = [184, 184, 184]; // #B8B8B8
const LABEL_INK: [number, number, number] = [51, 51, 51]; // #333333
const LABEL_EDGE: [number, number, number] = [136, 136, 136]; // #888888
const SUB_INK: [number, number, number] = [80, 80, 100]; // the band's line-2 grey

const HEAD_PT = 12;
const HEAD_LH = HEAD_PT * 1.2 * PT;
const POINT_PT = 10;
const POINT_LH = POINT_PT * 1.45 * PT;
const POINT_GAP = 1;
const STAMP_PT = 8.5;
const STAMP_LH = STAMP_PT * 1.45 * PT;
const ICON = 4.2;
const ICON_GAP = 2.1;
const QR = 22;
const BULLET_COL = 5.8;

type Rgb = [number, number, number];
const rgbOf = (hex: string): Rgb => { const { r, g, b } = hexToRgb(hex); return [r, g, b]; };

/** A5: the headings wear the look's colour unless it is under 4.5 : 1 on white, when they print in ink. The bar keeps it. */
export function rulesHeadingColour(colour: string): string {
  const hex = /^#[0-9A-Fa-f]{6}$/.test(colour) ? colour : CLUB_NEAR_BLACK;
  return contrastRatio(hex, '#FFFFFF') >= 4.5 ? hex : CLUB_NEAR_BLACK;
}

/** "Tournament rules · Nov 21–23, 2026 · Hosted by Riverdale Minor Ball"; narrowed, "U11 rules · …" (A1). */
export function rulesBandLine(opts: Pick<RulesPdfOptions, 'dates' | 'hostedBy' | 'narrowedTo'>): string {
  return [
    opts.narrowedTo ? `${opts.narrowedTo} rules` : 'Tournament rules',
    opts.dates,
    opts.hostedBy ? `Hosted by ${opts.hostedBy}` : null,
  ].filter(Boolean).join(' · ');
}

/** "Rules as of Wed, Nov 18, 2026, 3:12 p.m." — the org's clock, the house time spelling. */
export function rulesStampLine(iso: string): string {
  return `Rules as of ${formatOrgShortWeekdayDay(iso)}, ${formatTime(utcToZonedInputs(iso).time)}`;
}

/** "{Event} rules.pdf", with only the characters a file name cannot hold taken out. */
export function rulesPdfFilename(eventName: string): string {
  const clean = eventName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return `${clean || 'Tournament'} rules.pdf`;
}

/** A link prints its address under its name, without the scheme (A7); a placeholder `#` prints nothing. */
function printedAddress(url: string): string | null {
  const t = url.trim();
  if (!t || t === '#') return null;
  return t.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

// ── The six section icons and the downloads' file, drawn as outlines in the heading colour (4.2 mm). The page draws
//    them from lucide (`lib/rule-icons.ts`); the names are that list's. Unknown or unset is the Shield, as on the page. ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawIcon(doc: any, name: string | null, x: number, top: number, rgb: Rgb): void {
  doc.setDrawColor(...rgb); doc.setFillColor(...rgb); doc.setLineWidth(0.32);
  const s = ICON / 24; // lucide's 24-unit box
  const P = (px: number, py: number): [number, number] => [x + px * s, top + py * s];
  const poly = (pts: [number, number][], close = false) => {
    for (let i = 0; i < pts.length - 1; i++) doc.line(...P(...pts[i]), ...P(...pts[i + 1]));
    if (close) doc.line(...P(...pts[pts.length - 1]), ...P(...pts[0]));
  };
  const circle = () => doc.circle(...P(12, 12), 10 * s, 'S');
  const dot = (px: number, py: number) => doc.circle(...P(px, py), 0.9 * s, 'F');
  switch (name) {
    case 'BookOpen':
      poly([[12, 7], [12, 21]]);
      poly([[12, 7], [7, 3.5], [2, 3.5], [2, 18], [7, 18], [12, 21]]);
      poly([[12, 7], [17, 3.5], [22, 3.5], [22, 18], [17, 18], [12, 21]]);
      return;
    case 'AlertCircle': circle(); poly([[12, 7.5], [12, 13]]); dot(12, 16.5); return;
    case 'CheckCircle': circle(); poly([[7.5, 12.5], [10.5, 15.5], [16.5, 9]]); return;
    case 'Info': circle(); poly([[12, 11], [12, 17]]); dot(12, 7.5); return;
    case 'HelpCircle':
      circle();
      poly([[9, 9.5], [10, 7.5], [12, 7], [14, 7.5], [15, 9.5], [14, 11], [12, 12], [12, 13.5]]);
      dot(12, 17);
      return;
    case 'FileText':
      poly([[14, 2], [6, 2], [4, 4], [4, 20], [6, 22], [18, 22], [20, 20], [20, 8], [14, 2]]);
      poly([[14, 2], [14, 8], [20, 8]]);
      poly([[8, 13], [16, 13]]); poly([[8, 17], [16, 17]]);
      return;
    default: // Shield
      poly([[12, 2], [20, 5], [20, 11], [18.5, 16], [12, 22], [5.5, 16], [4, 11], [4, 5]], true);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildRulesPdfDoc(jsPDFClass: any, opts: RulesPdfOptions): any {
  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const maxY = pageHeight - 18; // the house footer sits at height − 8; the PDF check holds 3 mm clear of it
  const settings: OrgPdfSettings = { ...opts.settings, headerLine1: opts.eventName, headerLine2: rulesBandLine(opts) };
  const barRgb = rgbOf(/^#[0-9A-Fa-f]{6}$/.test(settings.accentColor) ? settings.accentColor : CLUB_NEAR_BLACK);
  const headRgb = rgbOf(rulesHeadingColour(settings.accentColor));
  const continuedWord = opts.narrowedTo ? `${opts.narrowedTo} rules (continued)` : 'Tournament rules (continued)';
  let y = 0;

  const bar = () => { doc.setFillColor(...barRgb); doc.rect(0, 0, pageWidth, 8, 'F'); };

  // ── The continuation band: the bar, the name left, "Tournament rules (continued)" right, the hairline. ──
  const cy = MARGIN + 4;
  const continuationTop = cy + 1.85 + 6.5;
  function continuationBand(): void {
    bar();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const rightW = doc.getTextWidth(continuedWord);
    doc.setTextColor(...SUB_INK);
    doc.text(continuedWord, pageWidth - MARGIN, cy, { align: 'right' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RUN_INK);
    const room = contentWidth - rightW - 6;
    let name = opts.eventName;
    if (doc.getTextWidth(name) > room) {
      while (name.length > 1 && doc.getTextWidth(`${name}…`) > room) name = name.slice(0, -1).trimEnd();
      name = `${name}…`;
    }
    doc.text(name, MARGIN, cy);
    doc.setDrawColor(...RUN_HAIRLINE); doc.setLineWidth(0.3);
    doc.line(MARGIN, cy + 1.85, pageWidth - MARGIN, cy + 1.85);
  }
  const newPage = () => { doc.addPage(); continuationBand(); y = continuationTop; };
  const pageIsFresh = () => y <= continuationTop + 0.01;

  // ── Page one: the bar, the band, the stamp box with its code. ──
  bar();
  y = drawIdentityBand(doc, settings, opts.eventName, MARGIN) + 3.2;
  {
    const boxX = MARGIN;
    const padY = 2.6;
    const padX = 3.2;
    const hasQr = !!opts.qrDataUrl;
    const textX = boxX + padX + (hasQr ? QR + 4.2 : 0);
    const textW = contentWidth - (textX - boxX) - padX;
    // Measure first, so the box is drawn once at its true height.
    doc.setFont('helvetica', 'normal'); doc.setFontSize(STAMP_PT);
    const sentence: string[] = doc.splitTextToSize(RULES_SUBJECT_TO_CHANGE, textW);
    const lead = 'The current rules are always at';
    const tail = hasQr ? ', or scan the code.' : '.';
    const tailW = doc.getTextWidth(tail);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const addressLines: string[] = doc.splitTextToSize(opts.liveAddress, textW);
    const lastW = doc.getTextWidth(addressLines[addressLines.length - 1] ?? '');
    // A hair of space after the bold address: the reader measures a bold run a little wider than jsPDF does.
    const TAIL_GAP = 0.6;
    const tailOwnLine = lastW + TAIL_GAP + tailW > textW;
    const lineCount = 1 + sentence.length + 1 + addressLines.length + (tailOwnLine ? 1 : 0);
    const textH = lineCount * STAMP_LH;
    const boxH = Math.max(hasQr ? QR : 0, textH) + padY * 2;
    doc.setDrawColor(...STAMP_EDGE); doc.setLineWidth(0.26);
    doc.roundedRect(boxX, y, contentWidth, boxH, 0.8, 0.8, 'S');
    if (hasQr) {
      try { doc.addImage(opts.qrDataUrl, 'PNG', boxX + padX, y + (boxH - QR) / 2, QR, QR); } catch { /* no code, never no file */ }
    }
    // The first baseline sits a cap's height below the padding; the text block is centred when the code is taller.
    let ty = y + padY + (boxH - padY * 2 - textH) / 2 + STAMP_LH * 0.72;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...STAMP_INK);
    doc.text(rulesStampLine(opts.stampedAt), textX, ty); ty += STAMP_LH;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(STAMP_PT);
    for (const l of sentence) { doc.text(l, textX, ty); ty += STAMP_LH; }
    doc.text(lead, textX, ty); ty += STAMP_LH;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    addressLines.forEach((l, i) => {
      doc.text(l, textX, ty);
      if (i === addressLines.length - 1 && !tailOwnLine) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(STAMP_PT);
        doc.text(tail, textX + lastW + TAIL_GAP, ty);
      }
      if (i < addressLines.length - 1) ty += STAMP_LH;
    });
    if (tailOwnLine) { ty += STAMP_LH; doc.setFont('helvetica', 'normal'); doc.setFontSize(STAMP_PT); doc.text(tail.replace(/^, /, ''), textX, ty); }
    y += boxH;
  }

  // ── The number column: as wide as the widest point number in the file ("12.10"), plus its gap. ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(POINT_PT);
  let numW = 0;
  for (const s of opts.sections) for (let i = 0; i < s.items.length; i++) numW = Math.max(numW, doc.getTextWidth(`${s.number}.${i + 1}`));
  const numCol = Math.max(numW + 3.2, 8);
  const textX = MARGIN + numCol;
  const textW = contentWidth - numCol;

  // A point's lines: its own line breaks kept, each paragraph wrapped under the text, never under the number.
  doc.setFont('helvetica', 'normal'); doc.setFontSize(POINT_PT);
  const linesOf = (text: string): string[] =>
    text.split(/\r?\n/).flatMap(p => (p.trim() ? doc.splitTextToSize(p, textW) as string[] : ['']));
  const pointH = (lines: string[]) => lines.length * POINT_LH + POINT_GAP;

  // ── A heading: icon (first page of a section only), "3  Pitching limits", the division label (A9). ──
  const headX = MARGIN + ICON + ICON_GAP;
  const headW = contentWidth - ICON - ICON_GAP;
  function headLines(text: string): string[] {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(HEAD_PT);
    return doc.splitTextToSize(text, headW);
  }
  const LABEL_PT = 8;
  function labelW(label: string): number {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(LABEL_PT);
    return doc.getTextWidth(label) + 2.6;
  }
  /** The heading's height including 4.5 mm above and 1.6 mm below; a label that cannot sit beside the title takes a line. */
  function headHeight(text: string, label: string | null): number {
    const lines = headLines(text);
    let h = lines.length * HEAD_LH;
    if (label) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(HEAD_PT);
      const last = doc.getTextWidth(lines[lines.length - 1]);
      if (last + 3.2 + labelW(label) > headW) h += HEAD_LH;
    }
    return 4.5 + h + 1.6;
  }
  function drawHead(text: string, icon: string | null | false, label: string | null): void {
    const lines = headLines(text);
    const top = y + 4.5;
    if (icon !== false) drawIcon(doc, icon, MARGIN, top + (HEAD_LH - ICON) / 2, headRgb);
    let by = top + HEAD_LH * 0.78;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(HEAD_PT); doc.setTextColor(...headRgb);
    lines.forEach((l, i) => { doc.text(l, headX, by); if (i < lines.length - 1) by += HEAD_LH; });
    if (label) {
      const last = doc.getTextWidth(lines[lines.length - 1]);
      const w = labelW(label);
      let lx = headX + last + 3.2;
      if (lx + w > headX + headW) { lx = headX; by += HEAD_LH; }
      doc.setDrawColor(...LABEL_EDGE); doc.setLineWidth(0.26);
      doc.roundedRect(lx, by - LABEL_PT * PT * 0.95, w, LABEL_PT * PT * 1.25, 0.5, 0.5, 'S');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(LABEL_PT); doc.setTextColor(...LABEL_INK);
      doc.text(label, lx + 1.3, by - 0.35);
    }
    y += headHeight(text, label);
  }

  /** One numbered point. Only a point longer than a whole page ever crosses one (it continues on the next, line by line). */
  function drawPoint(number: string, lines: string[]): void {
    let by = y + POINT_LH * 0.75;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(POINT_PT); doc.setTextColor(...NUMBER_INK);
    doc.text(number, MARGIN, by);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK);
    for (const l of lines) {
      if (by > maxY) {
        newPage();
        by = y + POINT_LH * 0.75;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(POINT_PT); doc.setTextColor(...INK);
      }
      if (l) doc.text(l, textX, by);
      by += POINT_LH;
    }
    y = by - POINT_LH * 0.75 + POINT_GAP;
  }

  // ── Each section, paged by the drawing's rules. A continuation always starts on a fresh page. ──
  for (const s of opts.sections) {
    const title = `${s.number}  ${s.title}`;
    const points = s.items.map((text, n) => ({ number: `${s.number}.${n + 1}`, lines: linesOf(text) }));
    let i = 0;
    let continued = false;
    const head = () => drawHead(continued ? `${title} (continued)` : title, continued ? false : s.icon, continued ? null : s.divisionLabel);
    const run = (count: number) => { head(); for (let n = 0; n < count; n++) drawPoint(points[i + n].number, points[i + n].lines); i += count; };
    for (;;) {
      const hH = headHeight(continued ? `${title} (continued)` : title, continued ? null : s.divisionLabel);
      const left = points.length - i;
      if (left === 0) {
        // A section with no points: its heading still never ends a page.
        if (y + hH + POINT_LH > maxY && !pageIsFresh()) newPage();
        head();
        break;
      }
      // How many whole points fit under the heading on this page.
      let room = maxY - y - hH + POINT_GAP;
      let k = 0;
      while (k < left && pointH(points[i + k].lines) <= room) { room -= pointH(points[i + k].lines); k++; }
      if (k >= left) { run(left); break; }
      if (!pageIsFresh()) {
        // Split here only with two points on each side; otherwise the section moves to a fresh page and is tried again.
        const here = Math.min(k, left - 2);
        if (here >= 2) { run(here); newPage(); continued = true; continue; }
        newPage();
        continue;
      }
      if (k === 0) {
        // A fresh page, and the next point alone is longer than a page: the one point that splits.
        run(1);
      } else {
        // A fresh page, and the rest is longer than it: fill it, leaving two for the next page where that is possible.
        run(left - k >= 2 ? k : Math.max(1, left - 2));
      }
      if (i >= points.length) break;
      newPage();
      continued = true;
    }
  }

  // ── Downloads, last, never narrowed (A7). Each kept whole; the heading kept with the first. ──
  if (opts.resources.length) {
    const rows = opts.resources.map(r => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(POINT_PT);
      const name: string[] = doc.splitTextToSize(r.label, contentWidth - BULLET_COL);
      const under = r.isFile ? (opts.qrDataUrl ? RULES_FILE_ON_PAGE : RULES_FILE_ON_PAGE_NO_CODE) : printedAddress(r.url);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(STAMP_PT);
      const sub: string[] = under ? doc.splitTextToSize(under, contentWidth - BULLET_COL) : [];
      return { name, sub, h: name.length * POINT_LH + sub.length * STAMP_LH + POINT_GAP * 1.5 };
    });
    const hH = headHeight(RULES_DOWNLOADS_HEADING, null);
    if (y + hH + rows[0].h > maxY) newPage();
    drawHead(RULES_DOWNLOADS_HEADING, 'FileText', null);
    for (const row of rows) {
      if (y + row.h > maxY && !pageIsFresh()) newPage();
      let by = y + POINT_LH * 0.75;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(POINT_PT); doc.setTextColor(...NUMBER_INK);
      doc.text('•', MARGIN + 1, by);
      doc.setTextColor(...INK);
      row.name.forEach((l, n) => { doc.text(l, MARGIN + BULLET_COL, by); if (n < row.name.length - 1) by += POINT_LH; });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(STAMP_PT); doc.setTextColor(...NUMBER_INK);
      for (const l of row.sub) { by += STAMP_LH; doc.text(l, MARGIN + BULLET_COL, by); }
      y += row.h;
    }
  }

  stampFooters(doc, settings);
  return doc;
}

/** The browser-shaped entry, the same as every document in the kit (the PDF check renders through it). */
export async function downloadRulesPdf(filename: string, opts: RulesPdfOptions): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  buildRulesPdfDoc(jsPDF, opts).save(filename);
}
