'use client';
/**
 * THE FAMILIES TAB (Club Tier Stage 5b — hub K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5 → P1; Asks 3, 4, 5, 13, 14, 16).
 *
 *   the list's line — "10 families · 2 children have no family on file" (5a: no registration count posing as children)
 *   Show            — the six questions are ONE pick-one pill in the olive "what is read" face (`SingleSelectDropdown
 *                     lead`; owner 08-19/08-20, the 10-07 olive pill): it names the question on screen and its count, and
 *                     opens the six with each count at its row's end; on a phone the portal's menu sheet. They never
 *                     combine (No family on file lists CHILDREN, the rest list families), so pick-one, not multi.
 *                     No Filter button: there is nothing to narrow (absent beats disabled). The question is in the
 *                     address (`?show=`), so Back, a reload and Previous · Next keep it.
 *   Search          — the one search field (Toolbar Rules, 2026-10-17): right of the pill at a desk (the left picks
 *                     the list, the right narrows it — amends Stage 5's "beside the pill"), its own 44 px row on a
 *                     phone, always open (the tournament toolbar's shape, without the square). ⚠ It
 *                     narrows the list on screen — the pill names what is read, and a search that quietly read every
 *                     family under "Owes money" would make the pill untrue. Its empty state offers "Search all families".
 *   Email these families — (owner 2026-10-22) only on a question that names families (Owes money, Missing forms, No
 *                     consent, Not back): the Email families window with that list chosen. The Emails tab is the door to
 *                     every other send. ⚠ The search narrows what is on screen, NOT who this reaches — the list is the
 *                     pill's, and the window says who it reaches.
 *   the table       — the standard (Family · Children · Balance · Chased · chevron; display-face headings; figures and
 *                     their headings on one side; the name is the link and the whole row opens; one chip). A house-league
 *                     fee not paid is FEE NOT PAID on the child's line and counts in Balance (owner 2026-10-18). On a
 *                     phone, one framed row a family.
 *   No family on file — CHILDREN, grouped under their team (Ask 4). Since Club Stage 2 only a team's coaches can add a
 *                     guardian to a rep roster: one line says so, a rep row opens nothing, and "Ask the coaches" emails
 *                     each head coach their players. A house-league registration is the club's own and opens.
 *   a family        — a record OVER this list (`FamilyRecordWindow`, Ask 5), with Previous · Next through the list it
 *                     was opened from. Its address is `/families/{personId}`; that address lands here with `?family=`
 *                     (the page's server redirect), which this reads, drops, and opens — the allocation window's way.
 */
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Mail } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { joinWithAnd } from '@/lib/utils';
import { FAMILY_EMAIL_WORDS as EW, FAMILY_LIST_WORDS as W } from '@/lib/families-words';
import { FAMILY_LIST_PREDICATES, isFamilyListKey, owedCents, type FamilyListKey } from '@/lib/families-lists';
import type { NoFamilyChild, WorklistFamily, WorklistPayload } from '@/lib/families-read';
import SingleSelectDropdown from '@/components/coaches/SingleSelectDropdown';
import LoadingState from '@/components/shared/LoadingState';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import SearchField from '@/components/shared/SearchField';
import { ClubRow, ClubRowBand, ClubRowList, EmptyCard, LoadFailed, NoticePill, RepChip, repKit, useDeferredLoad, useLatestRead } from '../RepKit';
import { useClubBrief } from '../ClubBriefProvider';
import { money, moneyFetch } from '../money/MoneyKit';
import FamilyRecordWindow from './FamilyRecordWindow';
import CoachAskWindow from './CoachAskWindow';
import EmailFamiliesWindow from './EmailFamiliesWindow';
import fam from './Families.module.css';

type Question = keyof typeof W.questions;
const QUESTIONS: readonly Question[] = ['nofamily', 'owes', 'forms', 'consent', 'notback', 'all'];
const isQuestion = (s: string | null): s is Question => s != null && (QUESTIONS as readonly string[]).includes(s);

/** A list longer than this shows its first rows and "Show more" (E05's screen half: a club's whole book never paints at once). */
const PAGE = 50;

