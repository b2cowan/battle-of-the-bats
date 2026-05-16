import { cookies } from 'next/headers';
import { BookOpen, FileText, Shield, AlertCircle, CheckCircle, Download, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getOrganizationBySlug, getPublicTournamentBySlug, getRules, getResources, getAgeGroups } from '@/lib/db';
import { notFound } from 'next/navigation';
import { isPublicPageEnabled } from '@/lib/public-pages';
import type { AgeGroup, Resource, RuleSection } from '@/lib/types';
import DivisionFilterBar from '@/components/DivisionFilterBar';
import styles from '../../rules/rules.module.css';

export const dynamic = 'force-dynamic';

type DisplayRuleSection = Pick<RuleSection, 'title' | 'icon' | 'ageGroupIds'> & {
  items: Array<{ content: string }>;
};
type DisplayResource = Pick<Resource, 'label' | 'url'>;

const ICON_MAP: Record<string, LucideIcon> = {
  Shield: Shield,
  BookOpen: BookOpen,
  AlertCircle: AlertCircle,
  CheckCircle: CheckCircle,
};

const FALLBACK_RULES: DisplayRuleSection[] = [
  {
    icon: 'BookOpen',
    title: 'Rules Coming Soon',
    items: [
      { content: 'The organizer has not published tournament rules yet. Please check back before game day.' },
    ],
  },
];

const FALLBACK_RESOURCES: DisplayResource[] = [];

export default async function RulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string; tournamentSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { orgSlug, tournamentSlug } = await params;
  const { view } = await searchParams;

  const cookieStore = await cookies();
  const prefName = cookieStore.get(`fl_agpref_${orgSlug}`)?.value ?? null;

  const org = await getOrganizationBySlug(orgSlug);
  const tournament = org ? await getPublicTournamentBySlug(org.id, tournamentSlug) : null;
  if (!tournament || !isPublicPageEnabled(tournament, 'rules')) notFound();

  let allRules: RuleSection[] = [];
  let resources: Resource[] = [];
  let ageGroups: AgeGroup[] = [];

  if (tournament) {
    [allRules, resources, ageGroups] = await Promise.all([
      getRules(tournament.id),
      getResources(tournament.id),
      getAgeGroups(tournament.id),
    ]);
  }

  const preferredGroup = prefName ? ageGroups.find(g => g.name === prefName) : null;
  const hasTaggedContent = allRules.some(r => r.ageGroupIds?.length);
  const isFiltering = !!preferredGroup && view !== 'all' && hasTaggedContent;

  const displayRules = allRules.length > 0
    ? (isFiltering
        ? allRules.filter(r => !r.ageGroupIds?.length || r.ageGroupIds.includes(preferredGroup!.id))
        : allRules)
    : FALLBACK_RULES;

  const displayResources = resources.length > 0 ? resources : FALLBACK_RESOURCES;
  const contactEmail = tournament?.contactEmail ?? org?.contactEmail ?? null;

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><BookOpen size={12} /> Rules & Resources</span>
          <h1 className="display-lg">Tournament Rules</h1>
          <p className="text-muted">
            Official rules, conduct guidelines, and resources for the tournament. All participants
            are expected to have read and understood these rules before game day.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {hasTaggedContent && prefName && ageGroups.length > 0 && (
            <DivisionFilterBar
              orgSlug={orgSlug}
              ageGroups={ageGroups}
              activeName={prefName}
              isFiltering={isFiltering}
              viewAllHref={`/${orgSlug}/${tournamentSlug}/rules?view=all`}
              backHref={`/${orgSlug}/${tournamentSlug}/rules`}
            />
          )}

          <div className={styles.rulesGrid}>
            {displayRules.map(section => {
              const Icon = ICON_MAP[section.icon || 'Shield'] || Shield;
              return (
                <div key={section.title} className={`card ${styles.ruleCard}`}>
                  <div className={styles.ruleCardHeader}>
                    <div className={styles.ruleIcon}>
                      <Icon size={20} />
                    </div>
                    <h2 className={styles.ruleTitle}>{section.title}</h2>
                  </div>
                  <ul className={styles.ruleList}>
                    {section.items.map((item, i) => (
                      <li key={i} className={styles.ruleItem}>
                        <span className={styles.ruleBullet} />
                        {item.content}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {displayResources.length > 0 && (
            <div className={`card ${styles.resourcesCard}`}>
              <div className={styles.ruleCardHeader}>
                <div className={styles.ruleIcon}>
                  <FileText size={20} />
                </div>
                <h2 className={styles.ruleTitle}>Downloads & Resources</h2>
              </div>
              <div className={styles.resourcesList} style={{ marginTop: '1.5rem' }}>
                {displayResources.map(r => {
                  const isSupabase = r.url.includes('supabase.co');
                  const downloadUrl = isSupabase ? `${r.url}?download=` : r.url;
                  const isExternal = !isSupabase && r.url.startsWith('http');

                  return (
                    <a
                      key={r.label}
                      href={downloadUrl}
                      download={isSupabase ? r.label : undefined}
                      target={isExternal ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className={styles.resourceItem}
                    >
                      {isExternal ? <ExternalLink size={14} /> : <Download size={14} />}
                      {r.label}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`card ${styles.disclaimerCard}`}>
            <p>
              <strong>Note:</strong> These rules are subject to change at the discretion of the tournament
              director. Updates will be posted on the News & Announcements page.
              {contactEmail && (
                <> For questions or clarifications, contact the tournament office at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
