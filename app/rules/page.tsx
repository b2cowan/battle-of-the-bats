import { BookOpen, FileText, Shield, AlertCircle, CheckCircle, Download } from 'lucide-react';
import type { Metadata } from 'next';
import styles from './rules.module.css';

export const metadata: Metadata = {
  title: 'Rules & Resources | Battle of the Bats',
  description: 'Tournament rules, code of conduct, and resources for the Battle of the Bats softball tournament.',
};

const RULES_SECTIONS = [
  {
    icon: Shield,
    title: 'General Tournament Rules',
    items: [
      'All games are governed by Softball Canada official rules unless otherwise specified.',
      'Each team must provide 1 scorekeeper and 1 base umpire per game.',
      'A minimum of 8 players are required to start a game; fewer than 8 results in a forfeit.',
      'Teams must be ready to play 10 minutes before their scheduled game time.',
      'A 10-run mercy rule applies after 4 innings (3.5 innings if home team is ahead).',
      'Games are 6 innings or 90 minutes maximum. No new inning starts after time expires.',
      'Protests must be filed with the tournament director before the end of the disputed game.',
    ],
  },
  {
    icon: BookOpen,
    title: 'Eligibility & Age Divisions',
    items: [
      'Players must meet the age requirement for their division as of January 1st of the tournament year.',
      'U11: Ages 9–11 | U13: Ages 11–13 | U15: Ages 13–15 | U17: Ages 15–17 | U19: Ages 17–19',
      'Each player may only be registered on one team per division.',
      'Proof of age (birth certificate or government ID) may be requested at any time.',
      'Player callups from lower divisions require tournament director approval.',
      'Overage players are not permitted under any circumstances.',
    ],
  },
  {
    icon: AlertCircle,
    title: 'Code of Conduct',
    items: [
      'Respect for all players, coaches, umpires, and spectators is mandatory.',
      'Any player, coach, or spectator ejected from a game may not return to the facility that day.',
      'Aggressive or threatening behaviour will result in immediate removal from the tournament.',
      'Consumption of alcohol or use of tobacco/cannabis is strictly prohibited in the playing area.',
      'All disputes must be handled through official channels — no confrontations with umpires.',
      'Coaches are responsible for the behaviour of their players and spectators.',
    ],
  },
  {
    icon: CheckCircle,
    title: 'Equipment & Uniforms',
    items: [
      'All bats must be certified for play under current Softball Canada regulations.',
      'Players must wear matching team uniforms with visible numbers.',
      'Helmets with face guards are mandatory for all batters and base runners.',
      'Catchers must wear full protective equipment (helmet, chest protector, shin guards).',
      'Cleats with metal spikes are NOT permitted for U11 and U13 divisions.',
      'Teams must supply their own game balls — one new ball per game minimum.',
    ],
  },
];

const RESOURCES = [
  { label: 'Softball Canada Official Rules (PDF)', href: 'https://www.softball.ca/en/rules' },
  { label: 'Tournament Bracket Format', href: '#' },
  { label: 'Field Map & Directions', href: '#' },
  { label: 'Player Registration Form', href: '#' },
  { label: 'Medical Waiver Form', href: '#' },
];

export default function RulesPage() {
  return (
    <div className="page-content">
      <div className={styles.pageHeader}>
        <div className="container">
          <span className="eyebrow"><BookOpen size={12} /> Rules & Resources</span>
          <h1 className="display-lg">Tournament Rules</h1>
          <p className="text-muted">
            Official rules, conduct guidelines, and resources for the Battle of the Bats. All participants
            are expected to have read and understood these rules before game day.
          </p>
        </div>
      </div>

      <div className="section">
        <div className="container">
          <div className={styles.rulesGrid}>
            {RULES_SECTIONS.map(section => (
              <div key={section.title} className={`card ${styles.ruleCard}`}>
                <div className={styles.ruleCardHeader}>
                  <div className={styles.ruleIcon}>
                    <section.icon size={20} />
                  </div>
                  <h2 className={styles.ruleTitle}>{section.title}</h2>
                </div>
                <ul className={styles.ruleList}>
                  {section.items.map((item, i) => (
                    <li key={i} className={styles.ruleItem}>
                      <span className={styles.ruleBullet} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Resources */}
          <div className={`card ${styles.resourcesCard}`}>
            <div className={styles.ruleCardHeader}>
              <div className={styles.ruleIcon}>
                <FileText size={20} />
              </div>
              <h2 className={styles.ruleTitle}>Downloads & Resources</h2>
            </div>
            <div className={styles.resourcesList}>
              {RESOURCES.map(r => (
                <a
                  key={r.label}
                  href={r.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.resourceItem}
                >
                  <Download size={14} />
                  {r.label}
                </a>
              ))}
            </div>
          </div>

          <div className={`card ${styles.disclaimerCard}`}>
            <p>
              <strong>Note:</strong> These rules are subject to change at the discretion of the tournament
              director. Updates will be posted on the News & Announcements page. For questions or
              clarifications, contact the tournament office at <a href="mailto:info@miltonbats.ca">info@miltonbats.ca</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
