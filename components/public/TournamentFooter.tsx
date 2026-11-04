'use client';
/**
 * components/public/TournamentFooter.tsx — one footer on every public tournament page (Public tournament pages Stage 1
 * Part 2 — lib/public-frame.ts; hub "The end state" and "Ask B" footers, plan §4).
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
 * The tab row and this page list replace the Overview's old row of "Explore" buttons.
 *
 * In the organizer's admin preview (`basePath`) every link stays inside the preview, and the host line is plain text —
 * the preview never sends the organizer out to the live site.
 *
 * THE SHORT FOOTER (Stage 7, Ask A5) is the focused page's (lib/public-focused-page.ts — the team pay page): the event's
 * name and the credit, nothing else. The page list, the host line and the address go (that page carries its own one way
 * to ask, under the pay block, A1). The credit shows for EVERY plan there, a free event's included: the focused page wears
 * no floating badge, so the footer is its one credit. Never in the demo (the credit is a door out of it).
 */
import Link from 'next/link';
import { Check, Copy } from 'lucide-react';
import { useParams } from 'next/navigation';
import { isDemoOrgSlug } from '@/lib/demo-org';
import { isFocusedPublicPage } from '@/lib/public-focused-page';
import BuiltOnCredit from '@/components/marketing/BuiltOnCredit';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import { useOrgHref, usePublicPathname } from '@/lib/use-public-pathname';
import { visibleTournamentTabs, type FrameTabContent } from '@/lib/tournament-page-tabs';
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
  /** Public tournament pages Stage 6 (Ask 14): News/Rules/Register/Champions tab facts, passed explicitly by
   *  both layouts (the footer renders only inside the frame). */
  frameContent?: FrameTabContent;
}

export default function TournamentFooter({
  name, contactEmail, host, hiddenPages, hasBracket, showCredit, basePath, frameContent,
}: TournamentFooterProps) {
  const { copied, copy } = useCopyToClipboard();
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || '';
  const tournamentSlug = (params?.tournamentSlug as string) || '';
  const orgHref = useOrgHref(orgSlug);
  const pathname = usePublicPathname() ?? '';
  const short = !basePath && isFocusedPublicPage(pathname, orgSlug, tournamentSlug);
  const pageHref = (key: string) => (basePath ? `${basePath}/${key}` : orgHref(`/${tournamentSlug}/${key}`));
  // The preview has no bracket route to point at (as its tab row and rail).
  const pages = visibleTournamentTabs(hiddenPages, !basePath && hasBracket, frameContent);

  if (short) {
    return (
      <footer className={clubStyles.footer} data-public-frame-footer="">
        <div className={clubStyles.footInner}>
          <p className={clubStyles.footName}>{name}</p>
          {!isDemoOrgSlug(orgSlug) && <BuiltOnCredit className={clubStyles.credit} />}
        </div>
      </footer>
    );
  }

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
