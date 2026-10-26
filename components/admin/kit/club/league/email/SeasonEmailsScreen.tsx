'use client';
/**
 * A HOUSE-LEAGUE SEASON'S EMAIL FAMILIES (Club Tier Stage 9d-1, frame e — owner 9d1·1, 9d1·3, 9d1·4, 9d1·8, 2026-10-26).
 * The rail's "Email families" opens this: the season's sent history, with the club's one email window as its one primary
 * button. Typed emails and one-family messages (never their words) from the club's record, the automatic notices sent
 * to many families at once (Publish teams), tagged Automatic, and the old composer's log read-only under "Earlier emails ·
 * counted per child" (hidden when the season has none). The season's allowance — three emails in any 24 hours — is the
 * page's first line (the admin header has no subtitle, ruling F3: a live fact moves to the body it describes).
 *
 * Gated by the season's email right (the runners and the registrar, every status — §0c: a finished season can still be
 * emailed), never the Families grant (9d1·2). The old page's composer, preview and per-child send are gone.
 */
import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { useHouseLeagueAccess } from '@/components/admin/kit/useHouseLeagueSeasons';
import { ALLOWANCE_WORDS, FAMILY_EMAIL_WORDS as EW, SEASON_EMAIL_WORDS as SW } from '@/lib/families-words';
import { isFinishedLeagueSeason } from '@/lib/house-league-access';
import type { EmailLogRow } from '@/lib/families-emails-log';
import type { EmailAllowance } from '@/lib/families-email';
import ck from '../../ClubKit.module.css';
import { EmptyCard, LoadFailed, NoticePill, PageLoading, repKit, useDeferredLoad, useLatestRead } from '../../RepKit';
import { moneyFetch } from '../../money/MoneyKit';
import EmailFamiliesWindow, { type EmailSent } from '../../families/EmailFamiliesWindow';
import { EmailLogList, EmailRecord } from '../../families/EmailLog';
import fam from '../../families/Families.module.css';

interface History {
  season: { id: string; name: string; status: string };
  rows: EmailLogRow[];
  earlier: EmailLogRow[];
  allowance: EmailAllowance;
  hasFamilies: boolean;
}

export default function SeasonEmailsScreen() {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { currentOrg, loading: orgLoading } = useOrg();
  const isPhone = useIsPhone();
  const gate = useHouseLeagueAccess();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const seasonHref = `/${slug}/admin/house-league/seasons/${seasonId}`;
  const [history, setHistory] = useState<History | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<EmailLogRow | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [said, setSaid] = useState<{ text: string; sendId: string | null } | null>(null);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug || !seasonId) return;
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<History>(`/api/admin/house-league/seasons/${seasonId}/emails/history?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setHistory(r.data);
  }, [slug, seasonId, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug && !!gate?.email, load);

  const season = history?.season ?? null;
  const finished = !!season && isFinishedLeagueSeason(season);
  const door = history?.hasFamilies ? (
    <button type="button" className={`btn btn-lime ${ck.iconOnlyPhone}`} onClick={() => setEmailing(true)} aria-haspopup="dialog"
      aria-label={isPhone ? SW.historyTitle : undefined}>
      <Mail size={14} aria-hidden /><span className={ck.btnWord}>{isPhone ? SW.historyButtonPhone : SW.historyTitle}</span>
    </button>
  ) : undefined;
  const header = (
    <AdminPageHeader
      eyebrow={season ? SW.historyEyebrow(season.name) : 'House league'}
      title={SW.historyTitle}
      backTo={{ href: seasonHref, label: season?.name ?? 'Season' }}
      inlineActions
      actions={door}
    />
  );

  if (orgLoading || !gate) return <PageLoading header={header} label="Loading Email families…" />;
  if (!gate.email) return <div className={repKit.page}>{header}<EmptyCard title={SW.noAccess} /></div>;
  if (failed && !history) return <div className={repKit.page}>{header}<LoadFailed title={SW.loadFailed} onRetry={() => void load()} /></div>;
  if (!history || !season) return <PageLoading header={header} label="Loading Email families…" />;

  const allowance = ALLOWANCE_WORDS.subtitle(history.allowance.used, history.allowance.nextAt);
  const empty = history.rows.length === 0 && history.earlier.length === 0;

  return (
    <div className={repKit.page}>
      {header}
      <p className={fam.lede}>{isPhone ? allowance.charAt(0).toUpperCase() + allowance.slice(1) : SW.historyLede(season.name, allowance)}</p>
      {finished && <p className={ck.hint}>{SW.finished}</p>}
      {failed && <p className={repKit.formError}>{SW.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{EW.tryAgain}</button></p>}
      {!history.hasFamilies ? (
        <EmptyCard title={finished ? SW.noFamiliesDone(season.name) : SW.noFamiliesTitle(season.name)}>{finished ? undefined : SW.noFamiliesBody}</EmptyCard>
      ) : empty ? (
        <EmptyCard title={SW.emptyTitle} action={door}>{SW.emptyBody(season.name)}</EmptyCard>
      ) : (
        <>
          <EmailLogList rows={history.rows} earlier={history.earlier} isPhone={isPhone} label={SW.historyTitle} onOpen={setOpen} />
          <p className={ck.hint}>{SW.footnote}</p>
        </>
      )}
      {open && (
        <EmailRecord row={open} eyebrow={season.name}
          detailUrl={`/api/admin/house-league/seasons/${seasonId}/emails/history?${q}&send=${encodeURIComponent(open.id)}`}
          resend={{ url: `/api/admin/house-league/seasons/${seasonId}/emails?${q}`, body: { action: 'resend', sendId: open.id }, owner: 'season' }}
          teamsHref={`${seasonHref}/teams`}
          onClose={() => setOpen(null)}
          onResent={text => { setOpen(null); setSaid({ text, sendId: null }); void load(); }} />
      )}
      {emailing && (
        <EmailFamiliesWindow
          q={q}
          season={{ id: season.id, name: season.name, registrationsHref: `${seasonHref}/registrations`, teamsHref: `${seasonHref}/teams` }}
          onClose={() => setEmailing(false)}
          onShowNoFamily={() => { setEmailing(false); window.location.assign(`${seasonHref}/registrations`); }}
          onSent={(text, sent?: EmailSent) => { setEmailing(false); setSaid({ text, sendId: sent?.partial ? sent.sendId : null }); void load(); }}
        />
      )}
      {said && (
        <NoticePill key={said.text} message={said.text} onDone={() => setSaid(null)}
          action={said.sendId ? {
            label: SW.openEmail,
            onAction: () => { const row = history.rows.find(r => r.id === said.sendId); if (row) setOpen(row); },
          } : undefined} />
      )}
    </div>
  );
}
