/**
 * lib/export/resolve-pdf-settings.ts — SERVER-ONLY.
 *
 * D4 (PDF Export Quality Phase 1): the identity pipeline. What a document carries is resolved
 * HERE, at the API chokepoint, never guessed client-side:
 *
 *   settings:  team settings → club settings → defaults
 *   logo:      team crest    → club logo     → none
 *   name line: team paper carries the TEAM's name; admin paper carries the ORG's name
 *              (falling back from a blank headerLine1 — decision 7 / D1).
 *
 * Before this file existed, "Use org logo" stored nothing and NO org had ever printed a logo.
 * The org's uploaded site logo (organizations.logo_url) is fetched, normalized by sharp to a
 * bounded PNG (the evidence run measured ~0.9 MB added per document by ONE oversized image),
 * and cached back into organizations.pdf_settings under `logoDerived` so the cost is paid once
 * per logo change, not per export. The admin settings POST replaces the whole JSONB, which
 * clears the cache — it simply re-derives on the next export.
 */
// Relative imports, deliberately — the unit-test resolver maps relative TS paths but not `@/`.
import { supabaseAdmin } from '../supabase-admin';
import { DEFAULT_PDF_SETTINGS, type OrgPdfSettings } from './pdf';
import { hasPlanFeature } from '../plan-features';
import type { OrgPlan } from '../types';

/** The team layer (rep_teams.pdf_settings): every key optional — absent = inherit the club's. */
export interface TeamPdfLook {
  logoDataUrl?: string;
  accentColor?: string;
  footerText?: string;
}

/** Longest edge of a normalized logo. Ample for the header's 24×12 mm slot at print DPI. */
const LOGO_MAX_PX = 256;
/** Hard byte ceiling on a normalized logo — the size guard that keeps exports small. */
const LOGO_MAX_BYTES = 300 * 1024;
/** Decode ceiling: a "small" file may still declare enormous pixel dimensions (decompression
 *  bomb) — sharp refuses to decode past this rather than allocating gigabytes. */
const LOGO_MAX_INPUT_PX = 4096 * 4096;
/** A logo fetch that hangs must not hang the export request behind it. */
const LOGO_FETCH_TIMEOUT_MS = 8000;

/** Decode arbitrary image bytes and re-encode as a bounded, palette PNG data URL. Null on any
 *  failure — including a decode that exceeds the pixel ceiling. */