// ONE definition per question (lib/families-lists.ts) — a count, the rows it shows and the people "Email these families"
// reaches are the same predicate, or the count lies about its list.
const FAMILY_PREDICATES = FAMILY_LIST_PREDICATES;

/** A family's search: names, every address it has used (the project's founding job), a phone number, its children. */
function familyMatches(f: WorklistFamily, q: string): boolean {
  const digits = q.replace(/\D/g, '');
  return f.name.toLowerCase().includes(q)
    || f.allEmails.some(e => e.includes(q))
    || (digits.length >= 4 && (f.phone ?? '').replace(/\D/g, '').includes(digits))
    || f.children.some(c => c.childName.toLowerCase().includes(q));
}

/** The children a row names: this season's, or — a family not back this season — the ones it had. */
const rowChildren = (f: WorklistFamily) => {
  const current = f.children.filter(c => c.current);
  const list = current.length ? current : f.children;
  const seen = new Set<string>();
  return list.filter(c => (seen.has(c.childKey) ? false : (seen.add(c.childKey), true)));
};

/** "Milan, Morgan and Riley Reyes" when the children share a surname; otherwise each name whole. */
function childrenPhrase(names: readonly string[]): string {
  const parts = names.map(n => n.trim().split(/\s+/));
  const last = parts[0]?.length > 1 ? parts[0][parts[0].length - 1] : null;
  if (last && parts.every(p => p.length > 1 && p[p.length - 1] === last)) return `${joinWithAnd(parts.map(p => p.slice(0, -1).join(' ')))} ${last}`;
  return joinWithAnd(names);
}

/** A family's Balance cell: what it owes, or a quiet dash. */
const owed = (f: WorklistFamily) => (owedCents(f) > 0 ? money(owedCents(f) / 100) : '—');

function ChasedChip({ f }: { f: WorklistFamily }) {
  if (f.repOwedCents > 0) return f.chasedAt ? <RepChip tone="warn">{W.reminded(f.chasedAt)}</RepChip> : <RepChip tone="bad">{W.never}</RepChip>;
  if (f.leagueUnpaidCount > 0) return <RepChip>{W.notTracked}</RepChip>;
  return null;
}

/** A record window open over the list: who, and whether it came from a row of the list on screen. */
type Open = { personId: string; fromList: boolean };

