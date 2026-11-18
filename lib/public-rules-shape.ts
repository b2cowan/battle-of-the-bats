/**
 * lib/public-rules-shape.ts — WHAT THE PUBLIC RULES PAGE SHOWS, worked out once (Public tournament pages Stage 10).
 *
 * The page (`components/public/PublicRules.tsx`) and its printable copy (`app/[orgSlug]/[tournamentSlug]/rules/pdf`) both
 * read this, so the file can never print a section the page hides, or number one differently (build prompt, "the technical
 * choice"). Pure and browser-safe.
 *
 * ⚖ Rulings it carries (owner 2026-11-18):
 *  · A1 — the file prints what the page is showing: narrowed to a saved division, the untagged sections plus that
 *    division's; `?view=all` shows the whole book.
 *  · A2 + G2 — sections are numbered across the WHOLE PUBLISHED BOOK (what View all shows), in the organizer's order. A
 *    narrowed page keeps those numbers, so U11 may read 1, 2, 4 when 3 is U13's: "rule 4.2" is the same line on every copy.
 *    A section held back with its division's schedule is not in the book, so publishing that division renumbers what
 *    follows it — the same as the organizer moving a section.
 *  · A7 — downloads are never narrowed (the page never narrows them).
 *  · A9 — a division-kept section carries its division names ("U13 only"); only the file prints it.
 *
 * ⚠ Pass the FULL division list. The held-back test (`publicPosts`) ignores a tag that matches no division, so a list
 * already cut to published divisions would let a held-back division's section through.
 */
import { publicPosts } from './public-tournament-shape';
import type { Division, Resource, RuleSection } from './types';

/** The page's fixed note, word for word (A3): the page's note and the file's stamp print this one sentence. Kept here,
 *  not in the PDF kit, so the page reads it without pulling the kit into its bundle. */
export const RULES_SUBJECT_TO_CHANGE =
  'These rules are subject to change at the discretion of the tournament director. Updates will be posted on the News & Announcements page.';

export interface PublicRulesSection {
  /** The row's link anchor — the old title-derived anchors, a repeated title disambiguated without moving the first. */
  anchor: string;
  /** Its place in the published book, from 1 (G2). */
  number: number;
  title: string;
  icon: string | null;
  /** "U13 only" (the division names, joined) for a division-kept section, null for one every division sees (A9). */
  divisionLabel: string | null;
  items: string[];
}

export interface PublicRulesShape {
  /** The division the page is narrowed to, or null when it shows the whole book. */
  narrowedTo: Pick<Division, 'id' | 'name'> | null;
  /** Some section is kept to a division (so the picker and View all have something to do). */
  hasTaggedContent: boolean;
  /** The published divisions, in the organizer's order — the picker's list. */
  divisions: Pick<Division, 'id' | 'name'>[];
  /** The sections this visitor sees, in book order. */
  sections: PublicRulesSection[];
  resources: Pick<Resource, 'label' | 'url'>[];
}

/** The anchor every section has had since the page was built: `rule-` and the title's letters and digits. */
function baseAnchor(title: string): string {
  return `rule-${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

export function shapePublicRules({ rules, resources, allDivisions, prefName, view }: {
  rules: RuleSection[];
  resources: Resource[];
  /** Every division of the tournament, held-back ones included (see the header). */
  allDivisions: Division[];
  /** The saved division's NAME (the `fl_agpref_{org}` cookie), or null. */
  prefName: string | null;
  view?: string | null;
}): PublicRulesShape {
  const book = publicPosts(rules, allDivisions);
  const published = allDivisions.filter(d => d.scheduleVisibility === 'published');
  const hasTaggedContent = book.some(r => r.divisionIds?.length);
  const preferred = prefName ? published.find(d => d.name === prefName) ?? null : null;
  const narrowedTo = preferred && view !== 'all' && hasTaggedContent ? preferred : null;

  const anchors = new Set<string>();
  const sections: PublicRulesSection[] = [];
  book.forEach((section, index) => {
    const base = baseAnchor(section.title);
    let anchor = base;
    for (let suffix = 2; anchors.has(anchor); suffix++) anchor = `${base}-${suffix}`;
    anchors.add(anchor);
    const tags = section.divisionIds ?? [];
    // Today's page rule, kept: a tagged section that does not name the saved division is left out (a section whose only
    // tag is stale — a deleted division — included, as before).
    if (narrowedTo && tags.length > 0 && !tags.includes(narrowedTo.id)) return;
    // A stale tag names nothing. Names in the organizer's division order, not the tag order.
    const names = published.filter(d => tags.includes(d.id)).map(d => d.name);
    sections.push({
      anchor,
      number: index + 1,
      title: section.title,
      icon: section.icon ?? null,
      divisionLabel: names.length ? `${names.join(', ')} only` : null,
      items: section.items.map(item => item.content),
    });
  });

  return {
    narrowedTo: narrowedTo ? { id: narrowedTo.id, name: narrowedTo.name } : null,
    hasTaggedContent,
    divisions: published.map(d => ({ id: d.id, name: d.name })),
    sections,
    resources: resources.map(r => ({ label: r.label, url: r.url })),
  };
}
