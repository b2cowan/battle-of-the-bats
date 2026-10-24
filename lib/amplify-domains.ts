import 'server-only';
import {
  AmplifyClient,
  CreateDomainAssociationCommand,
  DeleteDomainAssociationCommand,
  GetDomainAssociationCommand,
  type DomainAssociation,
} from '@aws-sdk/client-amplify';
import { isHostNotFound, mapHostStatus, parseDnsRecord, relativeRecordName, type HostState } from './amplify-domain-map';

/**
 * THE HOST, FOR A CLUB'S OWN WEB ADDRESS (Club Tier Stage 4e, Part 2): AWS Amplify's domain associations, three calls.
 * Create (the host returns the two records within seconds), Get (its status and the records, again), Delete (Stop).
 * Nothing else is called, and the IAM user behind the keys is limited to exactly these on this one app.
 *
 * Configuration, all server-side and read when first used so a missing value fails THIS feature, not the build:
 *   CLUB_DOMAINS_AMPLIFY_APP_ID   the Amplify app (d3ld0l2bgmmlga)
 *   CLUB_DOMAINS_AMPLIFY_BRANCH   `master` in production, `dev` on dev: the branch a club's address serves
 *   CLUB_DOMAINS_AWS_REGION       default us-east-2
 *   CLUB_DOMAINS_AWS_ACCESS_KEY_ID / CLUB_DOMAINS_AWS_SECRET_ACCESS_KEY   the app's own keys. Amplify's console refuses
 *     variables that start with AWS_, hence the prefix. When both are unset the SDK's default chain is used (a developer's
 *     CLI sign-in locally), the same as the bookkeeping store.
 *
 * Callers depend on the `DomainHost` shape, not on this file's SDK, so the service is tested with a fake.
 */

export interface HostRecords {
  /** The host's word for where the domain stands (kept for diagnosis). */
  hostStatus: string;
  state: HostState;
  /** The padlock check record, name relative to the domain. Null until the host has issued it. */
  record1: { name: string; value: string } | null;
  /** The host's own target for the club's front name (a `d….cloudfront.net` name). Null until issued. */
  record2HostTarget: string | null;
}

export interface DomainHost {
  /** Start serving `prefix.domain`. Resolves once the host has returned the records, or with them still null. */
  create(input: { domain: string; prefix: string }): Promise<HostRecords>;
  /** The current answer, or null when the host has no such association. */
  read(domain: string, prefix: string): Promise<HostRecords | null>;
  /** Stop serving the domain. Idempotent: an association already gone is not an error. */
  remove(domain: string): Promise<void>;
}

function config() {
  const appId = process.env.CLUB_DOMAINS_AMPLIFY_APP_ID;
  const branchName = process.env.CLUB_DOMAINS_AMPLIFY_BRANCH;
  if (!appId || !branchName) throw new Error('A club’s own web address is not configured (CLUB_DOMAINS_AMPLIFY_APP_ID / _BRANCH).');
  return { appId, branchName };
}

let client: AmplifyClient | null = null;
function amplify(): AmplifyClient {
  if (client) return client;
  const accessKeyId = process.env.CLUB_DOMAINS_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLUB_DOMAINS_AWS_SECRET_ACCESS_KEY;
  client = new AmplifyClient({
    region: process.env.CLUB_DOMAINS_AWS_REGION || 'us-east-2',
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
  });
  return client;
}

function toRecords(a: DomainAssociation, domain: string, prefix: string): HostRecords {
  const padlock = parseDnsRecord(a.certificateVerificationDNSRecord);
  const sub = a.subDomains?.find((s) => (s.subDomainSetting?.prefix ?? '') === prefix);
  const site = parseDnsRecord(sub?.dnsRecord);
  const status = String(a.domainStatus ?? '');
  return {
    hostStatus: status,
    state: mapHostStatus(status),
    record1: padlock ? { name: relativeRecordName(padlock.name, domain), value: padlock.value } : null,
    record2HostTarget: site?.value ?? null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const amplifyDomainHost: DomainHost = {
  async create({ domain, prefix }) {
    const { appId, branchName } = config();
    const created = await amplify().send(
      new CreateDomainAssociationCommand({
        appId,
        domainName: domain,
        enableAutoSubDomain: false,
        subDomainSettings: [{ prefix, branchName }],
      }),
    );
    let records = toRecords(created.domainAssociation!, domain, prefix);
    // Both records are known within seconds of the call (proof: ~10 s). Ask again, briefly, until the host has them.
    for (let i = 0; i < 8 && (!records.record1 || !records.record2HostTarget); i++) {
      await sleep(2000);
      const again = await amplify().send(new GetDomainAssociationCommand({ appId, domainName: domain }));
      records = toRecords(again.domainAssociation!, domain, prefix);
    }
    return records;
  },

  async read(domain, prefix) {
    const { appId } = config();
    try {
      const r = await amplify().send(new GetDomainAssociationCommand({ appId, domainName: domain }));
      return toRecords(r.domainAssociation!, domain, prefix);
    } catch (e) {
      if (isHostNotFound(e)) return null;
      throw e;
    }
  },

  async remove(domain) {
    const { appId, branchName } = config();
    try {
      // Dev and production are two branches of ONE Amplify app, so one set of keys can reach both. An association that serves a
      // branch other than ours belongs to the other environment: never delete it from here (a dev Stop must not take down a
      // production address). It is not ours to remove; the caller's own row is still released.
      const current = await amplify().send(new GetDomainAssociationCommand({ appId, domainName: domain }));
      const others = (current.domainAssociation?.subDomains ?? []).some(s => s.subDomainSetting?.branchName && s.subDomainSetting.branchName !== branchName);
      if (others) return;
      await amplify().send(new DeleteDomainAssociationCommand({ appId, domainName: domain }));
    } catch (e) {
      if (!isHostNotFound(e)) throw e;
    }
  },
};
