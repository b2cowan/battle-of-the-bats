'use client';
/**
 * components/public/ClubFooter.tsx — one footer on every club page (Club Tier Stage 4b-1; End state 1's footer and
 * Ask 7 of the Stage 4 drawings, ruled 2026-10-19; words through /marketing 2026-10-20).
 *
 * The club's name; "Questions? Email the club" over its address with a Copy button (an email link does nothing on some
 * phones, so the address is shown and copyable); its social links as 44 × 44 tiles named for screen readers ("Lakeshore
 * Lynx on Instagram"); and, under a hairline, the quiet "Built on FieldLogicHQ" credit on a paid plan (BUSINESS_DECISIONS
 * 2026-07-30 — the one trace of the platform a club's pages carry). A part with nothing to show is ABSENT, never a
 * placeholder. "Contacts and documents" opens the About page (Stage 4c-1) when the club has put something there.
 */
import Link from 'next/link';
import { Globe } from 'lucide-react';
import BuiltOnCredit from '@/components/marketing/BuiltOnCredit';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import type { ClubSocialKind } from '@/lib/club-site';
import { siteEdit } from '@/lib/site-edit-marks';
import type { ClubFrameClub } from './ClubFrame';
import styles from './ClubFrame.module.css';

/** What a tile shows (the icon set carries no brand marks) and what it is called aloud. */
const SOCIAL: Record<ClubSocialKind, { mark: string | null; name: (club: string) => string }> = {
  instagram: { mark: 'IG', name: club => `${club} on Instagram` },
  facebook:  { mark: 'FB', name: club => `${club} on Facebook` },
  x:         { mark: 'X',  name: club => `${club} on X` },
  website:   { mark: null, name: club => `${club} website` },
};

export default function ClubFooter({ club }: { club: ClubFrameClub }) {
  // "Copied" is a transient word, like "Saved": the shared hook shows it for two seconds, then the button reads "Copy".
  const { copied, copy } = useCopyToClipboard();

  return (
    // data-club-chrome: the club refusal steps the footer aside too (components/public/ClubNotFound.module.css).
    <footer className={styles.footer} data-club-footer="" data-club-chrome="" {...siteEdit('look')}>
      <div className={styles.footInner}>
        <p className={styles.footName}>{club.name}</p>

        {club.contactEmail && (
          <div className={styles.contact} {...siteEdit('about')}>
            <span className={styles.contactLabel}>Questions? Email the club</span>
            <div className={styles.mailRow}>
              <a href={`mailto:${club.contactEmail}`} className={styles.mail}>{club.contactEmail}</a>
              <button type="button" className={styles.copy} onClick={() => copy(club.contactEmail!)}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              {/* Announced from its own region: a live region on the focused button itself is read unreliably. */}
              <span className={styles.srOnly} aria-live="polite">{copied ? 'Copied' : ''}</span>
            </div>
          </div>
        )}

        {club.socials.length > 0 && (
          <ul className={styles.socials} {...siteEdit('about')}>
            {club.socials.map(({ kind, href }) => (
              <li key={kind}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.social}
                  aria-label={SOCIAL[kind].name(club.name)}
                >
                  {SOCIAL[kind].mark ?? <Globe size={18} aria-hidden />}
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* The one door to the About page (Stage 4c-1, Ask 10), only when it has contacts, documents or questions. */}
        {club.aboutHref && <Link href={club.aboutHref} className={styles.footDoor} {...siteEdit('lists')}>Contacts and documents</Link>}

        {club.showCredit && <BuiltOnCredit className={styles.credit} />}
      </div>
    </footer>
  );
}
