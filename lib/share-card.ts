/**
 * lib/share-card.ts
 * Client-side branded score-card image generator + share helper. Draws a 1080×1080
 * PNG on a canvas (org-coloured, both teams with monograms, the score, a FINAL/LIVE
 * chip, date/venue) and opens the native share sheet (Web Share API Level 2) with a
 * download fallback. No server image infra — every shared score is org-branded.
 */
import { teamColor, teamInitials } from '@/lib/team-color';

export interface ScoreCardData {
  tournamentName: string;
  awayName: string;
  homeName: string;
  awayScore: number;
  homeScore: number;
  statusLabel: string;   // "FINAL" | "LIVE" | "PENDING"
  live: boolean;         // true → red LIVE chip, else green FINAL chip
  dateLabel: string;
  venueLabel?: string | null;
  gameType?: string | null;
  /** Resolved org primary hex (read from the CSS var at call time). */
  primary: string;
}

const SIZE = 1080;
const PAD = 84;
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Truncate a string to fit `maxWidth` at the current ctx font, adding an ellipsis. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Split words into two roughly balanced lines. */
function splitTwoLines(words: string[]): [string, string] {
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const b = words.slice(i).join(' ').length;
    const diff = Math.abs(a - b);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

/**
 * Draw a team name in the available width WITHOUT truncating: shrink to fit on one
 * line, else wrap to two balanced lines (shrinking those too). Only ellipsizes a
 * single unbreakable word that's still too long at the minimum size.
 */
function drawName(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  centerY: number,
  maxW: number,
  color: string,
) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;

  // 1) one line, shrinking from 54 → 38
  for (let size = 54; size >= 38; size -= 2) {
    ctx.font = `800 ${size}px ${SANS}`;
    if (ctx.measureText(name).width <= maxW) {
      ctx.fillText(name, x, centerY + 2);
      return;
    }
  }

  // 2) two balanced lines, shrinking from 46 → 28
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const [l1, l2] = splitTwoLines(words);
    for (let size = 46; size >= 28; size -= 2) {
      ctx.font = `800 ${size}px ${SANS}`;
      if (ctx.measureText(l1).width <= maxW && ctx.measureText(l2).width <= maxW) {
        const lineH = size * 1.04;
        ctx.fillText(l1, x, centerY - lineH / 2 + 2);
        ctx.fillText(l2, x, centerY + lineH / 2 + 2);
        return;
      }
    }
    // extreme fallback: ellipsize each line at the minimum size
    ctx.font = `800 28px ${SANS}`;
    ctx.fillText(fitText(ctx, l1, maxW), x, centerY - 16);
    ctx.fillText(fitText(ctx, l2, maxW), x, centerY + 16);
    return;
  }

  // single very long word
  ctx.font = `800 38px ${SANS}`;
  ctx.fillText(fitText(ctx, name, maxW), x, centerY + 2);
}

function drawTeamRow(
  ctx: CanvasRenderingContext2D,
  name: string,
  score: number,
  centerY: number,
  isWinner: boolean,
  dim: boolean,
) {
  const av = 104;
  const avX = PAD;
  const avY = centerY - av / 2;

  // Monogram avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX + av / 2, centerY, av / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = teamColor(name, 58, dim ? 32 : 44);
  ctx.globalAlpha = dim ? 0.7 : 1;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 42px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(teamInitials(name), avX + av / 2, centerY + 2);
  ctx.restore();

  // Score (right-aligned, monospace, big)
  ctx.font = '800 132px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = dim ? 'rgba(255,255,255,0.42)' : '#ffffff';
  ctx.fillText(String(score), SIZE - PAD, centerY);
  const scoreWidth = ctx.measureText(String(score)).width;

  // Name — shrink/wrap to fit, never truncate (unless one giant word).
  const nameX = avX + av + 36;
  const nameMax = SIZE - PAD - scoreWidth - 40 - nameX;
  drawName(ctx, name, nameX, centerY, nameMax, dim ? 'rgba(255,255,255,0.55)' : '#ffffff');

  // Winner tick
  if (isWinner) {
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(avX + av - 6, avY + 8, 14, 0, Math.PI * 2);
    ctx.fill();
  }
}

