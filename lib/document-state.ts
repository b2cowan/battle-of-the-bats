/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A CHILD'S PAPERS FOR THE WORKING SEASON — the words and the per-form state the coach's Family &
 * paperwork tab shows (Club Tier Stage 14 S4, drawings tab 3 + tab 5, Ask 10 A; owner 2026-11-04).
 *
 * One row per document TYPE the team asks for (its active templates) or the child has signed
 * before on this team. Each row is "Needs signing" or "On file" for the working season, under the
 * rule in `lib/forms-coverage.ts`. The documents themselves stay on the season's entry they were
 * signed on (S4 Part 0, recommendation 1) — the caller passes them with that entry's season.
 *
 * ⚠ PURE (no database). Client-safe.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { RepDocumentType } from './types';
import { formatStoredDate } from './timezone';
import { theSeason } from './season-roll-path';
import { DOCUMENT_TYPE_ORDER, validityForType, type DocumentValidity } from './forms-coverage';

/** Sentence case in both portals (the /design round on the Stage 14 drawings: the coach's were Title Case). */
export const DOCUMENT_TYPE_LABEL: Record<RepDocumentType, string> = {
  waiver: 'Waiver',
  code_of_conduct: 'Code of conduct',
  medical_consent: 'Medical consent',
  other: 'Other',
};
export { DOCUMENT_TYPE_ORDER };

export const VALIDITY_LABEL: Record<DocumentValidity, string> = {
  signed_each_season: 'Signed each season',
  good_until_replaced: 'Good until replaced',
};
/** The template windows' one line under the choice. */
export const VALIDITY_HINT: Record<DocumentValidity, string> = {
  signed_each_season: 'Every player signs it again each season.',
  good_until_replaced: 'A signed copy stays on file until a newer one replaces it.',
};

export interface SeasonDocument {
  id: string;
  documentType: RepDocumentType;
  createdAt: string;
  /** The season of the entry it was signed on. */
  seasonId: string;
  seasonName: string;
  seasonYear: number;
}

export interface DocumentStateRow {
  documentType: RepDocumentType;
  label: string;
  validity: DocumentValidity;
  /** The template an upload from this row answers (the first that applies, by name), or null. */
  templateId: string | null;
  state: 'on_file' | 'needs_signing';
  /** The chip: "On file" / "Needs signing". */
  chip: string;
  /** The line under it. */
  line: string;
}

function newestFirst(a: SeasonDocument, b: SeasonDocument): number {
  return b.seasonYear - a.seasonYear || (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0);
}

export function documentStateRows(p: {
  /** The ACTIVE templates that apply to this team. */
  templates: readonly { id: string; name: string; document_type: string; validity?: string | null }[];
  /** This child's documents on this team, every season. */
  documents: readonly SeasonDocument[];
  season: { id: string; name: string };
}): DocumentStateRow[] {
  const types = new Set<RepDocumentType>();
  for (const t of p.templates) types.add(t.document_type as RepDocumentType);
  for (const d of p.documents) types.add(d.documentType);
  const rows: DocumentStateRow[] = [];
  for (const type of DOCUMENT_TYPE_ORDER) {
    if (!types.has(type)) continue;
    const ofType = p.templates.filter(t => t.document_type === type).sort((a, b) => a.name.localeCompare(b.name));
    const validity = validityForType(p.templates, type);
    const docs = p.documents.filter(d => d.documentType === type).slice().sort(newestFirst);
    const thisSeason = docs.find(d => d.seasonId === p.season.id) ?? null;
    const current = validity === 'signed_each_season' ? thisSeason : thisSeason ?? docs[0] ?? null;
    const label = DOCUMENT_TYPE_LABEL[type];
    const base = { documentType: type, label, validity, templateId: ofType[0]?.id ?? null };
    if (current) {
      const when = formatStoredDate(current.createdAt);
      rows.push({
        ...base, state: 'on_file', chip: 'On file',
        line: validity === 'good_until_replaced'
          ? `Uploaded ${when}. Good until it’s replaced.`
          : `Uploaded ${when} for ${theSeason(p.season.name)}.`,
      });
      continue;
    }
    const last = docs.find(d => d.seasonId !== p.season.id) ?? null;
    rows.push({
      ...base, state: 'needs_signing', chip: 'Needs signing',
      line: `Needs signing for ${theSeason(p.season.name)}.`
        + (last?.seasonName ? ` Last signed for ${theSeason(last.seasonName)}, ${formatStoredDate(last.createdAt)}.` : ''),
    });
  }
  return rows;
}

/** The once-a-season health check's words (drawing 5A/5B; one wording in both portals — S4 Part 0, call 6). */
export function healthAskTitle(seasonName: string): string {
  return `Still right for ${theSeason(seasonName)}?`;
}
export function healthAskLine(lastCheckedSeasonName: string | null): string {
  return (lastCheckedSeasonName ? `Last checked for ${theSeason(lastCheckedSeasonName)}. ` : '')
    + 'Confirm the medical note and emergency contact once a season, or change them.';
}

/** The section head's count: "2 to sign" (none = nothing shown). */
export function toSignLabel(rows: readonly DocumentStateRow[]): string | null {
  const n = rows.filter(r => r.state === 'needs_signing').length;
  return n === 0 ? null : `${n} to sign`;
}
