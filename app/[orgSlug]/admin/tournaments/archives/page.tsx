'use client';
/**
 * PAST TOURNAMENTS — Tournament admin redesign Stage 4 (D4; A19, A21, A22), built to hub v24
 * (https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM, Stage 4 tab), ruled 2026-10-06.
 *
 *   Past tournaments                       [Public ledger ↗] [?]   one name (title and tab; it said "Archives")
 *   ┌ COMPLETED 1 ──────────────────────────────────────┐        EVERY finished event lives here (A22), and only
 *   │ Riverdale Season Opener        [Reuse setup]   ›   │        here: the Tournaments list holds what's ahead
 *   │ Oct 2–4, 2026 · public site online                 │
 *   │ ARCHIVED 1 …                                       │        each row opens THE EVENT'S RECORD, where Bring
 *   │ SEALED RECORDS                                     │        back, Archive, Seal and Reuse live, each asking
 *   │ None yet. Seal a finished tournament from its …    │        first (the way back F32 promised)
 *   └────────────────────────────────────────────────────┘
 *
 * One frame with bands on a phone (S.7); at a desk a table — Tournament · Dates · Public site — the
 * Public site column answering "is it still up?" down the list. A Completed row carries Reuse setup
 * (olive on white, A12): in that band only, the band being the condition (K-08's named exception, as
 * Teams' Accept). Gone: the club's name above the title (2026-10-01), the plan fact under it, the dashed
 * lock box (2026-09-30) and "Seal Now" as an archived event's only action. The Tournament plan sees no
 * Reuse and one plain lock line for sealed records.
 */
import { useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
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
import { pastBands, walkOrder, type ListEvent } from '@/lib/tournament-lists';
import { formatEventDateRange, formatStoredDate } from '@/lib/timezone';
import styles from './archives-admin.module.css';

const PAST_HELP: HelpRequest = { module: 'tournaments', sectionIds: ['recipe-closeout-tournament'], subtopicId: 'closeout-two-lists' };

export default function AdminArchivesPage() {
  const { currentOrg, userRole, userCapabilities } = useOrg();
  const { openReuse } = useSetupWizard();
  const lists = useTournamentLists(currentOrg?.slug, currentOrg?.planId);
  const [openId, setOpenId] = useState<string | null>(null);

  const orgSlug = currentOrg?.slug ?? '';
  const planHref = tournamentPlusPanelHref(orgSlug);
  const canWrite = Boolean(userRole && hasCapability(userRole, userCapabilities, 'create_tournaments'));
  const canClone = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'tournament_cloning'));
  const canSeal = Boolean(currentOrg && hasPlanFeature(currentOrg.planId, 'sealed_archives'));
  const bands = pastBands(lists.events);
  const order = walkOrder(bands);

  const dates = (e: ListEvent) => formatEventDateRange(e.startDate, e.endDate, true) ?? LIST_WORDS.datesNotSet;
  const online = (e: ListEvent) => e.status === 'completed';
  const reuse = (e: ListEvent) => canClone && canWrite && e.status === 'completed' ? (
    <RowAction onClick={ev => { ev.stopPropagation(); openReuse({ id: e.id, name: e.name, year: e.year, status: e.status }, 'past_tournaments_row'); }}>
      {LIST_WORDS.reuseRow}
    </RowAction>
  ) : null;

  const ledgerDoor = (
    <a
      href={`/${orgSlug}/archives`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${screenParts.plainButton} ${screenParts.headerButton}`}
      aria-label={LIST_WORDS.publicLedger}
      title={LIST_WORDS.publicLedger}
    >
      <ExternalLink size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{LIST_WORDS.publicLedger}</span>
    </a>
  );

  // The Sealed records band: each sealed record a door to its public record; one sentence when none; on the
  // Tournament plan one plain lock line (never a dashed box).
  const sealedPhone = !canSeal
    ? [<ClubRow key="lock" title={<PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{RECORD_WORDS.lockSeal}</PlanLockLine>} />]
    : lists.sealed.length === 0
      ? [<ClubRow key="none" title={<span className={styles.quiet}>{LIST_WORDS.noneSealed}</span>} />]
      : lists.sealed.map(s => (
        <ClubRow
          key={s.archiveId}
          as="link"
          external
          href={`/${orgSlug}/archives/${s.archiveId}`}
          title={s.name}
          caption={RECORD_WORDS.sealed(formatStoredDate(s.sealedAt))}
          trail={<ExternalLink size={14} aria-hidden className={styles.out} />}
        />
      ));

  return (
    <div className={repKit.page}>
      <AdminPageHeader
        title={LIST_WORDS.past}
        inlineActions
        actions={<>{ledgerDoor}<HelpButton help={PAST_HELP} label={LIST_WORDS.past} iconOnly /></>}
      />

      {lists.error && lists.events.length === 0 ? (
        <LoadFailed title={lists.error} onRetry={() => void lists.reload()} />
      ) : lists.loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          {bands.length === 0 && <p className={styles.muted}>{LIST_WORDS.nothingPast}</p>}
          <div className={repKit.phoneOnly}>
            <ClubRowFrame>
              {bands.map(band => (
                <ClubRowList key={band.key} inset label={STATUS_WORD[band.key]}>
                  <ClubRowBand count={band.events.length}>{STATUS_WORD[band.key]}</ClubRowBand>
                  {band.events.map(e => (
                    <ClubRow
                      key={e.id}
                      as="button"
                      aria-haspopup="dialog"
                      onClick={() => setOpenId(e.id)}
                      title={e.name}
                      caption={`${dates(e)} · ${online(e) ? LIST_WORDS.siteOnline : LIST_WORDS.siteOffline}`}
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
                  <th scope="col">{LIST_WORDS.colSite}</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                  <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {bands.map(band => [
                  <tr key={`band-${band.key}`} className={repKit.band}>
                    <td colSpan={5}>{STATUS_WORD[band.key]} <span className={repKit.rowBandCount}>{band.events.length}</span></td>
                  </tr>,
                  ...band.events.map(e => (
                    <tr key={e.id} className={repKit.rowOpens} onClick={() => setOpenId(e.id)}>
                      <td>
                        <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={ev => { ev.stopPropagation(); setOpenId(e.id); }}>{e.name}</button>
                      </td>
                      <td className={repKit.dim}>{dates(e)}</td>
                      <td>{online(e) ? LIST_WORDS.online : LIST_WORDS.offline}</td>
                      <td className={styles.actionCell} onClick={ev => ev.stopPropagation()}>{reuse(e)}</td>
                      <td className={repKit.go}><span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span></td>
                    </tr>
                  )),
                ])}
                <tr className={repKit.band}><td colSpan={5}>{LIST_WORDS.sealedBand}</td></tr>
                {!canSeal ? (
                  <tr><td colSpan={5}><PlanLockLine href={planHref} plan={AFTER_EVENT_LOCK_PLAN}>{RECORD_WORDS.lockSeal}</PlanLockLine></td></tr>
                ) : lists.sealed.length === 0 ? (
                  <tr><td colSpan={5} className={repKit.dim}>{LIST_WORDS.noneSealed}</td></tr>
                ) : lists.sealed.map(s => (
                  <tr key={s.archiveId}>
                    <td>
                      <a className={repKit.nameLink} href={`/${orgSlug}/archives/${s.archiveId}`} target="_blank" rel="noopener noreferrer">{s.name}</a>
                    </td>
                    <td className={repKit.dim}>{RECORD_WORDS.sealed(formatStoredDate(s.sealedAt))}</td>
                    <td />
                    <td />
                    <td className={repKit.go}><ExternalLink size={14} aria-hidden className={styles.out} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RecordFromList openId={openId} order={order} lists={lists} onOpen={setOpenId} onClose={() => setOpenId(null)} />
    </div>
  );
}
