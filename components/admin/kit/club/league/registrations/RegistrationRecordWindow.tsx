'use client';
/**
 * A REGISTRATION'S RECORD (Club Tier Stage 9b-2, Part 3): the whole row opens it, on a phone and at a desk. It READS first
 * (design decisions: "a record reads first, edits whole") — and nothing on a registration is typed here, so it has no
 * pencil: the details, the fee as the book reads it, the history (the sign-up, each payment and refund, each price
 * correction, how it ended), and the same actions its row offers. Each action opens its own window over this one; the record
 * stays under it and reads the new state when that window is done. Previous · Next walk the list it was opened from.
 */
import KitDialog, { type KitStep } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { Facts } from '../../money/MoneyKit';
import { REG_RECORD_WORDS as W, REGS_WORDS } from '@/lib/house-league-money-words';
import { formatLeagueMoney, receivedOf, type LeagueMoneyLine } from '@/lib/league-money';
import { endedKind, isOpenReg, owesNow, regDay, registrationHistory, type PriceChange, type RegsSeason, type RowActionKey } from '@/lib/house-league-registrations';
import type { LeagueRegistration } from '@/lib/types';
import FeeCell from './FeeCell';
import CardRefundBlock from './CardRefundBlock';
import { isShown, newestFirst, type CardRefund } from '@/lib/league-card-refunds';
import { Note, type RegRowModel } from './RegistrationsList';
import css from './Registrations.module.css';

export default function RegistrationRecordWindow({
  model, season, seasonName, teamName, lines, changes, today, showFee, statusWord, steps, onPick, onNote, onClose,
  cardRefunds = [], canDesk = false, isPhone = false, focus = null, onAnotherWay,
}: {
  model: RegRowModel;
  season: RegsSeason;
  seasonName: string;
  teamName: string | null;
  lines: readonly LeagueMoneyLine[];
  changes: readonly PriceChange[];
  today: string;
  showFee: boolean;
  /** "Active" · "Waitlist · #2" · "Declined". */
  statusWord: string;
  /** The neighbours in the list it was opened from, or null when it was not opened from this list. */
  steps: { prev: KitStep | null; next: KitStep | null; position: string } | null;
  onPick: (key: RowActionKey) => void;
  /** The offer beside a refusal ("Waitlist {name}"). */
  onNote: (key: 'waitlist') => void;
  onClose: () => void;
  /** 12c: this child's card refunds (the "To the card" blocks). */
  cardRefunds?: readonly CardRefund[];
  /** The desk (takeFees): the button on a refund the card sent back, and the Fee cell's pill as its door. */
  canDesk?: boolean;
  isPhone?: boolean;
  /** Opened from a Needs-attention item (F5): 'card' scrolls the newest card refund into view. */
  focus?: 'fee' | 'card' | null;
  onAnotherWay?: (refundId: string) => void;
}) {
  const reg: LeagueRegistration = model.reg;
  const got = receivedOf(lines);
  const money = formatLeagueMoney;
  const history = registrationHistory(reg, lines, changes, today, cardRefunds);
  const refunds = newestFirst(cardRefunds.filter(isShown));
  const door = canDesk && onAnotherWay ? onAnotherWay : undefined;
  const F = W.facts;
  const fee = model.fee.state;

  const details = [
    [F.division, model.division ?? REGS_WORDS.noDivision] as const,
    isOpenReg(reg) && model.division ? [F.team, teamName ?? REGS_WORDS.notPlaced] as const : null,
    reg.status === 'waitlisted' && reg.waitlistPosition != null ? [F.position, REGS_WORDS.waitingPosition(reg.waitlistPosition)] as const : null,
    [F.guardian, model.guardian] as const,
    [F.email, reg.guardianEmail.trim() ? reg.guardianEmail : REGS_WORDS.noEmail] as const,
    reg.guardianPhone ? [F.phone, reg.guardianPhone] as const : null,
    reg.playerDateOfBirth ? [F.born, regDay(reg.playerDateOfBirth, today)] as const : null,
    [reg.source === 'admin_manual' ? F.addedByHand : F.signedUp, regDay(reg.registeredAt, today)] as const,
    reg.acceptedAt ? [F.accepted, regDay(reg.acceptedAt, today)] as const : null,
    reg.endedAt && !isOpenReg(reg)
      ? [F.ended, `${W.timeline.ended[endedKind(reg)]} ${regDay(reg.endedAt, today)}`] as const : null,
    reg.signupRef ? [F.reference, reg.signupRef] as const : null,
    reg.playerNotes ? [F.notes, reg.playerNotes] as const : null,
    reg.adminNotes ? [F.adminNotes, reg.adminNotes] as const : null,
  ];

  const feeRows = [
    [F.price, money(owesNow(reg, season))] as const,
    got > 0 ? [F.received, money(got)] as const : null,
    fee.kind === 'owing' || fee.kind === 'part' ? [F.owing, money(fee.owing)] as const : null,
    fee.kind === 'refunded' ? [F.refunded, money(fee.refunded)] as const : null,
    fee.kind === 'kept' ? [F.kept, `${money(fee.kept)}${fee.reason ? ` · ${fee.reason}` : ''}`] as const : null,
    fee.kind === 'kept' && fee.refunded ? [F.refunded, money(fee.refunded)] as const : null,
  ];

  return (
    <KitDialog
      kind="form"
      size="medium"
      record
      steps={steps ? { prev: steps.prev, next: steps.next, position: steps.position, noun: W.stepsNoun } : undefined}
      eyebrow={W.eyebrow(seasonName, model.division)}
      title={model.name}
      identity={statusWord}
      onClose={onClose}
    >
      {/* A refusal from an action started in here (a full division, a duplicate) is said in here, not only on the row behind. */}
      {model.note && <p className={css.recordNote}><Note row={model} onNote={(_row, key) => onNote(key)} /></p>}
      <section className={css.recordSection}>
        <h3 className={css.recordHead}>{W.details}</h3>
        <Facts rows={details} />
      </section>

      {showFee && (
        <section className={css.recordSection}>
          <h3 className={css.recordHead}>{W.fee}</h3>
          <div className={css.recordFee}><FeeCell parts={model.fee} onAlert={door} /></div>
          <Facts rows={feeRows} />
          {refunds.length > 0 && (
            <CardRefundBlock refunds={refunds} reg={reg} childName={model.name} kept={fee.kind === 'kept' && fee.refunded ? fee.kept : null}
              today={today} isPhone={isPhone} canDesk={!!door} focus={focus === 'card'} onAnotherWay={id => door?.(id)} />
          )}
        </section>
      )}

      <section className={css.recordSection}>
        <h3 className={css.recordHead}>{W.history}</h3>
        {history.length === 0 ? <p className={ck.hint}>{W.none}</p> : (
          <ul className={css.history}>
            {history.map((h, i) => (
              <li key={i} className={css.historyRow}>
                <span className={css.historyDay}>{h.day}</span>
                <span>{h.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {model.sheet.length > 0 && (
        <section className={css.recordSection}>
          <h3 className={css.recordHead}>{W.actions}</h3>
          <ul className={css.doList}>
            {model.sheet.map(item => (
              <li key={item.key}>
                <button type="button" className={css.doRow} onClick={() => onPick(item.key)}>
                  <span className={css.doName}>{item.label}</span>
                  {item.hint && <span className={css.doHint}>{item.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </KitDialog>
  );
}
