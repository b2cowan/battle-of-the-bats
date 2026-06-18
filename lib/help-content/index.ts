import type { ReactNode } from 'react';

export interface HelpLink {
  label: string;
  href: string;
}

export interface HelpFaq {
  id?: string;
  question: string;
  answer: ReactNode;
  answerText?: string;
  group?: string;
  keywords?: string[];
  popular?: boolean;
}

export interface HelpSection {
  id?: string;
  group?: string;
  /** Optional second grouping level rendered as a sub-heading under the group.
   *  Sections without a subgroup render flat under their parent group.
   *  Guides that use no groups at all are unaffected. */
  subgroup?: string;
  heading: string;
  summary?: string;
  keywords?: string[];
  searchText?: string;
  links?: HelpLink[];
  faqs?: HelpFaq[];
  hideFromContents?: boolean;
  content: ReactNode;
}

export interface HelpPageContent {
  title: string;
  role: string;
  intro: string;
  searchPlaceholder?: string;
  sections: HelpSection[];
  faqs?: HelpFaq[];
}

export interface HelpCalloutContent {
  variant: 'info' | 'tip' | 'warning';
  title: string;
  body: string;
  cta?: { label: string; href: string };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Resolve a section's stable anchor id. This is the SINGLE source of truth used
 * by both the single-scroll guide layout and the in-context help drawer, so a
 * page's "?" drawer and a deep link into the guide always resolve to the same id.
 */
export function resolveSectionId(section: HelpSection, index: number): string {
  return section.id ?? `${slugify(section.heading) || 'section'}-${index + 1}`;
}

/** Resolve a section-attached FAQ's anchor id (shared by the guide + the drawer). */
export function resolveFaqId(sectionId: string, faq: HelpFaq, faqIndex: number): string {
  return faq.id ?? `${sectionId}-faq-${faqIndex + 1}`;
}
