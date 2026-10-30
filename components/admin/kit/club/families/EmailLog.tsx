'use client';
/**
 * AN EMAIL LOG AND ONE EMAIL'S RECORD — the club's (Families › Emails, Stage 7c drawing 5) and a house-league season's
 * (its Email families history, 9d-1 frame e) wear the same list and the same record (memory
 * `feedback_shared_component_over_shared_class`).
 *
 * The table standard at a desk (Sent · Subject · To · By · Reached · chevron), one framed row each on a phone. A row opens
 * a read-only record: the email as sent, its counts and — since 9d-1 — the families it missed and those who opted out,
 * named one to three. A stopped email offers "Send to the N it missed" (9d1·10): the same email, never counted. An
 * automatic notice (9d1·4) wears the Automatic tag, which opens what it means. The old season log's rows ("Earlier emails ·
 * counted per child", 9d1·3) open nothing. Nothing here is editable.
 */
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { CLUB_EMAIL_CAP, FAMILY_EMAILS_TAB_WORDS as W, SEASON_EMAIL_WORDS as SW } from '@/lib/families-words';
import { PRACTICES_CHANGED_NOTICE } from '@/lib/club-schedule-league-words';
import { SCHEDULE_NOTICE_WORDS } from '@/lib/league-schedule-words';
import type { ClubEmailRecord, EmailLogRow } from '@/lib/families-emails-log';
import LoadingState from '@/components/shared/LoadingState';
import KitDialog, { DialogCancel } from '../KitDialog';
import ck from '../ClubKit.module.css';
import { ClubRow, ClubRowList, RepChip, repKit, useDeferredLoad } from '../RepKit';
import { jsonInit, moneyFetch, refusalText } from '../money/MoneyKit';
import { SendStanding } from '../SendParts';
import fam from './Families.module.css';

export const reachedText = (r: EmailLogRow) => {
  if (r.kind === 'earlier') return r.oldReached ?? '';
  if (!r.counts) return W.oneFamily;
  if (r.state === 'sending') return W.sending;
  if (r.state === 'stopped') return W.stopped(r.counts.reached, r.counts.families);
  return W.reached(r.counts.reached, r.counts.families);
};
/** The Reached cell: a send that stopped partway wears the amber chip (a status is said once, by a chip), its figures after. */
const reachedCell = (r: EmailLogRow) => (r.counts && r.state === 'stopped'
  ? <><span className={fam.chipGap}><RepChip tone="warn">{W.stoppedChip}</RepChip></span>{W.reached(r.counts.reached, r.counts.families)}</>
  : reachedText(r));
export const subjectText = (r: EmailLogRow) => r.subject ?? W.oneFamilySubject;

/** The subject, with the Automatic tag on a notice — a button, since every highlight opens (memory `feedback_clickable_design_annotations`). */
function SubjectCell({ r, onOpen }: { r: EmailLogRow; onOpen: (r: EmailLogRow) => void }) {
  return (
    <>
      <span className={r.subject ? undefined : repKit.dim}>{subjectText(r)}</span>
      {r.kind === 'notice' && <> <button type="button" className={fam.tagButton} onClick={e => { e.stopPropagation(); onOpen(r); }}
        aria-haspopup="dialog"><RepChip>{SW.automaticTag}</RepChip></button></>}
    </>
  );
}