export default function FamiliesBook() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();
  const search = useSearchParams();
  const isPhone = useIsPhone();
  const { brief, reload: reloadBrief } = useClubBrief();
  const slug = currentOrg?.slug ?? '';
  const q = `orgSlug=${encodeURIComponent(slug)}`;
  const base = `/${slug}/admin/families`;

  const [data, setData] = useState<WorklistPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [asking, setAsking] = useState(false);
  /** The list "Email these families" was pressed on — the window opens with it chosen. */
  const [emailing, setEmailing] = useState<FamilyListKey | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [open, setOpen] = useState<Open | null>(null);

  // An arriving family address (`?family=` from /families/{personId}) opens the record — whenever it changes — and is
  // then dropped from the address, so the window's own Back step starts from the clean list (never `router.replace` while
  // the window is open: the allocation window's rule).
  const askedFamily = search.get('family');
  const [seenAsk, setSeenAsk] = useState<string | null>(null);
  if (askedFamily !== seenAsk) {
    setSeenAsk(askedFamily);
    if (askedFamily) setOpen({ personId: askedFamily, fromList: search.get('show') != null });
  }
  const askedShow = search.get('show');
  useEffect(() => {
    if (!askedFamily) return;
    router.replace(askedShow ? `${base}?show=${encodeURIComponent(askedShow)}` : base, { scroll: false });
  }, [askedFamily, askedShow, router, base]);

  const beginRead = useLatestRead();
  const load = useCallback(async () => {
    if (!slug) return;
    const current = beginRead();
    setFailed(false);
    const r = await moneyFetch<WorklistPayload>(`/api/admin/families?${q}`).catch(() => null);
    if (!current()) return;
    if (!r?.ok) { setFailed(true); return; }
    setData(r.data);
  }, [slug, q, beginRead]);
  useDeferredLoad(!orgLoading && !!slug, load);

  // The rail and the Duplicates tab wear the brief's one count; this read ran the attach (the area's entry), so when it
  // finds a different number the brief reads again rather than the two places disagreeing.
  const briefCount = brief?.counts.familyDuplicates;
  const readCount = data?.duplicateCount;
  const synced = useRef<number | null>(null);
  useEffect(() => {
    if (readCount == null || briefCount == null || briefCount === readCount || synced.current === readCount) return;
    synced.current = readCount;
    reloadBrief();
  }, [readCount, briefCount, reloadBrief]);

  const families = useMemo(() => data?.families ?? [], [data]);
  const noFamily = useMemo(() => data?.noFamilyChildren ?? [], [data]);
  const counts: Record<Question, number> = useMemo(() => ({
    nofamily: noFamily.length,
    owes: families.filter(FAMILY_PREDICATES.owes).length,
    forms: families.filter(FAMILY_PREDICATES.forms).length,
    consent: families.filter(FAMILY_PREDICATES.consent).length,
    notback: families.filter(FAMILY_PREDICATES.notback).length,
    all: families.length,
  }), [families, noFamily]);

  // The landing question when the address names none: the day's honest headline — the data repair first. Chosen once, on
  // the first read: a later read (after Ask the coaches, or a merge) never swaps the list under the reader (/review).
  const [landed, setLanded] = useState<Question | null>(null);
  const firstLanding: Question = counts.nofamily > 0 ? 'nofamily' : counts.owes > 0 ? 'owes' : 'all';
  if (data && landed == null) setLanded(firstLanding);
  const landing: Question = landed ?? firstLanding;
  const show: Question = isQuestion(askedShow) ? askedShow : landing;
  const setShow = (next: string) => {
    setShown(PAGE);
    router.replace(`${base}?show=${encodeURIComponent(next)}`, { scroll: false });
  };

  const needle = query.trim().toLowerCase();
  const rows: WorklistFamily[] = useMemo(() => {
    if (show === 'nofamily') return [];
    const listed = show === 'all' ? families : families.filter(FAMILY_PREDICATES[show]);
    return needle ? listed.filter(f => familyMatches(f, needle)) : listed;
  }, [families, show, needle]);
  const childRows: NoFamilyChild[] = useMemo(() => (show !== 'nofamily' ? [] : needle
    ? noFamily.filter(c => c.childName.toLowerCase().includes(needle) || c.groupName.toLowerCase().includes(needle))
    : noFamily), [noFamily, show, needle]);

  if (failed && !data) return <LoadFailed title={W.loadFailed} onRetry={() => void load()} />;
  if (!data) return <LoadingState label="Loading families…" />;

  const questionName = W.questions[show];
  const options = QUESTIONS.map(id => ({
    id, label: W.questions[id], detail: String(counts[id]),
    pillMark: <span className={repKit.dim}>&nbsp;{counts[id]}</span>,
  }));
  const searchLabel = show === 'nofamily' ? W.searchChildren : W.search;
  const onSearch = (next: string) => { setQuery(next); setShown(PAGE); };

  // Previous · Next walk the list on screen (the question, narrowed by a search) — the record's `steps`.
  const listIds = rows.map(f => ({ personId: f.personId, name: f.name }));
  const openFamily = (personId: string) => setOpen({ personId, fromList: true });

  const emptyFor = (list: string) => (
    <EmptyCard title={needle ? W.emptySearchTitle(list) : show === 'nofamily' ? W.emptyNoFamilyTitle : families.length === 0 ? W.emptyBookTitle : W.emptyListTitle}
      action={needle && show !== 'all' ? <button type="button" className="btn btn-outline" onClick={() => setShow('all')}>{W.searchAll}</button> : undefined}>
      {needle ? null : show === 'nofamily' ? W.emptyNoFamilyBody : families.length === 0 ? W.emptyBookBody : W.emptyListBody}
    </EmptyCard>
  );

  const repChildrenWaiting = noFamily.some(c => c.source === 'rep_roster');

  return (
    <>
      <p className={fam.lede}>
        {W.lede(families.length)}
        {noFamily.length > 0 && <> · <b>{W.noFamilyCount(noFamily.length)}</b></>}
      </p>

      <div className={fam.tools}>
        <SingleSelectDropdown label={W.show} options={options} value={show} onChange={setShow} lead fill />
        <span className={tb.toolbarSpacer} aria-hidden />
        <div className={tb.deskFilters}><SearchField value={query} onChange={onSearch} label={searchLabel} /></div>
        {/* Email these families (owner 2026-10-22): present only on a list that names families — the pill's list, never
            narrowed by the search (the window says who it reaches). The Emails tab is the door to every other send. */}
        {isFamilyListKey(show) && counts[show] > 0 && (
          <button type="button" className="btn btn-outline" onClick={() => setEmailing(show)} aria-haspopup="dialog">
            <Mail size={14} aria-hidden />{EW.doorThese}
          </button>
        )}
      </div>
      <div className={tb.phoneSearchRow}><SearchField value={query} onChange={onSearch} label={searchLabel} layout="fill" /></div>

      {show === 'nofamily' ? (
        <>
          {repChildrenWaiting && (
            <div className={fam.askRow}>
              <p className={fam.askSay}>{W.whoAdds}</p>
              <button type="button" className="btn btn-outline" onClick={() => setAsking(true)}>
                <Mail size={14} aria-hidden />{W.askCoaches}
              </button>
            </div>
          )}
          {childRows.length === 0 ? emptyFor(questionName) : <NoFamilyList rows={childRows.slice(0, shown)} isPhone={isPhone} />}
          {childRows.length > shown && <ShowMore shown={shown} of={childRows.length} onMore={() => setShown(n => n + PAGE)} />}
        </>
      ) : rows.length === 0 ? emptyFor(questionName) : (
        <>
          {isPhone ? (
            <ClubRowList label={questionName}>
              {rows.slice(0, shown).map(f => {
                const kids = rowChildren(f);
                const unpaid = kids.some(c => c.feeUnpaid);
                return (
                  <ClubRow
                    key={f.personId}
                    as="button"
                    onClick={() => openFamily(f.personId)}
                    aria-haspopup="dialog"
                    aria-label={W.open(f.name)}
                    title={(
                      <span className={fam.cardTitle}>
                        <span>{f.name}</span>
                        <span className={`${fam.cardFigure}${owedCents(f) > 0 ? '' : ` ${fam.dim}`}`}>{owed(f)}</span>
                      </span>
                    )}
                    caption={(
                      <>
                        {kids.length > 0 && childrenPhrase(kids.map(c => c.childName))}
                        {unpaid && ` · ${W.feeNotPaidInline}`}
                        {(f.repOwedCents > 0 || f.leagueUnpaidCount > 0) && <span className={fam.cardChip}><ChasedChip f={f} /></span>}
                      </>
                    )}
                    chevron
                  />
                );
              })}
            </ClubRowList>
          ) : (
            <div className={repKit.tableFrame}>
              <table className={repKit.table}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '27%' }}>{W.colFamily}</th>
                    <th scope="col">{W.colChildren}</th>
                    <th scope="col" className={repKit.num} style={{ width: '13%' }}>{W.colBalance}</th>
                    <th scope="col" className={repKit.num} style={{ width: '17%' }}>{W.colChased}</th>
                    <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, shown).map(f => {
                    const kids = rowChildren(f);
                    return (
                      <tr key={f.personId} className={repKit.rowOpens}
                        onClick={() => { if (window.getSelection()?.toString()) return; openFamily(f.personId); }}>
                        <td>
                          <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog"
                            onClick={e => { e.stopPropagation(); openFamily(f.personId); }}>{f.name}</button>
                          <span className={fam.emailLine}>{f.email}</span>
                        </td>
                        <td>
                          {kids.slice(0, 3).map(c => (
                            <span key={c.sourceRowId} className={fam.childLine}>
                              {c.childName} · {c.where}
                              {c.feeUnpaid && <span className={fam.inlineChip}><RepChip tone="bad">{W.feeNotPaid}</RepChip></span>}
                            </span>
                          ))}
                          {kids.length > 3 && <span className={fam.childLine}>{W.andMore(kids.length - 3)}</span>}
                        </td>
                        <td className={`${repKit.num}${owedCents(f) > 0 ? '' : ` ${repKit.dim}`}`}>{owed(f)}</td>
                        <td className={repKit.num}><ChasedChip f={f} /></td>
                        <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > shown && <ShowMore shown={shown} of={rows.length} onMore={() => setShown(n => n + PAGE)} />}
        </>
      )}

      {/* The window mounts once an arriving address is clean, so its Back step starts from the list (never a dead Back). */}
      {open && !askedFamily && (
        <FamilyRecordWindow
          key={open.personId}
          q={q}
          personId={open.personId}
          listName={open.fromList ? questionName : null}
          list={open.fromList ? listIds : null}
          address={id => `${base}/${encodeURIComponent(id)}?show=${encodeURIComponent(show)}`}
          onStep={personId => setOpen({ personId, fromList: true })}
          onClose={() => setOpen(null)}
        />
      )}
      {asking && <CoachAskWindow q={q} onClose={() => setAsking(false)} />}
      {emailing && (
        <EmailFamiliesWindow
          q={q}
          initialList={emailing}
          onClose={() => setEmailing(null)}
          onShowNoFamily={() => { setEmailing(null); setShow('nofamily'); }}
          onSent={text => { setEmailing(null); setSaid(text); }}
        />
      )}
      {said && <NoticePill key={said} message={said} onDone={() => setSaid(null)} />}
    </>
  );
}

