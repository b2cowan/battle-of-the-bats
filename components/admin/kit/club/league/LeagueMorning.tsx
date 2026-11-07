'use client';
/**
 * THIS MORNING for the league admin and the registrar, on the season page (Club Tier Stage 13b, A3; F-NAV-6). The tiles come
 * from `leagueMorning` (lib/league-morning.ts) for the person's own role (read here, so the season page keeps deciding its
 * controls through the access gate and never a role list); this only draws them, as the club Overview's "This morning" does: a door card
 * per tile, the figure large, one line under it. Nothing for anyone else (the owner and the admin have the club's own).
 */
import { useOrg } from '@/lib/org-context';
import { CoachDoorCard, CoachEyebrow, CoachFigure, kit } from '@/components/coaches/kit';
import { LEAGUE_MORNING_WORDS as W, leagueMorning, type LeagueMorningInput } from '@/lib/league-morning';
import ck from '../ClubKit.module.css';
import styles from './LeagueMorning.module.css';

export default function LeagueMorning({ input }: { input: Omit<LeagueMorningInput, 'role'> }) {
  const { userRole } = useOrg();
  const tiles = leagueMorning({ ...input, role: userRole });
  if (tiles.length === 0) return null;
  return (
    <section className={ck.section} aria-labelledby="league-morning">
      <div className={ck.sectionHead}>
        <span id="league-morning" className={kit.eye}>{W.title}</span>
      </div>
      <div className={styles.grid} style={{ '--n': tiles.length } as React.CSSProperties}>
        {tiles.map(t => (
          <CoachDoorCard key={t.key} href={t.href} className={styles.card}>
            <CoachEyebrow arrow>{t.label}</CoachEyebrow>
            <CoachFigure tone={t.quiet ? 'muted' : undefined}>{t.figure}</CoachFigure>
            <p className={kit.sub}>{t.sub}</p>
          </CoachDoorCard>
        ))}
      </div>
    </section>
  );
}
