import { notFound, redirect } from 'next/navigation';
import { loadLegalPageOnce } from '@/lib/legal-page-data';
import { legalPagePath } from '@/lib/legal-paths';
import { legalPagesOn } from '@/lib/legal-pages-switch';
import { LEGAL_EFFECTIVE_BLANK_FACT, LEGAL_EFFECTIVE_PREFIX, legalEffectiveLine, legalToBeFilled } from '@/lib/legal-words';
import type { LegalDocKey } from '@/lib/legal-documents';
import LegalPage from './LegalPage';
import { ToBeFilledMark } from './LegalDocumentBody';

/**
 * A legal route's whole body (GST/HST Stage 6 step 6.2, Chunk 2a): ask `loadLegalPageOnce` what to show and render it, or answer
 * "not found" (the `app/invitation-stop/page.tsx` pattern) when the switch is off or the address is not a published version.
 */
export default function LegalDocRoute({ doc, version }: { doc: LegalDocKey; version?: string }) {
  const data = loadLegalPageOnce(doc, version);
  if (!data) notFound();
  const dateLine = data.effectiveText !== null
    ? legalEffectiveLine(data.effectiveText)
    : <>{LEGAL_EFFECTIVE_PREFIX} <ToBeFilledMark>{legalToBeFilled(LEGAL_EFFECTIVE_BLANK_FACT)}</ToBeFilledMark></>;
  return <LegalPage doc={doc} markdown={data.markdown} dateLine={dateLine} earlier={data.earlier} draft={data.draft} />;
}

/**
 * A short address (`/terms`, `/privacy`, `/legal`) to a document's current page. A PAGE-level redirect, not a `next.config` one: a
 * config redirect is unconditional and would announce the pages while they are dark. Off, this is "not found". The route file keeps
 * its own `dynamic = 'force-dynamic'` (segment config cannot be re-exported).
 */
export function redirectToLegalDoc(doc: LegalDocKey): never {
  if (!legalPagesOn()) notFound();
  redirect(legalPagePath(doc));
}
