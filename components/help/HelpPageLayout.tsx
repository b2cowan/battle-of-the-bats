import type { HelpSection } from '@/lib/help-content';
import styles from './help.module.css';

interface HelpPageLayoutProps {
  title: string;
  role: string;
  intro: string;
  sections: HelpSection[];
}

export default function HelpPageLayout({ title, role, intro, sections }: HelpPageLayoutProps) {
  return (
    <div className={styles.helpPage}>
      <div className={styles.helpPageHeader}>
        <h1 className={styles.helpPageTitle}>{title}</h1>
        <span className={styles.helpRoleBadge}>For: {role}</span>
      </div>
      <p className={styles.helpIntro}>{intro}</p>
      <div className={styles.helpSections}>
        {sections.map((section, i) => (
          <section key={i} className={styles.helpSection}>
            <h2 className={styles.helpSectionHeading}>{section.heading}</h2>
            <div className={styles.helpSectionContent}>{section.content}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
