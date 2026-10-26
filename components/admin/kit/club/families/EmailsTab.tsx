'use client';
/**
 * THE EMAILS TAB (Club Tier Stage 7c — Ask 7 A; drawing 5). Every email the club sent from Families, newest first: an
 * Email families send ("Reached 86 of 88"; "Sending…" while it goes; "Stopped at x of y" once it sat unfinished) and a
 * one-household message (Stage 5a — its date and sender only, so its row reads "1 family" and no subject, never an
 * invented number). The list and the record are `./EmailLog` (a season's history wears the same). A page at a time with
 * Show more. Nothing here is editable.
 *
 * Since 9d-1 (9d1·7) a house-league season's emails are here too, the season named in To, with a Season filter (All ·
 * Club-wide · each season); a season's automatic notices are not (they live on the season's own history). A stopped email
 * offers "Send to the N it missed" (9d1·10).
 *
 * It is also the ONE door to a send (owner 2026-10-22: moved off the Families toolbar — a send picks its own audience, so
 * it was never about the list on screen): "Email families" top right of the head, and on the empty card, opens
 * `EmailFamiliesWindow`; a send reloads the log and says so with the pill.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { FAMILY_EMAIL_WORDS as EW, FAMILY_EMAILS_TAB_WORDS as W, SEASON_EMAIL_WORDS as SW } from '@/lib/families-words';
import type { EmailLogPage, EmailLogRow } from '@/lib/families-emails-log';
import LoadingState from '@/components/shared/LoadingState';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import EmailFamiliesWindow from './EmailFamiliesWindow';
import { EmailLogList, EmailRecord } from './EmailLog';
import ck from '../ClubKit.module.css';
import { EmptyCard, LoadFailed, NoticePill, repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { moneyFetch } from '../money/MoneyKit';
import fam from './Families.module.css';

export default function EmailsTab() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const isPhone = useIsPhone();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const [rows, setRows] = useState<EmailLogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<{ id: string; name: string }[]>([]);
  const [season, setSeason] = useState('all');
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<EmailLogRow | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const list = `/api/admin/families/emails?${q}&season=${encodeURIComponent(season)}`;
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<EmailLogPage>(list).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setRows(r.data.rows); setTotal(r.data.total); setNext(r.data.next);
    // The filter keeps every season it has offered, so narrowing to one never takes the others off the list.
    if (r.data.seasons.length) setSeasons(r.data.seasons);
  }, [slug, list, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  async function loadMore() {
    if (!next || more) return;
    setMore(true);
    const r = await moneyFetch<EmailLogPage>(`${list}&before=${encodeURIComponent(next)}`).catch(() => null);
    setMore(false);
    if (!r?.ok) return;
    setRows(prev => {
      const seen = new Set((prev ?? []).map(x => x.key));
      return [...(prev ?? []), ...r.data.rows.filter(x => !seen.has(x.key))];
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

  // The Season filter, once the club has emailed a season (9d1·7).
  const filter = seasons.length > 0 ? (
    <SublinedChoice id="emails-season" label={SW.filterLabel} variant="toolbar"
      triggerClassName={`${ck.select} ${shared.convChoiceToolbarField} ${fam.filter}`}
      options={[{ value: 'all', name: SW.filterAll, sub: '' }, { value: 'club', name: SW.filterClub, sub: '' }, ...seasons.map(s => ({ value: s.id, name: s.name, sub: '' }))]}
      value={season}
      onChange={v => { setSeason(v); setRows(null); }} />
  ) : null;

  if (rows.length === 0 && season === 'all') return <><EmptyCard title={W.emptyTitle} action={door}>{W.emptyBody}</EmptyCard>{sending}</>;

  return (
    <>
      <div className={fam.emailsHead}>
        <p className={fam.lede}>{W.lede(total)}</p>
        {filter}
        {door}
      </div>
      {/* A read that failed after the list was already on screen (the reload after a send): say so, and offer the retry. */}
      {failed && <p className={repKit.formError}>{W.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{EW.tryAgain}</button></p>}
      <EmailLogList rows={rows} isPhone={isPhone} label={W.tab} onOpen={setOpen} />
      {next && (
        <div className={fam.more}>
          <button type="button" className="btn btn-outline" onClick={() => void loadMore()} disabled={more}>{W.showMore}</button>
        </div>
      )}
      {open && (
        <EmailRecord row={open} eyebrow={W.tab}
          detailUrl={`/api/admin/families/emails/${encodeURIComponent(open.id)}?${q}`}
          resend={{ url: `/api/admin/families/email?${q}`, body: { action: 'resend', sendId: open.id }, owner: open.seasonId ? 'season' : 'club' }}
          onClose={() => setOpen(null)}
          onResent={text => { setOpen(null); setSaid(text); void load(); }} />
      )}
      {sending}
    </>
  );
}