function ShowMore({ shown, of, onMore }: { shown: number; of: number; onMore: () => void }) {
  return (
    <div className={fam.more}>
      <button type="button" className="btn btn-outline" onClick={onMore}>{W.loadMore(shown, of)}</button>
    </div>
  );
}

/** No family on file: children grouped under their team or season. A rep row opens nothing (only the team's coaches can
 *  add a guardian); a house-league row opens the season's registrations. No action in a cell. */
function NoFamilyList({ rows, isPhone }: { rows: readonly NoFamilyChild[]; isPhone: boolean }) {
  const router = useRouter();
  const groups: { id: string; name: string; rows: NoFamilyChild[] }[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (last && last.id === r.groupId) last.rows.push(r);
    else groups.push({ id: r.groupId, name: r.groupName, rows: [r] });
  }
  const why = (r: NoFamilyChild) => (r.reason === 'no_email' ? W.whyNoEmail : W.whyUnattached);
  if (isPhone) {
    return (
      <ClubRowList label={W.questions.nofamily}>
        {groups.map(g => (
          <Fragment key={g.id}>
            <ClubRowBand count={g.rows.length}>{g.name}</ClubRowBand>
            {g.rows.map((r, i) => (r.href
              ? <ClubRow key={`${r.childName}-${i}`} as="link" href={r.href} title={r.childName} caption={why(r)} chevron />
              : <ClubRow key={`${r.childName}-${i}`} title={r.childName} caption={why(r)} />))}
          </Fragment>
        ))}
      </ClubRowList>
    );
  }
  return (
    <div className={repKit.tableFrame}>
      <table className={repKit.table}>
        <thead>
          <tr>
            <th scope="col" style={{ width: '40%' }}>{W.colChild}</th>
            <th scope="col">{W.colWhy}</th>
            <th scope="col" className={repKit.go}><span className={repKit.srOnly}>Open</span></th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g => (
            <Fragment key={g.id}>
              <tr className={repKit.band}><td colSpan={3}>{g.name} · {g.rows.length}</td></tr>
              {g.rows.map((r, i) => (
                <tr key={`${r.childName}-${i}`} className={r.href ? repKit.rowOpens : undefined}
                  onClick={r.href ? () => { if (window.getSelection()?.toString()) return; router.push(r.href!); } : undefined}>
                  <td>{r.href ? <Link href={r.href} className={repKit.nameLink} onClick={e => e.stopPropagation()}>{r.childName}</Link> : <span className={fam.childName}>{r.childName}</span>}</td>
                  <td>{why(r)}</td>
                  <td className={repKit.go}>{r.href && <Link href={r.href} className={repKit.goLink} aria-hidden tabIndex={-1}><ChevronRight size={16} /></Link>}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
