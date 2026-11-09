import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LEGAL_DOCUMENTS, type LegalDocKey } from './legal-documents';
import { legalPagesMode } from './legal-pages-switch';
import { filterDraftForPreview } from './legal-draft-filter';

/**
 * The dev preview's text (GST/HST Stage 6 step 6.2, ruling Q1): the `/legal` draft itself, filtered of every owner note
 * (`lib/legal-draft-filter.ts`). Returns the filtered markdown ONLY when `legalPagesMode() === 'preview'`; in every other mode
 * it returns null BEFORE touching the file system, so a production build never reads a draft. No copy of the text exists
 * anywhere else; at step 6.7 the approved text becomes a frozen version file and this module has nothing left to read.
 */
export function readDraftForPreview(doc: LegalDocKey, env: Record<string, string | undefined> = process.env): string | null {
  if (legalPagesMode(env) !== 'preview') return null;
  const raw = readFileSync(path.join(process.cwd(), LEGAL_DOCUMENTS[doc].draftPath), 'utf8');
  return filterDraftForPreview(raw);
}
