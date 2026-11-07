import Link from 'next/link';
import { Lock } from 'lucide-react';
import { NOT_YOURS_PAGES, NOT_YOURS_WORDS, notYoursWhoSentence, type NotYoursPage } from '@/lib/not-yours-words';
import type { OrgRole } from '@/lib/types';
import styles from './NotYours.module.css';

export type NotYoursScreenProps = {
  page: NotYoursPage;
  /** The page's name when it is not the words file's (a team workspace's "Staff & access"). */
  title?: string;
  ownerName: string | null;
  viewerRole: OrgRole | string | null;
  /** The person's own home (lib/member-home.ts); null only while the club is unknown. */
  home: { href: string; label: string } | null;
};

/**
 * ONE SCREEN FOR A PAGE THAT ISN'T THE PERSON'S (⚖ Club Tier Stage 13a, Ask 6 = A). What the page is, who opens it by
 * name, and a door back to the person's own home — never a silent return, never a one-line notice. Rendered in place of
 * the page's CONTENT, inside the admin frame, so the nav still shows. Server-safe (no hooks): a server layout renders it
 * directly; a client page renders it through `NotYours`, which reads the owner's name and the home.
 */
export function NotYoursScreen({ page, title, ownerName, viewerRole, home }: NotYoursScreenProps) {
  const words = NOT_YOURS_PAGES[page];
  const name = title ?? words.title;
  return (
    <div className={styles.page} data-not-yours={page}>
      <div className={styles.card}>
        <Lock size={22} aria-hidden />
        <p className={styles.eyebrow}>{name}</p>
        <h1 className={styles.title}>{NOT_YOURS_WORDS.heading(name)}</h1>
        <p className={styles.text}>{words.what} {notYoursWhoSentence(words.who, ownerName, viewerRole)}</p>
        {home && (
          <div className={styles.actions}>
            <Link href={home.href} className="btn btn-lime">{NOT_YOURS_WORDS.back(home.label)}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
