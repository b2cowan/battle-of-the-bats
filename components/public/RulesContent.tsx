import { BookOpen, FileText, Shield, AlertCircle, CheckCircle, Download, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Division, Resource, RuleSection } from '@/lib/types';
import DivisionFilterBar from '@/components/DivisionFilterBar';
import PublicTournamentState from '@/components/public/PublicTournamentState';
import styles from '@/app/[orgSlug]/rules/rules.module.css';

const ICON_MAP: Record<string, LucideIcon> = {
  Shield: Shield,
  BookOpen: BookOpen,
  AlertCircle: AlertCircle,
  CheckCircle: CheckCircle,
};

type RulesContentProps = {
  orgSlug: string;
  tournamentSlug: string;
  pageEnabled: boolean;
  rules: RuleSection[];
  resources: Resource[];
  divisions: Division[];
  /** Visitor's saved division preference (cookie). Null in the admin preview. */
  prefName: string | null;
  /** `?view=all` escape hatch from the division filter. */
  view?: string;
  contactEmail: string | null;
  rulesLayout: 'columns' | 'single';
  resourcesLayout: 'list' | 'grid';
};

/**
 * Shared Rules & Resources renderer used by BOTH the live public route
 * (app/[orgSlug]/[tournamentSlug]/rules) and the admin tournament preview, so the
 * two render identically. Pure/presentational — callers fetch the data.
 */
export default function RulesContent({
  orgSlug,
  tournamentSlug,
  pageEnabled,
  rules: allRules,
  resources,
  divisions,
  prefName,
  view,
  contactEmail,
  rulesLayout,
  resourcesLayout,
}: RulesContentProps) {
  if (!pageEnabled) {
    return (
      <div className="page-content">
        <div className="section">
          <div className="container">
            <PublicTournamentState
              icon={<BookOpen size={40} />}
              eyebrow="Rules"
              title="Rules unavailable"
              description="The organizer has hidden public rules and resources for this tournament."
              contactEmail={contactEmail}
            />
          </div>
        </div>
      </div>
    );
  }

  const hasRules     = allRules.length > 0;
  const hasResources = resources.length > 0;
  const hasContent   = hasRules || hasResources;

  const preferredGroup = prefName ? divisions.find(g => g.name === prefName) : null;
  const hasTaggedContent = allRules.some(r => r.divisionIds?.length);
  const isFiltering = !!preferredGroup && view !== 'all' && hasTaggedContent;

  const displayRules = isFiltering
    ? allRules.filter(r => !r.divisionIds?.length || r.divisionIds.includes(preferredGroup!.id))
    : allRules;

  return (
    <div className="page-content">
      <div className="public-page-header">
        <div className="container">
          <span className="eyebrow"><BookOpen size={12} /> Rules & Resources</span>
          <h1>Tournament Rules</h1>
          <p className="text-muted">
            Official rules, conduct guidelines, and resources for the tournament. All participants
            are expected to have read and understood these rules before game day.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          {!hasContent && (
            <PublicTournamentState
              icon={<BookOpen size={40} />}
              eyebrow="Rules"
              title="Rules coming soon"
              description="Rules and resources have not been published yet. Check back before game day."
              contactEmail={contactEmail}
            />
          )}

          {hasRules && (
            <>
              {hasTaggedContent && prefName && divisions.length > 0 && (
                <DivisionFilterBar
                  orgSlug={orgSlug}
                  divisions={divisions}
                  activeName={prefName}
                  isFiltering={isFiltering}
                  viewAllHref={`/${orgSlug}/${tournamentSlug}/rules?view=all`}
                  backHref={`/${orgSlug}/${tournamentSlug}/rules`}
                />
              )}

              <div className={`${styles.rulesGrid}${rulesLayout === 'single' ? ` ${styles.rulesGridSingle}` : ''}`}>
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
            </>
          )}

          {hasResources && (
            <div className={`card ${styles.resourcesCard}`}>
              <div className={styles.ruleCardHeader}>
                <div className={styles.ruleIcon}>
                  <FileText size={20} />
                </div>
                <h2 className={styles.ruleTitle}>Downloads &amp; Resources</h2>
              </div>
              <div className={`${styles.resourcesList}${resourcesLayout === 'grid' ? ` ${styles.resourcesGrid}` : ''}`} style={{ marginTop: '1.5rem' }}>
                {resources.map(r => {
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

          {hasContent && (
            <div className={`card ${styles.disclaimerCard}`}>
              <p>
                <strong>Note:</strong> These rules are subject to change at the discretion of the tournament
                director. Updates will be posted on the News &amp; Announcements page.
                {contactEmail && (
                  <> For questions or clarifications, contact the tournament office at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</>
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
