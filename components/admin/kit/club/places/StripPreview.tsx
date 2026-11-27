'use client';
/**
 * The club site's closed-places strip, as families will see it, inside a staff window (S1–S3; the Close a place window's
 * preview and Reopen's "Your site still shows this:"). The club's own face, as its site wears it (the tryout preview's
 * rule), and the strip's own box, so the fold reads the same.
 */
import { ClosureStripBox } from '@/components/public/ClubClosureStrip';
import frameStyles from '@/components/public/ClubFrame.module.css';
import { useOrg } from '@/lib/org-context';
import { clubFace } from '@/lib/club-site';
import type { ClosureStrip } from '@/lib/club-notice';
import s from './ClosePlace.module.css';

export default function StripPreview({ strip, lead }: { strip: ClosureStrip; lead: string }) {
  const face = clubFace(useOrg().currentOrg?.themeFont);
  return (
    <>
      <p className={s.siteLead}>{lead}</p>
      <div className={`${frameStyles.tokens} ${s.preview}`} data-club-face={face}>
        <ClosureStripBox groups={strip.groups} smallLine={strip.smallLine} />
      </div>
    </>
  );
}
