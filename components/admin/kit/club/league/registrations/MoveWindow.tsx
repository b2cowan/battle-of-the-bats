'use client';
/**
 * MOVE DIVISION (Club Tier Stage 9b-2, Part 3; copy §6): one registration or the ticked ones. The kit's form window,
 * medium. The room is checked first (a division shows its spots left), then the price is asked about ONLY when the
 * destination charges a different price for the day the child signed up AND nothing has been received — Keep their price
 * is the starting choice, since a move never changes what a family owes unless the registrar says so. A child who has paid
 * keeps their price on any move, and the window says so and points at Correct the price. A batch asks the price question
 * ONCE. Nobody is emailed.
 *
 * ⚠ A CHILD HOLDING A SPOT CANNOT BE MOVED INTO A FULL DIVISION (the database refuses it: `division_full`), so a full
 * division is offered to a child who is already WAITLISTED — who joins the end of its line — and to no one else.
 */
import { useMemo, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError } from '../../money/MoneyKit';
import { MOVE_WORDS } from '@/lib/house-league-money-words';
import { formatLeagueMoney } from '@/lib/league-money';
import {
  firstWaiting, ordinal, owesNow, priceIn, priceOn, spotsLeft, whyOf,
  type Refusal, type RegsDivision, type RegsSeason, type WhyTally, tallyWhy, type Why,
} from '@/lib/house-league-registrations';
import type { LeagueRegistration } from '@/lib/types';
import { patchRegistration } from './api';
import css from './Registrations.module.css';

export interface MoveTarget { reg: LeagueRegistration; name: string; from: string | null; received: number }

export interface MoveOutcome {
  /** The registrations that moved. */
  done: LeagueRegistration[];
  tally: WhyTally[];
  /** Paid children who kept their price. */
  kept: number;
  division: string;
  /** Who moved up in the division they left. */
  promoted: LeagueRegistration[];
  /** Ids that stayed (refused or already there). */
  stayed: string[];
}

const isHeld = (r: LeagueRegistration) => r.status === 'active' || r.status === 'pending_review';

