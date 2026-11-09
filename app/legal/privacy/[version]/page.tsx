import { notFound } from 'next/navigation';
import LegalDocRoute from '@/components/legal/LegalDocRoute';
import { isVersionDate, publishedVersions } from '@/lib/legal-documents';
import { legalPageMetadata } from '@/lib/legal-page-data';

// One published version at its own address, forever (GST/HST Stage 6 step 6.2). Only a listed date answers; the preview has none.
export const dynamicParams = true;
export const generateStaticParams = () => publishedVersions('privacy').map(version => ({ version }));
export const generateMetadata = async ({ params }: { params: Promise<{ version: string }> }) => {
  const { version } = await params;
  return legalPageMetadata('privacy', isVersionDate(version) ? version : undefined);
};

export default async function Page({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  if (!isVersionDate(version)) notFound();
  return <LegalDocRoute doc="privacy" version={version} />;
}
