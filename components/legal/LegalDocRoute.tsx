import { notFound } from 'next/navigation';
import { loadLegalPage } from '@/lib/legal-page-data';
import { legalEffectiveLine, legalToBeFilled, LEGAL_EFFECTIVE_BLANK_FACT } from '@/lib/legal-words';
import type { LegalDocKey } from '@/lib/legal-documents';
import LegalPage from './LegalPage';
import { ToBeFilledMark } from './LegalDocumentBody';

/**
 * A legal route's whole body (GST/HST Stage 6 step 6.2, Chunk 2a): ask `loadLegalPage` what to show and render it, or answer
 * "not found" (the `app/invitation-stop/page.tsx` pattern) when the switch is off or the address is not a published version.
 */
export default function LegalDocRoute({ doc, version }: { doc: LegalDocKey; version?: string }) {
  const data = loadLegalPage(doc, version);
  if (!data) notFound();
  const dateLine = data.effectiveText !== null
    ? legalEffectiveLine(data.effectiveText)
    : <>{legalEffectiveLine('').trimEnd()} <ToBeFilledMark>{legalToBeFilled(LEGAL_EFFECTIVE_BLANK_FACT)}</ToBeFilledMark></>;
  return <LegalPage doc={doc} markdown={data.markdown} dateLine={dateLine} earlier={data.earlier} draft={data.draft} />;
}
