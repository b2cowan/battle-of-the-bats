import { notFound } from 'next/navigation';
import LegalDocRoute from '@/components/legal/LegalDocRoute';
import { isVersionDate, publishedVersions } from '@/lib/legal-documents';
import { legalPageMetadata } from '@/lib/legal-page-data';

// One Payments Terms version at its own address, forever (Payments Terms §13) — the Terms' own `[version]` route. Only a listed date
// answers. The Payouts card links the version an owner is agreeing to, and the one they agreed to.
export const dynamicParams = true;
export const generateStaticParams = () => publishedVersions('payments').map(version => ({ version }));
export const generateMetadata = async ({ params }: { params: Promise<{ version: string }> }) => {
  const { version } = await params;
  return legalPageMetadata('payments', isVersionDate(version) ? version : undefined);
};

export default async function Page({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  if (!isVersionDate(version)) notFound();
  return <LegalDocRoute doc="payments" version={version} />;
}
