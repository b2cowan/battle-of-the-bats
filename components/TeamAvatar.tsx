/**
 * TeamAvatar — a team's identity chip (C7). Shows the uploaded logo when present,
 * otherwise a deterministic colored monogram from `lib/team-color.ts`, so admin
 * lists share the exact identity the public site already uses. Pure/stateless.
 */

import { teamAvatarHue, teamInitials } from '@/lib/team-color';
import styles from './TeamAvatar.module.css';

export default function TeamAvatar({
  name,
  logoUrl,
  size = 26,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        className={styles.avatar}
        style={{ width: size, height: size, minWidth: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: `hsl(${teamAvatarHue(name)}, 58%, 38%)`,
        fontSize: Math.round(size * 0.4),
      }}
    >
      {teamInitials(name)}
    </span>
  );
}
