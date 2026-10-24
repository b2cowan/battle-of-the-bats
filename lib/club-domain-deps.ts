import 'server-only';
import { amplifyDomainHost } from '@/lib/amplify-domains';
import { publicDnsLookup } from '@/lib/club-domain-dns';
import { clubDomainStore } from '@/lib/club-domain-store';
import type { ServiceDeps } from '@/lib/club-domain-service';
import { isDemoOrgId } from '@/lib/demo-org-server';
import { captureError } from '@/lib/observability';

/**
 * The real collaborators for `lib/club-domain-service.ts`, wired once. Record 2 points at a name of ours, so a future change
 * of host never needs a club to touch its records. The safeguard proof PASSED (2026-10-23): Amplify served and kept verifying
 * a club whose www pointed at `sites.fieldlogichq.ca`, so that is the default. `CLUB_DOMAINS_SITE_TARGET` overrides it; set
 * it to an empty string to hand out the host's own target instead (the fallback the proof allowed for).
 */
export const DEFAULT_SITE_TARGET = 'sites.fieldlogichq.ca';

/** A failure's cause, with account ids and ARNs taken out, for observability only (the owner sees a fixed sentence). */
export function scrubbedCause(err: unknown, where: string): Error {
  const e = err as { name?: string; message?: string } | null;
  const clean = String(e?.message ?? err).replace(/arn:aws[^\s"']*/g, 'arn:…').replace(/\b\d{12}\b/g, '…');
  return new Error(`${where}: ${e?.name ?? 'Error'}: ${clean}`);
}

export function clubDomainDeps(): ServiceDeps {
  const configured = process.env.CLUB_DOMAINS_SITE_TARGET;
  return {
    store: clubDomainStore,
    host: amplifyDomainHost,
    dns: publicDnsLookup,
    siteTarget: configured === undefined ? DEFAULT_SITE_TARGET : configured.trim() || null,
    branch: process.env.CLUB_DOMAINS_AMPLIFY_BRANCH ?? '',
    isDemoOrg: isDemoOrgId,
    now: () => new Date(),
    report: (err, where) => { void captureError(scrubbedCause(err, where)); },
  };
}
