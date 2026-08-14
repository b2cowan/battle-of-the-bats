'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { HelpSection } from '@/lib/help-content';
import { resolveFaqId, resolveSubtopicId } from '@/lib/help-content';
import { followHashLink } from './help-scroll';
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
 * Renders ONE help section's inner content — heading, summary, links, body,
 * sub-topics, and its FAQ accordion — exactly as the single-scroll guide does.
 * Shared by HelpPageLayout (the full guide) and HelpDrawer (the in-context "?"
 * panel) so the two presentations can never drift. The caller owns any wrapping
 * <section> element and its scroll-spy / anchor attributes.
 *
 * Sub-topics (scannable-format standard, 2026-08-14) render per presentation:
 *   - 'guide'  → a jump-chip row (3+ sub-topics), then anchored sub-headings.
 *     Chips are plain hash links — HelpPageLayout's hashchange handler owns the
 *     scroll, so deep links and chip clicks resolve identically.
 *   - 'drawer' → an "In this topic" list of <details> expanders (the FAQ pattern).
 *     They stay UNCONTROLLED so reader toggles survive re-renders; only the
 *     FIRST one may start open, and only when the caller says the drawer shows a
 *     single section (a multi-section drawer opens fully collapsed to stay short).
 *
 * FAQ <details> stay UNCONTROLLED for the same reason (the deliberate Phase-1
 * behaviour). A section without sub-topics renders exactly as it always has.
 */
export default function HelpSectionBlock({
  section,
  sectionId,
  headingLevel = 3,
  presentation = 'guide',
  defaultOpenFirstSubtopic = false,
  defaultOpenSubtopicId,
}: {
  section: HelpSection;
  sectionId: string;
  headingLevel?: 3 | 4;
  presentation?: 'guide' | 'drawer';
  defaultOpenFirstSubtopic?: boolean;
  /** Drawer: open THIS sub-topic pre-expanded (the page's own answer). When it
   *  names a sub-topic of this section it beats defaultOpenFirstSubtopic. */
  defaultOpenSubtopicId?: string;
}) {
  const Heading = headingLevel === 4 ? 'h4' : 'h3';
  const SubHeading = headingLevel === 4 ? 'h5' : 'h4';
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

      {/* Jump chips sit ABOVE the overview so a reader with one question never
          reads the intro first. Guide only; the drawer's expander list already
          is the jump surface. */}
      {presentation === 'guide' && subtopics.length >= 3 && (
        <nav className={styles.helpJumpChips} aria-label={`Jump within ${section.heading}`}>
          {subtopics.map((topic, i) => (
            <a
              key={subtopicIds[i]}
              href={`#${subtopicIds[i]}`}
              className={styles.helpJumpChip}
              onClick={event => followHashLink(event, subtopicIds[i])}
            >
              {topic.title}
            </a>
          ))}
        </nav>
      )}

      <div className={styles.helpSectionContent}>{section.content}</div>

      {subtopics.length > 0 && (
        presentation === 'drawer' ? (
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
        ) : (
          subtopics.map((topic, i) => (
            <section key={subtopicIds[i]} id={subtopicIds[i]} className={styles.helpSubtopicBlock}>
              <SubHeading className={styles.helpSubtopicHeading}>
                <span>{topic.title}</span>
                <a
                  href={`#${subtopicIds[i]}`}
                  className={styles.helpSubtopicAnchor}
                  aria-label={`Link to ${topic.title}`}
                  onClick={event => followHashLink(event, subtopicIds[i])}
                >
                  #
                </a>
              </SubHeading>
              <div className={styles.helpSectionContent}>{topic.content}</div>
            </section>
          ))
        )
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
