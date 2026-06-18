'use client';

import Link from 'next/link';
import type { HelpSection } from '@/lib/help-content';
import { resolveFaqId } from '@/lib/help-content';
import styles from './help.module.css';

/**
 * Renders ONE help section's inner content — heading, summary, links, body, and
 * its FAQ accordion — exactly as the single-scroll guide does. Shared by
 * HelpPageLayout (the full guide) and HelpDrawer (the in-context "?" panel) so
 * the two presentations can never drift. The caller owns any wrapping <section>
 * element and its scroll-spy / anchor attributes.
 *
 * FAQ <details> stay UNCONTROLLED so the reader can toggle them freely without a
 * parent re-render snapping them shut (the deliberate Phase-1 behaviour).
 */
export default function HelpSectionBlock({
  section,
  sectionId,
  headingLevel = 3,
}: {
  section: HelpSection;
  sectionId: string;
  headingLevel?: 3 | 4;
}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const faqs = section.faqs ?? [];

  return (
    <>
      <Heading className={styles.helpTopicHeading}>{section.heading}</Heading>

      {section.summary && (
        <p className={styles.helpTopicSummary}>{section.summary}</p>
      )}

      {section.links && section.links.length > 0 && (
        <div className={styles.helpSectionLinks}>
          {section.links.map(link => (
            <Link key={link.href} href={link.href} className={styles.helpSectionLink}>
              {link.label}
            </Link>
          ))}
        </div>
      )}

      <div className={styles.helpSectionContent}>{section.content}</div>

      {faqs.length > 0 && (
        <div className={styles.helpFaqList}>
          {faqs.map((faq, i) => {
            const id = resolveFaqId(sectionId, faq, i);
            return (
              <details key={id} id={id} className={styles.helpFaqItem}>
                <summary>
                  <span>{faq.question}</span>
                </summary>
                <div className={styles.helpFaqAnswer}>{faq.answer}</div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
