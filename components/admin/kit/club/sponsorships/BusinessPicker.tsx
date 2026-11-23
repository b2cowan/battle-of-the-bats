'use client';
/**
 * THE OFFER WINDOW'S BUSINESS FIELD (Board Ready Stage 6, Part 2; round 1 tab 3, screen B). The shipped payee picker's
 * look and behaviour (PayeeCombobox's own styles and overlay hooks — the list hangs over the window, Escape closes it):
 * the club's one sponsor list, each business with its grey line ("Frank Osei · no deals yet", "2026 · Team sponsor,
 * paid"), and at its foot "+ New business “Har…”" (a name and an email; they fill in the rest). A business that can't be
 * emailed an offer (owner call (d): unsubscribed, "Do not offer again", a family opt-out) stays pickable and says why
 * under its name; the window then leaves Send out.
 */
import { useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import styles from '@/components/accounting/PayeeCombobox.module.css';
import { useDismissable, useFieldMenu } from '@/lib/overlay-hooks';
import { DEAL_WORDS as D } from '@/lib/club-sponsorship-deal-words';
import type { EmailBar } from '@/lib/club-sponsorship-deals';
import type { OfferSponsor } from './deals-api';
import css from './Sponsorships.module.css';

export type PickedBusiness = { kind: 'existing'; id: string } | { kind: 'new'; name: string } | null;

/** The sentence a barred address carries (call (d), drafted for /marketing). */
export function barSentence(bar: EmailBar, club: string): string | null {
  if (!bar) return null;
  if (bar.kind === 'unsubscribed') return D.offer.barUnsubscribed(bar.on);
  if (bar.kind === 'do_not_offer') return D.offer.barDoNotOffer(bar.on);
  return D.offer.barFamily(club);
}

export default function BusinessPicker({ id, sponsors, value, onChange, club, invalid }: {
  id: string;
  sponsors: readonly OfferSponsor[];
  value: PickedBusiness;
  onChange: (v: PickedBusiness) => void;
  club: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissable(open, rootRef, () => setOpen(false));
  const listShown = open && !value;
  useFieldMenu(listShown, rootRef, menuRef, () => setOpen(false));

  const typed = text.trim();
  const shown = useMemo(() => {
    const q = typed.toLowerCase();
    return sponsors.filter(s => !q || s.name.toLowerCase().includes(q)).slice(0, 50);
  }, [sponsors, typed]);
  const exact = sponsors.some(s => s.name.toLowerCase() === typed.toLowerCase());

  if (value) {
    const name = value.kind === 'existing' ? sponsors.find(s => s.id === value.id)?.name ?? '' : value.name;
    return (
      <div className={styles.selectedRow} data-kit-field>
        <span className={styles.selectedName}>{name}</span>
        <button type="button" className={styles.clearBtn} onClick={() => { onChange(null); setText(''); }} aria-label={`${D.offer.business}: ${name}`}>
          <X size={13} aria-hidden />
        </button>
      </div>
    );
  }

  const sub = (s: OfferSponsor) => s.caption ?? [s.contactName, D.offer.noDealsYet].filter(Boolean).join(' · ');
  return (
    <div className={styles.root} ref={rootRef} data-kit-field>
      <div className={styles.inputWrap}>
        <input id={id} className={styles.input} type="text" value={text} autoComplete="off" aria-invalid={invalid || undefined}
          onChange={e => { setText(e.target.value); if (!open) setOpen(true); }} onFocus={() => setOpen(true)} />
        <ChevronDown size={14} className={styles.chevron} aria-hidden />
      </div>
      {listShown && (
        <div className={styles.dropdown} ref={menuRef}>
          {shown.length > 0 && (
            <div className={styles.section}>
              {shown.map(s => {
                const bar = barSentence(s.bar, club);
                return (
                  <button key={s.id} type="button" className={styles.option}
                    onMouseDown={() => { onChange({ kind: 'existing', id: s.id }); setText(''); setOpen(false); }}>
                    {s.name}
                    <span className={css.pickerSub}>{sub(s)}</span>
                    {bar && <span className={css.pickerBarred}>{bar}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {typed && !exact && (
            <div className={styles.section}>
              <button type="button" className={`${styles.option} ${styles.optionAction}`}
                onMouseDown={() => { onChange({ kind: 'new', name: typed.slice(0, 80) }); setText(''); setOpen(false); }}>
                + {D.offer.newBusiness(typed.length > 24 ? `${typed.slice(0, 24)}…` : typed)}
                <span className={css.pickerSub}>{D.offer.newBusinessHint}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
