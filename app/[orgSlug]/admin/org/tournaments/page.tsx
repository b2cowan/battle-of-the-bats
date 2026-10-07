'use client';
/**
 * THE TOURNAMENTS LIST — Tournament admin redesign Stage 4 (D5, then D7: one list, ruled 2026-10-06 — it
 * replaced A22's two lists and the Past tournaments page), built to hub v27
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 4 tab, part "D7 One list").
 *
 *   Tournaments                       [+ New tournament] [?]   one name (the tab too); no "Organization" eyebrow
 *   1 of 1 tournament slot in use                              a plan with a finite number of slots only — the
 *   ┌ ACTIVE 2   public site online ────────────────┐         event holding the slot is on this page (F57)
 *   │ Riverdale Summer Classic                       │         EVERY event, in exactly one band, in the order
 *   │ Oct 4–6, 2026 · 8 teams                     ›  │         of its life: what's ahead on top, so history
 *   │ COMPLETED 1   public site online               │         only ever adds rows below; Mark complete moves
 *   │ Riverdale Season Opener      [Reuse setup]  ›  │         an event down a band, not to another page
 *   │ SEALED RECORDS                 Public ledger ↗ │
 *   └────────────────────────────────────────────────┘
 *
 * Each band says ONCE what it means for the public site, beside its count (it replaced Past tournaments'
 * Public site column, which repeated the band on every row). One row shape in every band: the name, then
 * its dates and its teams ("no teams" on a finished event, never "no teams yet"). A Completed row carries
 * Reuse setup (olive on white, A12) — in that band only, the band being the condition (K-08's named
 * exception, as Teams' Accept). NO OTHER CONTROLS ON A ROW (F35): the whole row opens THE EVENT'S RECORD,
 * where every status change asks first. Public ledger, the old Past tournaments header's door, sits in the
 * Sealed records band, shown when there is a sealed record to list. Every band is open (D7b).
 *
 * One frame with bands on a phone (S.7); at a desk a table — Tournament · Dates · Teams — with the bands
 * as band rows. `tournaments/manage/page.tsx` re-exports this page; `tournaments/archives` (Past
 * tournaments' old address) redirects here. The door to it is "Tournaments" in the rail's Admin group and
 * the phone's More (D7a).
 */
