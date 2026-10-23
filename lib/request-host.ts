import 'server-only';
import { headers } from 'next/headers';

/** The host this request was addressed to (behind Amplify's CDN the original is `x-forwarded-host`). */
export async function requestHost(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
}
