'use client';
/**
 * THE TOURNAMENTS LIST — Tournament admin redesign Stage 4 (D5; A20, A22), built to hub v24
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 4 tab), ruled 2026-10-06.
 *
 *   Tournaments                       [+ New tournament] [?]   one name (the tab too); no "Organization" eyebrow
 *   1 of 1 tournament slot in use                              a plan with a finite number of slots only
 *   ┌ ACTIVE 2 ───────────────────────────────┐               the list holds what's AHEAD (A22): each event
 *   │ Riverdale Summer Classic                 │               lives in one list by where it is in its life;
 *   │ Oct 3–5, 2026 · 8 teams               ›  │               Mark complete moves it to Past tournaments
 *   │ DRAFT 1 …                                │
 *   └──────────────────────────────────────────┘
 *   Finished events are in Past tournaments ›                  the door at the list's foot (olive text)
 *
 * Each event a 60px row in ONE frame on a phone (S.7); at a desk a table — Tournament · Dates · Teams —
 * with the statuses as band rows. NO CONTROLS ON A ROW (F35): the status menu that wrote on change, Seal,
 * Reuse, preview, edit and the red Delete left it; the whole row opens THE EVENT'S RECORD, where every
 * status change asks first. The two callouts and "How statuses work" went (Seal's warning into its
 * confirm; the status help into Help). New tournament opens the frame's ONE setup wizard.
 *
 * `tournaments/manage/page.tsx` re-exports this page.
 */
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { kit } from '@/components/coaches/kit';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, LoadFailed, repKit } from '@/components/admin/kit/club/RepKit';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { useSetupWizard } from '@/components/admin/tournament/SetupWizardOpener';
import RecordFromList from '@/components/admin/tournament/RecordFromList';
import { useTournamentLists } from '@/components/admin/tournament/useTournamentLists';
import { AFTER_EVENT_LOCK_PLAN, LIST_WORDS } from '@/lib/after-event-words';
import { RECORD_WORDS, STATUS_WORD } from '@/lib/tournament-status-words';
import { aheadBands, walkOrder } from '@/lib/tournament-lists';
import { formatEventDateRange } from '@/lib/timezone';
import styles from './tournaments-admin.module.css';

const LIST_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-closeout-tournament'], subtopicId: 'closeout-two-lists' };

export default function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string | string[]; source?: string | string[] }>;
}) {
  const resolved = use(searchParams);
  const createValue = resolved.create;
  // ?create=1 (the coach portal's "Tournaments you run" door, owner ruling 2026-09-13): the setup wizard
  // opens at once, and finishing it lands on the new tournament's board (the frame's one opener).
  const createOnLoad = createValue === '1' || (Array.isArray(createValue) && createValue.includes('1'));

  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { openNew } = useSetupWizard();
  const lists = useTournamentLists(currentOrg?.slug, currentOrg?.planId);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (createOnLoad) openNew('manage_tournaments_new_button');
  }, [createOnLoad, openNew]);

  const orgSlug = currentOrg?.slug ?? '';
  const base = `/${orgSlug}/admin/tournaments`;
  const canWrite = Boolean(userRole && hasCapability(userRole, userCapabilities, 'create_tournaments'));
  const limit = currentOrg?.tournamentLimit ?? 9999;
  const finiteSlots = limit < 9999;
  const used = lists.events.filter(e => e.status !== 'archived').length;
  const atLimit = finiteSlots && used >= limit;
  const planHref = tournamentPlusPanelHref(orgSlug);
  const bands = aheadBands(lists.events);
  const order = walkOrder(bands);

  const caption = (e: (typeof order)[number]) =>
    `${formatEventDateRange(e.startDate, e.endDate, true) ?? LIST_WORDS.datesNotSet} · ${LIST_WORDS.teams(e.acceptedTeams)}`;

  const newButton = canWrite && !atLimit ? (
    <button
      type="button"
      className={`btn btn-lime btn-data ${screenParts.headerButton}`}
      onClick={() => openNew('manage_tournaments_new_button')}
      aria-label={LIST_WORDS.newTournament}
      title={LIST_WORDS.newTournament}
    >
      <Plus size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{LIST_WORDS.newTournament}</span>
    </button>
  ) : null;

  return (
    <div className={repKit.page}>
      <AdminPageHeader
        title={LIST_WORDS.tournaments}
        inlineActions
        actions={<>{newButton}<HelpButton help={LIST_HELP} label={LIST_WORDS.tournaments} iconOnly /></>}
      />
      {finiteSlots && (
        <div className={styles.slotLine}>
          <span>{LIST_WORDS.slotsInUse(used, limit)}</span>
          {atLimit && canWrite && <PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{RECORD_WORDS.lockSlots}</PlanLockLine>}
        </div>
      )}

      {lists.error && lists.events.length === 0 ? (
        <LoadFailed title={lists.error} onRetry={() => void lists.reload()} />
      ) : lists.loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : bands.length === 0 ? (
        <p className={styles.muted}>{LIST_WORDS.nothingAhead}</p>
      ) : (
        <>
          <div className={repKit.phoneOnly}>
            <ClubRowFrame>
              {bands.map(band => (
                <ClubRowList key={band.key} inset label={STATUS_WORD[band.key]}>
                  <ClubRowBand count={band.events.length}>{STATUS_WORD[band.key]}</ClubRowBand>
                  {band.events.map(e => (
                    <ClubRow key={e.id} as="button" aria-haspopup="dialog" onClick={() => setOpenId(e.id)} title={e.name} caption={caption(e)} chevron />
                  ))}
                </ClubRowList>
              ))}
            </ClubRowFrame>
          </div>
          <div className={`${repKit.deskOnly} ${repKit.tableFrame}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">{LIST_WORDS.colTournament}</th>
                  <th scope="col">{LIST_WORDS.colDates}</th>
                  <th scope="col" className={styles.num}>{LIST_WORDS.colTeams}</th>
                  <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {bands.map(band => [
                  <tr key={`band-${band.key}`} className={repKit.band}>
                    <td colSpan={4}>{STATUS_WORD[band.key]} <span className={repKit.rowBandCount}>{band.events.length}</span></td>
                  </tr>,
                  ...band.events.map(e => (
                    <tr key={e.id} className={repKit.rowOpens} onClick={() => setOpenId(e.id)}>
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={ev => { ev.stopPropagation(); setOpenId(e.id); }}>{e.name}</button>
                      </td>
                      <td className={repKit.dim}>{formatEventDateRange(e.startDate, e.endDate, true) ?? LIST_WORDS.datesNotSet}</td>
                      <td className={styles.num}>{e.acceptedTeams}</td>
                      <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Link href={`${base}/archives`} className={`${kit.footLink} ${styles.toPast}`}>
        {LIST_WORDS.toPast} <ChevronRight size={14} aria-hidden />
      </Link>

      <RecordFromList openId={openId} order={order} lists={lists} onOpen={setOpenId} onClose={() => setOpenId(null)} />
    </div>
  );
}
