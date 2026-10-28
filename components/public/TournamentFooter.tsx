'use client';
/**
 * components/public/TournamentFooter.tsx — one footer on every public tournament page (Public tournament pages Stage 1
 * Part 2, behind the preview switch — lib/public-frame.ts; hub "The end state" and "Ask B" footers, plan §4).
 *
 * The club footer's shape (ClubFooter, ClubFrame.module.css `.footer`), in the organizer's colour: the event's name;
 * "Questions? Email the tournament" over the address with a Copy button (the same address the Rules and News pages
 * already show — the organizer's public-contact switch decides it, lib/db.ts resolveTournamentContactEmail); the event's
 * pages; the host line (lib/public-frame.ts publicFrameHost — "Hosted by {club} ›" as a link, or "Run by {organizer}" as
 * plain text); and, under a hairline, the paid plan's "Built on FieldLogicHQ" credit.
 *
 * THE CREDIT RULES DO NOT CHANGE: a paid plan's credit moves here from the bottom of the page (where it rendered alone);
 * a free event keeps its FieldLogicHQ badge exactly as it is, and the footer carries no second credit (WI-10: stacking
 * them says the same thing twice). The demo carries none (the caller decides `showCredit`).
 *
 * The tab row and this page list replace the Overview's old row of "Explore" buttons (behind the switch only).
 *
 * In the organizer's admin preview (`basePath`) every link stays inside the preview, and the host line is plain text —
 * the preview never sends the organizer out to the live site.
 */
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { useParams } from 'next/navigation';
import BuiltOnCredit from '@/components/marketing/BuiltOnCredit';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { useOrgHref } from '@/lib/use-public-pathname';
import { visibleTournamentTabs } from '@/lib/tournament-page-tabs';
import type { PublicPageKey } from '@/lib/public-pages';
import type { PublicFrameHost } from '@/lib/public-frame';
import clubStyles from './ClubFrame.module.css';
import styles from './TournamentFrame.module.css';

export interface TournamentFooterProps {
  name: string;
  contactEmail: string | null;
  host: PublicFrameHost | null;
  hiddenPages: PublicPageKey[];
  hasBracket: boolean;
  showCredit: boolean;
  /** The admin preview's `/…/preview/{tournament}` base: links stay in the preview, the host line is text. */
  basePath?: string;
}

export default function TournamentFooter({
  name, contactEmail, host, hiddenPages, hasBracket, showCredit, basePath,
}: TournamentFooterProps) {
  const { copied, copy } = useCopyToClipboard();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const orgHref = useOrgHref(orgSlug);
  const pageHref = (key: string) => (basePath ? `${basePath}/${key}` : orgHref(`/${tournamentSlug}/${key}`));
  // The preview has no bracket route to point at (as its tab row and rail).
  const pages = visibleTournamentTabs(hiddenPages, !basePath && hasBracket);

  return (
    <footer className={clubStyles.footer} data-public-frame-footer="">
      <div className={clubStyles.footInner}>
        <p className={clubStyles.footName}>{name}</p>

        {contactEmail && (
          <div className={clubStyles.contact}>
            <span className={clubStyles.contactLabel}>Questions? Email the tournament</span>
            <div className={clubStyles.mailRow}>
              <a href={`mailto:${contactEmail}`} className={clubStyles.mail}>{contactEmail}</a>
              <button
                type="button"
                className={clubStyles.copy}
                onClick={() => copy(contactEmail)}
                aria-label="Copy email address"
                title={copied ? 'Copied' : 'Copy email address'}
              >
                {copied ? <Check size={18} aria-hidden /> : <Copy size={18} aria-hidden />}
              </button>
              <span className={clubStyles.srOnly} aria-live="polite">{copied ? 'Copied' : ''}</span>
            </div>
          </div>
        )}

        {pages.length > 0 && (
          <nav aria-label="Pages in this tournament">
            <ul className={styles.footPages}>
              {pages.map(({ key, label }) => (
                <li key={key}><Link href={pageHref(key)} className={styles.footLink}>{label}</Link></li>
              ))}
            </ul>
          </nav>
        )}

        {host && (
          host.kind === 'hosted' && !basePath
            ? <Link href={orgHref()} className={styles.footHost}>Hosted by {host.name} ›</Link>
            : <p className={`${styles.footHost} ${styles.footHostText}`}>{host.kind === 'hosted' ? 'Hosted by' : 'Run by'} {host.name}</p>
        )}

        {showCredit && <BuiltOnCredit className={clubStyles.credit} />}
      </div>
    </footer>
  );
}