export default function MoveWindow({
  season, divisions, targets, regs, today, orgQuery, seasonId, raised, onClose, onChanged, onDone,
}: {
  season: RegsSeason;
  divisions: readonly RegsDivision[];
  targets: readonly MoveTarget[];
  regs: readonly LeagueRegistration[];
  today: string;
  orgQuery: string;
  seasonId: string;
  raised: boolean;
  onClose: () => void;
  onChanged: () => void;
  onDone: (outcome: MoveOutcome) => void;
}) {
  const many = targets.length > 1;
  const one = targets[0];
  const [to, setTo] = useState('');
  const [choice, setChoice] = useState<'keep' | 'use'>('keep');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const options = useMemo(() => divisions.filter(d => {
    if (!many && one.reg.divisionId === d.id) return false;
    // A child holding a spot cannot go into a full division; only a waitlisted one can (see the header).
    const full = spotsLeft(d) === 0;
    return !(full && !many && isHeld(one.reg));
  }), [divisions, many, one]);
  const dest = divisions.find(d => d.id === to) ?? null;

  // Who moves, who is already there, and what each would pay in the destination (for the day they signed up).
  const movers = dest ? targets.filter(t => t.reg.divisionId !== dest.id) : targets;
  const priced = dest ? movers.map(t => {
    const next = priceIn(dest, season, t.reg)?.amount ?? null;
    const now = owesNow(t.reg, season);
    return { t, next, now, differs: next != null && next !== now };
  }) : [];
  const unpaidDiffer = priced.filter(p => p.differs && p.t.received === 0);
  const paidDiffer = priced.filter(p => p.differs && p.t.received > 0);
  const ask = unpaidDiffer.length > 0;
  const money = formatLeagueMoney;

  const needSpot = dest ? movers.filter(t => isHeld(t.reg)).length : 0;
  const room = dest ? spotsLeft(dest) : null;
  const overRoom = many && room != null && needSpot > room;
  const waitingMover = !many && one.reg.status === 'waitlisted';
  const destFull = dest != null && spotsLeft(dest) === 0;
  const place = dest ? ordinal(dest.waitlistCount + 1) : '';

  const optionLabel = (d: RegsDivision) => {
    if (spotsLeft(d) === 0 && (many || !isHeld(one.reg))) return MOVE_WORDS.optionFull(d.name);
    const left = spotsLeft(d);
    const price = !many ? priceIn(d, season, one.reg) : null;
    return MOVE_WORDS.optionSpot(d.name, left == null ? null : MOVE_WORDS.spotsLeft(left), price ? (price.amount > 0 ? money(price.amount) : 'Free') : null);
  };

  const promotedFirst = !many && isHeld(one.reg) && season.autoPromoteWaitlist ? firstWaiting(regs, one.reg.divisionId, one.reg.id) : null;

  async function go() {
    if (busy) return;
    if (!dest) { setError(MOVE_WORDS.choose); return; }
    setBusy(true); setError('');
    const out: MoveOutcome = { done: [], tally: [], kept: 0, division: dest.name, promoted: [], stayed: [] };
    const whys: Why[] = [];
    for (const t of targets) {
      if (t.reg.divisionId === dest.id) {
        if (!many) { setError(MOVE_WORDS.sameDivision(t.name, dest.name)); setBusy(false); return; }
        whys.push({ key: 'same', division: dest.name }); out.stayed.push(t.reg.id);
        continue;
      }
      const r = await patchRegistration(orgQuery, seasonId, t.reg.id, { divisionId: dest.id, reprice: ask && choice === 'use' });
      if (r.ok) {
        out.done.push(r.registration);
        if (r.promoted) out.promoted.push(r.promoted);
        if (r.keptPrice) out.kept += 1;
        continue;
      }
      if (!many) { setError(r.error); setBusy(false); onChanged(); return; }
      const refusal: Refusal = r;
      whys.push(whyOf(refusal, { division: dest.name, free: false }));
      out.stayed.push(t.reg.id);
    }
    out.tally = tallyWhy(whys);
    setBusy(false);
    onDone(out);
  }

  const foot = !dest ? null
    : many ? MOVE_WORDS.bulk.foot(movers.length, dest.name, paidDiffer.length)
      : waitingMover ? MOVE_WORDS.footWaitlist(one.name, one.from ?? MOVE_WORDS.choose, dest.name, place)
        : `${MOVE_WORDS.foot(one.name, one.from ?? '—', dest.name)}${promotedFirst ? ` ${MOVE_WORDS.footPromoted(promotedFirst.playerFirstName, one.from ?? '')}` : ''}`;

  return (
    <KitDialog
      kind="form"
      size="medium"
      raised={raised}
      eyebrow={MOVE_WORDS.eyebrow(season.name)}
      title={many ? MOVE_WORDS.bulk.title(targets.length) : MOVE_WORDS.title(one.name)}
      onClose={onClose}
      busy={busy}
      footerStart={foot ? <span>{foot}</span> : undefined}
      footer={(
        <>
          <DialogCancel>{MOVE_WORDS.cancel}</DialogCancel>
          {dest && (
            <button type="button" className="btn btn-lime" onClick={() => void go()} disabled={busy}>
              {busy ? MOVE_WORDS.working : many ? MOVE_WORDS.bulk.submit(movers.length) : waitingMover ? MOVE_WORDS.submitWaitlist : MOVE_WORDS.submit}
            </button>
          )}
        </>
      )}
    >
      <FormError>{error}</FormError>
      <label className={ck.field} htmlFor="regs-move-to">
        <span className={ck.label}>{MOVE_WORDS.toLabel}</span>
        <select id="regs-move-to" className={ck.select} value={to} onChange={e => { setTo(e.target.value); setChoice('keep'); setError(''); }}>
          <option value="">{MOVE_WORDS.choose}</option>
          {options.map(d => <option key={d.id} value={d.id}>{optionLabel(d)}</option>)}
        </select>
      </label>

      {dest && waitingMover && destFull && (
        <p className={css.moveWarn}>{MOVE_WORDS.fullLine(dest.name, one.name, place)}</p>
      )}
      {dest && overRoom && room != null && (
        <p className={css.moveWarn}>{MOVE_WORDS.bulk.room(dest.name, room, needSpot - room)}</p>
      )}

      {dest && ask && (
        <fieldset className={css.choices}>
          <legend className={ck.label}>
            {many
              ? MOVE_WORDS.bulk.priceLead(dest.name, money(priceOn(dest, season, today)?.amount ?? 0))
              : MOVE_WORDS.priceLead(dest.name, money(unpaidDiffer[0].next ?? 0), one.name, money(unpaidDiffer[0].now))}
          </legend>
          <label className={css.choice}>
            <input type="radio" name="regs-move-price" checked={choice === 'keep'} onChange={() => setChoice('keep')} />
            <span className={css.choiceName}>{many ? MOVE_WORDS.bulk.keep : MOVE_WORDS.priceKeep(one.name, money(unpaidDiffer[0].now))}</span>
          </label>
          <label className={css.choice}>
            <input type="radio" name="regs-move-price" checked={choice === 'use'} onChange={() => setChoice('use')} />
            <span className={css.choiceName}>{many ? MOVE_WORDS.bulk.use(dest.name) : MOVE_WORDS.priceUse(dest.name, money(unpaidDiffer[0].next ?? 0))}</span>
          </label>
          {!many && <p className={ck.hint}>{MOVE_WORDS.priceHint(dest.name, one.name)}</p>}
        </fieldset>
      )}

      {dest && !many && paidDiffer.length > 0 && (
        <p className={ck.hint}>{MOVE_WORDS.paid(one.name, money(paidDiffer[0].now))}</p>
      )}
      {dest && many && paidDiffer.length > 0 && (
        <p className={ck.hint}>{MOVE_WORDS.bulk.paid(paidDiffer.length, joinNames(paidDiffer.map(p => p.t.name)))}</p>
      )}
    </KitDialog>
  );
}

/** "Henry", "Henry and Ava", "Henry, Ava and Sam", "Henry, Ava, Sam and 4 more" (copy §0). */
function joinNames(names: readonly string[]): string {
  const shown = names.length > 3 ? names.slice(0, 3) : names;
  const rest = names.length - shown.length;
  const head = shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] ?? '';
  return rest > 0 ? `${shown.join(', ')} and ${rest} more` : head;
}
