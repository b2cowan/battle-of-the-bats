import Link from 'next/link';
import type { Organization } from '@/lib/types';
import styles from '@/components/Navbar.module.css';

type TournamentPreviewNavProps = {
  org: Organization;
  orgSlug: string;
  tournamentName: string;
};

export default function TournamentPreviewNav({
  org,
  orgSlug,
  tournamentName,
}: TournamentPreviewNavProps) {
  const adminBase = `/${orgSlug}/admin/tournaments`;
  const links = [
    { href: '#preview-home', label: 'Home' },
    { href: '#announcements', label: 'News' },
    { href: '#schedule', label: 'Schedule' },
    { href: `${adminBase}/results`, label: 'Standings' },
    { href: `${adminBase}/teams`, label: 'Teams' },
    { href: `${adminBase}/rules`, label: 'Rules' },
  ];

  return (
    <nav className={`${styles.nav} ${styles.scrolled}`} aria-label="Tournament preview navigation">
      <div className={`container ${styles.inner}`}>
        <Link href="#preview-home" className={styles.logo}>
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

        <div className={styles.links}>
          {links.map(link => (
            <Link key={link.label} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </div>

        <div className={styles.actions}>
          <Link href={`${adminBase}/registrations`} className="btn btn-primary btn-sm">
            Registration
          </Link>
        </div>
      </div>
    </nav>
  );
}
