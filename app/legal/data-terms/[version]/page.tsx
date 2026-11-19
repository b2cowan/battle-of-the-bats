import { notFound } from 'next/navigation';
import LegalDocRoute from '@/components/legal/LegalDocRoute';
import { isVersionDate, publishedVersions } from '@/lib/legal-documents';
import { legalPageMetadata } from '@/lib/legal-page-data';

// One Data Terms version at its own address, forever (Board Ready 0a-5) — the Terms' own `[version]` route. Only a listed date answers.
export const dynamicParams = true;
export const generateStaticParams = () => publishedVersions('data-terms').map(version => ({ version }));
export const generateMetadata = async ({ params }: { params: Promise<{ version: string }> }) => {
  const { version } = await params;
  return legalPageMetadata('data-terms', isVersionDate(version) ? version : undefined);
};

export default async function Page({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  if (!isVersionDate(version)) notFound();
  return <LegalDocRoute doc="data-terms" version={version} />;
}
