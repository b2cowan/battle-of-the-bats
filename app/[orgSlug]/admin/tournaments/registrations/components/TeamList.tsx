'use client';
/**
 * TEAMS' LIST (Tournament admin redesign Stage 2, T2 · T4 · T6). ONE frame per division — the pools, the
 * review queue, the waitlist and "Accepted — needs a spot" are bands in it (S.7: a list whose rows fit a
 * phone is one frame; F40's one painter) — drawn with the admin's ONE row recipe (`ClubRow`, Stage 1).
 * At a desk it is a TABLE (Team · Coach · Slot · Payment): an organizer reads Payment down the column.
 * Status is never a column and never a badge under a pool: the band says it once, and a chip marks only
 * a row whose status differs from its band (a waiting team that already holds a spot, owner P2).
 *
 * Three modes, one list:
 *   normal — the whole row opens the team's record; ONE worded action beside the chevron where the row
 *            exists to do it (Accept · Promote · Place — A13), olive on white.
 *   select — Teams' OWN selection row (A17, ruled: no shared part until a second screen needs one): a
 *            22px tick leads the row and the whole row toggles it.
 *   swap   — the pools only; each row's chevron becomes a 44px swap mark, the first choice shown by its
 *            mark turning olive. The row is NEVER tinted (§3.3). Rows do not open.
 */
import type { ReactNode } from 'react';
import { ArrowLeftRight, ChevronRight } from 'lucide-react';
import { ClubRow, ClubRowBand, ClubRowFrame, ClubRowList, repKit } from '@/components/admin/kit/club/RepKit';
import { TEAMS_WORDS } from '@/lib/registration-words';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import type { BandKind, PoolSlot, TeamBand, TeamRecord, TeamRowItem } from '@/lib/tournament-teams';
import styles from '../teams-admin.module.css';

/** What a row says, decided by the page (it holds the fees, the plan and the open spots). */
export interface RowFacts {
  /** The caption line on a phone ("Red Team 2 · Coach Storm · Owes $475"). */
  caption: ReactNode;
  /** A chip when the team's status differs from its band. */
  chip: ReactNode | null;
  /** The row's one worded action, or null. */
  action: ReactNode | null;
  /** The desk's third column (the slot, the pool, or the waitlist place). */
  place: ReactNode;
  /** The desk's Payment cell. */
  payment: ReactNode;
}

export type ListMode = 'normal' | 'select' | 'swap';

