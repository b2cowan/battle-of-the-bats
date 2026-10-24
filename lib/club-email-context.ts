import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getOrgPublicSiteContent } from './db';
import {
  familyReplyPlan, familySenderName, isEmailableLogoUrl, usableContactEmail,
  type ClubEmailFacts, type FamilyMailFace, type FamilyReplyPlan,
} from './email-club-identity';

/**
 * lib/club-email-context.ts — SERVER-ONLY. What a family email needs to know about the club that the pure module
 * (lib/email-club-identity.ts) cannot read: how big the logo file is, and whether the club has a public contact.
 *
 * The routes that send family mail already hold the organization, so nothing here re-reads it: `clubEmailFacts` takes the
 * fields the caller holds. The only extra read is a club that has a PNG or JPEG logo on our storage, and then it is one
 * small read of `pdf_settings` — and, the first time only, one fetch of the logo to measure it.
 */

/** A logo that hangs must not hang the send behind it. */
const LOGO_FETCH_TIMEOUT_MS = 4000;
/** A logo that could not be measured is not tried again for a day, so a bad file never slows every send. */
const LOGO_RETRY_AFTER_MS = 24 * 3600 * 1000;
/** Same decode ceiling as the PDF pipeline: a small file may still declare enormous pixel dimensions. */
const LOGO_MAX_INPUT_PX = 4096 * 4096;
/** A club logo is a small file; anything bigger is not measured (the email shows the initials). */
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

interface LogoSizeCache { source: string; width?: number; height?: number; failedAt?: string }

/** The club fields a family email reads. The caller usually already holds all of them (an `Organization`). */
export interface ClubEmailOrg {
  id: string;
  name: string;
  logoUrl?: string | null;
  themePreset?: string | null;
  themePrimary?: string | null;
  themeAccent?: string | null;
}

/** Fetch the logo once and read its pixel size. Null on any failure — the email then shows the initials, never a squashed logo. */
async function measureLogo(url: string): Promise<{ width: number; height: number } | null> {
  try {
    // A redirect would leave the storage host the caller checked, so it is an error, not a hop.
    const res = await fetch(url, { signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS), redirect: 'error' });
    if (!res.ok) return null;
    if (Number(res.headers.get('content-length') ?? 0) > LOGO_MAX_BYTES) return null;
    // Lazy: sharp is a native module — loaded only when an image actually has to be measured.
    const { default: sharp } = await import('sharp');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > LOGO_MAX_BYTES) return null;
    const meta = await sharp(bytes, { limitInputPixels: LOGO_MAX_INPUT_PX }).metadata();
    if (!meta.width || !meta.height) return null;
    // EXIF orientations 5–8 turn the picture on its side: a mail app shows it turned, so the size is the turned one.
    const sideways = (meta.orientation ?? 1) >= 5;
    return sideways ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
  } catch {
    return null;
  }
}

/**
 * A logo's size, remembered inside the organization's existing `pdf_settings` JSON under `logoSize` (no schema change).
 * Keyed by the logo's address, so a new logo is measured afresh; the settings page's save replaces the whole JSON and
 * clears it, which only costs one more measurement. The write is a compare-and-swap on the JSON we read, the same guard
 * `resolveOrgPdfSettings` uses for `logoDerived`: it never overwrites a save made while we were measuring.
 */
async function knownLogoSize(orgId: string, logoUrl: string): Promise<{ width: number; height: number } | null> {
  const { data } = await supabaseAdmin.from('organizations').select('pdf_settings').eq('id', orgId).maybeSingle();
  const raw = ((data as { pdf_settings?: Record<string, unknown> | null } | null)?.pdf_settings ?? {}) as Record<string, unknown> & { logoSize?: LogoSizeCache };
  const cached = raw.logoSize;
  if (cached && cached.source === logoUrl && cached.width && cached.height && cached.width > 0 && cached.height > 0) return { width: cached.width, height: cached.height };
  if (cached?.source === logoUrl && cached.failedAt && Date.now() - Date.parse(cached.failedAt) < LOGO_RETRY_AFTER_MS) return null;

  const measured = await measureLogo(logoUrl);
  const stored = (data as { pdf_settings?: unknown } | null)?.pdf_settings ?? null;
  const write = supabaseAdmin
    .from('organizations')
    .update({ pdf_settings: { ...raw, logoSize: measured ? { source: logoUrl, ...measured } : { source: logoUrl, failedAt: new Date().toISOString() } } })
    .eq('id', orgId);
  // Compare-and-swap on exactly what was read; a column that is NULL never equals '{}', so it is matched with IS NULL.
  await (stored === null ? write.is('pdf_settings', null) : write.filter('pdf_settings', 'eq', JSON.stringify(stored)));
  return measured;
}

/**
 * The club's facts for a family email. A club with no usable logo (none, an SVG, a WebP, a stock logo's path, a file
 * that is not ours) costs no read at all.
 */
export async function clubEmailFacts(org: ClubEmailOrg): Promise<ClubEmailFacts> {
  let logoSize: ClubEmailFacts['logoSize'] = null;
  if (org.logoUrl && isEmailableLogoUrl(org.logoUrl)) {
    try {
      logoSize = await knownLogoSize(org.id, org.logoUrl);
    } catch (err) {
      console.error('[club-email-context] a logo size could not be read (the email shows the initials):', err instanceof Error ? err.message : String(err));
    }
  }
  return {
    name: org.name,
    logoUrl: org.logoUrl ?? null,
    logoSize,
    themePreset: org.themePreset ?? null,
    themePrimary: org.themePrimary ?? null,
    themeAccent: org.themeAccent ?? null,
  };
}

/**
 * The club's public-site contact address — the one place a club says "write to us". ⚠ NOT `Organization.contactEmail`,
 * which is always empty. Read once per send or per sweep run, never once per email.
 */
export async function clubPublicContact(orgId: string): Promise<string | null> {
  try {
    return usableContactEmail((await getOrgPublicSiteContent(orgId))?.contactEmail);
  } catch (err) {
    console.error('[club-email-context] the public contact could not be read (replies are said to reach nobody):', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** The reply plan of system mail (a game-change notice, a dues reminder, a receipt): the club's contact if it has one. */
export async function systemReplyPlan(org: { id: string; name: string }): Promise<FamilyReplyPlan> {
  return familyReplyPlan({ kind: 'system', clubName: org.name, clubContact: await clubPublicContact(org.id) });
}

/** Everything a piece of SYSTEM mail wears for one club: its face, where a reply goes, and the contact address (the decline names it). */
export type SystemMailFace = FamilyMailFace & {
  reply: FamilyReplyPlan;
  contact: string | null;
  /** The transport options that go with this face (Reply-To and the sender name), paired once so no sender can forget one. */
  sendOpts: { replyTo: string | null; fromName: string };
};

/**
 * The face of a system email, read once for a send or a sweep run. A face that cannot be read is a plainer email, never a
 * missed one — the senders that use this are about money and registrations — so this never throws.
 */
export async function systemMailFace(org: ClubEmailOrg): Promise<SystemMailFace | null> {
  try {
    const [club, contact] = await Promise.all([clubEmailFacts(org), clubPublicContact(org.id)]);
    const reply = familyReplyPlan({ kind: 'system', clubName: org.name, clubContact: contact });
    return {
      club, contact, reply, replyLine: reply.line, replyTo: reply.replyTo,
      sendOpts: { replyTo: reply.replyTo, fromName: familySenderName(club.name) },
    };
  } catch (err) {
    console.error('[club-email-context] a club face could not be built (the email goes plain):', err instanceof Error ? err.message : String(err));
    return null;
  }
}