/** The log: a table at a desk, framed rows on a phone. `earlier`: the old season log, apart under its divider. */
export function EmailLogList({ rows, earlier = [], isPhone, label, onOpen }: {
  rows: readonly EmailLogRow[];
  earlier?: readonly EmailLogRow[];
  isPhone: boolean;
  label: string;
  onOpen: (r: EmailLogRow) => void;
}) {
  if (isPhone) {
    const row = (r: EmailLogRow) => r.kind === 'earlier' ? (
      <ClubRow key={r.key} title={<span className={fam.cardTitle}><span>{subjectText(r)}</span><span className={fam.cardFigure}>{reachedText(r)}</span></span>}
        caption={`${W.sentAt(r.sentAt)} · ${r.to}${r.by ? ` · ${r.by}` : ''}`} />
    ) : (
      <ClubRow key={r.key} as="button" onClick={() => onOpen(r)} aria-haspopup="dialog" aria-label={W.open(subjectText(r))}
        title={(
          <span className={fam.cardTitle}>
            <span>{subjectText(r)}{r.kind === 'notice' && <> <RepChip>{SW.automaticTag}</RepChip></>}</span>
            <span className={fam.cardFigure}>{reachedCell(r)}</span>
          </span>
        )}
        caption={`${W.sentAt(r.sentAt)} · ${r.to}${r.by ? ` · ${r.by}` : ''}`}
        chevron
      />
    );
    return (
      <>
        <ClubRowList label={label}>{rows.map(row)}</ClubRowList>
        {earlier.length > 0 && (
          <>
            <p className={fam.divider}>{SW.earlierDivider}</p>
            <ClubRowList label={SW.earlierDivider}>{earlier.map(row)}</ClubRowList>
          </>
        )}
      </>
    );
  }
  const line = (r: EmailLogRow) => r.kind === 'earlier' ? (
    <tr key={r.key}>
      <td className={fam.nw}>{W.sentAt(r.sentAt)}</td>
      <td>{subjectText(r)}</td>
      <td>{r.to}</td>
      <td className={fam.nwClip} title={r.by ?? undefined}>{r.by ?? '—'}</td>
      <td className={`${repKit.num} ${fam.nw}`}>{reachedText(r)}</td>
      <td className={repKit.go} />
    </tr>
  ) : (
    <tr key={r.key} className={repKit.rowOpens}
      onClick={() => { if (window.getSelection()?.toString()) return; onOpen(r); }}>
      <td className={fam.nw}>{W.sentAt(r.sentAt)}</td>
      <td>
        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
          onClick={e => { e.stopPropagation(); onOpen(r); }}>
          <SubjectCell r={r} onOpen={onOpen} />
        </button>
      </td>
      <td>{r.to}</td>
      <td className={fam.nwClip} title={r.by ?? undefined}>{r.by ?? '—'}</td>
      <td className={`${repKit.num} ${fam.nw}`}>{reachedCell(r)}</td>
      <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
    </tr>
  );
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            {/* Subject takes the slack: Sent and Reached (nowrap) hug their figures, so a subject and its Automatic tag stay on one line. */}
            <th scope="col" style={{ width: '1%' }}>{W.colSent}</th>
            <th scope="col" style={{ width: '38%' }}>{W.colSubject}</th>
            <th scope="col" style={{ width: '30%' }}>{W.colTo}</th>
            <th scope="col" style={{ width: '12%' }}>{W.colBy}</th>
            <th scope="col" className={repKit.num} style={{ width: '1%' }}>{W.colReached}</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(line)}
          {earlier.length > 0 && (
            <tr className={fam.dividerRow}><td colSpan={6}>{SW.earlierDivider}</td></tr>
          )}
          {earlier.map(line)}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One email as sent. `detailUrl` reads a typed email's words and families; `resend` is the door's "Send to the N it
 * missed" (its URL and body, and whose allowance it would have counted toward); `teamsHref` is Teams & draft's door on a
 * notice.
 */
