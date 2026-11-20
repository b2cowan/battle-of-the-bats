import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContextWithRole, type AuthContextWithRole } from './api-auth';
import { getLeagueSeasonById } from './db';
import { hasPlanFeature, requiresPlanCopy } from './plan-features';
import { FORM_LIMITS } from './club-form';
import { FORM_WORDS } from './club-form-words';
import { checkDocumentUpload } from './document-upload';
import type { LeagueSeason } from './types';

/**
 * WHAT EVERY SEASON-FORM ROUTE SHARES (Board Ready Stage 4; rulings 6 and 16). Reading the form (its questions, documents
 * and counts — never an answer) is anyone who can open the season (`read`); changing it is the people who set up a season
 * (`run`), only while the season is live (a finished season answers 423). Each handler asks `houseLeagueRefusal` itself,
 * twice (the action, then the action on the season), so tests/unit/house-league-gate-guard.test.ts can read it; no route
 * names a role.
 */

/** The person asking (the org from `?orgSlug=`); null when signed out. Each handler then refuses through
 *  `houseLeagueRefusal(ctx, action)` and again with the season, in its own body, where the gate guard reads it. */
export function formAuth(req: Request): Promise<AuthContextWithRole | null> {
  return getAuthContextWithRole({ orgSlug: new URL(req.url).searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
}

/** The season in the address, only when it is this club's. */
export async function seasonOf(params: Promise<{ seasonId: string }>, ctx: AuthContextWithRole): Promise<LeagueSeason | null> {
  const { seasonId } = await params;
  return getLeagueSeasonById(seasonId, ctx.org.id);
}

export const seasonNotFound = () => NextResponse.json({ error: 'Season not found' }, { status: 404 });

/** The club's own questions ride the existing custom-questions gate (every house-league plan passes it today, drawing tab
 *  9). Documents and their ticks are NEVER behind it (ruled). */
export function questionsOnPlan(ctx: AuthContextWithRole): boolean {
  return hasPlanFeature(ctx.org.planId, 'custom_registration_fields');
}

export function questionsPlanRefusal(ctx: AuthContextWithRole): Response | null {
  return questionsOnPlan(ctx) ? null : NextResponse.json({ error: requiresPlanCopy('custom_registration_fields') }, { status: 403 });
}

/**
 * A document's add or replace, read from one multipart body (its fields, and `file` for a PDF). The PDF is checked from
 * its bytes, never the browser's type, and capped at 8 MB before the body is read (the proxy buffers 10 MB).
 */
export type DocumentUpload = {
  fields: Record<string, string>;
  pdf: { bytes: Uint8Array; storedName: string; displayName: string; size: number } | null;
};
export async function readDocumentUpload(req: Request): Promise<DocumentUpload | { error: string; status: number }> {
  const length = Number(req.headers.get('content-length') ?? '0');
  if (length > FORM_LIMITS.fileBytes + 64 * 1024) return { error: FORM_WORDS.docTooBig, status: 413 };
  const form = await req.formData().catch(() => null);
  if (!form) return { error: 'Invalid request body', status: 400 };
  const fields: Record<string, string> = {};
  let file: File | null = null;
  for (const [k, v] of form.entries()) {
    if (typeof v === 'string') fields[k] = v;
    else if (k === 'file') file = v;
  }
  if (!file) return { fields, pdf: null };
  if (file.size > FORM_LIMITS.fileBytes) return { error: FORM_WORDS.docTooBig, status: 413 };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkDocumentUpload(bytes, file.name, ['pdf']);
  if (!checked) return { error: FORM_WORDS.docNotPdf, status: 400 };
  return { fields, pdf: { bytes, storedName: checked.storedName, displayName: checked.displayName, size: bytes.byteLength } };
}

export const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });
export const conflict = (error: string) => NextResponse.json({ error }, { status: 409 });
export const serverError = (error: string) => NextResponse.json({ error }, { status: 500 });
