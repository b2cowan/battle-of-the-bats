'use client';
/**
 * A bank balance typed as dollars (Bank balance check BC2). "$" typed or not; the screen sends cents (`parseCents`, the
 * engine's parser: it reads a minus sign AND the bracket form the product prints for an overdraft, "($50.00)"). A balance
 * may be zero or below, so there is no sign rule here.
 */
import ck from '../../ClubKit.module.css';
import { repKit } from '../../RepKit';

export default function BankMoneyField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={ck.field} htmlFor={id}>
      <span className={ck.label}>{label}<span className={repKit.req} aria-hidden>*</span></span>
      <input id={id} className={ck.input} inputMode="decimal" value={value} placeholder="$0.00" maxLength={16}
        onChange={e => onChange(e.target.value)} />
    </label>
  );
}