export function EmailRecord({ row, eyebrow, detailUrl, resend, teamsHref, onClose, onResent }: {
  row: EmailLogRow;
  eyebrow: string;
  detailUrl: string;
  resend: { url: string; body: Record<string, unknown>; owner: 'season' | 'club' } | null;
  teamsHref?: string;
  onClose: () => void;
  onResent: (text: string) => void;
}) {
  const [detail, setDetail] = useState<ClubEmailRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const read = useCallback(async () => {
    if (row.kind !== 'club') return;
    const r = await moneyFetch<ClubEmailRecord>(detailUrl).catch(() => null);
    if (!r?.ok) { setFailed(true); return; }
    setDetail(r.data);
  }, [detailUrl, row]);
  useDeferredLoad(true, read);

  const r: EmailLogRow = detail ?? row;
  const body = detail?.body ?? null;
  const c = r.counts;
  // A typed email's families still to reach come with its detail; a schedule notice's are its failed count (9d-2b).
  const missed = r.kind === 'notice' ? c?.failed ?? 0 : detail?.missed ?? 0;
  const canResend = !!resend && r.state === 'stopped' && missed > 0;

  async function sendMissed() {
    if (!resend || busy) return;
    setBusy(true); setError('');
    try {
      const res = await moneyFetch<{ reached?: number; families?: number; claimed?: number; code?: string; error?: string }>(resend.url, jsonInit('POST', resend.body));
      // A schedule notice's press that took no one (another send holds them) says so, never "Sent to the 5 it missed".
      if (res.ok && res.data.claimed === 0) { setError(SW.stillSending); return; }
      if (res.ok) { onResent(SW.resent(missed, res.data.reached ?? 0, res.data.families ?? c?.families ?? 0)); return; }
      setError(refusalText(res.data, SW.unknown));
    } catch {
      setError(SW.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KitDialog kind="form" record size="medium" eyebrow={eyebrow} title={subjectText(r)} onClose={onClose} busy={busy}
      footerStart={error ? <SendStanding>{error}</SendStanding> : canResend ? <p className={ck.hint}>{SW.resendNote(resend!.owner)}</p> : undefined}
      footer={canResend ? (
        <>
          <DialogCancel>{W.close}</DialogCancel>
          <button type="button" className="btn btn-lime" onClick={() => void sendMissed()} disabled={busy}>
            {busy ? W.sending : SW.resend(missed)}
          </button>
        </>
      ) : undefined}>
      <dl className={fam.read}>
        <dt>{W.factSent}</dt><dd>{W.sentAt(r.sentAt)}</dd>
        <dt>{W.factBy}</dt><dd className={r.by ? undefined : fam.quiet}>{r.by ?? '—'}</dd>
        <dt>{W.factTo}</dt><dd>{r.to}</dd>
        {c && (
          <>
            <dt>{W.factGoingTo}</dt><dd>{c.families}</dd>
            <dt>{W.factReached}</dt><dd>{r.state === 'stopped' ? W.reached(c.reached, c.families) : reachedText(r)}</dd>
            {r.kind === 'club' && (
              <>
                <dt>{W.factOptedOut}</dt><dd className={c.optedOut ? undefined : fam.quiet}>{SW.namedFact(c.optedOut, c.optedOut ? detail?.optedOutNamed ?? null : null)}</dd>
                <dt>{W.factFailed}</dt><dd className={c.failed ? undefined : fam.quiet}>{SW.namedFact(c.failed, c.failed ? detail?.missedNamed ?? null : null)}</dd>
                <dt>{W.factCoaches}</dt><dd className={c.coaches ? undefined : fam.quiet}>{c.coaches}</dd>
              </>
            )}
          </>
        )}
      </dl>
      {r.kind === 'club' ? (
        <>
          <div className={fam.readAfter} />
          {failed ? <p className={repKit.formError}>{W.loadFailed}</p>
            : body == null ? <LoadingState inline label="Loading the email…" />
            : <p className={fam.emailBody}>{body}</p>}
          <p className={ck.hint}>{r.state === 'stopped' && detail ? SW.stoppedNote(detail.missed) : W.reachedNote}</p>
        </>
      ) : r.kind === 'notice' && (r.noticeKind === 'schedule_published' || r.noticeKind === 'games_changed') ? (
        // Publish schedule and a division's schedule changes (House League 9d-2b, f4): no Teams door.
        <>
          <p className={`${ck.hint} ${fam.readAfter}`}>
            {r.noticeKind === 'schedule_published' ? SCHEDULE_NOTICE_WORDS.publishedBody(r.division ?? null) : SCHEDULE_NOTICE_WORDS.changesBody(r.division ?? null)}
          </p>
          {r.state === 'stopped' && <p className={ck.hint}>{SW.stoppedNote(missed)}</p>}
        </>
      ) : r.kind === 'notice' && r.noticeKind === 'practices_changed' ? (
        // The club's Send the changes (Stage 11b Part 5): no Teams door — the teams didn't change, their practices did.
        <p className={`${ck.hint} ${fam.readAfter}`}>{PRACTICES_CHANGED_NOTICE.body(CLUB_EMAIL_CAP)}</p>
      ) : r.kind === 'notice' ? (
        <p className={`${ck.hint} ${fam.readAfter}`}>
          {SW.automaticBody(r.to === SW.everyone ? null : r.to)}
          {teamsHref && <>{' '}<Link className={repKit.inlineLink} href={teamsHref}>{SW.openTeams}</Link></>}
        </p>
      ) : (
        <p className={`${ck.hint} ${fam.readAfter}`}>{W.oneFamilyNote}</p>
      )}
    </KitDialog>
  );
}
