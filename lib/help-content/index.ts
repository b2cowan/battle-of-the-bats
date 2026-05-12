import type { ReactNode } from 'react';

export interface HelpSection {
  heading: string;
  content: ReactNode;
}

export interface HelpPageContent {
  title: string;
  role: string;
  intro: string;
  sections: HelpSection[];
}

export interface HelpCalloutContent {
  variant: 'info' | 'tip' | 'warning';
  title: string;
  body: string;
  cta?: { label: string; href: string };
}
