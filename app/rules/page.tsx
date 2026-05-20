import { BookOpen, FileText, Shield, AlertCircle, CheckCircle, Download, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTournaments, getRules, getResources } from '@/lib/db';
import type { Resource, RuleSection } from '@/lib/types';
import styles from './rules.module.css';

export const metadata: Metadata = {
  title: 'Rules & Resources | FieldLogicHQ',
  description: 'Tournament rules, code of conduct, and resources.',
};

type DisplayRuleSection = Pick<RuleSection, 'title' | 'icon'> & {
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
    icon: 'Shield',
    title: 'General Tournament Rules',
    items: [
      { content: 'Tournament-specific rules should be reviewed and published before the event goes live.' },
      { content: 'Teams must be ready to play before their scheduled game time.' },
      { content: 'Final eligibility, roster, scoring, and protest rules are set by the tournament organizer.' },
    ],
  },
  {
    icon: 'BookOpen',
    title: 'Eligibility & Divisions',
    items: [
      { content: 'Division eligibility should be confirmed by the tournament organizer.' },
      { content: 'Roster limits, player eligibility, and team documentation requirements should be published before registration opens.' },
    ],
  },
  {
    icon: 'AlertCircle',
    title: 'Code of Conduct',
    items: [
      { content: 'Respect for all players, coaches, umpires, and spectators is mandatory.' },
      { content: 'Any player, coach, or spectator ejected from a game may not return to the facility that day.' },
      { content: 'Aggressive or threatening behaviour will result in immediate removal from the tournament.' },
      { content: 'All disputes must be handled through official channels.' },
      { content: 'Coaches are responsible for the behaviour of their players and spectators.' },
    ],
  },
  {
    icon: 'CheckCircle',
    title: 'Equipment & Uniforms',
    items: [
      { content: 'Teams are responsible for meeting equipment requirements set by the tournament organizer.' },
      { content: 'Uniform and identification requirements should be published before the event.' },
    ],
  },
];

const FALLBACK_RESOURCES: DisplayResource[] = [
  { label: 'Tournament Rules', url: '#' },
  { label: 'Venue Map & Directions', url: '#' },
  { label: 'Registration Requirements', url: '#' },
];

export default async function RulesPage() {
  const tournaments = await getTournaments();
  const active = tournaments.find(t => t.isActive) || tournaments[0];
  
  let rules: RuleSection[] = [];
  let resources: Resource[] = [];
  
  if (active) {
    rules = await getRules(active.id, { admin: true });
    resources = await getResources(active.id, { admin: true });
  }

  const displayRules = rules.length > 0 ? rules : FALLBACK_RULES;
  const displayResources = resources.length > 0 ? resources : FALLBACK_RESOURCES;

  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><BookOpen size={12} /> Rules & Resources</span>
          <h1 className="display-lg">Tournament Rules</h1>
          <p className="text-muted">
            Official rules, conduct guidelines, and resources for this tournament. All participants
            are expected to have read and understood these rules before game day.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
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

          {/* Resources */}
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
                // Force download only for Supabase files
                const downloadUrl = isSupabase ? `${r.url}?download=` : r.url;
                const isExternal = !isSupabase && r.url.startsWith('http');
                
                return (
                  <a
                    key={r.label}
                    href={downloadUrl}
                    download={isSupabase ? r.label : undefined}
                    target={isExternal ? "_blank" : undefined}
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

          <div className={`card ${styles.disclaimerCard}`}>
            <p>
              <strong>Note:</strong> These rules are subject to change at the discretion of the tournament
              director. Updates will be posted on the News & Announcements page. For questions or
              clarifications, contact the tournament organizer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
