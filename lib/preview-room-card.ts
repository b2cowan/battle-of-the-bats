/**
 * lib/preview-room-card.ts — the room card (Club Website Track P, Session P3; owner ruling T7; drawing tab 4B): the card
 * left on the table, half a letter page (5.5 × 8.5 in), with the club's colours across the top, the QR code, the claim
 * code and the preview's foot line. It is the only place the claim code is written down outside the owner's own window.
 *
 * ⚠ Deliberately OUTSIDE `lib/export/` and its rendered check (`npm run check:pdf`): that engine and its check are for the
 * documents a CUSTOMER prints, on their paper settings, with the product's identity band and footer. This is an
 * owner-only staff card with its own fixed face and no customer settings. Pure (no browser globals) so a test can build it
 * with jsPDF in node; the window passes the QR and the logo as data URLs.
 */
import { CARD_WORDS, formatClaimCode, previewAddress } from './preview-claim';

export type RoomCardInput = {
  clubName: string;
  slug: string;
  tagline: string | null;
  code: string;
  removalDate: string;
  primary: string | null;
  accent: string | null;
  /** PNG data URL of the QR (medium error correction, a wide quiet border, drawn by the window). */
  qrDataUrl: string | null;
  /** The club's logo as a data URL, or null (its initials are drawn instead). */
  logoDataUrl: string | null;
};

/** Half a letter page, portrait, in inches. */
export const ROOM_CARD_SIZE = { width: 5.5, height: 8.5 } as const;