export async function generateScoreCardBlob(data: ScoreCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const primary = /^#[0-9a-f]{6}$/i.test(data.primary) ? data.primary : '#1E3A8A';

  // ── Background: dark base + org-colour wash ──
  ctx.fillStyle = '#0A0A12';
  ctx.fillRect(0, 0, SIZE, SIZE);
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE * 0.7);
  g.addColorStop(0, `${primary}55`);
  g.addColorStop(0.55, `${primary}14`);
  g.addColorStop(1, '#0A0A1200');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Accent top bar
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, SIZE, 10);

  // ── Tournament name (top) ──
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '700 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.translate(0, 0);
  // letter-spacing emulation
  const tName = fitText(ctx, data.tournamentName.toUpperCase(), SIZE - PAD * 2);
  ctx.fillText(tName, SIZE / 2, 118);
  ctx.restore();

  // ── Status chip ──
  const chipText = data.statusLabel || 'FINAL';
  // A submitted-but-unconfirmed score is "Unofficial" — amber, never the success-green
  // that reads as a final result on a shared keepsake (J6-015).
  const isUnofficial = chipText.toUpperCase() === 'UNOFFICIAL';
  ctx.font = '800 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const chipW = ctx.measureText(chipText).width + 64;
  const chipH = 64;
  const chipX = (SIZE - chipW) / 2;
  const chipY = 168;
  roundRect(ctx, chipX, chipY, chipW, chipH, 14);
  ctx.fillStyle = data.live ? 'rgba(239,68,68,0.18)' : isUnofficial ? 'rgba(245,158,11,0.16)' : 'rgba(34,197,94,0.16)';
  ctx.fill();
  roundRect(ctx, chipX, chipY, chipW, chipH, 14);
  ctx.lineWidth = 2;
  ctx.strokeStyle = data.live ? 'rgba(239,68,68,0.55)' : isUnofficial ? 'rgba(245,158,11,0.5)' : 'rgba(34,197,94,0.5)';
  ctx.stroke();
  if (data.live) {
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(chipX + 30, chipY + chipH / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = data.live ? '#FCA5A5' : isUnofficial ? '#FCD34D' : '#86EFAC';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(chipText, SIZE / 2 + (data.live ? 12 : 0), chipY + chipH / 2 + 2);

  // ── Matchup rows ──
  const awayWin = data.awayScore > data.homeScore;
  const homeWin = data.homeScore > data.awayScore;
  drawTeamRow(ctx, data.awayName, data.awayScore, 430, awayWin, homeWin);

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, 545);
  ctx.lineTo(SIZE - PAD, 545);
  ctx.stroke();

  drawTeamRow(ctx, data.homeName, data.homeScore, 660, homeWin, awayWin);

  // ── Meta line (date · gameType) ──
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 30px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const meta = [data.dateLabel, data.gameType].filter(Boolean).join('  ·  ');
  ctx.fillText(fitText(ctx, meta, SIZE - PAD * 2), SIZE / 2, 818);

  if (data.venueLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '500 26px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(fitText(ctx, data.venueLabel, SIZE - PAD * 2), SIZE / 2, 862);
  }

  // ── Footer brand ──
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(PAD, 940, SIZE - PAD * 2, 2);
  ctx.fillStyle = primary;
  ctx.font = '800 30px ui-monospace, "SFMono-Regular", Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText('Live results on FieldLogicHQ', SIZE / 2, 1000);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png', 0.95);
  });
}

/**
 * Share a LINK (so the recipient's app unfurls the page's OG preview and can tap
 * through to the live page — drives traffic). Native share sheet, else copy to
 * clipboard. Returns what happened so the button can show the right state.
 */
export async function shareLink(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'idle'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, title, text });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'idle';
      // fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'idle';
  }
}

/** Open the native share sheet with the image; fall back to a download. */
export async function shareScoreImage(blob: Blob, filename: string, text: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return; // user cancelled
      // otherwise fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
