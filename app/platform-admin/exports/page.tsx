import { requirePlatformAreaView } from '@/lib/platform-auth';
import { EXPORT_CATALOG } from '@/lib/export';
import ExportRegistryClient from './ExportRegistryClient';

export const metadata = { title: 'Export Registry — Platform Admin' };

/**
 * EVERY WAY DATA LEAVES FIELDLOGICHQ, in one place.
 *
 * ## Why a page rather than a document
 *
 * The registry behind this has existed for months, calling itself the source of truth for help
 * documentation, pricing accuracy and coverage detection — and nothing read it, so nothing kept it
 * honest. When it was finally checked (2026-09-06) it was wrong in both directions and silent on
 * five surfaces: nine entries pointed at files that no longer existed, five declared themselves
 * unbuilt on screens that export today, and five exports were missing altogether.
 *
 * A list nobody consults drifts; a list on a page somebody opens gets noticed. `check:export-catalog`
 * is what makes it safe to open — it proves, on every build, that this page and the code agree.
 *
 * ## What it is for
 *
 * Three questions, all of which used to need somebody to read the source:
 *   · "What can a customer on this plan actually export?" — a pricing answer.
 *   · "Can they get their data out, and put it back?" — a buying question, and the reason the
 *     round-trip column exists at all.
 *   · "Why is there no export on this screen?" — answered by the entry itself, not by a shrug.
 *
 * ⚠ NO WRITES, AND NONE ARE COMING. Everything here is generated from the code and proven against
 * it; an edit control would let this page disagree with the product, which is the exact failure it
 * was built to end.
 */
export default async function ExportRegistryPage() {
  await requirePlatformAreaView('export_registry');

  /* Passed whole rather than filtered on the server: the list is a few dozen rows of static
     metadata, and every filter on the page is a reading of the same rows. */
  return <ExportRegistryClient entries={EXPORT_CATALOG} />;
}
