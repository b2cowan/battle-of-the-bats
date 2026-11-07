import type { ReactNode } from 'react';
import TeamFrame from '@/components/admin/kit/club/TeamFrame';

/** Every page of one rep team. ⚖ A team is a place (Club Tier Stage 13i, A3): its one header and its five tabs. */
export default function TeamLayout({ children }: { children: ReactNode }) {
  return <TeamFrame>{children}</TeamFrame>;
}
