'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { HelpSection } from '@/lib/help-content';
import { resolveFaqId, resolveSubtopicId } from '@/lib/help-content';
import styles from './help.module.css';

/**
 * One accordion row — shared by the FAQ list and the drawer's sub-topic list so
 * the two <details> treatments cannot drift: both wear the FAQ item's chrome
 * (including its 44px summary tap floor), and a style fix lands once. Stays
 * UNCONTROLLED — `defaultOpen` is initial state only, so reader toggles survive
 * re-renders. Exported for HelpPageLayout's page-level FAQ list — the third
 * consumer of the same chrome.
 */
export function HelpAccordionItem({
  id,
  title,
  bodyClassName,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: ReactNode;
  bodyClassName: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} className={styles.helpFaqItem} open={defaultOpen ? true : undefined}>
      <summary><span>{title}</span></summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  );
}

/**
 * Renders ONE whole help section — heading, summary, links, body, sub-topics as
 * an "In this topic" expander list, and its FAQ accordion.
 *
 * This is the IN-CONTEXT "?" DRAWER's renderer. The full guide used to share it,
 * but since the article model landed (2026-08-14) the guide renders one article
 * at a time — an answer alone, or a topic's overview plus a list of its answers —
 * so it owns its own chrome in HelpPageLayout. Both still render the SAME content
 * ReactNodes from `lib/help-content`, which is where drift would actually hurt.
 *
 * Sub-topics render as uncontrolled <details> expanders (the FAQ pattern), so
 * reader toggles survive re-renders. Only the FIRST may start open, and only when
 * the caller says the drawer shows a single section (a multi-section drawer opens
 * fully collapsed to stay short). FAQ <details> stay uncontrolled for the same
 * reason. A section without sub-topics renders exactly as it always has.
 */
export default function HelpSectionBlock({
  section,
  sectionId,
  headingLevel = 3,
  defaultOpenFirstSubtopic = false,
  defaultOpenSubtopicId,
}: {
  section: HelpSection;
  sectionId: string;
  headingLevel?: 3 | 4;
  defaultOpenFirstSubtopic?: boolean;
  /** Open THIS sub-topic pre-expanded (the page's own answer). When it names a
   *  sub-topic of this section it beats defaultOpenFirstSubtopic. */
  defaultOpenSubtopicId?: string;
}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const faqs = section.faqs ?? [];
  const subtopics = section.subtopics ?? [];
  const subtopicIds = subtopics.map((topic, i) => resolveSubtopicId(sectionId, topic, i));
  // The page's own answer wins; "first" is only the fallback when no (or an
  // unknown) target was requested.
  const targetedOpenIndex = defaultOpenSubtopicId ? subtopicIds.indexOf(defaultOpenSubtopicId) : -1;
  const isDefaultOpen = (i: number) => (
    targetedOpenIndex >= 0 ? i === targetedOpenIndex : (defaultOpenFirstSubtopic && i === 0)
  );

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

      {subtopics.length > 0 && (
        <div className={styles.helpSubtopicList}>
          <p className={styles.helpSubtopicLabel}>In this topic</p>
          {subtopics.map((topic, i) => (
            <HelpAccordionItem
              key={subtopicIds[i]}
              id={subtopicIds[i]}
              title={topic.title}
              bodyClassName={`${styles.helpSectionContent} ${styles.helpSubtopicBody}`}
              defaultOpen={isDefaultOpen(i)}
            >
              {topic.content}
            </HelpAccordionItem>
          ))}
        </div>
      )}

      {faqs.length > 0 && (
        <div className={styles.helpFaqList}>
          {faqs.map((faq, i) => {
            const id = resolveFaqId(sectionId, faq, i);
            return (
              <HelpAccordionItem key={id} id={id} title={faq.question} bodyClassName={styles.helpFaqAnswer}>
                {faq.answer}
              </HelpAccordionItem>
            );
          })}
        </div>
      )}
    </>
  );
}
