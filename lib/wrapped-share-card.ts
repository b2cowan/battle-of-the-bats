/**
 * lib/wrapped-share-card.ts
 * Client-side Season Wrapped image generator (Coach Portal Batch 3, wow #7 / D3).
 * Same pattern as lib/share-card.ts (score cards): draw a 1080×1080 PNG on a canvas and
 * hand it to the OS share sheet — no server image infra, no public route, the coach
 * decides where it goes. Share-safe by construction: the payload's award line already
 * carries first name + jersey only, and no money data exists in the payload at all.
 */
import type { SeasonWrappedStats } from '@/lib/season-wrapped';
import { roundRect, fitText } from '@/lib/share-card';

export interface WrappedCardData extends SeasonWrappedStats {
  seasonName: string;
  teamName: string;
  teamColor: string | null;
}

const SIZE = 1080;
const PAD = 84;
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace';
const LIME = '#D9F99D';

/** Mix a hex color toward black by `amount` (0..1). The no-color-anywhere fallback is the
 *  PLATFORM primary (--platform-primary #1E3A8A) — a colorless team's card then reads as
 *  deliberate FieldLogicHQ branding, not as a dark-theme leak (owner call, Batch 3 QA).
 *  Kept as a literal on purpose: canvas can't read CSS vars, and the card must render
 *  identically on-page and in the exported PNG. */
export function shadeHex(hex: string | null | undefined, amount: number, fallback = '#1E3A8A'): string {
  const source = hex && /^#[0-9a-f]{6}$/i.test(hex) ? hex : fallback;
  const n = parseInt(source.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * (1 - amount));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export async function generateWrappedCardBlob(data: WrappedCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // ── Ground: team color, deep and dark enough for white ink at any hue ──
  const top = shadeHex(data.teamColor, 0.62);
  const bottom = shadeHex(data.teamColor, 0.34);
  const g = ctx.createLinearGradient(0, 0, SIZE * 0.4, SIZE);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Eyebrow + identity ──
  ctx.fillStyle = LIME;
  ctx.font = `800 34px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SEASON WRAPPED', SIZE / 2, 128);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 44px ${SANS}`;
  ctx.fillText(fitText(ctx, data.teamName, SIZE - PAD * 2), SIZE / 2, 196);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `600 30px ${SANS}`;
  ctx.fillText(fitText(ctx, data.seasonName, SIZE - PAD * 2), SIZE / 2, 244);

  // ── Record ──
  const rec = data.record;
  const recText = rec.games > 0
    ? `${rec.wins}–${rec.losses}${rec.ties > 0 ? `–${rec.ties}` : ''}`
    : 'That’s a wrap';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${rec.games > 0 ? 176 : 96}px ${MONO}`;
  ctx.fillText(recText, SIZE / 2, rec.games > 0 ? 430 : 400);
  if (rec.games > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `600 30px ${SANS}`;
    ctx.fillText(`${rec.games} game${rec.games === 1 ? '' : 's'} · league & tournament play`, SIZE / 2, 486);
  }

  // ── Stat tiles (only the earned ones; up to 4, two per row) ──
  const tiles: { label: string; value: string; sub: string }[] = [];
  if (data.longestStreak) {
    tiles.push({
      label: 'LONGEST STREAK',
      value: `${data.longestStreak.length} wins`,
      sub: `${fmtDate(data.longestStreak.startsAt)} – ${fmtDate(data.longestStreak.endsAt)}`,
    });
  }
  if (data.closestGame) {
    const cg = data.closestGame;
    tiles.push({
      label: 'CLOSEST GAME',
      value: `${cg.teamScore}–${cg.opponentScore} ${cg.result === 'win' ? 'W' : 'L'}`,
      sub: cg.opponent ? `${cg.homeAway === 'away' ? '@' : 'vs'} ${cg.opponent} · ${fmtDate(cg.startsAt)}` : fmtDate(cg.startsAt),
    });
  }
  if (data.attendanceRate) {
    tiles.push({ label: 'ATTENDANCE', value: `${data.attendanceRate.pct}%`, sub: 'game days' });
  }
  if (data.topAward) {
    const extra = data.topAward.tiedWith.length > 0 ? ` & ${data.topAward.tiedWith.join(' & ')}` : '';
    tiles.push({
      label: 'MOST AWARDED',
      value: fitTileValue(data.topAward.playerLabel + extra),
      sub: `${data.topAward.count} award${data.topAward.count === 1 ? '' : 's'}${data.topAward.topTypeName ? ` · ${data.topAward.topTypeName}` : ''}`,
    });
  }
  if (tiles.length < 4 && data.lineupFact) {
    const lf = data.lineupFact;
    tiles.push({
      label: 'LINEUP FACT',
      value: `${lf.wins}–${lf.losses}${lf.ties ? `–${lf.ties}` : ''}`,
      sub: `reused ${lf.uses}× · never beaten`,
    });
  }
  if (tiles.length === 0) {
    tiles.push({ label: 'ROSTER', value: `${data.rosterCount} players`, sub: 'a season together' });
  }

  function fitTileValue(v: string): string {
    return v.length > 18 ? `${v.slice(0, 17)}…` : v;
  }

  const shown = tiles.slice(0, 4);
  const cols = shown.length === 1 ? 1 : 2;
  const rows = Math.ceil(shown.length / cols);
  const tileW = cols === 1 ? SIZE - PAD * 2 : (SIZE - PAD * 2 - 24) / 2;
  const tileH = 150;
  const gridTop = 560;
  shown.forEach((t, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Center a lone last tile in its row.
    const inLastRow = row === rows - 1;
    const lastRowCount = shown.length - (rows - 1) * cols;
    const offsetX = inLastRow && lastRowCount === 1 && cols === 2 ? (tileW + 24) / 2 : 0;
    const x = PAD + offsetX + col * (tileW + 24);
    const y = gridTop + row * (tileH + 24);
    roundRect(ctx, x, y, tileW, tileH, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    roundRect(ctx, x, y, tileW, tileH, 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `700 22px ${MONO}`;
    ctx.fillText(t.label, x + 28, y + 46);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 44px ${SANS}`;
    ctx.fillText(fitText(ctx, t.value, tileW - 56), x + 28, y + 96);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `500 24px ${SANS}`;
    ctx.fillText(fitText(ctx, t.sub, tileW - 56), x + 28, y + 130);
  });

  // ── Footer brand ──
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(PAD, 950, SIZE - PAD * 2, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `700 28px ${MONO}`;
  ctx.fillText('Made with FieldLogicHQ', SIZE / 2, 1006);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png', 0.95);
  });
}
