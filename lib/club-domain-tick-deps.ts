import 'server-only';
import tls from 'node:tls';
import { amplifyDomainHost } from '@/lib/amplify-domains';
import { publicDnsLookup } from '@/lib/club-domain-dns';
import { clubDomainStore } from '@/lib/club-domain-store';
import type { DomainRow } from '@/lib/club-domain-service';
import type { OwnerEmail, TickDeps } from '@/lib/club-domain-tick';
import { clubDomainEmail, type DomainEmailFacts } from '@/lib/email-club-domain';
import { sendEmail } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatInOrgZone, formatStoredDate } from '@/lib/timezone';

/**
 * The real world for the status check (lib/club-domain-tick.ts): the stored connections, the host, DNS, the live certificate, the
 * bare name's forward, and the owner's mailbox. READS ONLY against the outside world: nothing here writes to AWS or to anyone's DNS.
 * Per connected club per day: one DNS lookup for record 1, one host read, one certificate read, one HTTP request; per hour: one
 * DNS lookup for record 2.
 */

/** The date the club's live certificate runs out, from a TLS handshake with the club's own address (5 s at most). */
function certificateExpiry(host: string): Promise<string | null> {
  return new Promise(resolve => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 5000, rejectUnauthorized: false }, () => {
      const valid = socket.getPeerCertificate()?.valid_to;
      socket.end();
      const d = valid ? new Date(valid) : null;
      resolve(d && !Number.isNaN(d.getTime()) ? d.toISOString() : null);
    });
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', () => resolve(null));
  });
}

/** Does the club's bare name (lakeshorelynx.ca) send people on to its www address? true / false; never throws. */
async function bareForwards(bare: string, fullName: string): Promise<boolean> {
  for (const scheme of ['https', 'http']) {
    try {
      const res = await fetch(`${scheme}://${bare}/`, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'FieldLogicHQ-address-check' } });
      const to = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && to) {
        const host = new URL(to, `${scheme}://${bare}/`).hostname.toLowerCase();
        if (host === fullName) return true;
      }
    } catch { /* try the other scheme */ }
  }
  return false;
}

async function ownerContact(orgId: string): Promise<{ email: string | null; firstName: string | null }> {
  const { data: member } = await supabaseAdmin.from('organization_members').select('user_id').eq('organization_id', orgId).eq('role', 'owner').maybeSingle();
  if (!member?.user_id) return { email: null, firstName: null };
  const { data } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
  const user = data?.user;
  const full = (user?.user_metadata?.full_name ?? user?.user_metadata?.name) as string | undefined;
  return { email: user?.email ?? null, firstName: full?.trim().split(/\s+/)[0] || null };
}

function whichWasMissing(row: DomainRow): string {
  const r1 = row.last_check?.record1.state === 'found';
  const r2 = row.last_check?.record2.state === 'found';
  return r1 && !r2 ? 'record 2' : !r1 && r2 ? 'record 1' : 'either record';
}

async function emailOwner(row: DomainRow, which: OwnerEmail, patch: Partial<DomainRow>): Promise<boolean> {
  const { data: org } = await supabaseAdmin.from('organizations').select('name, slug').eq('id', row.org_id).maybeSingle();
  const owner = await ownerContact(row.org_id);
  if (!org || !owner.email) return true; // nobody to tell: not a failure to retry forever
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca').replace(/\/$/, '');
  const noticed = (patch.not_working_since ?? row.not_working_since ?? patch.needs_attention_since ?? row.needs_attention_since) as string | null;
  const padlock = (patch.padlock_expires_at ?? row.padlock_expires_at) as string | null;
  const facts: DomainEmailFacts = {
    clubName: org.name,
    address: row.full_name,
    bare: row.domain,
    oldAddress: `fieldlogichq.ca/${org.slug}`,
    rowUrl: `${appUrl}/${org.slug}/admin/public-site#address`,
    ownerFirstName: owner.firstName,
    padlockDate: padlock ? formatStoredDate(padlock, { longMonth: true }) : null,
    noticedDate: noticed ? formatStoredDate(noticed, { longMonth: true }) : null,
    noticedTime: noticed ? formatInOrgZone(noticed, { hour: 'numeric', minute: '2-digit' }) : null,
    bareNotForwarding: which === 'live' && row.prefix === 'www' && row.last_check?.bare_forwards === false,
    whichMissing: which === 'gave_up' ? whichWasMissing(row) : undefined,
  };
  const { subject, html } = clubDomainEmail(which, facts);
  const res = await sendEmail(owner.email, subject, html);
  return res.status !== 'provider_error';
}

export function clubDomainTickDeps(): TickDeps {
  return {
    listAll: () => clubDomainStore.listAll(),
    update: (orgId, patch) => clubDomainStore.update(orgId, patch),
    hostRead: (domain, prefix) => amplifyDomainHost.read(domain, prefix),
    cnames: name => publicDnsLookup.cnames(name),
    certificateExpiry,
    bareForwards,
    email: emailOwner,
    now: () => new Date(),
  };
}
