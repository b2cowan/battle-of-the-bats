import 'server-only';
import { Resolver } from 'node:dns/promises';
import type { DnsLookup } from '@/lib/club-domain-service';

/**
 * Our own lookup of a club's records (Club Tier Stage 4e). Two public resolvers rather than the machine's own, so what we
 * report is what the internet sees and no local cache of an old answer makes "Check now" lie to a volunteer who has just
 * saved a record. "No such record" is an answer (an empty list); only a lookup that could not be made at all throws.
 */
const resolver = new Resolver({ timeout: 3000, tries: 2 });
resolver.setServers(['1.1.1.1', '8.8.8.8']);

const NO_ANSWER = new Set(['ENODATA', 'ENOTFOUND', 'NXDOMAIN', 'ENOENT']);

export const publicDnsLookup: DnsLookup = {
  async cnames(name) {
    try {
      return await resolver.resolveCname(name);
    } catch (e) {
      const code = (e as { code?: string } | null)?.code ?? '';
      if (NO_ANSWER.has(code)) return [];
      throw e;
    }
  },
};