async function normalizeToPngDataUrl(source: Buffer): Promise<string | null> {
  try {
    // Lazy: sharp is a native module — loaded only when an image actually needs work.
    // Palette quantization matters: logos are flat-colour art, and a truecolor 256px PNG
    // costs ~250 KB PER DOCUMENT once embedded — quantized it's a tenth of that.
    const { default: sharp } = await import('sharp');
    const png = await sharp(source, { limitInputPixels: LOGO_MAX_INPUT_PX })
      .resize(LOGO_MAX_PX, LOGO_MAX_PX, { fit: 'inside', withoutEnlargement: true })
      .png({ palette: true, compressionLevel: 9 })
      .toBuffer();
    if (png.length > LOGO_MAX_BYTES) return null;
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Normalize an UPLOADED data-URL image (the team crest, or an admin-stored logo) through the
 * same sharp pipeline as derived logos. This is the server-side teeth behind the client's
 * canvas downscale: a hand-crafted PUT with a small-bytes/huge-pixels image is re-encoded —
 * or rejected — here, never stored and served to other people's browsers as-is.
 */
export async function normalizeLogoDataUrl(dataUrl: string): Promise<string | null> {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  try {
    return await normalizeToPngDataUrl(Buffer.from(dataUrl.slice(comma + 1), 'base64'));
  } catch {
    return null;
  }
}

/**
 * Fetch an image URL and normalize it into a bounded PNG data URL for jsPDF (which cannot
 * draw webp, and must never embed a 2 MB original). Returns null on any failure — a broken
 * logo degrades to a text-only header, never a broken export.
 *
 * Trust boundary lives HERE, not in the writers of organizations.logo_url: only a root-relative
 * path (a repo-shipped stock logo, read from disk) or an https URL on this project's Supabase
 * storage host is fetched. Anything else — including a future writer storing an arbitrary URL —
 * resolves to null instead of becoming a server-side request to it (SSRF).
 */
export async function deriveLogoDataUrl(url: string): Promise<string | null> {
  try {
    // Stock logos are stored root-relative ('/stock-logos/x.svg') — they are repo files, so
    // read them from disk; a server-side fetch of a relative URL would just throw.
    if (url.startsWith('/')) {
      if (url.includes('..')) return null;
      const [fs, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
      const file = path.join(process.cwd(), 'public', ...url.split('/').filter(Boolean));
      return await normalizeToPngDataUrl(Buffer.from(await fs.readFile(file)));
    }

    const parsed = new URL(url);
    const storageHost = process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null;
    if (parsed.protocol !== 'https:' || !storageHost || parsed.host !== storageHost) return null;

    const res = await fetch(url, { signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await normalizeToPngDataUrl(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** What the resolver needs from an organizations row. */
export interface ResolvableOrg {
  id: string;
  name: string;
  planId: OrgPlan;
  logoUrl?: string | null;
  pdfSettings?: Record<string, unknown> | null;
}

/**
 * Resolve the settings ADMIN paper is generated with: stored settings over defaults, the org's
 * name on the header when the org left it blank (D1 — the sentence the settings page always
 * promised), the org's uploaded logo made real (D4), and branding forced on below the
 * customization plans (the rule the engine's comment claimed but nothing enforced).
 */
export async function resolveOrgPdfSettings(org: ResolvableOrg): Promise<OrgPdfSettings> {
  const raw = (org.pdfSettings ?? {}) as Partial<OrgPdfSettings> & {
    logoDerived?: { source: string; dataUrl: string };
  };
  const { logoDerived, ...stored } = raw;
  const canCustomize = hasPlanFeature(org.planId, 'pdf_template_settings');

  let logoDataUrl = canCustomize ? stored.logoDataUrl : undefined;
  if (!logoDataUrl && canCustomize && org.logoUrl) {
    if (logoDerived?.source === org.logoUrl && logoDerived.dataUrl) {
      logoDataUrl = logoDerived.dataUrl;
    } else {
      const derived = await deriveLogoDataUrl(org.logoUrl);
      if (derived) {
        logoDataUrl = derived;
        // Cache write-back, GUARDED: the derive above took real time (network + sharp), and
        // an admin may have SAVED settings in that window. Writing `{ ...raw, logoDerived }`
        // unguarded would clobber that save with our stale snapshot — a silent revert three
        // review lenses flagged independently. The jsonb equality filter makes this a
        // compare-and-swap: the write lands only if the row still holds exactly what we
        // read; otherwise it matches zero rows and the cache simply re-derives next time.
        await supabaseAdmin
          .from('organizations')
          .update({ pdf_settings: { ...raw, logoDerived: { source: org.logoUrl, dataUrl: derived } } })
          .eq('id', org.id)
          .filter('pdf_settings', 'eq', JSON.stringify(org.pdfSettings ?? {}));
      }
    }
  }

  return {
    ...DEFAULT_PDF_SETTINGS,
    ...stored,
    // Whitespace-only counts as blank — the settings page promises "left blank, your org name".
    headerLine1: stored.headerLine1?.trim() ? stored.headerLine1 : org.name,
    logoDataUrl,
    showBranding: canCustomize ? (stored.showBranding ?? true) : true,
  };
}

/**
 * Layer a team's own look over the club's resolved settings, and stamp the team's NAME as the
 * header identity — the name is not a setting and no club header line overrides it (approved
 * mockup, 2026-08-22). headerLine2 is cleared: a club's subtitle line describes club paper.
 */
export function applyTeamLook(
  clubResolved: OrgPdfSettings,
  teamName: string,
  look: TeamPdfLook | null | undefined,
  canCustomize: boolean,
): OrgPdfSettings {
  const l = look ?? {};
  return {
    ...clubResolved,
    headerLine1: teamName,
    headerLine2: undefined,
    ...(canCustomize && l.logoDataUrl ? { logoDataUrl: l.logoDataUrl } : {}),
    ...(canCustomize && l.accentColor ? { accentColor: l.accentColor } : {}),
    ...(canCustomize && l.footerText ? { footerText: l.footerText } : {}),
  };
}

/**
 * Resolve the settings TEAM paper is generated with: the club's resolved settings as the
 * inherited default (team settings → club settings → defaults; team crest → club logo → none).
 */
export async function resolveTeamPdfSettings(
  org: ResolvableOrg,
  team: { name: string; pdfLook?: TeamPdfLook | null },
): Promise<OrgPdfSettings> {
  const base = await resolveOrgPdfSettings(org);
  const canCustomize = hasPlanFeature(org.planId, 'pdf_template_settings');
  return applyTeamLook(base, team.name, team.pdfLook, canCustomize);
}
