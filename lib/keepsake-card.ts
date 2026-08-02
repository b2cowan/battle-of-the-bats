/**
 * lib/keepsake-card.ts
 * Client-side keepsake image for a player's season recap (Chunk D slice 3, item 3.3).
 *
 * Rides the SHIPPED share-card rail (lib/share-card.ts score cards, lib/wrapped-share-card.ts
 * Season Wrapped): draw a 1080×1080 PNG on a canvas in the browser and hand it to the OS share
 * sheet. There is no server image route, no stored asset and NO PUBLIC URL — the image exists
 * on the family's own device and the human decides where it goes.
 *
 * ⚠ SHARE-SAFE PAYLOAD, ENFORCED BY THE TYPE. `KeepsakeCardData` has a `firstName` field and
 * no surname field, because this is the one artifact in the product designed to leave the app.
 * The recap payload it is built from is first-name-only for the same reason. The printed
 * certificate is the deliberate exception — paper handed over by a coach — and it is a
 * separate surface with a separate justification (§8.2, owner-approved). Do not add a surname
 * here, and do not add a second surface that names a child.
 */
import { roundRect, fitText } from '@/lib/share-card';
import { shadeHex } from '@/lib/wrapped-share-card';

export interface KeepsakeCardData {
  /** First name only — see the header. */
  firstName: string;
  jerseyNumber: string | null;
  teamName: string;
  seasonName: string;
  teamColor: string | null;
  /** Award names, in the order the recap shows them. Empty is fine — the card just has fewer
   *  lines, exactly like the recap has fewer blocks. */
  awardNames: string[];
  /** Whole-percent attendance, or null when the coach never recorded any. */
  attendancePct: number | null;
}

const SIZE = 1080;
const PAD = 84;
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, "SFMono-Regular", Menlo, monospace';
const LIME = '#D9F99D';

/**
 * "🏆 MVP · Hustle ×2" — awards collapsed to name + count, longest-standing first.
 * Returns null when there is nothing to say; the caller omits the line rather than drawing
 * an empty one.
 */
export function awardSummaryLine(awardNames: string[]): string | null {
  if (awardNames.length === 0) return null;
  const counts = new Map<string, number>();
  for (const name of awardNames) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
    .join(' · ');
}

export async function generateKeepsakeCardBlob(data: KeepsakeCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // ── Ground: the team's colour, deep enough for white ink at any hue. The no-colour
  //    fallback is the platform primary, matching the Wrapped card's owner-settled call. ──
  const g = ctx.createLinearGradient(0, 0, SIZE * 0.4, SIZE);
  g.addColorStop(0, shadeHex(data.teamColor, 0.66));
  g.addColorStop(1, shadeHex(data.teamColor, 0.3));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // ── Eyebrow: team · season ──
  ctx.fillStyle = LIME;
  ctx.font = `800 30px ${MONO}`;
  ctx.fillText(
    fitText(ctx, `${data.teamName.toUpperCase()} · ${data.seasonName.toUpperCase()}`, SIZE - PAD * 2),
    SIZE / 2, 150,
  );

  // ── The name. First name + jersey, the whole point of the card. ──
  const label = data.jerseyNumber ? `${data.firstName} #${data.jerseyNumber}` : data.firstName;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 150px ${SANS}`;
  ctx.fillText(fitText(ctx, label, SIZE - PAD * 2), SIZE / 2, 470);

  // ── The lines the season earned. A card with none is a name on a team colour, which is
  //    still a keepsake — it is never padded with invented ones. ──
  const lines: string[] = [];
  const awards = awardSummaryLine(data.awardNames);
  if (awards) lines.push(`🏆 ${awards}`);
  if (data.attendancePct !== null) lines.push(`${data.attendancePct}% attendance`);

  const boxTop = 580;
  const lineH = 96;
  lines.forEach((line, i) => {
    const y = boxTop + i * (lineH + 20);
    roundRect(ctx, PAD, y, SIZE - PAD * 2, lineH, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fill();
    roundRect(ctx, PAD, y, SIZE - PAD * 2, lineH, 24);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 42px ${SANS}`;
    ctx.fillText(fitText(ctx, line, SIZE - PAD * 2 - 56), SIZE / 2, y + 62);
  });

  // ── Footer brand ──
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(PAD, 950, SIZE - PAD * 2, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `700 28px ${MONO}`;
  ctx.fillText('Made with FieldLogicHQ', SIZE / 2, 1006);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png', 0.95);
  });
}
