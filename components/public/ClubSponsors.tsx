import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { siteEdit } from '@/lib/site-edit-marks';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';
import type { SiteSponsor } from '@/lib/types';
import kit from './ClubKit.module.css';
import styles from './ClubSponsors.module.css';

/**
 * THE CLUB'S SPONSORS, as families see them (Club Tier Stage 4d; drawings https://claude.ai/artifact/CAKV9xcGQoW4zudF5TvGcE,
 * ruled 2026-10-19 Ask 17; words CLUB_TIER_STAGE4D_COPY.md §D). Two placements, one list:
 *
 *   ClubSponsorStrip  the last thing on the HOME page, above the footer — a tile each: the logo alone, or the name as text
 *                     when there is no logo. Home only (not the shared frame, not team, tryout or tournament pages).
 *   ClubSponsorList   the Sponsors section at the foot of the ABOUT page — the logo beside the name.
 *
 * Both are handed the sponsors a family may see NOW (`sponsorsShowing`, lib/club-sponsors.ts — an ended one is filtered
 * by the page's loader, never here), and both are absent when there are none: no heading, no placeholder. A sponsor with a
 * link is one link, opening in a new tab; without one it is plain text. No tiers: every tile is the same size and a
 * logo is scaled to fit, never cropped. This is the club's thank-you, nothing to do with the coach money book.
 * A logo's alt text is the sponsor's name where it stands alone (the strip) and empty where the name is written beside it
 * (the list), so a screen reader never reads the name twice.
 */

function Out({ sponsor, className, children }: { sponsor: SiteSponsor; className: string; children: ReactNode }) {
  return sponsor.link ? (
    <a href={sponsor.link} target="_blank" rel="noopener noreferrer sponsored" className={className}>
      {children}
      <span className={kit.srOnly}>, {W.opensNewTab}</span>
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

export function ClubSponsorStrip({ sponsors }: { sponsors: readonly SiteSponsor[] }) {
  if (sponsors.length === 0) return null;
  return (
    <div className={styles.band}>
      <section className={kit.section} aria-labelledby="sponsors" {...siteEdit('lists')}>
        <h2 id="sponsors" className={kit.sectionTitle}>{W.sponsorsHeading}</h2>
        <div className={kit.list}>
          <div className={styles.strip}>
            {sponsors.map(s => (
              <Out key={s.id} sponsor={s} className={styles.tile}>
                {/* The address is one the save and the read already held to the club's own upload folder. */}
                {s.logoUrl ? <img src={s.logoUrl} alt={s.name} loading="lazy" /> : <span>{s.name}</span>}
              </Out>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ClubSponsorList({ sponsors }: { sponsors: readonly SiteSponsor[] }) {
  if (sponsors.length === 0) return null;
  return (
    <section className={kit.section} aria-labelledby="sponsors">
      <h2 id="sponsors" className={kit.sectionTitle}>{W.sponsorsHeading}</h2>
      <div className={kit.list}>
        {sponsors.map(s => (
          <Out key={s.id} sponsor={s} className={styles.row}>
            {s.logoUrl && <span className={styles.logo}><img src={s.logoUrl} alt="" loading="lazy" /></span>}
            <span className={styles.name}>{s.name}</span>
            {s.link && <ExternalLink size={16} aria-hidden className={styles.ext} />}
          </Out>
        ))}
      </div>
    </section>
  );
}