const HEX = /^#([0-9a-f]{6})$/i;
function rgb(hex: string | null | undefined, fallback: [number, number, number]): [number, number, number] {
  const m = hex ? HEX.exec(hex) : null;
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** White or near-black text, whichever reads on the band. */
function inkOn([r, g, b]: [number, number, number]): [number, number, number] {
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? [22, 24, 29] : [255, 255, 255];
}
function initials(name: string): string {
  return name.split(/\s+/).filter(w => /^[A-Za-z]/.test(w)).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '•';
}
/** jsPDF's Helvetica is single-byte (see lib/export/rules-pdf.ts): typographic quotes and dashes map to it, the rest drop. */
function latin(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/** A web address broken where it reads (after "/" and each "-"), never past the column (/design M5: a 60-character
 *  address otherwise runs off the card, and splitTextToSize only breaks at spaces). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsPDF's doc
function addressLines(doc: any, address: string, width: number, size: number): string[] {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(size);
  const pieces = address.split(/(?<=[/-])/);
  const lines: string[] = [];
  let line = '';
  for (const piece of pieces) {
    if (line && doc.getTextWidth(line + piece) > width) { lines.push(line); line = piece; }
    else line += piece;
  }
  if (line) lines.push(line);
  return lines;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- jsPDF's class, passed in so node and the browser share one builder
export function buildRoomCardDoc(jsPDFClass: any, input: RoomCardInput): any {
  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'in', format: [ROOM_CARD_SIZE.width, ROOM_CARD_SIZE.height] });
  const W = ROOM_CARD_SIZE.width;
  const M = 0.45;
  const band = rgb(input.primary, [22, 40, 77]);
  const rule = rgb(input.accent, [214, 170, 60]);
  const ink = inkOn(band);

  // ── The header band in the club's colours, with a rule in its second colour ──
  const bandH = 1.35;
  doc.setFillColor(...band);
  doc.rect(0, 0, W, bandH, 'F');
  doc.setFillColor(...rule);
  doc.rect(0, bandH, W, 0.06, 'F');

  const tile = 0.62;
  const tileY = (bandH - tile) / 2;
  let drewLogo = false;
  if (input.logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(M, tileY, tile, tile, 0.08, 0.08, 'F');
      const kind = input.logoDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : input.logoDataUrl.startsWith('data:image/webp') ? 'WEBP' : 'PNG';
      const props = doc.getImageProperties(input.logoDataUrl);
      const box = tile - 0.08;
      const scale = Math.min(box / props.width, box / props.height);
      const lw = props.width * scale, lh = props.height * scale;
      doc.addImage(input.logoDataUrl, kind, M + 0.04 + (box - lw) / 2, tileY + 0.04 + (box - lh) / 2, lw, lh, undefined, 'FAST');
      drewLogo = true;
    } catch { /* initials instead, never no card */ }
  }
  if (!drewLogo) {
    doc.setDrawColor(...rule);
    doc.setLineWidth(0.03);
    doc.setFillColor(...band);
    doc.roundedRect(M, tileY, tile, tile, 0.08, 0.08, 'FD');
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(initials(input.clubName), M + tile / 2, tileY + tile / 2, { align: 'center', baseline: 'middle' });
  }

  const textX = M + tile + 0.2;
  const textW = W - textX - M;
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const nameLines = doc.splitTextToSize(latin(input.clubName), textW).slice(0, 2);
  const tagline = input.tagline ? latin(input.tagline) : '';
  const nameTop = bandH / 2 - (nameLines.length * 0.26 + (tagline ? 0.22 : 0)) / 2 + 0.2;
  doc.text(nameLines, textX, nameTop);
  if (tagline) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(doc.splitTextToSize(tagline, textW)[0], textX, nameTop + nameLines.length * 0.26 - 0.02);
  }

  // ── The foot first: the body is centred between the band and it (/design 2026-11-25 S1) ──
  const footTop = ROOM_CARD_SIZE.height - 0.95;

  // ── The body (tab 4B): the QR on the left (its own quiet border is in the image), the words on the right ──
  const qr = 2.2;
  const colX = M + qr + 0.05;
  const colW = W - colX - M;
  type Run = { lines: string[]; font: [string, string]; size: number; color: [number, number, number]; step: number; gap: number };
  const fit = (text: string, font: [string, string], size: number) => { doc.setFont(...font); doc.setFontSize(size); return doc.splitTextToSize(text, colW) as string[]; };
  const runs: Run[] = [
    { lines: fit(latin(CARD_WORDS.headline), ['helvetica', 'bold'], 20), font: ['helvetica', 'bold'], size: 20, color: [22, 24, 29], step: 0.3, gap: 0.06 },
    { lines: fit(latin(CARD_WORDS.scan), ['helvetica', 'normal'], 11), font: ['helvetica', 'normal'], size: 11, color: [22, 24, 29], step: 0.19, gap: 0.24 },
    { lines: fit(latin(CARD_WORDS.claimWith).toUpperCase(), ['helvetica', 'bold'], 9), font: ['helvetica', 'bold'], size: 9, color: [60, 64, 72], step: 0.16, gap: 0.3 },
    { lines: [formatClaimCode(input.code)], font: ['courier', 'bold'], size: 22, color: [22, 24, 29], step: 0.32, gap: 0.02 },
    { lines: addressLines(doc, previewAddress(input.slug), colW, 10), font: ['helvetica', 'normal'], size: 10, color: [60, 64, 72], step: 0.17, gap: 0 },
  ];
  const textH = runs.reduce((h, r) => h + r.lines.length * r.step + r.gap, 0);
  const blockH = Math.max(qr, textH + 0.1);
  const room = footTop - (bandH + 0.06);
  const top = bandH + 0.06 + Math.max(0.35, (room - blockH) / 2);
  if (input.qrDataUrl) {
    try { doc.addImage(input.qrDataUrl, 'PNG', M - 0.1, top + (blockH - qr) / 2, qr, qr); } catch { /* the address is printed beside it */ }
  }
  let y = top + (blockH - textH) / 2 + 0.22;
  for (const r of runs) {
    doc.setFont(...r.font);
    doc.setFontSize(r.size);
    doc.setTextColor(...r.color);
    for (const line of r.lines) { doc.text(line, colX, y); y += r.step; }
    y += r.gap;
  }

  // ── The foot: the preview's marking and the removal date ──
  doc.setDrawColor(210, 212, 216);
  doc.setLineWidth(0.01);
  doc.line(M, footTop, W - M, footTop);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 94, 102);
  doc.text(doc.splitTextToSize(latin(CARD_WORDS.foot(input.clubName, input.removalDate)), W - 2 * M), M, footTop + 0.27);

  return doc;
}

/** The window's "Room card (PDF)": builds the card and hands it to the browser. */
export async function downloadRoomCard(input: RoomCardInput): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  buildRoomCardDoc(jsPDF, input).save(`${input.slug}-room-card.pdf`);
}
