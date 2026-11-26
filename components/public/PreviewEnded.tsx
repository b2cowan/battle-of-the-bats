import SystemScreen, { SystemAction } from '@/components/shared/SystemScreen';
import NotFoundPageSync from '@/components/NotFoundPageSync';
import { ENDED_WORDS, type EndedPreview } from '@/lib/preview-ended';

/**
 * "This preview has ended" (Club Website Track P, Session P4; T12; drawing tab 7): on a removed preview's own address, and
 * inline in the claim page's column (/design 2026-11-26: one page at both doors).
 *
 * Drawn on the platform's system-screen ground, the same family as "We can't find that page" it turns into after 90 days,
 * so the change reads as one page changing its words. No club bar, no logo, no colours (the club is gone, and /legal
 * finding 4: never the logo, the meeting or who made it). Its one button goes to Home, as the not-found page's does.
 */
export default function PreviewEnded({ ended, surface }: { ended: EndedPreview; surface?: 'inline' }) {
  return (
    <>
      {/* Only the club's address is a not-found page to the shell; the claim page keeps its own frame. */}
      {surface !== 'inline' && <NotFoundPageSync />}
      {/* The 404's own broken-link tile (/design 2026-11-26, as drawn): after 90 days only the words change. */}
      <SystemScreen surface={surface} icon="broken" eyebrow={ENDED_WORDS.eyebrow} title={ENDED_WORDS.title} notes={[ENDED_WORDS.help]}
        actions={<SystemAction kind="primary" href="/discover">{ENDED_WORDS.home}</SystemAction>}>
        {ENDED_WORDS.body(ended.name, ended.removedOn)}
      </SystemScreen>
    </>
  );
}