export default function TeamList({
  bands, mode, placeColumn, facts, selectedIds, swapFirstSlotId, onOpen, onToggle, onSwap,
}: {
  bands: TeamBand[];
  mode: ListMode;
  /** The desk's third column heading — "Slot", "Pool" — or null where none applies (a division without pools). */
  placeColumn: string | null;
  facts: (team: TeamRecord, slot: PoolSlot | null, band: BandKind) => RowFacts;
  selectedIds: Set<string>;
  swapFirstSlotId: string | null;
  onOpen: (teamId: string) => void;
  onToggle: (teamId: string) => void;
  onSwap: (slotId: string) => void;
}) {
  const shown = mode === 'swap' ? bands.filter(b => b.kind === 'pool') : bands;
  const cols = 4 + (placeColumn ? 1 : 0) + (mode === 'select' ? 1 : 0);
  // Each team's facts, once per render — the phone rows and the desk table both draw from them.
  const factsOf = new Map(shown.flatMap(b => b.rows.flatMap(r => (r.kind === 'team' ? [[r.team.id, facts(r.team, r.slot, b.kind)] as const] : []))));
  /** A swap target's name to a screen reader: the spot, who is in it, and whether it is the first choice. */
  const swapLabel = (slot: PoolSlot, who: string) => `${slot.displayName}, ${who}${swapFirstSlotId === slot.id ? ' — chosen' : ''}`;

  const phoneRow = (row: TeamRowItem) => {
    const key = row.kind === 'team' ? row.team.id : row.slot.id;
    if (mode === 'swap' && row.slot) {
      const chosen = swapFirstSlotId === row.slot.id;
      const name = row.kind === 'team' ? row.team.name : row.slot.displayName;
      return (
        <ClubRow
          key={key}
          as="button"
          onClick={() => onSwap(row.slot!.id)}
          aria-label={swapLabel(row.slot, row.kind === 'team' ? row.team.name : TEAMS_WORDS.openSpot)}
          title={name}
          caption={row.kind === 'team' ? factsOf.get(row.team.id)!.caption : TEAMS_WORDS.openSpot}
          trail={<SwapMark on={chosen} />}
        />
      );
    }
    if (row.kind === 'empty') {
      return <ClubRow key={key} title={row.slot.displayName} caption={TEAMS_WORDS.openSpot} />;
    }
    const f = factsOf.get(row.team.id)!;
    if (mode === 'select') {
      const on = selectedIds.has(row.team.id);
      return (
        <li key={key} className={styles.selItem} data-row-list-row>
          <label className={styles.selRow}>
            <input type="checkbox" className={screenParts.check22} checked={on} onChange={() => onToggle(row.team.id)} />
            <span className={styles.selMain}>
              <span className={styles.selTitle}>{row.team.name}{f.chip}</span>
              <span className={styles.selCaption}>{f.caption}</span>
            </span>
          </label>
        </li>
      );
    }
    return (
      <ClubRow
        key={key}
        as="button"
        onClick={() => onOpen(row.team.id)}
        aria-haspopup="dialog"
        title={<>{row.team.name}{f.chip}</>}
        caption={f.caption}
        chevron
        beside={f.action ?? undefined}
      />
    );
  };

  const deskRow = (row: TeamRowItem) => {
    const key = row.kind === 'team' ? row.team.id : row.slot.id;
    if (row.kind === 'empty') {
      const chosen = swapFirstSlotId === row.slot.id;
      return (
        <tr key={key} className={mode === 'swap' ? repKit.rowOpens : undefined} onClick={mode === 'swap' ? () => onSwap(row.slot.id) : undefined}>
          {mode === 'select' && <td />}
          <td className={repKit.dim}>{TEAMS_WORDS.openSpot}</td>
          <td />
          {placeColumn && <td>{row.slot.displayName}</td>}
          <td />
          <td />
          <td className={repKit.go}>
            {mode === 'swap' && (
              <button type="button" className={styles.swapButton} onClick={e => { e.stopPropagation(); onSwap(row.slot.id); }}
                aria-label={swapLabel(row.slot, TEAMS_WORDS.openSpot)}>
                <SwapMark on={chosen} />
              </button>
            )}
          </td>
        </tr>
      );
    }
    const t = row.team;
    const f = factsOf.get(t.id)!;
    const chosen = row.slot != null && swapFirstSlotId === row.slot.id;
    const onRow = mode === 'swap' ? () => row.slot && onSwap(row.slot.id)
      : mode === 'select' ? () => onToggle(t.id)
        : () => onOpen(t.id);
    return (
      <tr key={key} className={repKit.rowOpens} onClick={onRow}>
        {mode === 'select' && (
          <td className={styles.tickCell} onClick={e => e.stopPropagation()}>
            <input type="checkbox" className={screenParts.check22} checked={selectedIds.has(t.id)} onChange={() => onToggle(t.id)} aria-label={`Select ${t.name}`} />
          </td>
        )}
        <td>
          <span className={repKit.nameCell}>
            {mode === 'normal'
              ? <button type="button" className={`${repKit.nameButton} ${repKit.nameLink}`} aria-haspopup="dialog" onClick={e => { e.stopPropagation(); onOpen(t.id); }}>{t.name}</button>
              : <span className={repKit.nameLink}>{t.name}</span>}
            {f.chip}
          </span>
        </td>
        <td className={repKit.dim}>{t.coach || '—'}</td>
        {placeColumn && <td>{f.place}</td>}
        <td>{f.payment}</td>
        <td className={styles.actionCell} onClick={e => e.stopPropagation()}>{mode === 'normal' ? f.action : null}</td>
        <td className={repKit.go}>
          {mode === 'swap' && row.slot
            ? (
              <button type="button" className={styles.swapButton} onClick={e => { e.stopPropagation(); onSwap(row.slot!.id); }}
                aria-label={swapLabel(row.slot, t.name)}>
                <SwapMark on={chosen} />
              </button>
            )
            : <span className={repKit.goLink} aria-hidden><ChevronRight size={16} /></span>}
        </td>
      </tr>
    );
  };

  return (
    <div className={mode === 'swap' ? styles.swapping : undefined}>
      <div className={repKit.phoneOnly}>
        <ClubRowFrame>
          {shown.map(band => (
            <ClubRowList key={band.key} inset label={band.label}>
              <ClubRowBand count={band.count}>{band.label}</ClubRowBand>
              {band.rows.map(phoneRow)}
            </ClubRowList>
          ))}
        </ClubRowFrame>
      </div>
      <div className={`${repKit.deskOnly} ${repKit.tableFrame}`}>
        <table className={repKit.table}>
          <thead>
            <tr>
              {mode === 'select' && <th scope="col" className={styles.tickCell}><span className="sr-only">Select</span></th>}
              <th scope="col">Team</th>
              <th scope="col">Coach</th>
              {placeColumn && <th scope="col">{placeColumn}</th>}
              <th scope="col">Payment</th>
              <th scope="col"><span className="sr-only">Action</span></th>
              <th scope="col" className={repKit.go}><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(band => [
              <tr key={`band-${band.key}`} className={repKit.band}>
                <td colSpan={cols + 1}>{band.label} <span className={repKit.rowBandCount}>{band.count}</span></td>
              </tr>,
              ...band.rows.map(deskRow),
            ])}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The swap mark — olive once chosen (the row itself is never tinted). */
function SwapMark({ on }: { on: boolean }) {
  return <span className={styles.swapMark} data-on={on || undefined} aria-hidden><ArrowLeftRight size={16} /></span>;
}
