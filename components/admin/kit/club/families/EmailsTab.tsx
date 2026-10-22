'use client';
/**
 * THE EMAILS TAB (Club Tier Stage 7c — Ask 7 A; drawing 5). Every email the club sent from Families, newest first: an
 * Email families send ("Reached 86 of 88"; "Sending…" while it goes; "Stopped at x of y" once it sat unfinished) and a
 * one-household message (Stage 5a — its date and sender only, so its row reads "1 family" and no subject, never an
 * invented number). The table standard at a desk (Sent · Subject · To · By · Reached · chevron), one framed row each on a
 * phone; a page at a time with Show more. A row opens a read-only record: the email as sent and its counts — ⚠ never a
 * list of families (owner 2026-10-22, Put to the owner 1). Nothing here is editable.
 *
 * It is also the ONE door to a send (owner 2026-10-22: moved off the Families toolbar — a send picks its own audience, so
 * it was never about the list on screen): "Email families" top right of the head, and on the empty card, opens
 * `EmailFamiliesWindow`; a send reloads the log and says so with the pill.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { FAMILY_EMAIL_WORDS as EW, FAMILY_EMAILS_TAB_WORDS as W } from '@/lib/families-words';
import type { EmailLogPage, EmailLogRow } from '@/lib/families-emails-log';
import LoadingState from '@/components/shared/LoadingState';
import KitDialog from '../KitDialog';
import EmailFamiliesWindow from './EmailFamiliesWindow';
import ck from '../ClubKit.module.css';
import { ClubRow, ClubRowList, EmptyCard, LoadFailed, NoticePill, RepChip, repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { moneyFetch } from '../money/MoneyKit';
import fam from './Families.module.css';

const reachedText = (r: EmailLogRow) => {
  if (!r.counts) return W.oneFamily;
  if (r.state === 'sending') return W.sending;
  if (r.state === 'stopped') return W.stopped(r.counts.reached, r.counts.families);
  return W.reached(r.counts.reached, r.counts.families);
};
/** The Reached cell: a send that stopped partway wears the amber chip (a status is said once, by a chip), its figures after. */
const reachedCell = (r: EmailLogRow) => (r.counts && r.state === 'stopped'
  ? <><RepChip tone="warn">{W.stoppedChip}</RepChip> {W.reached(r.counts.reached, r.counts.families)}</>
  : reachedText(r));
const subjectText = (r: EmailLogRow) => r.subject ?? W.oneFamilySubject;

