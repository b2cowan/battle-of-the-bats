'use client';
/**
 * COMMUNICATIONS (Club Communications Stage 1, Session 2; drawing tabs 1–6). One place for the email the club sends to
 * groups: one list of what went out, and one New email button. The list is ONE reader on the server
 * (`/api/admin/club-emails/log`) over the family log and the coach and board log, each row already filtered for this
 * reader — this screen never hides a row or a name (legal §2c). It replaced Families › Emails (direction ruling 3), so
 * its list and its family record are the shipped `EmailLogList` and `EmailRecord`; a coach or board row opens
 * `ColleagueRecord`.
 *
 * New email (asks 1, 2, 10), Session 2: the family choice only, so the button names it — "Email families" — and opens the
 * club's window (owner, admin) or, for a league seat, its season's own window; two or more seasons under way are the
 * create menu, each season named. Session 3 adds To coaches and To the board to the same menu.
 */
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { PLACE } from '@/lib/club-group-email-words';
import { familyDoor, placeFacts } from '@/lib/club-communications-place';
import { FINISHED_LEAGUE_SEASON_STATUSES } from '@/lib/house-league-access';
import type { CommsKind, CommsPage, CommsRow } from '@/lib/club-communications-log';
import LoadingState from '@/components/shared/LoadingState';
import SublinedChoice from '@/components/coaches/SublinedChoice';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import shared from '@/app/[orgSlug]/coaches/coaches.module.css';
import EmailFamiliesWindow from '../families/EmailFamiliesWindow';
import { EmailLogList, EmailRecord } from '../families/EmailLog';
import { ColleagueRecord } from './ColleagueRecord';
import { TabActions } from '../PlaceFrame';
import ck from '../ClubKit.module.css';
import { EmptyCard, LoadFailed, NoticePill, repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { moneyFetch } from '../money/MoneyKit';
import { useHouseLeagueSeasons } from '../../useHouseLeagueSeasons';
import fam from '../families/Families.module.css';

type Writing = { door: 'club' } | { door: 'season'; id: string; name: string };
const KIND_WORD: Record<CommsKind, string> = { families: PLACE.filterFamilies, coaches: PLACE.filterCoaches, board: PLACE.filterBoard };

export default function CommunicationsScreen() {
  const { currentOrg, userRole, userCapabilities, limitedToTeamGroups, loading: orgLoading } = useOrg();
  const router = useRouter();
  const isPhone = useIsPhone();
  usePageTitle(PLACE.name);
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const facts = currentOrg && userRole ? placeFacts({ role: userRole, capabilities: userCapabilities, limited: limitedToTeamGroups }, currentOrg) : null;
  const door = facts ? familyDoor(facts) : null;
  // A league seat's "To families" is the season's own window, one per season under way (ask 2); a finished one is emailed
  // from its own tab. Between seasons there is nothing to write to yet, so no button (owner 2026-11-17: the list stays).
  const seasons = useHouseLeagueSeasons(door === 'season')
    .filter(s => s.status !== 'draft' && !(FINISHED_LEAGUE_SEASON_STATUSES as readonly string[]).includes(s.status));

  const [rows, setRows] = useState<CommsRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [kinds, setKinds] = useState<CommsKind[]>([]);
  const [seasonsSent, setSeasonsSent] = useState<{ id: string; name: string }[]>([]);
  const [filter, setFilter] = useState('all');
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<CommsRow | null>(null);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const list = `/api/admin/club-emails/log?${q}&filter=${encodeURIComponent(filter)}`;
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<CommsPage>(list).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setRows(r.data.rows); setTotal(r.data.total); setNext(r.data.next);
    // The filter keeps every choice it has offered, so narrowing to one never takes the others off the list.
    if (r.data.kinds.length) setKinds(r.data.kinds);
    if (r.data.seasons.length) setSeasonsSent(r.data.seasons);
  }, [slug, list, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  async function loadMore() {
    // The same latest-read token as `load`: a filter change while this page is in flight drops it (/review 2026-11-17).
    if (!next || more) return;
    setMore(true);
    const current = beginRead();
    const r = await moneyFetch<CommsPage>(`${list}&before=${encodeURIComponent(next)}`).catch(() => null);
    setMore(false);
    if (!current()) return;
    if (!r?.ok) return;
    setRows(prev => {
      const seen = new Set((prev ?? []).map(x => x.key));
      return [...(prev ?? []), ...r.data.rows.filter(x => !seen.has(x.key))];
    });
    setNext(r.data.next);
  }

  if (failed && !rows) return <LoadFailed title={PLACE.loadFailed} onRetry={() => void load()} />;
  if (!rows) return <LoadingState label={PLACE.loading} />;

  // New email: with one choice the button names it and opens it (ask 10); with more, the create menu (ask 1).
  const choices: Writing[] = door === 'club' ? [{ door: 'club' }] : seasons.map(s => ({ door: 'season', id: s.id, name: s.name }));
  const button = choices.length === 0 ? null : choices.length === 1 ? (
    <button type="button" className="btn btn-lime" onClick={() => setWriting(choices[0])} aria-haspopup="dialog">
      <Plus size={15} aria-hidden /> {PLACE.emailFamilies}
    </button>
  ) : (
    <CoachToolbarMenu label={PLACE.newEmail} icon={<Plus size={15} aria-hidden />} variant="primary" drawerOnPhone drawerTitle={PLACE.newEmail}>
      {choices.map(c => c.door === 'season' && (
        // Drawing tab 2: each choice reads "To families", the season named on its second line (ask 2).
        <CoachToolbarMenuItem key={c.id} label={PLACE.toFamilies} hint={c.name} onSelect={() => setWriting(c)} />
      ))}
    </CoachToolbarMenu>
  );

  const seasonHref = (id: string) => `/${slug}/admin/house-league/seasons/${id}`;
  const windows = (
    <>
      {writing?.door === 'club' && (
        <EmailFamiliesWindow q={q} eyebrow={PLACE.eyebrow}
          onClose={() => setWriting(null)}
          onShowNoFamily={() => { setWriting(null); router.push(`/${slug}/admin/families?show=nofamily`); }}
          onSent={text => { setWriting(null); setSaid(text); void load(); }} />
      )}
      {writing?.door === 'season' && (
        <EmailFamiliesWindow q={q}
          season={{ id: writing.id, name: writing.name, registrationsHref: `${seasonHref(writing.id)}/registrations`, teamsHref: `${seasonHref(writing.id)}/teams` }}
          onClose={() => setWriting(null)}
          onShowNoFamily={() => { const to = `${seasonHref(writing.id)}/registrations`; setWriting(null); router.push(to); }}
          onSent={text => { setWriting(null); setSaid(text); void load(); }} />
      )}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </>
  );

  // The filter (ask 8): All, the kinds this reader has rows of, then each season emailed — shown once the club has sent
  // more than one kind (drawing tab 1).
  const options = [
    { value: 'all', name: PLACE.filterAll, sub: '' },
    ...kinds.map(k => ({ value: k, name: KIND_WORD[k], sub: '' })),
    ...seasonsSent.map(s => ({ value: `season:${s.id}`, name: s.name, sub: '' })),
  ];
  const filterChoice = kinds.length > 1 ? (
    <SublinedChoice id="communications-filter" label={PLACE.filterLabel} variant="toolbar"
      triggerClassName={`${ck.select} ${shared.convChoiceToolbarField} ${fam.filter}`}
      options={options} value={filter}
      onChange={v => { setFilter(v); setRows(null); }} />
  ) : null;

  // Empty only when there is nothing further to read (a first page can be empty with more behind it).
  if (rows.length === 0 && filter === 'all' && !next) {
    return <><EmptyCard title={PLACE.emptyTitle} action={button ?? undefined}>{PLACE.emptyBody}</EmptyCard>{windows}</>;
  }

  const finishOf = (r: CommsRow) => {
    const f = r.finish;
    if (!f || 'line' in f) return null;
    return f.door === 'club'
      ? { url: `/api/admin/families/email?${q}`, body: { action: 'resend', sendId: r.id }, owner: 'club' as const }
      : { url: `/api/admin/house-league/seasons/${encodeURIComponent(f.seasonId)}/emails?${q}`, body: { action: 'resend', sendId: r.id }, owner: 'season' as const };
  };

  return (
    <>
      <TabActions lede={PLACE.lede(total)}>
        {filterChoice}
        {button}
      </TabActions>
      {failed && <p className={repKit.formError}>{PLACE.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{PLACE.tryAgain}</button></p>}
      <EmailLogList rows={rows} isPhone={isPhone} label={PLACE.name} onOpen={r => setOpen(r as CommsRow)} />
      {next && (
        <div className={fam.more}>
          <button type="button" className="btn btn-outline" onClick={() => void loadMore()} disabled={more}>{PLACE.showMore}</button>
        </div>
      )}
      {open && (open.kind === 'coaches' || open.kind === 'board') ? (
        <ColleagueRecord row={open} eyebrow={PLACE.eyebrow} q={q}
          onClose={() => setOpen(null)}
          onFinished={text => { setOpen(null); setSaid(text); void load(); }} />
      ) : open && (
        <EmailRecord row={open} eyebrow={PLACE.eyebrow}
          detailUrl={`/api/admin/club-emails/family/${encodeURIComponent(open.id)}?${q}`}
          resend={finishOf(open)}
          finishLine={open.finish && 'line' in open.finish ? open.finish.line : undefined}
          onClose={() => setOpen(null)}
          onResent={text => { setOpen(null); setSaid(text); void load(); }} />
      )}
      {windows}
    </>
  );
}
