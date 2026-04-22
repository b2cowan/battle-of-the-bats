import Link from 'next/link';
import { Trophy, Mail, MapPin, Phone } from 'lucide-react';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.glow} />
      <div className="container">
        <div className={styles.grid}>
          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.logoRow}>
              <Trophy size={22} className={styles.trophy} />
              <span className={styles.name}>BATTLE OF THE BATS</span>
            </div>
            <p className={styles.tagline}>
              Hosted by the <strong>Milton Bats</strong>. A premier youth softball tournament
              featuring age groups from U11 to U19.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className={styles.colTitle}>Quick Links</h4>
            <ul className={styles.linkList}>
              {[
                { href: '/schedule', label: 'Schedule' },
                { href: '/results',  label: 'Results'  },
                { href: '/teams',    label: 'Teams'    },
                { href: '/rules',    label: 'Rules & Resources' },
                { href: '/news',     label: 'News & Announcements' },
              ].map(l => (
                <li key={l.href}><Link href={l.href} className={styles.link}>{l.label}</Link></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className={styles.colTitle}>Contact</h4>
            <ul className={styles.contactList}>
              <li><MapPin size={14} /> Milton, Ontario</li>
              <li><Mail size={14} /> info@miltonbats.ca</li>
              <li><Phone size={14} /> (905) 555-0123</li>
            </ul>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copy}>
            &copy; {new Date().getFullYear()} Milton Bats — Battle of the Bats. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
