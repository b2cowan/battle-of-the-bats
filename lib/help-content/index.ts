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
