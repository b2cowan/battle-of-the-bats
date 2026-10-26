'use client';
/**
 * "WHOSE FEE WAS THE REFUND?" (Club Tier Stage 12c Part 3; words CLUB_TIER_STAGE12C_REFUND_VISIBLE_COPY.md §5). A part
 * refund made in the club's Stripe dashboard on a payment for two or more children is in no book until the desk says whose
 * it was: one child, or split between them (amounts that add up to the refund, none more than that child paid), with the
 * reason the family reads. Opened from the Needs-attention item ("Choose the child") — nothing picked on open.
 */
import { useEffect, useState } from 'react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { FormError, TextField, moneyFetch } from '../../money/MoneyKit';
import { CARD_REFUND_WORDS } from '@/lib/house-league-money-words';
import { formatLeagueMoney } from '@/lib/league-money';
import { possessive } from '@/lib/utils';
import css from './Registrations.module.css';

type Child = { regId: string; name: string; first: string; division: string; paid: number; left: number };
type Read = { amount: number; assigned: boolean; day: string; card: string; reference: string; children: Child[]; guardianEmail: string };

const W = CARD_REFUND_WORDS.whose;

export default function WhoseWindow({ orgQuery, seasonId, unassignedId, onClose, onDone }: {
  orgQuery: string;
  seasonId: string;
  unassignedId: string;
  onClose: () => void;
  onDone: (said: string) => void;
}) {
  const url = `/api/admin/house-league/seasons/${seasonId}/card-refunds/whose/${unassignedId}${orgQuery}`;
  const [read, setRead] = useState<Read | null>(null);
  const [failed, setFailed] = useState('');
  const [pick, setPick] = useState<string | 'split' | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void moneyFetch<Read>(url).then(r => {
      if (!live) return;
      if (r.ok) setRead(r.data); else setFailed((r.data as { error?: string }).error ?? 'That refund is no longer waiting.');
    }).catch(() => { if (live) setFailed('That refund couldn’t be read. Try again.'); });
    return () => { live = false; };
  }, [url]);

  const money = formatLeagueMoney;
  async function save() {
    if (!read || busy) return;
    const total = Math.round(read.amount * 100);
    let picks: Array<{ regId: string; amount: number }>;
    if (pick === 'split') {
      picks = read.children.map(c => ({ regId: c.regId, amount: Number(amounts[c.regId] ?? 0) })).filter(p => p.amount > 0);
      const sum = picks.reduce((n, p) => n + Math.round(p.amount * 100), 0);
      if (sum !== total) { setError(W.errSum(money(sum / 100), money(read.amount))); return; }
      const over = read.children.find(c => Math.round(Number(amounts[c.regId] ?? 0) * 100) > Math.round(c.left * 100));
      if (over) { setError(W.errOver(possessive(over.first), money(over.left))); return; }
    } else if (pick) {
      const child = read.children.find(c => c.regId === pick)!;
      if (total > Math.round(child.left * 100)) { setError(W.errOver(possessive(child.first), money(child.left))); return; }
      picks = [{ regId: pick, amount: read.amount }];
    } else { setError(W.errChoose); return; }
    if (!reason.trim()) { setError(W.errReason); return; }
    setBusy(true); setError('');
    const r = await moneyFetch<{ said: string }>(url, { method: 'POST', body: JSON.stringify({ picks, reason: reason.trim() }) });
    setBusy(false);
    if (!r.ok) { setError((r.data as { error?: string }).error ?? 'The refund couldn’t be recorded. Try again.'); return; }
    onDone(r.data.said);
  }

  return (
    <KitDialog
      kind="form"
      size="medium"
      title={read ? W.title(money(read.amount)) : W.title('')}
      onClose={onClose}
      busy={busy}
      dirty={!!pick || reason.trim() !== ''}
      footerStart={read && !read.assigned ? <span>{W.foot}</span> : undefined}
      footer={(
        <>
          <DialogCancel>Cancel</DialogCancel>
          {read && !read.assigned && (
            <button type="button" className="btn btn-lime" onClick={() => void save()} disabled={busy}>{busy ? W.working : W.save}</button>
          )}
        </>
      )}
    >
      {failed && <FormError>{failed}</FormError>}
      {read && (
        <>
          <p className={css.endLead}>{W.lead(read.day, read.card, read.reference)}</p>
          <FormError>{error}</FormError>
          <fieldset className={css.choices}>
            {read.children.map(c => (
              <label key={c.regId} className={css.choice}>
                <input type="radio" name="regs-whose" checked={pick === c.regId} onChange={() => setPick(c.regId)} />
                <span>
                  <span className={css.choiceName}>{c.name}</span>
                  <span className={ck.hint}>{W.optionSub(c.division, money(c.paid))}</span>
                </span>
              </label>
            ))}
            <label className={css.choice}>
              <input type="radio" name="regs-whose" checked={pick === 'split'} onChange={() => setPick('split')} />
              <span>
                <span className={css.choiceName}>{W.split}</span>
                <span className={ck.hint}>{W.splitSub(money(read.amount))}</span>
              </span>
            </label>
            {pick === 'split' && (
              <div className={css.choiceFields}>
                {read.children.map(c => (
                  <label key={c.regId} className={ck.field} htmlFor={`regs-whose-${c.regId}`}>
                    <span className={ck.label}>{W.splitAmount(c.first)}</span>
                    <input id={`regs-whose-${c.regId}`} className={ck.input} inputMode="decimal" value={amounts[c.regId] ?? ''}
                      onChange={e => setAmounts(a => ({ ...a, [c.regId]: e.target.value }))} />
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <TextField id="regs-whose-reason" label={W.reason} value={reason} onChange={setReason} required maxLength={500} hint={W.reasonHint} />
        </>
      )}
    </KitDialog>
  );
}
