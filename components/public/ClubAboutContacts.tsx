'use client';
/**
 * The About page's Who to contact (Club Tier Stage 4c-1, Ask 10): a role the club names, its address on its own line, and
 * Copy — labelled at a desk, its symbol alone on a phone (the house rule for a secondary action, design log 2026-10-20).
 * One "Copied" region for the list, so a screen reader hears which address was copied.
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import type { SiteContact } from '@/lib/types';
import kit from './ClubKit.module.css';
import styles from './ClubAbout.module.css';

export default function ClubAboutContacts({ contacts }: { contacts: SiteContact[] }) {
  const { copied, copy } = useCopyToClipboard();
  const [which, setWhich] = useState<string | null>(null);

  return (
    <div className={kit.list}>
      {contacts.map(c => {
        const done = copied && which === c.id;
        return (
          <div key={c.id} className={styles.contact}>
            <span className={styles.role}>{c.role}</span>
            <div className={styles.mailRow}>
              <a href={`mailto:${c.email}`} className={styles.address}>{c.email}</a>
              <button
                type="button"
                className={`${kit.btn} ${kit.btnSecondary} ${kit.btnSm} ${styles.copy}`}
                onClick={() => { setWhich(c.id); copy(c.email); }}
                aria-label={`Copy ${c.role} email address`}
              >
                {done ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
                <span className={styles.copyLabel}>{done ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        );
      })}
      <span className={kit.srOnly} aria-live="polite">{copied ? 'Copied' : ''}</span>
    </div>
  );
}
