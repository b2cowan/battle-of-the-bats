'use client';

/**
 * The family page (P2 chunk D) — where a worklist row lands.
 *
 * Built to the Phase 2 mockups (plan §5.3); Club Tier Stage 5a changed its DATA and WORDS only (5b redraws it as a
 * record over the list — hub K4MPu4ni53Ct7yrDcmWJd9 v116, P2). The honest rules it embodies:
 *  · Money is the team's money, read the same way (E03): each child once with Dues · Paid · Balance in the coach's
 *    Player dues words, the event lines only when not zero, and the family's "Rep dues balance". A house-league child
 *    is Paid / Not paid with the fee as context, never summed (gap 2).
 *  · Children are counted once (E08), never as registration rows.
 *  · ONE email switch — "Club email · On / Opted out", org-wide (gap 1).
 *  · Forms & consent is REP-ONLY and absent entirely for a league-only family (gap 7).
 *  · Export sits at the page's head, above everything its file holds (the 10-09 / 10-11 rulings): PDF first, then a
 *    structured file. Message this family opens the one club send window (P4); a family it cannot reach, or one that
 *    has had today's three, has no door — the reason sits where it was (absent beats disabled).
 *  · Record-a-payment is DEFERRED (plan §5-P2 money note); no button pretends otherwise.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { usePageTitle } from '@/lib/usePageTitle';
import { formatStoredDate } from '@/lib/timezone';
import { useParams } from 'next/navigation';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ExportMenu from '@/components/admin/ExportMenu';
import MessageFamilyWindow from '@/components/admin/kit/club/families/MessageFamilyWindow';
import { FAMILY_FILE_WORDS as FW, FAMILY_MESSAGE_WORDS as MW, FAMILY_PAGE_WORDS as PW } from '@/lib/families-words';
import type { FamilyFile } from '@/lib/family-file';
import type { FamilyPagePayload } from '@/lib/families-read';
import { fmt } from '@/lib/coach-money-summary';
import { fetchResolvedPdfSettings, DEFAULT_PDF_SETTINGS, downloadFamilyFile } from '@/lib/export/pdf';
import styles from '../families.module.css';
import LoadingState from '@/components/shared/LoadingState';

// The server's own payload type — a type-only import, erased from the client bundle.
type Payload = FamilyPagePayload;

/** A Player dues figure in the product's one money face (`fmt`): a balance held for the family reads in brackets. */
const dollars = (cents: number) => fmt(cents / 100);
// The ONE formatter for stored dates (org timezone, never the reader's) — this
// page concentrates money and consent dates, exactly where a reader-timezone
// drift is most expensive.
const shortDate = (iso: string) => formatStoredDate(iso);

