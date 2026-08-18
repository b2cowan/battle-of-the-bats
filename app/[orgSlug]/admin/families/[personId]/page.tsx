'use client';

/**
 * The family page (P2 chunk D) — where a worklist row lands.
 *
 * Built to the Phase 2 mockups (plan §5.3). The honest rules it embodies:
 *  · Money is asymmetric and labelled: rep dues are dollar lines; a house-league
 *    child is Paid / Not paid with the fee as context, never summed (gap 2).
 *  · ONE email switch — "Club email · On / Opted out", org-wide (gap 1).
 *  · Forms & consent is REP-ONLY and absent entirely for a league-only family;
 *    a league child has no rows because nothing was ever storable (gap 7).
 *  · Children are joined through the PARENT; no sibling claim is made (gap 4).
 *  · History lists what is recorded — money, addresses, registrations — never
 *    sent emails, which nothing records (gap 3).
 *  · Actions: message + export. Record-a-payment is DEFERRED until the money
 *    QA walks land (plan §5-P2 money note); no button pretends otherwise.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Contact } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { usePageTitle } from '@/lib/usePageTitle';
import { formatStoredDate } from '@/lib/timezone';
import { useParams } from 'next/navigation';
import styles from '../families.module.css';

interface Payload {
  person: { id: string; name: string; email: string; phone: string | null; createdAt: string };
  addresses: { email: string; isCurrent: boolean; firstSeenAt: string; lastSeenAt: string }[];
  children: { source: string; sourceRowId: string; childName: string; where: string; year: number | null; current: boolean }[];
  money: {
    repLines: { childName: string; year: number; totalCents: number; paidCents: number; unpaidCents: number; lastReminderAt: string | null }[];
    creditCents: number;
    owingCents: number;
    leagueLines: { childName: string; seasonName: string; feeCents: number | null; paid: boolean }[];
  };
  guardians: { personId: string; name: string; email: string; provenance: string; portalActive: boolean }[];
  contact: { optedOut: boolean; optedOutVia: string | null };
  forms: { childName: string; templateName: string; documentType: string; status: 'on_file' | 'missing' }[];
  consents: { basis: string; scope: string; startedAt: string; withdrawnAt: string | null }[];
  history: { at: string; what: string }[];
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
// The ONE formatter for stored dates (org timezone, never the reader's) — this
// page concentrates money and consent dates, exactly where a reader-timezone
// drift is most expensive.
const shortDate = (iso: string) => formatStoredDate(iso);

export default function FamilyPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const params = useParams<{ personId: string }>();
  const personId = params?.personId;
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';

  const canUse = !loading && !!currentOrg && !!userRole
    && hasCapability(userRole, userCapabilities, 'module_families')
    && hasModuleEntitlement(currentOrg, 'module_families');

  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [msgOpen, setMsgOpen] = useState(false);
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');
  const [msgResult, setMsgResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  usePageTitle(data?.person.name ?? 'Family');

  useEffect(() => {
    if (!canUse || !currentOrg || !personId) return;
    // Stale guard — guardian PII must never paint under a different org/person
    // than the one that requested it.
    let stale = false;
    setData(null); setStatus('loading');
    fetch(`/api/admin/families/${personId}${orgQuery}`)
      .then(r => {
        if (stale) return null;
        if (r.status === 404) { setStatus('notfound'); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: Payload | null) => { if (d && !stale) { setData(d); setStatus('ok'); } })
      .catch(() => { if (!stale) setStatus('error'); });
    return () => { stale = true; };
  }, [canUse, currentOrg, personId, orgQuery]);

  if (loading || !userRole || !currentOrg) {
    return <div className="flex items-center justify-center h-64"><span className="hud-label">Loading...</span></div>;
  }
  if (!canUse) {
    return (
      <div className={styles.page}>
        <div className={styles.empty} style={{ marginTop: '3rem' }}>
          <h2 className={styles.emptyTitle}>This area needs the Families permission</h2>
          <p className={styles.emptyBody}>An owner can grant it from Organization Admin → Members → Manage member → Module access.</p>
        </div>
      </div>
    );
  }
  if (status === 'notfound' || status === 'error') {
    return (
      <div className={styles.page}>
        <Link href={`${base}/families`} className={styles.backLink}><ArrowLeft size={13} /> Families</Link>
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>{status === 'notfound' ? 'No family here' : 'Could not load this family'}</h2>
          <p className={styles.emptyBody}>{status === 'notfound' ? 'The record does not exist in this organization.' : 'Reload to try again.'}</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="flex items-center justify-center h-64"><span className="hud-label">Loading…</span></div>;
  }

  const { person, addresses, children, money, guardians, contact, forms, consents, history } = data;
  const currentChildren = children.filter(c => c.current);
  const formerChildren = children.filter(c => !c.current);
  const hasRepChildren = children.some(c => c.source === 'rep_roster' && c.current);
  const liveConsents = consents.filter(c => !c.withdrawnAt);

  async function sendMessage() {
    if (!msgSubject.trim() || !msgBody.trim() || sending) return;
    setSending(true); setMsgResult(null);
    try {
      const res = await fetch(`/api/admin/families/${personId}/message${orgQuery}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: msgSubject, body: msgBody }),
      });
      const d = await res.json();
      if (!res.ok) setMsgResult(d.error ?? 'Send failed');
      else if (d.status === 'suppressed') setMsgResult('Not sent — this family has opted out of club email.');
      else { setMsgResult(`Sent to ${d.sent} of ${d.recipients} guardian${d.recipients === 1 ? '' : 's'}.`); setMsgSubject(''); setMsgBody(''); }
    } catch { setMsgResult('Send failed'); }
    setSending(false);
  }

  return (
    <div className={styles.page}>
      <Link href={`${base}/families`} className={styles.backLink}><ArrowLeft size={13} /> Families</Link>
      <div className={styles.pageHeader}>
        <div className={styles.headerIcon}><Contact size={20} /></div>
        <div>
          <h1 className={styles.pageTitle}>{person.name}</h1>
          <p className={styles.pageSub}>
            Guardian · {currentChildren.length} current registration{currentChildren.length === 1 ? '' : 's'}
            {formerChildren.length > 0 && ` · ${formerChildren.length} past`}
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h2 className={styles.panelHead}>Children</h2>
          {children.length === 0 && <p className={styles.panelFoot} style={{ border: 0, margin: 0, padding: 0 }}>No registrations attach to this person — their record came from a tryout.</p>}
          {children.map(c => (
            <div key={c.sourceRowId} className={`${styles.line} ${!c.current ? styles.lineSub : ''}`}>
              <span>{c.childName}</span>
              <span className={styles.lineV}>{c.where}{c.year ? ` · ${c.year}` : ''}{!c.current ? ' · past' : ''}</span>
            </div>
          ))}
          {children.length > 1 && (
            <p className={styles.panelFoot}>
              Children are joined through this parent — one parent registered each of them. The system does
              not claim same-named children across programmes are the same child.
            </p>
          )}
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelHead}>Money</h2>
          {money.repLines.length === 0 && money.leagueLines.length === 0 && (
            <p className={styles.panelFoot} style={{ border: 0, margin: 0, padding: 0 }}>No dues or registration fees on record this season.</p>
          )}
          {money.repLines.map(l => (
            <div key={`${l.childName}-${l.year}`}>
              <div className={styles.line}>
                <span>{l.childName} — dues {l.year}</span>
                <span className={styles.lineV}>{dollars(l.totalCents)}</span>
              </div>
              {l.paidCents > 0 && <div className={`${styles.line} ${styles.lineSub}`}><span>Paid to date</span><span className={styles.lineV}>−{dollars(l.paidCents)}</span></div>}
            </div>
          ))}
          {money.creditCents > 0 && (
            <div className={styles.line}><span>Credits on file</span><span className={styles.lineV}>{dollars(money.creditCents)}</span></div>
          )}
          {money.repLines.length > 0 && (
            <div className={`${styles.line} ${styles.lineTotal}`}>
              <span>Unpaid installments — rep dues</span>
              <span className={styles.lineV}>{dollars(money.owingCents)}</span>
            </div>
          )}
          {money.leagueLines.map(l => (
            <div key={`${l.childName}-${l.seasonName}`} className={styles.line}>
              <span>{l.childName} — registration</span>
              <span className={styles.lineV}>
                <span className={`${styles.pill} ${l.paid ? styles.pillGood : styles.pillBad}`}>{l.paid ? 'Paid' : 'Not paid'}</span>
                {l.feeCents != null && <> · fee {dollars(l.feeCents)}</>}
              </span>
            </div>
          ))}
          <p className={styles.panelFoot}>
            {money.repLines.some(l => l.lastReminderAt)
              ? `Dues reminders last reached this family ${shortDate(money.repLines.map(l => l.lastReminderAt).filter(Boolean).sort().reverse()[0]!)}. `
              : ''}
            Credits are shown as recorded — how they apply to dues is the money book&rsquo;s call, not this page&rsquo;s.
            {money.leagueLines.length > 0 && ' A house-league fee is a paid/not-paid record, never summed into a balance.'}
          </p>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelHead}>Guardians</h2>
          {guardians.map(g => (
            <div key={g.personId} className={styles.line}>
              <span>{g.name}</span>
              <span className={styles.lineV}><span className={`${styles.pill} ${styles.pillInfo}`}>{g.provenance}</span></span>
            </div>
          ))}
          <div className={styles.line}>
            <span>Portal access</span>
            <span className={styles.lineV}>{guardians.some(g => g.portalActive) ? 'Active' : 'Never invited'}</span>
          </div>
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelHead}>Contact</h2>
          {addresses.map(a => (
            <div key={a.email} className={styles.line}>
              <span style={{ overflowWrap: 'anywhere' }}>{a.email}</span>
              <span className={styles.lineV}>
                {a.isCurrent
                  ? <span className={`${styles.pill} ${styles.pillGood}`}>Current</span>
                  : `to ${shortDate(a.lastSeenAt)}`}
              </span>
            </div>
          ))}
          <div className={styles.line}>
            <span>Phone</span>
            <span className={styles.lineV}>{person.phone ?? 'Not on file'}</span>
          </div>
          <div className={styles.line}>
            <span>Club email</span>
            <span className={styles.lineV}>
              {contact.optedOut
                ? <span className={`${styles.pill} ${styles.pillBad}`}>Opted out</span>
                : <span className={`${styles.pill} ${styles.pillGood}`}>On</span>}
            </span>
          </div>
          <p className={styles.panelFoot}>
            One switch, org-wide: an opt-out suppresses all family email from this club
            {contact.optedOut && contact.optedOutVia && contact.optedOutVia !== person.email
              ? ` — recorded under a former address (${contact.optedOutVia}) and honoured for the current one`
              : ''}.
          </p>
        </div>

        {/* Rendered when there are rep children (forms) OR any consent on record —
            a league-only family's waiver acceptance (mig 252) must be visible;
            only the FORMS half is rep-scoped (plan §5.3 gap 7 + review fix). */}
        {(hasRepChildren || liveConsents.length > 0) && (
          <div className={styles.panel}>
            <h2 className={styles.panelHead}>Forms &amp; consent <span className={styles.panelScope}>forms are rep-only</span></h2>
            {liveConsents.length === 0
              ? <div className={styles.line}><span>Consent</span><span className={styles.lineV}>None on file</span></div>
              : liveConsents.map((c, i) => (
                  <div key={i} className={styles.line}>
                    <span>Consent · {c.basis === 'league_registration' ? 'league waiver' : c.basis.replace(/_/g, ' ')}</span>
                    <span className={styles.lineV}><span className={`${styles.pill} ${styles.pillGood}`}>{shortDate(c.startedAt)}</span></span>
                  </div>
                ))}
            {forms.map((f, i) => (
              <div key={i} className={styles.line}>
                <span>{f.childName} — {f.templateName}</span>
                <span className={styles.lineV}>
                  <span className={`${styles.pill} ${f.status === 'on_file' ? styles.pillGood : styles.pillBad}`}>
                    {f.status === 'on_file' ? 'On file' : 'Missing'}
                  </span>
                </span>
              </div>
            ))}
            <p className={styles.panelFoot}>
              House league keeps no forms, so league children have no form rows — nothing is &ldquo;missing&rdquo; for
              them. A league waiver acceptance appears above as consent.
            </p>
          </div>
        )}

        <div className={styles.panel}>
          <h2 className={styles.panelHead}>History</h2>
          {history.length === 0 && <p className={styles.panelFoot} style={{ border: 0, margin: 0, padding: 0 }}>Nothing recorded yet.</p>}
          {history.slice(0, 10).map((h, i) => (
            <div key={i} className={styles.line}>
              <span>{shortDate(h.at)}</span>
              <span className={styles.lineV}>{h.what}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.actionbar}>
        <button className="btn btn-lime btn-data" onClick={() => setMsgOpen(o => !o)}>Message this family</button>
        <a
          className="btn btn-outline btn-data"
          href={`/api/admin/families/${personId}/export${orgQuery}`}
          download
        >
          Export their data
        </a>
      </div>

      {msgOpen && (
        <div className={styles.msgForm}>
          <input
            className={styles.msgInput}
            placeholder="Subject"
            value={msgSubject}
            onChange={e => setMsgSubject(e.target.value)}
            aria-label="Message subject"
          />
          <textarea
            className={`${styles.msgInput} ${styles.msgTextarea}`}
            placeholder="Message — sent once to every guardian in this family, with the club identified and an unsubscribe link. Opt-outs are honoured automatically."
            value={msgBody}
            onChange={e => setMsgBody(e.target.value)}
            aria-label="Message body"
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-lime btn-data" onClick={sendMessage} disabled={sending || !msgSubject.trim() || !msgBody.trim()}>
              {sending ? 'Sending…' : 'Send'}
            </button>
            <button className="btn btn-outline btn-data" onClick={() => { setMsgOpen(false); setMsgResult(null); }}>Cancel</button>
          </div>
          {msgResult && <p className={styles.notice}>{msgResult}</p>}
        </div>
      )}
    </div>
  );
}