import { use, useEffect, useState } from 'react';
import { ChevronRight, ExternalLink, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { hasCapability } from '@/lib/roles';
import { hasPlanFeature } from '@/lib/plan-features';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import HelpButton from '@/components/help/HelpButton';
import type { HelpRequest } from '@/components/help/help-drawer-context';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, LoadFailed, RowAction, repKit } from '@/components/admin/kit/club/RepKit';
import PlanLockLine, { tournamentPlusPanelHref } from '@/components/admin/tournament/PlanLockLine';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { useSetupWizard } from '@/components/admin/tournament/SetupWizardOpener';
import RecordFromList from '@/components/admin/tournament/RecordFromList';
import { useTournamentLists } from '@/components/admin/tournament/useTournamentLists';
import { AFTER_EVENT_LOCK_PLAN, LIST_WORDS } from '@/lib/after-event-words';
import { RECORD_WORDS, STATUS_WORD } from '@/lib/tournament-status-words';
import { isFinished, listBands, walkOrder, type ListBand, type ListEvent } from '@/lib/tournament-lists';
import { formatEventDateRange, formatStoredDate } from '@/lib/timezone';
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
  const { openNew, openReuse } = useSetupWizard();
  const lists = useTournamentLists(currentOrg?.slug, currentOrg?.planId);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (createOnLoad) openNew('manage_tournaments_new_button');
  }, [createOnLoad, openNew]);

  const orgSlug = currentOrg?.slug ?? '';
  const canWrite = Boolean(userRole && hasCapability(userRole, userCapabilities, 'create_tournaments'));
  const canClone = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const canSeal = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'sealed_archives'));
  const limit = currentOrg?.tournamentLimit ?? 9999;
  const finiteSlots = limit < 9999;
  // Every status but Archived holds a slot — and with one list, the events holding them are all on this page.
  const used = lists.events.filter(e => e.status !== 'archived').length;
  const atLimit = finiteSlots && used >= limit;
  // The slot line and New tournament wait for the first read: before it, "used" is 0 and a full plan would
  // flash "0 of 1 in use" and a New tournament that then turns into the lock line (/review 2026-10-06).
  const ready = !lists.loading && !(lists.error && lists.events.length === 0);
  const planHref = tournamentPlusPanelHref(orgSlug);
  const bands = listBands(lists.events);
  const order = walkOrder(bands);

  const dates = (e: ListEvent) => formatEventDateRange(e.startDate, e.endDate, true) ?? LIST_WORDS.datesNotSet;
  const caption = (e: ListEvent) => `${dates(e)} · ${LIST_WORDS.teams(e.acceptedTeams, isFinished(e.status))}`;
  const reuse = (e: ListEvent) => canClone && canWrite && e.status === 'completed' ? (
    <RowAction onClick={ev => { ev.stopPropagation(); openReuse({ id: e.id, name: e.name, year: e.year, status: e.status }, 'manage_tournaments_row'); }}>
      {LIST_WORDS.reuseRow}
    </RowAction>
  ) : null;
  // The band's label, its count and — once — what the band means for the public site.
  const bandLabel = (band: ListBand) => (
    <>
      {STATUS_WORD[band.key]} <span className={repKit.rowBandCount}>{band.events.length}</span>
      <span className={styles.bandNote}>{LIST_WORDS.bandSite[band.key]}</span>
    </>
  );
  // Public ledger lists sealed records only, so its door shows when there is one to list: the band's last
  // row on a phone (a 44px row, as each sealed record's), the band row's right edge at a desk.
  const hasLedger = canSeal && lists.sealed.length > 0;
  const ledgerHref = `/${orgSlug}/archives`;

  const newButton = canWrite && ready && !atLimit ? (
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

  // The Sealed records band: each sealed record a door to its public record, on ANY plan — a club that sealed
  // records on Tournament Plus and later moved plans still sees its own (/review 2026-10-06); then, on a plan
  // without sealing, one plain lock line (never a dashed box); with sealing and nothing sealed, one sentence.
  const sealedPhone = [
    ...lists.sealed.map(s => (
      <ClubRow
        key={s.archiveId}
        as="link"
        external
        href={`/${orgSlug}/archives/${s.archiveId}`}
        title={s.name}
        caption={RECORD_WORDS.sealed(formatStoredDate(s.sealedAt))}
        trail={<ExternalLink size={14} aria-hidden className={styles.out} />}
      />
    )),
    ...(hasLedger ? [
      <ClubRow key="ledger" as="link" external href={ledgerHref} title={<span className={styles.door}>{LIST_WORDS.publicLedger}</span>} trail={<ExternalLink size={14} aria-hidden className={styles.out} />} />,
    ] : []),
    ...(!canSeal
      ? [<ClubRow key="lock" title={<PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{RECORD_WORDS.lockSeal}</PlanLockLine>} />]
      : lists.sealed.length === 0
        ? [<ClubRow key="none" title={<span className={styles.quiet}>{LIST_WORDS.noneSealed}</span>} />]
        : []),
  ];

  return (
    <div className={repKit.page}>
      <AdminPageHeader
        title={LIST_WORDS.tournaments}
        inlineActions
        actions={<>{newButton}<HelpButton help={LIST_HELP} label={LIST_WORDS.tournaments} iconOnly /></>}
      />
      {finiteSlots && ready && (
        <div className={styles.slotLine}>
          <span>{LIST_WORDS.slotsInUse(used, limit)}</span>
          {atLimit && canWrite && <PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{RECORD_WORDS.lockSlots}</PlanLockLine>}
        </div>
      )}

      {lists.error && lists.events.length === 0 ? (
        <LoadFailed title={lists.error} onRetry={() => void lists.reload()} />
      ) : lists.loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {bands.length === 0 && <p className={styles.muted}>{LIST_WORDS.nothingYet}</p>}
          <div className={repKit.phoneOnly}>
            <ClubRowFrame>
              {bands.map(band => (
                <ClubRowList key={band.key} inset label={STATUS_WORD[band.key]}>
                  <ClubRowBand>{bandLabel(band)}</ClubRowBand>
                  {band.events.map(e => (
                    <ClubRow
                      key={e.id}
                      as="button"
                      aria-haspopup="dialog"
                      onClick={() => setOpenId(e.id)}
                      title={e.name}
                      caption={caption(e)}
                      chevron
                      beside={reuse(e) ?? undefined}
                    />
                  ))}
                </ClubRowList>
              ))}
              <ClubRowList inset label={LIST_WORDS.sealedBand}>
                <ClubRowBand>{LIST_WORDS.sealedBand}</ClubRowBand>
                {sealedPhone}
              </ClubRowList>
            </ClubRowFrame>
          </div>
          <div className={`${repKit.deskOnly} ${repKit.tableFrame}`}>
            <table className={repKit.table}>
              <thead>
                <tr>
                  <th scope="col">{LIST_WORDS.colTournament}</th>
                  <th scope="col">{LIST_WORDS.colDates}</th>
                  <th scope="col" className={repKit.num}>{LIST_WORDS.colTeams}</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                  <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {bands.map(band => [
                  <tr key={`band-${band.key}`} className={repKit.band}>
                    <td colSpan={5}>{bandLabel(band)}</td>
                  </tr>,
                  ...band.events.map(e => (
                    <tr key={e.id} className={repKit.rowOpens} onClick={() => setOpenId(e.id)}>
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={ev => { ev.stopPropagation(); setOpenId(e.id); }}>{e.name}</button>
                      </td>
                      <td className={repKit.dim}>{dates(e)}</td>
                      <td className={repKit.num}>{e.acceptedTeams}</td>
                      <td className={styles.actionCell} onClick={ev => ev.stopPropagation()}>{reuse(e)}</td>
                      <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                    </tr>
                  )),
                ])}
                <tr className={repKit.band}>
                  <td colSpan={5}>
                    <span className={styles.bandRow}>
                      {LIST_WORDS.sealedBand}
                      {hasLedger && (
                        <a href={ledgerHref} target="_blank" rel="noopener noreferrer" className={styles.ledgerDoor}>
                          {LIST_WORDS.publicLedger} <ExternalLink size={13} aria-hidden />
                        </a>
                      )}
                    </span>
                  </td>
                </tr>
                {lists.sealed.map(s => (
                  <tr key={s.archiveId}>
                    <td>
                      <a className={repKit.nameLink} href={`/${orgSlug}/archives/${s.archiveId}`} target="_blank" rel="noopener noreferrer">{s.name}</a>
                    </td>
                    <td className={repKit.dim} colSpan={3}>{RECORD_WORDS.sealed(formatStoredDate(s.sealedAt))}</td>
                    <td className={repKit.go}><ExternalLink size={14} aria-hidden className={styles.out} /></td>
                  </tr>
                ))}
                {!canSeal ? (
                  <tr><td colSpan={5}><PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{RECORD_WORDS.lockSeal}</PlanLockLine></td></tr>
                ) : lists.sealed.length === 0 ? (
                  <tr><td colSpan={5} className={repKit.dim}>{LIST_WORDS.noneSealed}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RecordFromList openId={openId} order={order} lists={lists} onOpen={setOpenId} onClose={() => setOpenId(null)} />
    </div>
  );
}
