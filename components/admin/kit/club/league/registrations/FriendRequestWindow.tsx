'use client';
/**
 * ONE FRIEND REQUEST (Board Ready Stage 1 Part 2; drawing tab 4, "Request window · from the row, or Pick one…"). Who
 * asked, what the parent typed, and every sign-up it could mean: the same division first, each with its reason; a match
 * in another division is drawn dimmed and can't be picked (A2: that is Can't honour). "Someone else?" searches this
 * season's live sign-ups in the asking child's division. One lime (Confirm). A reader without the desk's right reads it.
 */
import { useMemo, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError } from '../../money/MoneyKit';
import SearchField from '@/components/shared/SearchField';
import { playerName, guardianName, regDay } from '@/lib/house-league-registrations';
import { askedPhrase, friendFold, reasonOf, FRIEND_QUEUE_WORDS, type QueueRow } from '@/lib/league-friend-queue';
import type { LeagueRegistration } from '@/lib/types';
import css from './Registrations.module.css';

const W = FRIEND_QUEUE_WORDS.win;

interface Choice { reg: LeagueRegistration; why: string | null; pickable: boolean }

export default function FriendRequestWindow({ row, regs, divisionName, today, canDecide, onClose, onConfirm }: {
  row: QueueRow;
  regs: readonly LeagueRegistration[];
  divisionName: (id: string | null) => string | null;
  today: string;
  canDecide: boolean;
  onClose: () => void;
  /** Sends the confirm; resolves to the refusal's sentence, or null when it went through. */
  onConfirm: (items: { id: string; matchId: string }[]) => Promise<string | null>;
}) {
  const req = row.requests[0];
  const asker = row.asker;
  const division = divisionName(asker.divisionId);
  const live = (r: LeagueRegistration) => r.status !== 'declined' && r.status !== 'withdrawn';

  const choices: Choice[] = useMemo(() => {
    if (req.code) return row.match ? [{ reg: row.match, why: FRIEND_QUEUE_WORDS.mark.code, pickable: row.match.divisionId === asker.divisionId }] : [];
    return row.candidates.map(c => ({ reg: c.reg, why: c.sameDivision ? reasonOf(c) : null, pickable: c.sameDivision }));
  }, [req.code, row.match, row.candidates, asker.divisionId]);

  const [query, setQuery] = useState('');
  const found: Choice[] = useMemo(() => {
    const q = friendFold(query);
    if (!q) return [];
    const shown = new Set(choices.map(c => c.reg.id));
    return regs.filter(r => live(r) && r.id !== asker.id && !shown.has(r.id) && r.divisionId === asker.divisionId
      && friendFold(playerName(r)).includes(q)).slice(0, 6).map(reg => ({ reg, why: null, pickable: true }));
  }, [query, regs, choices, asker.id, asker.divisionId]);

  const firstPick = row.match && row.match.divisionId === asker.divisionId ? row.match.id : choices.find(c => c.pickable)?.reg.id ?? null;
  const [pick, setPick] = useState<string | null>(firstPick);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const picked = [...choices, ...found].find(c => c.reg.id === pick && c.pickable)?.reg ?? null;
  const unchanged = row.band === 'confirmed' && !!picked && picked.id === row.match?.id;

  async function confirm() {
    if (!picked || busy) return;
    setBusy(true); setError('');
    // A Both asked pair confirmed on its partner is one decision for both requests.
    const items = row.partner && picked.id === row.partner.id && row.requests[1]
      ? [{ id: req.id, matchId: picked.id }, { id: row.requests[1].id, matchId: asker.id }]
      : [{ id: req.id, matchId: picked.id }];
    const refused = await onConfirm(items);
    setBusy(false);
    if (refused) setError(refused);
  }

  const option = (c: Choice) => (
    <label key={c.reg.id} className={css.choice} data-dim={!c.pickable || undefined}>
      <input type="radio" name="friend-pick" checked={pick === c.reg.id} disabled={!c.pickable || !canDecide} onChange={() => setPick(c.reg.id)} />
      <span>
        <span className={css.choiceName}>{FRIEND_QUEUE_WORDS.matchLine(playerName(c.reg), divisionName(c.reg.divisionId))}</span>
        <span className={ck.hint}>
          {c.pickable
            ? [W.parentOf(guardianName(c.reg)), c.why].filter(Boolean).join(' · ')
            : W.otherDivision}
        </span>
      </span>
    </label>
  );

  return (
    <KitDialog
      kind={canDecide ? 'form' : 'question'}
      eyebrow={W.eyebrow(division)}
      title={W.title(playerName(asker), askedPhrase(req))}
      onClose={onClose}
      busy={busy}
      footerStart={canDecide ? <span className={ck.hint}>{picked ? W.foot(asker.playerFirstName, picked.playerFirstName) : W.footNone}</span> : undefined}
      footer={canDecide ? (
        <>
          <DialogCancel>{W.cancel}</DialogCancel>
          <button type="button" className="btn btn-lime" disabled={!picked || busy || unchanged} onClick={() => void confirm()}>
            {busy ? W.working : W.confirm}
          </button>
        </>
      ) : <DialogCancel>{W.cancel}</DialogCancel>}
    >
      <p className={ck.hint}>
        {[req.typedParent ? W.parentGiven(req.typedParent) : null, W.signedUpBy(regDay(asker.registeredAt, today), guardianName(asker))].filter(Boolean).join(' ')}
      </p>
      <FormError>{error}</FormError>
      <fieldset className={css.choices}>
        <legend className={ck.label}>{W.lead}</legend>
        {choices.length === 0 && found.length === 0 && <p className={ck.hint}>{W.none}</p>}
        {choices.map(option)}
        {found.map(option)}
      </fieldset>
      {canDecide && !req.code && (
        <div className={ck.field}>
          <span className={ck.label}>{W.searchLead}</span>
          <SearchField value={query} onChange={setQuery} label={W.searchLabel} layout="fill" />
          {query.trim() && found.length === 0 && <span className={ck.hint}>{W.searchNone}</span>}
        </div>
      )}
    </KitDialog>
  );
}
