import { cookies } from 'next/headers';
import { BookOpen, FileText, Shield, AlertCircle, CheckCircle, Download, ExternalLink } from 'lucide-react';
import { getOrganizationBySlug, getTournamentBySlug, getRules, getResources, getAgeGroups } from '@/lib/db';
import DivisionFilterBar from '@/components/DivisionFilterBar';
import styles from '../../rules/rules.module.css';

export const dynamic = 'force-dynamic';

const ICON_MAP: Record<string, any> = {
  Shield: Shield,
  BookOpen: BookOpen,
  AlertCircle: AlertCircle,
  CheckCircle: CheckCircle,
};

const FALLBACK_RULES = [
  {
    icon: 'Shield',
    title: 'General Tournament Rules',
    items: [
      { content: 'All games are governed by Softball Canada official rules unless otherwise specified.' },
      { content: 'Each team must provide 1 scorekeeper and 1 base umpire per game.' },
      { content: 'A minimum of 8 players are required to start a game; fewer than 8 results in a forfeit.' },
      { content: 'Teams must be ready to play 10 minutes before their scheduled game time.' },
      { content: 'A 10-run mercy rule applies after 4 innings (3.5 innings if home team is ahead).' },
      { content: 'Games are 6 innings or 90 minutes maximum. No new inning starts after time expires.' },
      { content: 'Protests must be filed with the tournament director before the end of the disputed game.' },
    ],
  },
  {
    icon: 'BookOpen',
    title: 'Eligibility & Age Divisions',
    items: [
      { content: 'Players must meet the age requirement for their division as of January 1st of the tournament year.' },
      { content: 'U11: Ages 9–11 | U13: Ages 11–13 | U15: Ages 13–15 | U17: Ages 15–17 | U19: Ages 17–19' },
      { content: 'Each player may only be registered on one team per division.' },
      { content: 'Proof of age (birth certificate or government ID) may be requested at any time.' },
      { content: 'Player callups from lower divisions require tournament director approval.' },
      { content: 'Overage players are not permitted under any circumstances.' },
    ],
  },
  {
    icon: 'AlertCircle',
    title: 'Code of Conduct',
    items: [
      { content: 'Respect for all players, coaches, umpires, and spectators is mandatory.' },
      { content: 'Any player, coach, or spectator ejected from a game may not return to the facility that day.' },
      { content: 'Aggressive or threatening behaviour will result in immediate removal from the tournament.' },
      { content: 'Consumption of alcohol or use of tobacco/cannabis is strictly prohibited in the playing area.' },
      { content: 'All disputes must be handled through official channels — no confrontations with umpires.' },
      { content: 'Coaches are responsible for the behaviour of their players and spectators.' },
    ],
  },
  {
    icon: 'CheckCircle',
    title: 'Equipment & Uniforms',
    items: [
      { content: 'All bats must be certified for play under current Softball Canada regulations.' },
      { content: 'Players must wear matching team uniforms with visible numbers.' },
      { content: 'Helmets with face guards are mandatory for all batters and base runners.' },
      { content: 'Catchers must wear full protective equipment (helmet, chest protector, shin guards).' },
      { content: 'Cleats with metal spikes are NOT permitted for U11 and U13 divisions.' },
      { content: 'Teams must supply their own game balls — one new ball per game minimum.' },
    ],
  },
];

const FALLBACK_RESOURCES = [
  { label: 'Softball Canada Official Rules (PDF)', url: 'https://www.softball.ca/en/rules' },
  { label: 'Tournament Bracket Format', url: '#' },
  { label: 'Field Map & Directions', url: '#' },
  { label: 'Player Registration Form', url: '#' },
  { label: 'Medical Waiver Form', url: '#' },
];

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
  const tournament = org ? await getTournamentBySlug(org.id, tournamentSlug) : null;

  let allRules: any[] = [];
  let resources: any[] = [];
  let ageGroups: any[] = [];

  if (tournament) {
    [allRules, resources, ageGroups] = await Promise.all([
      getRules(tournament.id),
      getResources(tournament.id),
      getAgeGroups(tournament.id),
    ]);
  }

  const preferredGroup = prefName ? ageGroups.find((g: any) => g.name === prefName) : null;
  const hasTaggedContent = allRules.some((r: any) => r.ageGroupIds?.length);
  const isFiltering = !!preferredGroup && view !== 'all' && hasTaggedContent;

  const displayRules = allRules.length > 0
    ? (isFiltering
        ? allRules.filter((r: any) => !r.ageGroupIds?.length || r.ageGroupIds.includes(preferredGroup!.id))
        : allRules)
    : FALLBACK_RULES;

  const displayResources = resources.length > 0 ? resources : FALLBACK_RESOURCES;

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
            {displayRules.map((section: any) => {
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
                    {section.items.map((item: any, i: number) => (
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

          <div className={`card ${styles.resourcesCard}`}>
            <div className={styles.ruleCardHeader}>
              <div className={styles.ruleIcon}>
                <FileText size={20} />
              </div>
              <h2 className={styles.ruleTitle}>Downloads & Resources</h2>
            </div>
            <div className={styles.resourcesList} style={{ marginTop: '1.5rem' }}>
              {displayResources.map((r: any) => {
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

          <div className={`card ${styles.disclaimerCard}`}>
            <p>
              <strong>Note:</strong> These rules are subject to change at the discretion of the tournament
              director. Updates will be posted on the News & Announcements page. For questions or
              clarifications, contact the tournament office at <a href="mailto:info@b2cowan.com">info@b2cowan.com</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
