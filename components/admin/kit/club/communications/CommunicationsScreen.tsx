'use client';
/**
 * COMMUNICATIONS (Club Communications Stage 1, Session 2; drawing tabs 1–6). One place for the email the club sends to
 * groups: one list of what went out, and one New email button. The list is ONE reader on the server
 * (`/api/admin/club-emails/log`) over the family log and the coach and board log, each row already filtered for this
 * reader — this screen never hides a row or a name (legal §2c). It replaced Families › Emails (direction ruling 3), so
 * its list and its family record are the shipped `EmailLogList` and `EmailRecord`; a coach or board row opens
 * `ColleagueRecord`.
 *
 * New email (asks 1, 2, 10; Session 3): the create menu, one choice each — To families (the club's window for the owner and
 * admins, a league seat's season's own window, one per season under way), To coaches, To the board. With one choice the
 * button names it and opens it, no menu (ask 10). The coach and board choices appear only to a seat the server would let
 * write to them (`facts.seat`), and the board only when someone else is on it (the options read says so).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { PLACE, type ColleagueKind } from '@/lib/club-group-email-words';
import { familyDoor } from '@/lib/club-communications-place';
import { useCommunicationsFacts } from '../../useCommunicationsFacts';
import { FINISHED_LEAGUE_SEASON_STATUSES } from '@/lib/house-league-access';
import type { CommsPage, CommsRow } from '@/lib/club-communications-log';
import type { CommsKind } from '@/lib/club-communications-place';
import LoadingState from '@/components/shared/LoadingState';
import FilterMenu, { FilterLine, pickedLabels, type FilterGroupDef } from '@/components/admin/tournament/FilterMenu';
import { CoachListToolbar, ToolbarCount } from '@/components/coaches/kit';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import EmailFamiliesWindow from '../families/EmailFamiliesWindow';
import { EmailLogList, EmailRecord } from '../families/EmailLog';
import { ColleagueRecord } from './ColleagueRecord';
import EmailColleaguesWindow, { type SendAgain } from './EmailColleaguesWindow';
import { EmptyCard, LoadFailed, NoticePill, repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { moneyFetch } from '../money/MoneyKit';
import { useHouseLeagueSeasons } from '../../useHouseLeagueSeasons';
import fam from '../families/Families.module.css';

type Writing =
  | { door: 'club' } | { door: 'season'; id: string; name: string }
  | { door: ColleagueKind; again?: SendAgain };
const KIND_WORD: Record<CommsKind, string> = { families: PLACE.filterFamilies, coaches: PLACE.filterCoaches, board: PLACE.filterBoard };

export default function CommunicationsScreen() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const isPhone = useIsPhone();
  usePageTitle(PLACE.name);
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const facts = useCommunicationsFacts();
  const door = facts ? familyDoor(facts) : null;
  const seat = facts?.seat ?? null;
  // Pending until the options read answers; a seat with no board seat never asks.
  // The board is offered only when someone besides the sender is on it (the server's own answer; Stage 1 drawing tab 8).
  const [boardOffered, setBoardOffered] = useState<boolean | null>(null);
  useEffect(() => {
    if (!slug || !seat?.board) return;
    let live = true;
    void moneyFetch<{ offered?: boolean }>(`/api/admin/club-emails?${q}&kind=board`).then(r => { if (live) setBoardOffered(!!(r.ok && r.data.offered)); })
      .catch(() => { if (live) setBoardOffered(false); });
    return () => { live = false; };
  }, [slug, q, seat?.board]);
  // A league seat's "To families" is the season's own window, one per season under way (ask 2); a finished one is emailed
  // from its own tab. Between seasons there is nothing to write to yet, so no button (owner 2026-11-17: the list stays).
  const seasons = useHouseLeagueSeasons(door === 'season')
    .filter(s => s.status !== 'draft' && !(FINISHED_LEAGUE_SEASON_STATUSES as readonly string[]).includes(s.status));

  const [rows, setRows] = useState<CommsRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [whole, setWhole] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [kinds, setKinds] = useState<CommsKind[]>([]);
  const [seasonsSent, setSeasonsSent] = useState<{ id: string; name: string }[]>([]);
  // The Filter's ticks (owner 2026-11-20): Sent to and Season. Not remembered between visits (the toolbar ruling).
  const [who, setWho] = useState<ReadonlySet<CommsKind>>(new Set());
  const [seasonPicks, setSeasonPicks] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<CommsRow | null>(null);
  const [writing, setWriting] = useState<Writing | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  const filtered = who.size > 0 || seasonPicks.size > 0;
  const list = `/api/admin/club-emails/log?${q}`
    + (who.size ? `&who=${[...who].join(',')}` : '')
    + (seasonPicks.size ? `&season=${[...seasonPicks].map(encodeURIComponent).join(',')}` : '');
  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<CommsPage>(list).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setRows(r.data.rows); setTotal(r.data.total); setWhole(r.data.whole); setNext(r.data.next);
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

  // New email: with one choice the button names it and opens it (ask 10); with more, the create menu (ask 1). Each choice
  // carries its second line for THIS seat (drawing tab 2): a league seat's families are its season, its coaches the
  // house league's; the owner's are the whole club's.
  interface Choice { key: string; writing: Writing; menu: string; sub: string; named: string }
  const choices: Choice[] = [
    ...(door === 'club' ? [{ key: 'families', writing: { door: 'club' } as Writing, menu: PLACE.toFamilies, sub: PLACE.toFamiliesSub, named: PLACE.emailFamilies }]
      : seasons.map(s => ({ key: `season:${s.id}`, writing: { door: 'season', id: s.id, name: s.name } as Writing, menu: PLACE.toFamilies, sub: s.name, named: PLACE.emailFamilies }))),
    ...(seat?.coaches ? [{ key: 'coaches', writing: { door: 'coaches' } as Writing, menu: PLACE.toCoaches,
      sub: seat.coaches.rep ? PLACE.toCoachesSub : PLACE.toCoachesSubLeague, named: PLACE.emailCoaches }] : []),
    ...(seat?.board && boardOffered === true ? [{ key: 'board', writing: { door: 'board' } as Writing, menu: PLACE.toBoard, sub: PLACE.toBoardSub, named: PLACE.emailBoard }] : []),
  ];
  // Until the board's answer is in, the button waits rather than showing one choice and then two.
  const button = (seat?.board && boardOffered === null) || choices.length === 0 ? null : choices.length === 1 ? (
    <button type="button" className="btn btn-lime" onClick={() => setWriting(choices[0].writing)} aria-haspopup="dialog">
      <Plus size={15} aria-hidden /> {choices[0].named}
    </button>
  ) : (
    <CoachToolbarMenu label={PLACE.newEmail} icon={<Plus size={15} aria-hidden />} variant="primary" drawerOnPhone drawerTitle={PLACE.newEmail}>
      {choices.map(c => <CoachToolbarMenuItem key={c.key} label={c.menu} hint={c.sub} onSelect={() => setWriting(c.writing)} />)}
    </CoachToolbarMenu>
  );
  // A seat whose only choice is the board (the treasurer) reads its own empty list (Stage 1 drawing tab 8).
  const onlyBoard = !!seat?.board && !seat.coaches && door === null;

  const seasonHref = (id: string) => `/${slug}/admin/house-league/seasons/${id}`;
  // After a send or a finish: close the window or the record (the caller says which), show the notice, read the list again.
  const doneAfter = (close: () => void) => (text: string) => { close(); setSaid(text); void load(); };
  const sentDone = doneAfter(() => setWriting(null));
  const openDone = doneAfter(() => setOpen(null));
  const windows = (
    <>
      {writing?.door === 'club' && (
        <EmailFamiliesWindow q={q} eyebrow={PLACE.eyebrow}
          onClose={() => setWriting(null)}
          onShowNoFamily={() => { setWriting(null); router.push(`/${slug}/admin/families?show=nofamily`); }}
          onSent={sentDone} />
      )}
      {writing?.door === 'season' && (
        <EmailFamiliesWindow q={q}
          season={{ id: writing.id, name: writing.name, registrationsHref: `${seasonHref(writing.id)}/registrations`, teamsHref: `${seasonHref(writing.id)}/teams` }}
          onClose={() => setWriting(null)}
          onShowNoFamily={() => { const to = `${seasonHref(writing.id)}/registrations`; setWriting(null); router.push(to); }}
          onSent={sentDone} />
      )}
      {(writing?.door === 'coaches' || writing?.door === 'board') && (
        <EmailColleaguesWindow kind={writing.door} q={q} slug={slug} eyebrow={PLACE.eyebrow} again={writing.again}
          onClose={() => setWriting(null)}
          onSent={sentDone} />
      )}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </>
  );

  // THE FILTER (ask 8; owner 2026-11-20): the toolbar's one Filter button, as Registrations' — not a form dropdown. Sent to
  // offers the kinds this reader has rows of, once there is more than one; Season, each season emailed. A tick narrows
  // the list in place (the menu stays open while ticks change, so the list is never swapped for the loading state).
  const toggle = <T,>(set: (f: (prev: ReadonlySet<T>) => ReadonlySet<T>) => void) => (key: T) => set(prev => {
    const nextSet = new Set(prev);
    if (nextSet.has(key)) nextSet.delete(key); else nextSet.add(key);
    return nextSet;
  });
  const groups: FilterGroupDef[] = [
    { key: 'who', label: PLACE.filterWho, options: kinds.length > 1 ? kinds.map(k => ({ key: k, label: KIND_WORD[k] })) : [],
      selected: [...who], onToggle: k => toggle(setWho)(k as CommsKind) },
    { key: 'season', label: PLACE.filterSeason, options: kinds.length > 1 || seasonsSent.length > 1 ? seasonsSent.map(x => ({ key: x.id, label: x.name })) : [],
      selected: [...seasonPicks], onToggle: toggle(setSeasonPicks) },
  ];
  const resetFilter = () => { setWho(new Set()); setSeasonPicks(new Set()); };
  const filterButton = groups.some(g => g.options.length > 0) ? (
    <FilterMenu groups={groups} label={PLACE.filter} onLabel={PLACE.filterOn} resetLabel={PLACE.filterClear} onReset={resetFilter} align="end" />
  ) : null;

  // Empty only when there is nothing further to read (a first page can be empty with more behind it).
  if (rows.length === 0 && !filtered && !next) {
    return <><EmptyCard title={onlyBoard ? PLACE.emptyBoardTitle : PLACE.emptyTitle} action={button ?? undefined}>{onlyBoard ? PLACE.emptyBoardBody : PLACE.emptyBody}</EmptyCard>{windows}</>;
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
      {/* The count on the left, the Filter and the create on the right (Toolbar Rules, Rules 1 and 2 — Payment requests' line). */}
      <CoachListToolbar
        lede={<ToolbarCount total={filtered ? whole : total} shown={filtered ? total : undefined} one={PLACE.countOne} many={PLACE.countMany} />}
        filters={filterButton}
        actions={button}
      />
      <FilterLine picks={pickedLabels(groups)} label={PLACE.filter} />
      {failed && <p className={repKit.formError}>{PLACE.loadFailed} <button type="button" className={repKit.inlineLink} onClick={() => void load()}>{PLACE.tryAgain}</button></p>}
      {rows.length === 0 && filtered && !next
        ? <p className={repKit.quiet}>{PLACE.noMatch}</p>
        : <EmailLogList rows={rows} isPhone={isPhone} label={PLACE.name} onOpen={r => setOpen(r as CommsRow)} />}
      {next && (
        <div className={fam.more}>
          <button type="button" className="btn btn-outline" onClick={() => void loadMore()} disabled={more}>{PLACE.showMore}</button>
        </div>
      )}
      {open && (open.kind === 'coaches' || open.kind === 'board') ? (
        <ColleagueRecord row={open} eyebrow={PLACE.eyebrow} q={q}
          // "Send again to these people" only to a seat that may write to that same group now (the server asks again).
          canSendAgain={open.kind === 'board' ? !!seat?.board && !!boardOffered : !!seat?.coaches}
          onSendAgain={(kind, again) => { setOpen(null); setWriting({ door: kind, again }); }}
          onClose={() => setOpen(null)}
          onFinished={openDone} />
      ) : open && (
        <EmailRecord row={open} eyebrow={PLACE.eyebrow}
          detailUrl={`/api/admin/club-emails/family/${encodeURIComponent(open.id)}?${q}`}
          resend={finishOf(open)}
          finishLine={open.finish && 'line' in open.finish ? open.finish.line : undefined}
          onClose={() => setOpen(null)}
          onResent={openDone} />
      )}
      {windows}
    </>
  );
}