export default function FamilyPage() {
  const { currentOrg, userRole, userCapabilities, loading } = useOrg();
  const params = useParams<{ personId: string }>();
  const personId = params?.personId;
  const base = `/${currentOrg?.slug ?? ''}/admin`;
  const q = currentOrg?.slug ? `orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  const orgQuery = q ? `?${q}` : '';

  const canUse = !loading && !!currentOrg && !!userRole
    && hasCapability(userRole, userCapabilities, 'module_families')
    && hasModuleEntitlement(currentOrg, 'module_families');

  const [data, setData] = useState<Payload | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [msgOpen, setMsgOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  usePageTitle(data?.person.name ?? 'Family');

  useEffect(() => {
    if (!canUse || !currentOrg || !personId) return;
    // Stale guard — guardian PII must never paint under a different org/person
    // than the one that requested it.
    let stale = false;
    if (reload === 0) { setData(null); setStatus('loading'); }
    fetch(`/api/admin/families/${personId}${orgQuery}`)
      .then(r => {
        if (stale) return null;
        if (r.status === 404) { setStatus('notfound'); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: Payload | null) => { if (d && !stale) { setData(d); setStatus('ok'); } })
      // A refresh after a send that fails keeps the page and its notice; only a first load becomes the error screen.
      .catch(() => { if (!stale && reload === 0) setStatus('error'); });
    return () => { stale = true; };
  }, [canUse, currentOrg, personId, orgQuery, reload]);

  /** The family file, as the house PDF (drawn here, from the route's file) or the structured file (downloaded). */
  const exportPdf = useCallback(async () => {
    if (!personId || !currentOrg) return;
    setNotice(null);
    try {
      const [res, settings] = await Promise.all([
        fetch(`/api/admin/families/${personId}/export?${q}&format=pdf`),
        fetchResolvedPdfSettings(`/api/admin/org/pdf-settings?${q}&resolve=1`),
      ]);
      if (!res.ok) { setNotice(FW.failed); return; }
      const { file } = (await res.json()) as { file: FamilyFile };
      await downloadFamilyFile(`family-file-${file.family.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`, { file, settings: settings ?? DEFAULT_PDF_SETTINGS });
    } catch {
      setNotice(FW.failed);
    }
  }, [personId, currentOrg, q]);
  /** The structured file, fetched then saved — a refusal says so on the page instead of replacing it with raw JSON. */
  const exportJson = useCallback(async () => {
    if (!personId) return;
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/families/${personId}/export?${q}&format=json`);
      if (!res.ok) { setNotice(FW.failed); return; }
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'family-file.json';
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(FW.failed);
    }
  }, [personId, q]);

  if (loading || !userRole || !currentOrg) {
    return <LoadingState label="Loading this family…" />;
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
    return <LoadingState label="Loading this family…" />;
  }

  const { person, addresses, children, money, guardians, contact, message, forms, consents, history } = data;
  const hasRepChildren = children.some(c => c.source === 'rep_roster' && c.current);
  const liveConsents = consents.filter(c => !c.withdrawnAt);
  // The door's reason, where the door was (absent beats disabled): nobody reachable first, then today's three.
  const doorReason = message.reachable === 0 ? MW.optedOutReason : message.capped ? MW.capReason(message.nextAt) : null;

  return (
    <div className={styles.page}>
      {/* The way back is the header's leading corner (backTo) — one back treatment, as in the coaches portal. */}
      <AdminPageHeader
        backTo={{ href: `${base}/families`, label: 'Families' }}
        title={person.name}
        // F3 — "Guardian" is who this person IS: an identity chip beside the name. The counts move to
        // the Children card below, which is the list they count.
        titleChips={<span className={`${styles.pill} ${styles.pillMute}`}>Guardian</span>}
        actions={
          <ExportMenu
            formats={['pdf']}
            onExportPDF={exportPdf}
            pdfLabel={FW.pdf}
            planId={currentOrg.planId}
            holds={{ title: FW.menuHolds }}
            document={{ onExportJSON: exportJson, jsonLabel: FW.structured, jsonHint: FW.structuredHint }}
          />
        }
      />

      <div className={styles.grid}>
        <div className={styles.panel}>
          <h2 className={styles.panelHead}>
            Children<span className={styles.panelScope}>{PW.children(data.childCount)}</span>
          </h2>
          {children.length === 0 && <p className={styles.panelFoot} style={{ border: 0, margin: 0, padding: 0 }}>No registrations attach to this person — their record came from a tryout.</p>}
          {children.map(c => (
            <div key={c.sourceRowId} className={`${styles.line} ${!c.current ? styles.lineSub : ''}`}>
              <span>{c.childName}</span>
              <span className={styles.lineV}>{c.where}{c.year ? ` · ${c.year}` : ''}{!c.current ? ' · past' : ''}</span>
            </div>
          ))}
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelHead}>Money</h2>
          {money.children.length === 0 && money.leagueLines.length === 0 && (
            <p className={styles.panelFoot} style={{ border: 0, margin: 0, padding: 0 }}>{PW.noMoney}</p>
          )}
          {money.children.map(m => (
            <div key={m.childKey}>
              <div className={styles.line}>
                <span>{m.childName}{m.year ? ` · ${m.year}` : ''}</span>
                <span className={styles.lineV}>{PW.balance} {dollars(m.balanceCents)}</span>
              </div>
              <div className={`${styles.line} ${styles.lineSub}`}><span>{PW.dues}</span><span className={styles.lineV}>{dollars(m.duesCents)}</span></div>
              {m.fundraisingCents !== 0 && <div className={`${styles.line} ${styles.lineSub}`}><span>{PW.fundraising}</span><span className={styles.lineV}>{dollars(m.fundraisingCents)}</span></div>}
              {m.otherCreditsCents !== 0 && <div className={`${styles.line} ${styles.lineSub}`}><span>{PW.otherCredits}</span><span className={styles.lineV}>{dollars(m.otherCreditsCents)}</span></div>}
              <div className={`${styles.line} ${styles.lineSub}`}><span>{PW.paid}</span><span className={styles.lineV}>{dollars(m.paidCents)}</span></div>
              {m.handedBackCents !== 0 && <div className={`${styles.line} ${styles.lineSub}`}><span>{PW.handedBack}</span><span className={styles.lineV}>{dollars(m.handedBackCents)}</span></div>}
            </div>
          ))}
          {money.children.length > 0 && (
            <div className={`${styles.line} ${styles.lineTotal}`}>
              <span>{PW.repBalance}</span>
              <span className={styles.lineV}>{dollars(money.repBalanceCents)}</span>
            </div>
          )}
          {money.leagueLines.map(l => (
            <div key={`${l.childName}-${l.seasonName}`} className={styles.line}>
              <span>{l.childName} — registration</span>
              <span className={styles.lineV}>
                <span className={`${styles.pill} ${l.paid ? styles.pillGood : styles.pillBad}`}>{PW.leaguePaid(l.paid)}</span>
                {l.feeCents != null && <> · {PW.leagueFeeOf(dollars(l.feeCents))}</>}
              </span>
            </div>
          ))}
          {(money.lastReminderAt || money.leagueLines.length > 0) && (
            <p className={styles.panelFoot}>
              {money.lastReminderAt ? `Dues reminders last reached this family ${shortDate(money.lastReminderAt)}. ` : ''}
              {money.leagueLines.length > 0 && 'A house-league fee is a paid/not-paid record, never summed into a balance.'}
            </p>
          )}
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelHead}>Guardians</h2>
          {guardians.map(g => (
            <div key={g.personId} className={styles.line}>
              <span>{g.name}</span>
              <span className={styles.lineV}><span className={`${styles.pill} ${styles.pillInfo}`}>{g.provenance}</span></span>
            </div>
          ))}
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
          <div className={styles.line}>
            <span>{MW.lastMessaged}</span>
            <span className={styles.lineV}>{message.lastMessaged ? MW.lastMessagedValue(message.lastMessaged.at, message.lastMessaged.by) : MW.neverMessaged}</span>
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
        {doorReason
          ? <p className={styles.notice} style={{ margin: 0 }}>{doorReason}</p>
          : <button className="btn btn-lime btn-data" onClick={() => { setNotice(null); setMsgOpen(true); }}>{MW.door}</button>}
      </div>
      {notice && <p className={styles.notice} role="status">{notice}</p>}

      {msgOpen && personId && (
        <MessageFamilyWindow
          q={q}
          personId={personId}
          familyName={person.name}
          onClose={() => setMsgOpen(false)}
          onSent={text => { setMsgOpen(false); setNotice(text); setReload(n => n + 1); }}
        />
      )}
    </div>
  );
}
