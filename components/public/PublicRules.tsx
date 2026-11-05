import { BookOpen } from 'lucide-react';
import type { Division, Resource, RuleSection } from '@/lib/types';
import { orgLinks } from '@/lib/org-links';
import DivisionFilterBar from '@/components/DivisionFilterBar';
import PublicTournamentState from './PublicTournamentState';
import PublicRuleSections from './PublicRuleSections';
import PublicPage from './PublicPage';
import styles from './PublicRules.module.css';

/** The Rules body, live and in the admin preview (the old RulesContent was deleted in Stage 8 Part 3a). */
export default async function PublicRules({
  orgSlug, tournamentSlug, pageEnabled, rules, resources, divisions, prefName, view, contactEmail, isPreview = false,
}: {
  orgSlug: string; tournamentSlug: string; pageEnabled: boolean;
  rules: RuleSection[]; resources: Resource[]; divisions: Division[];
  prefName: string | null; view?: string; contactEmail: string | null; isPreview?: boolean;
}) {
  if (!pageEnabled || (rules.length === 0 && resources.length === 0)) {
    return <PublicPage>
      <PublicTournamentState icon={<BookOpen size={24} />} eyebrow="Rules"
        title={pageEnabled ? 'Rules coming soon' : 'Rules unavailable'}
        description={pageEnabled
          ? 'Rules and resources have not been published yet. Check back before game day.'
          : 'The organizer has hidden public rules and resources for this tournament.'}
        contactEmail={isPreview ? null : contactEmail} />
    </PublicPage>;
  }

  // Keep the existing saved-division preference; rules remain tournament-wide, with no schedule-publish gate (D1).
  const preferredGroup = prefName ? divisions.find(d => d.name === prefName) : null;
  const hasTaggedContent = rules.some(r => r.divisionIds?.length);
  const isFiltering = !!preferredGroup && view !== 'all' && hasTaggedContent;
  const displayRules = isFiltering
    ? rules.filter(r => !r.divisionIds?.length || r.divisionIds.includes(preferredGroup!.id))
    : rules;
  const href = await orgLinks(orgSlug);
  // The old title-derived anchors continue to work. Disambiguate repeated titles without changing the first link.
  const anchors = new Set<string>();
  const sectionAnchors = new Map<string, string>();
  for (const section of rules) {
    const base = `rule-${section.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
    let anchor = base;
    for (let suffix = 2; anchors.has(anchor); suffix++) anchor = `${base}-${suffix}`;
    anchors.add(anchor);
    sectionAnchors.set(section.id, anchor);
  }
  const sections = displayRules.map(section => ({
    anchor: sectionAnchors.get(section.id)!, title: section.title, icon: section.icon ?? null, items: section.items.map(item => item.content),
  }));

  return <PublicPage>
    <h1 className="sr-only">Tournament Rules</h1>
    <p className={styles.note}>These rules are subject to change at the discretion of the tournament director.
      {' '}Updates will be posted on the News &amp; Announcements page.
      {contactEmail && !isPreview && <> For questions or clarifications, contact the tournament office at{' '}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>}
    </p>
    {hasTaggedContent && prefName && divisions.length > 0 && !isPreview && <div className={styles.filter}>
      <DivisionFilterBar orgSlug={orgSlug} divisions={divisions.map(d => ({ id: d.id, name: d.name }))} activeName={prefName} isFiltering={isFiltering}
        viewAllHref={href(`/${tournamentSlug}/rules?view=all`)} backHref={href(`/${tournamentSlug}/rules`)} />
    </div>}
    <PublicRuleSections sections={sections} resources={resources.map(r => ({ label: r.label, url: r.url }))}
      isPreview={isPreview} shareAllDivisions={hasTaggedContent} />
  </PublicPage>;
}
