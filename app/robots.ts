import type { MetadataRoute } from 'next';
import { requestHost } from '@/lib/request-host';
import { robotsFor } from '@/lib/robots-rules';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca';

// Answers for the host it is served on (Club Tier 4e); the rules live in lib/robots-rules.ts so a test can pin them.
export default async function robots(): Promise<MetadataRoute.Robots> {
  return robotsFor(await requestHost(), SITE_URL);
}
