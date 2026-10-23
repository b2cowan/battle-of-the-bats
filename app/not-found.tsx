import SystemScreen, { SystemAction } from '@/components/shared/SystemScreen';

/**
 * Root 404 — handles every unmatched URL app-wide, so it renders outside every shell. It follows the account's theme
 * through the family's own ground (warm for everyone, Dark only for a signed-in person who chose it). It reads no
 * session, so the page stays static: its one button goes to Home for everyone (The public face, warm: S5, Ask 1).
 */
export default function NotFound() {
  return (
    <SystemScreen icon="broken" eyebrow="404 · Page not found" title="We can’t find that page"
      actions={<SystemAction kind="primary" href="/discover">Go to Home</SystemAction>}>
      The link may be old, or the address may have a typo. Start from Home and look for it there.
    </SystemScreen>
  );
}
