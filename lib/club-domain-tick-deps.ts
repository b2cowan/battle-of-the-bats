import 'server-only';
import tls from 'node:tls';
import { lookup } from 'node:dns/promises';
import { amplifyDomainHost } from '@/lib/amplify-domains';
import { publicDnsLookup } from '@/lib/club-domain-dns';
import { clubDomainStore } from '@/lib/club-domain-store';
import type { DomainRow } from '@/lib/club-domain-service';
import { hostStatusMeansGone, type OwnerEmail, type TickDeps } from '@/lib/club-domain-tick';
import { clubDomainEmail, type DomainEmailFacts } from '@/lib/email-club-domain';
import { sendEmail } from '@/lib/email';
import { orgOwnerUserIds } from '@/lib/notify-recipients';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatInOrgZone, formatStoredDate } from '@/lib/timezone';

/**
 * The real world for the status check (lib/club-domain-tick.ts): the stored connections, the host, DNS, the live certificate, the
 * bare name's forward, and the owner's mailbox. READS ONLY against the outside world: nothing here writes to AWS or to anyone's DNS.
 * Per connected club per day: one DNS lookup for record 1, one host read, one certificate read, one HTTP request; per hour: one
 * DNS lookup for record 2.
 *
 * ⚠ The club chooses the name this server connects to (the certificate read and the bare-name fetch), so a name that resolves to
 * a private, loopback or link-local address is never connected to: an unanswered question, not a probe of our own network.
 */

/** Is this address one a public website could have (not private, loopback, link-local, carrier-grade NAT, unspecified)? */
export function isPublicIp(ip: string): boolean {
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return false;
  if (/^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return false; // unique-local, link-local
  return true;
}

async function resolvesPublicly(host: string): Promise<boolean> {
  try {
    const all = await lookup(host, { all: true });
    return all.length > 0 && all.every(a => isPublicIp(a.address));
  } catch {
    return false;
  }
}

/** The date the club's live certificate runs out, from a TLS handshake with the club's own address (5 s at most). Rejects when it could not be read. */
async function certificateExpiry(host: string): Promise<string | null> {
  if (!(await resolvesPublicly(host))) throw new Error('not a public address');
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 5000, rejectUnauthorized: false }, () => {
      const valid = socket.getPeerCertificate()?.valid_to;
      socket.end();
      const d = valid ? new Date(valid) : null;
      if (d && !Number.isNaN(d.getTime())) resolve(d.toISOString());
      else reject(new Error('no certificate date'));
    });
    socket.on('timeout', () => { socket.destroy(); reject(new Error('timeout')); });
    socket.on('error', e => reject(e));
  });
}

/** Does the club's bare name (lakeshorelynx.ca) send people on to its www address? true / false when answered; throws when no answer could be had. */
async function bareForwards(bare: string, fullName: string): Promise<boolean> {
  if (!(await resolvesPublicly(bare))) throw new Error('not a public address');
  let answered = false;
  for (const scheme of ['https', 'http']) {
    try {
      const res = await fetch(`${scheme}://${bare}/`, { redirect: 'manual', signal: AbortSignal.timeout(6000), headers: { 'user-agent': 'FieldLogicHQ-address-check' } });
      answered = true;
      void res.body?.cancel().catch(() => undefined);
      const to = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && to) {
        const host = new URL(to, `${scheme}://${bare}/`).hostname.toLowerCase();
        if (host === fullName) return true;
      }
    } catch { /* try the other scheme */ }
  }
  if (!answered) throw new Error('no answer');
  return false;
}

/** The owner's address and first name, or `null` when the lookup could not be made (the email is then retried, never stamped). */
async function ownerContact(orgId: string): Promise<{ email: string | null; firstName: string | null } | null> {
  try {
    const [userId] = await orgOwnerUserIds(orgId);
    if (!userId) return { email: null, firstName: null };
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) return null;
    const user = data?.user;
    const full = (user?.user_metadata?.full_name ?? user?.user_metadata?.name) as string | undefined;
    return { email: user?.email ?? null, firstName: full?.trim().split(/\s+/)[0] || null };
  } catch {
    return null;
  }
}

async function emailOwner(row: DomainRow, which: OwnerEmail, patch: Partial<DomainRow>): Promise<boolean> {
  const { data: org, error } = await supabaseAdmin.from('organizations').select('name, slug').eq('id', row.org_id).maybeSingle();
  if (error) return false;
  const owner = await ownerContact(row.org_id);
  if (owner === null) return false; // could not look: try again next wake
  if (!org || !owner.email) return true; // nobody to tell: not a failure to retry forever
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.fieldlogichq.ca').replace(/\/$/, '');
  const noticed = (patch.not_working_since ?? row.not_working_since ?? patch.needs_attention_since ?? row.needs_attention_since) as string | null;
  const padlock = (patch.padlock_expires_at ?? row.padlock_expires_at) as string | null;
  const seen = (patch.last_check ?? row.last_check) as DomainRow['last_check'];
  const r1 = seen?.record1.state === 'found';
  const r2 = seen?.record2.state === 'found';
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
    bareNotForwarding: which === 'live' && row.prefix === 'www' && seen?.bare_forwards === false,
    whichMissing: which === 'gave_up' ? (r1 && !r2 ? 'record 2' : !r1 && r2 ? 'record 1' : 'either record') : undefined,
    bothRecordsFound: which === 'gave_up' && r1 && r2,
    hostCause: which === 'not_working' && hostStatusMeansGone((patch.host_status ?? row.host_status) as string | null),
  };
  const { subject, html } = clubDomainEmail(which, facts);
  const res = await sendEmail(owner.email, subject, html, { kind: 'club_domain_notice', orgId: row.org_id });
  // Only a send counts: 'skipped' (no mail key configured) is not "told", so the owner is told once the key exists.
  return res.status === 'sent';
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