export default function EmailsTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const [rows, setRows] = useState<EmailLogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<EmailLogRow | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<EmailLogPage>(`/api/admin/families/emails?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setRows(r.data.rows); setTotal(r.data.total); setNext(r.data.next);
  }, [slug, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  async function loadMore() {
    if (!next || more) return;
    setMore(true);
    const r = await moneyFetch<EmailLogPage>(`/api/admin/families/emails?${q}&before=${encodeURIComponent(next)}`).catch(() => null);
    setMore(false);
    if (!r?.ok) return;
    setRows(list => {
      const seen = new Set((list ?? []).map(x => x.key));
      return [...(list ?? []), ...r.data.rows.filter(x => !seen.has(x.key))];
    });
    setNext(r.data.next);
  }

  if (failed && !rows) return <LoadFailed title={W.loadFailed} onRetry={() => void load()} />;
  if (!rows) return <LoadingState label="Loading emails…" />;

  // The one door to a send (owner 2026-10-22): beside the log it feeds, in words on a phone (a primary action).
  const door = (
    <button type="button" className="btn btn-outline" onClick={() => setEmailing(true)} aria-haspopup="dialog">
      {EW.door}
    </button>
  );
  const sending = (
    <>
      {emailing && (
        <EmailFamiliesWindow
          q={q}
          onClose={() => setEmailing(false)}
          onShowNoFamily={() => { setEmailing(false); router.push(`/${slug}/admin/families?show=nofamily`); }}
          onSent={text => { setEmailing(false); setSaid(text); void load(); }}
        />
      )}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </>
  );

  if (rows.length === 0) return <><EmptyCard title={W.emptyTitle} action={door}>{W.emptyBody}</EmptyCard>{sending}</>;

  return (
    <>
      <div className={fam.emailsHead}>
        <p className={fam.lede}>{W.lede(total)}</p>
        {door}
      </div>
      {/* A read that failed after the list was already on screen (the reload after a send): say so, and offer the retry. */}
      {failed && <p className={repKit.formError}>{W.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{EW.tryAgain}</button></p>}
      {isPhone ? (
        <ClubRowList label={W.tab}>
          {rows.map(r => (
            <ClubRow key={r.key} as="button" onClick={() => setOpen(r)} aria-haspopup="dialog" aria-label={W.open(subjectText(r))}
              title={(
                <span className={fam.cardTitle}>
                  <span>{subjectText(r)}</span>
                  <span className={fam.cardFigure}>{reachedCell(r)}</span>
                </span>
              )}
              caption={`${W.sentAt(r.sentAt)} · ${r.to}${r.by ? ` · ${r.by}` : ''}`}
              chevron
            />
          ))}
        </ClubRowList>
      ) : (
        <div className={repKit.tableFrame}>
          <table className={repKit.table}>
            <thead>
              <tr>
                <th scope="col" style={{ width: '15%' }}>{W.colSent}</th>
                <th scope="col">{W.colSubject}</th>
                <th scope="col" style={{ width: '22%' }}>{W.colTo}</th>
                <th scope="col" style={{ width: '15%' }}>{W.colBy}</th>
                <th scope="col" className={repKit.num} style={{ width: '18%' }}>{W.colReached}</th>
                <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className={repKit.rowOpens}
                  onClick={() => { if (window.getSelection()?.toString()) return; setOpen(r); }}>
                  <td className={fam.nw}>{W.sentAt(r.sentAt)}</td>
                  <td>
                    <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                      onClick={e => { e.stopPropagation(); setOpen(r); }}>
                      <span className={r.subject ? undefined : repKit.dim}>{subjectText(r)}</span>
                    </button>
                  </td>
                  <td>{r.to}</td>
                  <td className={fam.nwClip} title={r.by ?? undefined}>{r.by ?? '—'}</td>
                  <td className={`${repKit.num} ${fam.nw}`}>{reachedCell(r)}</td>
                  <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {next && (
        <div className={fam.more}>
          <button type="button" className="btn btn-outline" onClick={() => void loadMore()} disabled={more}>{W.showMore}</button>
        </div>
      )}
      {open && <EmailRecord q={q} row={open} onClose={() => setOpen(null)} />}
      {sending}
    </>
  );
}

/** One email as sent: its words (a club-wide send) and its counts. A one-household message keeps no words. */
function EmailRecord({ q, row, onClose }: { q: string; row: EmailLogRow; onClose: () => void }) {
  const [detail, setDetail] = useState<(EmailLogRow & { body: string }) | null>(null);
  const [failed, setFailed] = useState(false);
  const read = useCallback(async () => {
    if (row.kind !== 'club') return;
    const r = await moneyFetch<EmailLogRow & { body: string }>(`/api/admin/families/emails/${encodeURIComponent(row.id)}?${q}`).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setDetail(r.data);
  }, [q, row]);
  useDeferredLoad(true, read);

  const r = detail ?? row;
  const body = detail?.body ?? null;
  const c = r.counts;
  return (
    <KitDialog kind="form" record size="medium" eyebrow={W.tab} title={subjectText(r)} onClose={onClose}>
      <dl className={fam.read}>
        <dt>{W.factSent}</dt><dd>{W.sentAt(r.sentAt)}</dd>
        <dt>{W.factBy}</dt><dd className={r.by ? undefined : fam.quiet}>{r.by ?? '—'}</dd>
        <dt>{W.factTo}</dt><dd>{r.to}</dd>
        {c && (
          <>
            <dt>{W.factGoingTo}</dt><dd>{c.families}</dd>
            <dt>{W.factReached}</dt><dd>{reachedText(r)}</dd>
            <dt>{W.factOptedOut}</dt><dd className={c.optedOut ? undefined : fam.quiet}>{c.optedOut}</dd>
            <dt>{W.factFailed}</dt><dd className={c.failed ? undefined : fam.quiet}>{c.failed}</dd>
            <dt>{W.factCoaches}</dt><dd className={c.coaches ? undefined : fam.quiet}>{c.coaches}</dd>
          </>
        )}
      </dl>
      {r.kind === 'club' ? (
        <>
          <div className={fam.readAfter} />
          {failed ? <p className={repKit.formError}>{W.loadFailed}</p>
            : body == null ? <LoadingState inline label="Loading the email…" />
            : <p className={fam.emailBody}>{body}</p>}
          <p className={ck.hint}>{r.state === 'stopped' ? W.stoppedNote : W.reachedNote}</p>
        </>
      ) : (
        <p className={`${ck.hint} ${fam.readAfter}`}>{W.oneFamilyNote}</p>
      )}
    </KitDialog>
  );
}
