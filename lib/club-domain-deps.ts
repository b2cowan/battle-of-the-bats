import 'server-only';
import { amplifyDomainHost } from '@/lib/amplify-domains';
import { publicDnsLookup } from '@/lib/club-domain-dns';
import { clubDomainStore } from '@/lib/club-domain-store';
import type { ServiceDeps } from '@/lib/club-domain-service';
import { isDemoOrgId } from '@/lib/demo-org-server';

/**
 * The real collaborators for `lib/club-domain-service.ts`, wired once. `CLUB_DOMAINS_SITE_TARGET` is the name record 2
 * points at (`sites.fieldlogichq.ca`, so a future change of host never needs a club to touch its records); unset hands out
 * the host's own target, the fallback the safeguard proof allows for.
 */
export function clubDomainDeps(): ServiceDeps {
  return {
    store: clubDomainStore,
    host: amplifyDomainHost,
    dns: publicDnsLookup,
    siteTarget: process.env.CLUB_DOMAINS_SITE_TARGET?.trim() || null,
    branch: process.env.CLUB_DOMAINS_AMPLIFY_BRANCH ?? '',
    isDemoOrg: isDemoOrgId,
    now: () => new Date(),
  };
}
