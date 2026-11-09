import kit from '@/components/marketing/MarketingKit.module.css';
import { legalSections, sectionAnchor } from '@/lib/legal-sections';
import type { LegalDocKey } from '@/lib/legal-documents';
import { cn } from '@/lib/utils';
import {
  LEGAL_CONTENTS_LABEL, LEGAL_DRAFT_BANNER_BODY, LEGAL_DRAFT_BANNER_TITLE, LEGAL_READ_CURRENT, LEGAL_TITLES, PRIVACY_TITLE, TERMS_TITLE,
} from '@/lib/legal-words';
import LegalDocumentBody from './LegalDocumentBody';
import styles from './LegalPage.module.css';

/**
 * One legal page, as drawn (GST/HST Stage 6 step 6.2): the draft banner (the dev preview only), the title, one line under it, the
 * text, and a contents list beside it on a wide screen. A server component; the route decides what to show and passes it in.
 * The banner is keyed on `draft`, which a route sets only when the text came from the draft file — never from an environment name,
 * so it cannot show on production.
 */
export default function LegalPage({
  doc, markdown, dateLine, earlier, draft,
}: {
  doc: LegalDocKey;
  markdown: string;
  /** (4a) "Effective {date}", or the preview's blank-date line. Replaced by `earlier` on a version no longer current. */
  dateLine: React.ReactNode;
  /** (4b) The earlier-version line and the path of the current page. */
  earlier?: { text: string; currentHref: string } | null;
  draft: boolean;
}) {
  const sections = legalSections(markdown);
  const otherTitle = doc === 'terms' ? PRIVACY_TITLE : TERMS_TITLE;
  return (
    <div className={cn(kit.page, styles.wrap)}>
      <div className={cn('container', styles.layout)}>
        <article className={styles.prose}>
          {draft && (
            <p className={styles.draft} role="note">
              <strong>{LEGAL_DRAFT_BANNER_TITLE}</strong>
              {LEGAL_DRAFT_BANNER_BODY}
            </p>
          )}
          <header className={styles.head}>
            <h1 className={cn(kit.heading, styles.title)}>{LEGAL_TITLES[doc]}</h1>
            {earlier ? (
              <div className={styles.earlier}>
                {earlier.text}
                <a className={styles.currentLink} href={earlier.currentHref}>{LEGAL_READ_CURRENT}</a>
              </div>
            ) : (
              <p className={kit.small}>{dateLine}</p>
            )}
          </header>
          <div className={styles.text}>
            <LegalDocumentBody markdown={markdown} otherTitle={otherTitle} />
          </div>
        </article>
        {sections.length > 0 && (
          <nav className={styles.rail} aria-label={LEGAL_CONTENTS_LABEL}>
            <p className={styles.railCap}>{LEGAL_CONTENTS_LABEL}</p>
            <ol className={styles.railList}>
              {sections.map(s => (
                <li key={s.n}>
                  <a className={styles.railLink} href={`#${sectionAnchor(s.n)}`}>
                    <span className={styles.railNum}>{s.n}</span>
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
    </div>
  );
}
