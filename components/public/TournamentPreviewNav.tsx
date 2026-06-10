import Link from 'next/link';
import type { Organization } from '@/lib/types';
import { visiblePublicPages, type PublicPageKey } from '@/lib/public-pages';
import styles from '@/components/Navbar.module.css';
import previewStyles from './TournamentPreviewNav.module.css';

type TournamentPreviewNavProps = {
  org: Organization;
  orgSlug: string;
  tournamentSlug: string;
  tournamentName: string;
  colorMode?: 'dark' | 'light';
  hiddenPages?: PublicPageKey[];
};

export default function TournamentPreviewNav({
  org,
  orgSlug,
  tournamentSlug,
  tournamentName,
  colorMode = 'dark',
  hiddenPages = [],
}: TournamentPreviewNavProps) {
  const previewBase = `/${orgSlug}/admin/tournaments/preview/${tournamentSlug}`;
  const links = [
    { href: previewBase, label: 'Home', key: null },
    ...visiblePublicPages({ publicHiddenPages: hiddenPages })
      .filter(page => page.key !== 'register')
      .map(page => ({ href: `${previewBase}/${page.key}`, label: page.label, key: page.key })),
  ];

  return (
    <nav className={`${styles.nav} ${styles.scrolled}`} data-color-mode={colorMode} aria-label="Tournament preview navigation">
      <div className={`container ${styles.inner}`}>
        <Link href={previewBase} className={styles.logo}>
          {org.logoUrl && (
            <span
              aria-hidden="true"
              className={styles.logoImg}
              style={{
                backgroundImage: `url(${org.logoUrl})`,
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'contain',
                display: 'inline-block',
              }}
            />
          )}
          <span className={styles.orgName}>{tournamentName}</span>
        </Link>

        <div className={`${styles.links} ${previewStyles.links}`}>
          {links.map(link => (
            <Link key={link.label} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className={`${styles.actions} ${previewStyles.actions}`}>
          {!hiddenPages.includes('register') && (
            <Link href={`${previewBase}/register`} className="btn btn-primary btn-sm">
              Register
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
